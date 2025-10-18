from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session


from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import Allocation, Evaluation, Rubric, RubricCriterion, Score
from app.api.v1.schemas.scores import SubmitScoresRequest, ScoreOut

router = APIRouter(prefix="/scores", tags=["scores"])


@router.post("", response_model=list[ScoreOut], status_code=status.HTTP_201_CREATED)
def submit_scores(
    payload: SubmitScoresRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    # 1) allocation valideren + reviewer = current user
    alloc = (
        db.query(Allocation)
        .filter(
            Allocation.id == payload.allocation_id,
            Allocation.school_id == user.school_id,
        )
        .first()
    )
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found")
    if alloc.reviewer_id != user.id:
        raise HTTPException(status_code=403, detail="Not your allocation")

    # 2) haal evaluation/rubric voor schaal + criteria
    ev = (
        db.query(Evaluation)
        .filter(
            Evaluation.id == alloc.evaluation_id, Evaluation.school_id == user.school_id
        )
        .first()
    )
    if not ev:
        raise HTTPException(status_code=400, detail="Evaluation mismatch")

    rubric = (
        db.query(Rubric)
        .filter(Rubric.id == ev.rubric_id, Rubric.school_id == user.school_id)
        .first()
    )
    if not rubric:
        raise HTTPException(status_code=400, detail="Rubric not found")

    # geldige criteria set
    valid_crit_ids = {
        rc.id
        for rc in db.query(RubricCriterion.id)
        .filter(
            RubricCriterion.school_id == user.school_id,
            RubricCriterion.rubric_id == rubric.id,
        )
        .all()
    }
    if not valid_crit_ids:
        raise HTTPException(status_code=400, detail="No rubric criteria")

    # 3) upsert per item
    out: list[Score] = []
    for it in payload.items:
        if it.criterion_id not in valid_crit_ids:
            raise HTTPException(
                status_code=422, detail=f"Invalid criterion_id: {it.criterion_id}"
            )
        if not (rubric.scale_min <= it.score <= rubric.scale_max):
            raise HTTPException(
                status_code=422,
                detail=f"Score {it.score} out of bounds [{rubric.scale_min}-{rubric.scale_max}]",
            )

        row = (
            db.query(Score)
            .filter(
                Score.school_id == user.school_id,
                Score.allocation_id == alloc.id,
                Score.criterion_id == it.criterion_id,
            )
            .first()
        )
        if not row:
            row = Score(
                school_id=user.school_id,
                allocation_id=alloc.id,
                criterion_id=it.criterion_id,
                score=it.score,
                comment=it.comment,
                attachments=it.attachments or {},
                status="submitted",
            )
            db.add(row)
        else:
            row.score = it.score
            row.comment = it.comment
            row.attachments = it.attachments or {}
            row.status = "submitted"
        out.append(row)

    db.commit()
    # refresh voor ids
    for r in out:
        db.refresh(r)
    return out


@router.get("/by-allocation/{allocation_id}", response_model=list[ScoreOut])
def get_scores_by_allocation(
    allocation_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)
):
    # alleen eigen allocations mogen gelezen worden (reviewer)
    alloc = (
        db.query(Allocation)
        .filter(Allocation.id == allocation_id, Allocation.school_id == user.school_id)
        .first()
    )
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found")
    if alloc.reviewer_id != user.id:
        raise HTTPException(status_code=403, detail="Not your allocation")

    rows = (
        db.query(Score)
        .filter(Score.school_id == user.school_id, Score.allocation_id == allocation_id)
        .order_by(Score.criterion_id.asc())
        .all()
    )
    return rows


@router.get("/my")
def get_my_scores(
    allocation_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Prefill voor student (reviewer) voor een specifieke allocation.
    Response: [{criterion_id, score, comment}]
    """
    # autorisatie: student moet reviewer zijn op deze allocation
    alloc = db.query(Allocation).filter(Allocation.id == allocation_id).first()
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found")
    if alloc.reviewer_id != user.id:
        raise HTTPException(status_code=403, detail="Not your allocation")

    items = (
        db.query(Score)
        .filter(
            Score.allocation_id == allocation_id,
            Score.reviewer_id == user.id,
        )
        .all()
    )
    return [
        {
            "criterion_id": s.criterion_id,
            "score": s.score,
            "comment": s.comment or "",
        }
        for s in items
    ]
