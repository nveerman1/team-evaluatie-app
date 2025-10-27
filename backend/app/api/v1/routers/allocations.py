from __future__ import annotations

from typing import List, Dict, Optional, Tuple

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
    Group,  # verwacht (met evt. team_number, evt. evaluation_id)
)

router = APIRouter(prefix="/allocations", tags=["allocations"])


# =========================
# Helpers
# =========================


def _get_eval_or_404(db: Session, evaluation_id: int) -> Evaluation:
    ev = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    return ev


def _ensure_allocation(
    db: Session,
    evaluation_id: int,
    reviewer_id: int,
    reviewee_id: int,
    is_self: bool,
) -> Allocation:
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
            evaluation_id=evaluation_id,
            reviewer_id=reviewer_id,
            reviewee_id=reviewee_id,
            is_self=is_self,
        )
        db.add(alloc)
    else:
        # sync flag voor bestaande self-alloc (mocht deze wijzigen)
        if is_self and not alloc.is_self:
            alloc.is_self = True
    return alloc


def _round_robin_k_peers(user_ids: List[int], k: int) -> List[Tuple[int, int]]:
    """
    Voor elk user_id kiest dit k peers (geen self), rondlopend.
    """
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


def _infer_users_from_existing_allocations(
    db: Session, evaluation_id: int
) -> List[int]:
    ids = set()
    rows = (
        db.query(Allocation.reviewer_id, Allocation.reviewee_id)
        .filter(Allocation.evaluation_id == evaluation_id)
        .all()
    )
    for r, e in rows:
        ids.add(r)
        ids.add(e)
    return sorted(ids)


def _get_groups_for_allocation_request(
    db: Session, payload: AutoAllocateRequest, *, school_id: Optional[int] = None
) -> Dict[int, List[int]]:
    """
    Bepaalt per group_id de user_ids die we moeten alloceren.
    Voorrang:
      1) payload.group_ids / group_id
         - eerst via GroupMember
         - fallback: via User.team_id == group_id
      2) payload.team_number
         - als Group.team_number bestaat: map naar group_ids → GroupMember
         - anders (of leeg): fallback via User.team_number == payload.team_number
      3) Groepen met Group.evaluation_id == payload.evaluation_id (als kolom bestaat) → GroupMember
      4) Fallback: infer uit bestaande allocations en groepeer via GroupMember; anders 1 supergroep.
    school_id (tenant) wordt gebruikt om Users binnen dezelfde school te houden als de huidige gebruiker.
    """
    groups: Dict[int, List[int]] = {}

    # Helpers
    def users_by_team_id(team_id: int) -> List[int]:
        q = db.query(User.id)
        if school_id is not None and hasattr(User, "school_id"):
            q = q.filter(User.school_id == school_id)
        if hasattr(User, "team_id"):
            q = q.filter(User.team_id == team_id)
            return [r.id for r in q.all()]
        return []

    def users_by_team_number(team_number: int) -> List[int]:
        q = db.query(User.id)
        if school_id is not None and hasattr(User, "school_id"):
            q = q.filter(User.school_id == school_id)
        if hasattr(User, "team_number"):
            q = q.filter(User.team_number == team_number)
            return [r.id for r in q.all()]
        return []

    # 1) Expliciet meegegeven group_ids / group_id
    target_group_ids: List[int] = []
    if payload.group_ids:
        target_group_ids = list({gid for gid in payload.group_ids if gid is not None})
    elif payload.group_id:
        target_group_ids = [payload.group_id]

    if target_group_ids:
        rows = (
            db.query(GroupMember.group_id, GroupMember.user_id)
            .filter(GroupMember.group_id.in_(target_group_ids))
            .all()
        )
        if rows:
            for gid, uid in rows:
                groups.setdefault(gid, []).append(uid)
            return groups
        # Fallback: geen GroupMember records → Users met team_id == group_id
        fallback_users: List[int] = []
        for gid in target_group_ids:
            uids = users_by_team_id(gid)
            if uids:
                groups.setdefault(gid, []).extend(uids)
                fallback_users.extend(uids)
        if groups:
            return groups  # gegroepeerd op gid
        # anders val je door naar volgende strategieën

    # 2) team_number
    if payload.team_number is not None:
        # 2a) Als Group.team_number bestaat → vertaal naar groups en lees GroupMember
        if hasattr(Group, "team_number"):
            g_rows = (
                db.query(Group.id)
                .filter(Group.team_number == payload.team_number)
                .all()
            )
            g_ids = [g.id for g in g_rows]
            if g_ids:
                rows = (
                    db.query(GroupMember.group_id, GroupMember.user_id)
                    .filter(GroupMember.group_id.in_(g_ids))
                    .all()
                )
                if rows:
                    for gid, uid in rows:
                        groups.setdefault(gid, []).append(uid)
                    return groups
        # 2b) Fallback: Users met user.team_number == payload.team_number (zet alles in 1 virtuele groep)
        uids = users_by_team_number(payload.team_number)
        if uids:
            groups[-1] = uids  # -1 = virtuele groep
            return groups

    # 3) Groepen die expliciet aan evaluatie hangen (alleen als kolom bestaat)
    if hasattr(Group, "evaluation_id"):
        eg = (
            db.query(Group.id)
            .filter(Group.evaluation_id == payload.evaluation_id)
            .all()
        )
        eg_ids = [g.id for g in eg]
        if eg_ids:
            rows = (
                db.query(GroupMember.group_id, GroupMember.user_id)
                .filter(GroupMember.group_id.in_(eg_ids))
                .all()
            )
            if rows:
                for gid, uid in rows:
                    groups.setdefault(gid, []).append(uid)
                return groups

    # 4) Fallback: infer uit bestaande allocations/users, groepeer via GroupMember, anders 1 supergroep
    user_ids = set(_infer_users_from_existing_allocations(db, payload.evaluation_id))
    if user_ids:
        gm_rows = (
            db.query(GroupMember.group_id, GroupMember.user_id)
            .filter(GroupMember.user_id.in_(list(user_ids)))
            .all()
        )
        if gm_rows:
            for gid, uid in gm_rows:
                groups.setdefault(gid, []).append(uid)
        if not groups:
            # geen groupmember info → alles in 1 virtuele groep
            groups[-1] = sorted(user_ids)

    return groups


# =========================
# Routes
# =========================


@router.post("/auto", status_code=status.HTTP_200_OK)
def auto_allocate(
    payload: AutoAllocateRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Maakt allocations voor een evaluatie:
    - include_self=True → voegt self-alloc toe voor elke student
    - peers_per_student=None of >= team_size-1 → iedereen beoordeelt **alle** teamgenoten (geen self)
    - peers_per_student=k → round-robin toewijzing naar k peers per student (geen self)
    - targetgroep(en): group_id / group_ids / team_number (anders infer uit data)

    Autorisatie (optioneel strenger maken):
      - hier aanname: current_user mag dit omdat hij docent/admin/owner is.
    """
    ev = _get_eval_or_404(db, payload.evaluation_id)

    groups = _get_groups_for_allocation_request(
        db, payload, school_id=getattr(user, "school_id", None)
    )
    if not groups:
        raise HTTPException(
            status_code=400, detail="No groups/users found for this request"
        )

    created = 0

    for group_id, members in groups.items():
        user_ids = sorted(set(members))
        n = len(user_ids)
        if n == 0:
            continue

        # Self-allocaties
        if payload.include_self:
            for uid in user_ids:
                _ensure_allocation(db, ev.id, uid, uid, True)
                created += 1

        # Peer-allocaties
        if n >= 2:
            k = payload.peers_per_student
            if not k or k >= (n - 1):
                # Iedereen beoordeelt alle anderen (geen self)
                for reviewer in user_ids:
                    for reviewee in user_ids:
                        if reviewee != reviewer:
                            _ensure_allocation(db, ev.id, reviewer, reviewee, False)
                            created += 1
            else:
                # Round-robin naar k peers
                for reviewer, reviewee in _round_robin_k_peers(user_ids, k):
                    _ensure_allocation(db, ev.id, reviewer, reviewee, False)
                    created += 1

    db.commit()
    return {"status": "ok", "created_or_touched": created}


@router.get("/my", response_model=List[MyAllocationOut])
def my_allocations(
    evaluation_id: int = Query(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Alle allocations voor de ingelogde student (als reviewer) binnen deze evaluatie.
    Geeft per allocation een `completed`-vlag: True als alle criteria zijn gescoord.
    
    Als er nog geen self-allocation bestaat, wordt deze automatisch aangemaakt.
    """
    # 1) Evaluatie & rubric
    ev = _get_eval_or_404(db, evaluation_id)

    # 2) Alle allocations voor deze reviewer
    rows = (
        db.query(Allocation, User)
        .join(User, User.id == Allocation.reviewee_id)
        .filter(
            Allocation.evaluation_id == evaluation_id,
            Allocation.reviewer_id == user.id,
        )
        .order_by(Allocation.is_self.desc(), User.name.asc())
        .all()
    )
    
    # 2a) Als er geen self-allocation bestaat, maak deze aan
    has_self_alloc = any(alloc.is_self for alloc, _ in rows)
    if not has_self_alloc:
        # Ensure allocation has required field
        school_id = getattr(user, "school_id", None)
        if school_id is None:
            # Fallback: get school_id from evaluation
            school_id = ev.school_id if hasattr(ev, "school_id") else None
        
        if school_id is not None:
            self_alloc = _ensure_allocation(
                db, evaluation_id, user.id, user.id, is_self=True
            )
            if hasattr(self_alloc, "school_id") and self_alloc.school_id is None:
                self_alloc.school_id = school_id
            db.commit()
            db.refresh(self_alloc)
            
            # Add to rows
            rows = [(self_alloc, user)] + rows

    # 3) Criteria van deze evaluatie (op basis van rubric)
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

    # 4) completed = (#scores voor deze allocation) >= (#criteria)
    out: List[MyAllocationOut] = []
    total_criteria = len(crit_ids)

    for alloc, reviewee in rows:
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
