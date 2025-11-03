from __future__ import annotations

from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.api.v1.schemas.allocations import AutoAllocateRequest, MyAllocationOut
from app.infra.db.models import (
    Allocation,
    Evaluation,
    User,
    RubricCriterion,
    Score,
    GroupMember,
    Group,
)

router = APIRouter(prefix="/allocations", tags=["allocations"])


# ---------------------------
# Helpers
# ---------------------------


def _get_eval_or_404(db: Session, evaluation_id: int) -> Evaluation:
    ev = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
    if not ev:
        raise HTTPException(404, "Evaluatie niet gevonden")
    return ev


def _ensure_allocation(
    db: Session,
    school_id: int,
    evaluation_id: int,
    reviewer_id: int,
    reviewee_id: int,
    is_self: bool,
) -> Allocation:
    """Zorgt dat (evaluation_id, reviewer_id, reviewee_id) bestaat; zet altijd school_id."""
    alloc = (
        db.query(Allocation)
        .filter(
            Allocation.evaluation_id == evaluation_id,
            Allocation.reviewer_id == reviewer_id,
            Allocation.reviewee_id == reviewee_id,
        )
        .first()
    )
    if not alloc:
        alloc = Allocation(
            school_id=school_id,
            evaluation_id=evaluation_id,
            reviewer_id=reviewer_id,
            reviewee_id=reviewee_id,
            is_self=is_self,
        )
        db.add(alloc)
    else:
        # Zorg dat school_id nooit NULL blijft (oude records of migraties)
        if getattr(alloc, "school_id", None) is None:
            alloc.school_id = school_id
        if is_self and not alloc.is_self:
            alloc.is_self = True
    return alloc


def _round_robin_k_peers(user_ids: List[int], k: int) -> List[Tuple[int, int]]:
    n = len(user_ids)
    pairs: List[Tuple[int, int]] = []
    if n < 2 or k <= 0:
        return pairs
    for i, reviewer in enumerate(user_ids):
        picks: List[int] = []
        step = 1
        while len(picks) < min(k, n - 1):
            ridx = (i + step) % n
            reviewee = user_ids[ridx]
            if reviewee != reviewer:
                picks.append(reviewee)
            step += 1
        for reviewee in picks:
            pairs.append((reviewer, reviewee))
    return pairs


def _select_members_for_course(
    db: Session,
    *,
    school_id: int,
    course_id: int,
    team_number: Optional[int] = None,
    group_ids: Optional[List[int]] = None,
) -> List[int]:
    """
    Selecteert alle ACTIEVE studenten die in deze course zitten via groups→group_members.
    Optioneel filter op team_number (User.team_number) of expliciete group_ids.
    """
    q = (
        db.query(User.id)
        .join(GroupMember, GroupMember.user_id == User.id)
        .join(Group, Group.id == GroupMember.group_id)
        .filter(
            User.school_id == school_id,
            User.role == "student",
            User.archived.is_(False),
            Group.school_id == school_id,
            Group.course_id == course_id,
        )
    )
    if team_number is not None:
        q = q.filter(User.team_number == team_number)
    if group_ids:
        q = q.filter(Group.id.in_(group_ids))

    # distinct voor het geval iemand per ongeluk in meerdere groups van dezelfde course zit
    return [uid for (uid,) in q.distinct().all()]


def _has_access_to_evaluation(db: Session, evaluation_id: int, user_id: int) -> bool:
    """Student heeft toegang als hij in de course van deze evaluatie zit (via membership) of al een allocation heeft."""
    has_alloc = (
        db.query(Allocation.id)
        .filter(
            Allocation.evaluation_id == evaluation_id, Allocation.reviewer_id == user_id
        )
        .limit(1)
        .scalar()
        is not None
    )
    if has_alloc:
        return True

    ev = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
    if not ev or not ev.course_id:
        return False

    is_member = (
        db.query(GroupMember.id)
        .join(Group, Group.id == GroupMember.group_id)
        .filter(Group.course_id == ev.course_id, GroupMember.user_id == user_id)
        .limit(1)
        .scalar()
        is not None
    )
    return is_member


def _fetch_allocation_rows(db: Session, evaluation_id: int, reviewer_id: int):
    """Helper to fetch allocation rows for a given reviewer and evaluation."""
    return (
        db.query(Allocation, User)
        .join(User, User.id == Allocation.reviewee_id)
        .filter(
            Allocation.evaluation_id == evaluation_id,
            Allocation.reviewer_id == reviewer_id,
        )
        .order_by(Allocation.is_self.desc(), User.name.asc())
        .all()
    )


# ---------------------------
# Routes
# ---------------------------


@router.post("/auto", status_code=status.HTTP_200_OK)
def auto_allocate(
    payload: AutoAllocateRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Auto-allocatie zonder aparte sync:
    - Bepaalt leden via groups → group_members voor evaluatie.course_id
    - Filter op team_number (User.team_number) of expliciet group_id(s)
    - include_self=True → self-alloc per student (wizard stap 1)
    - peers_per_student:
        - None of >= team_size-1 → iedereen beoordeelt alle peers (geen self) (wizard stap 2)
        - k → round-robin k peers per student (geen self)
    """
    ev = _get_eval_or_404(db, payload.evaluation_id)

    # Neem school_id van de evaluatie als die er is, anders van de aanroepende user (docent).
    school_id = getattr(ev, "school_id", None) or getattr(user, "school_id", None)
    if school_id is None:
        raise HTTPException(500, "school_id ontbreekt op evaluatie/gebruiker")

    # doelgroep bepalen
    target_group_ids: List[int] = []
    if payload.group_ids:
        target_group_ids = [gid for gid in payload.group_ids if gid is not None]
    elif payload.group_id:
        target_group_ids = [payload.group_id]

    members = _select_members_for_course(
        db,
        school_id=school_id,
        course_id=ev.course_id,
        team_number=payload.team_number,
        group_ids=target_group_ids or None,
    )

    print(
        f"[AUTO_ALLOC] eval={ev.id} course={ev.course_id} team={payload.team_number} "
        f"group_ids={target_group_ids or None} members={members}"
    )

    if len(members) == 0:
        raise HTTPException(400, "Geen teamleden gevonden voor deze selectie")
    if len(members) < 2 and (
        payload.peers_per_student is None or payload.peers_per_student > 0
    ):
        # bij peers heb je minimaal 2 nodig
        raise HTTPException(400, "Te weinig teamleden (minimaal 2)")

    # self
    if payload.include_self:
        for u in members:
            _ensure_allocation(db, school_id, ev.id, u, u, True)

    # peers
    n = len(members)
    if n >= 2:
        k = payload.peers_per_student
        if not k or k >= (n - 1):
            for r in members:
                for e in members:
                    if r != e:
                        _ensure_allocation(db, school_id, ev.id, r, e, False)
        else:
            for r, e in _round_robin_k_peers(members, int(k)):
                _ensure_allocation(db, school_id, ev.id, r, e, False)

    db.commit()
    return {
        "status": "ok",
        "evaluation_id": ev.id,
        "course_id": ev.course_id,
        "team_number": payload.team_number,
        "group_ids": target_group_ids or None,
        "members": members,
    }


@router.get("/my", response_model=List[MyAllocationOut])
def my_allocations(
    evaluation_id: int = Query(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Alle allocations voor de ingelogde student (als reviewer) binnen deze evaluatie.
    Als er nog geen self-allocation bestaat maar de student hoort bij de course,
    wordt de self-allocation aangemaakt.
    Ook worden peer-allocations automatisch aangemaakt voor alle teamgenoten.
    """
    ev = _get_eval_or_404(db, evaluation_id)

    rows = _fetch_allocation_rows(db, evaluation_id, user.id)

    has_self = any(alloc.is_self for alloc, _ in rows)
    has_access = _has_access_to_evaluation(db, evaluation_id, user.id)
    
    # Compute valid teammate IDs for filtering and creating allocations
    valid_teammate_ids = set()
    if has_access:
        school_id = getattr(ev, "school_id", None) or getattr(user, "school_id", None)
        if school_id is None:
            raise HTTPException(500, "school_id ontbreekt op evaluatie/gebruiker")
        
        # Find which Group(s) the user belongs to for this course and their team_number(s)
        user_groups = (
            db.query(Group.id, Group.team_number)
            .join(GroupMember, GroupMember.group_id == Group.id)
            .filter(
                GroupMember.user_id == user.id,
                Group.course_id == ev.course_id,
                Group.school_id == school_id,
            )
            .all()
        )
        
        if user_groups:
            # Get unique team numbers from user's groups (filter out None values)
            team_numbers = {team_num for _, team_num in user_groups if team_num is not None}
            
            if team_numbers:
                # Find all teammates in Groups with same course_id and same team_number(s)
                teammates = (
                    db.query(User.id)
                    .join(GroupMember, GroupMember.user_id == User.id)
                    .join(Group, Group.id == GroupMember.group_id)
                    .filter(
                        User.school_id == school_id,
                        User.role == "student",
                        User.archived.is_(False),
                        Group.school_id == school_id,
                        Group.course_id == ev.course_id,
                        Group.team_number.in_(team_numbers),
                    )
                    .distinct()
                    .all()
                )
                
                valid_teammate_ids = {uid for (uid,) in teammates}
        
        needs_commit = False
        
        # Create self-allocation if missing
        if not has_self:
            self_alloc = _ensure_allocation(
                db, school_id, evaluation_id, user.id, user.id, True
            )
            needs_commit = True
        
        # Create peer allocations for valid teammates not yet allocated
        if valid_teammate_ids:
            # Get existing peer allocation reviewee IDs to avoid duplicates
            existing_reviewee_ids = {alloc.reviewee_id for alloc, _ in rows if not alloc.is_self}
            
            # Create peer allocations for teammates not yet allocated
            for teammate_id in valid_teammate_ids:
                if teammate_id != user.id and teammate_id not in existing_reviewee_ids:
                    _ensure_allocation(
                        db, school_id, evaluation_id, user.id, teammate_id, False
                    )
                    needs_commit = True
        
        # Commit all changes and re-fetch if anything was created
        if needs_commit:
            db.commit()
            rows = _fetch_allocation_rows(db, evaluation_id, user.id)
    
    # Filter rows: keep self-allocation and peer allocations for valid teammates only
    # This filters out any old allocations that don't match the current team criteria
    filtered_rows = [
        (alloc, reviewee) for alloc, reviewee in rows
        if alloc.is_self or alloc.reviewee_id in valid_teammate_ids
    ]

    crit_ids: List[int] = [
        c.id
        for c in db.query(RubricCriterion)
        .filter(RubricCriterion.rubric_id == ev.rubric_id)
        .order_by(
            RubricCriterion.position.asc()
            if hasattr(RubricCriterion, "position")
            else RubricCriterion.id.asc()
        )
        .all()
    ]
    total_criteria = len(crit_ids)

    out: List[MyAllocationOut] = []
    for alloc, reviewee in filtered_rows:
        scored_count = (
            db.query(func.count(Score.id))
            .filter(Score.allocation_id == alloc.id)
            .scalar()
        ) or 0
        completed = total_criteria > 0 and scored_count >= total_criteria

        out.append(
            MyAllocationOut(
                allocation_id=alloc.id,
                evaluation_id=alloc.evaluation_id,
                reviewee_id=alloc.reviewee_id,
                reviewee_name=reviewee.name,
                reviewee_email=reviewee.email,
                is_self=alloc.is_self,
                rubric_id=ev.rubric_id,
                criterion_ids=crit_ids,
                completed=completed,
            )
        )
    return out
