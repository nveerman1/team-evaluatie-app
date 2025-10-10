from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    Allocation,
    Evaluation,
    Group,
    GroupMember,
    User,
    RubricCriterion,
)

from app.api.v1.schemas.allocations import (
    AutoAllocateRequest,
    AllocationOut,
    MyAllocationOut,
)

router = APIRouter(prefix="/allocations", tags=["allocations"])


@router.post("/auto", response_model=dict, status_code=status.HTTP_201_CREATED)
def auto_allocate(
    payload: AutoAllocateRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    # 1) haal evaluation + course op binnen dezelfde school
    ev = (
        db.query(Evaluation)
        .filter(
            Evaluation.id == payload.evaluation_id,
            Evaluation.school_id == user.school_id,
        )
        .first()
    )
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    # 2) verzamel groepen van de course
    groups = (
        db.query(Group)
        .filter(Group.school_id == user.school_id, Group.course_id == ev.course_id)
        .all()
    )
    if not groups:
        return {"created": 0, "message": "No groups in course"}

    # 3) members per group
    members_by_group: dict[int, list[GroupMember]] = {}
    for g in groups:
        m = (
            db.query(GroupMember)
            .filter(
                GroupMember.school_id == user.school_id,
                GroupMember.group_id == g.id,
                GroupMember.active.is_(True),
            )
            .all()
        )
        if m:
            members_by_group[g.id] = m

    created = 0

    # helper: safe get-or-create allocation
    def ensure_alloc(reviewer_id: int, reviewee_id: int, is_self: bool):
        nonlocal created
        exists = (
            db.query(Allocation)
            .filter(
                Allocation.school_id == user.school_id,
                Allocation.evaluation_id == ev.id,
                Allocation.reviewer_id == reviewer_id,
                Allocation.reviewee_id == reviewee_id,
            )
            .first()
        )
        if exists:
            return
        db.add(
            Allocation(
                school_id=user.school_id,
                evaluation_id=ev.id,
                reviewer_id=reviewer_id,
                reviewee_id=reviewee_id,
                is_self=is_self,
            )
        )
        created += 1

    # 4) voor elke groep: self-allocations en round-robin peers
    for group_id, members in members_by_group.items():
        user_ids = [gm.user_id for gm in members]

        if payload.include_self:
            for uid in user_ids:
                ensure_alloc(uid, uid, True)

        k = payload.peers_per_student
        if k <= 0 or len(user_ids) < 2:
            continue

        # round-robin: voor i -> (i+1 .. i+k) mod n
        n = len(user_ids)
        for i, reviewer in enumerate(user_ids):
            picks: list[int] = []
            step = 1
            while len(picks) < min(k, n - 1):
                ridx = (i + step) % n
                reviewee = user_ids[ridx]
                if reviewee != reviewer:
                    picks.append(reviewee)
                step += 1
            for reviewee in picks:
                ensure_alloc(reviewer, reviewee, False)

    db.commit()
    return {"created": created}


@router.get("/my", response_model=list[MyAllocationOut])
def my_allocations(
    evaluation_id: int = Query(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    # lijst van allocations voor de huidige reviewer in deze evaluatie
    ev = (
        db.query(Evaluation)
        .filter(Evaluation.id == evaluation_id, Evaluation.school_id == user.school_id)
        .first()
    )
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    # rubriek-criterium ids voor snelle client-render
    crit_ids = [
        rc.id
        for rc in db.query(RubricCriterion.id)
        .filter(
            RubricCriterion.school_id == user.school_id,
            RubricCriterion.rubric_id == ev.rubric_id,
        )
        .all()
    ]

    rows = (
        db.query(Allocation, User)
        .join(User, User.id == Allocation.reviewee_id)
        .filter(
            Allocation.school_id == user.school_id,
            Allocation.evaluation_id == ev.id,
            Allocation.reviewer_id == user.id,
        )
        .order_by(Allocation.is_self.desc(), User.name.asc())
        .all()
    )

    out: list[MyAllocationOut] = []
    for alloc, reviewee in rows:
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
            )
        )
    return out


@router.get("", response_model=list[AllocationOut])
def list_allocations(
    evaluation_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)
):
    qs = (
        db.query(Allocation)
        .filter(
            Allocation.school_id == user.school_id,
            Allocation.evaluation_id == evaluation_id,
        )
        .order_by(Allocation.id.asc())
    )
    return qs.all()
