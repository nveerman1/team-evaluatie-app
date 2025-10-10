from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import Evaluation, Course, Rubric
from app.api.v1.schemas.evaluations import (
    EvaluationCreate,
    EvaluationOut,
    EvaluationUpdateStatus,
)

router = APIRouter(prefix="/evaluations", tags=["evaluations"])


@router.post("", response_model=EvaluationOut, status_code=status.HTTP_201_CREATED)
def create_evaluation(
    payload: EvaluationCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    # check course & rubric in same school
    course = (
        db.query(Course)
        .filter(Course.id == payload.course_id, Course.school_id == user.school_id)
        .first()
    )
    rubric = (
        db.query(Rubric)
        .filter(Rubric.id == payload.rubric_id, Rubric.school_id == user.school_id)
        .first()
    )
    if not course or not rubric:
        raise HTTPException(status_code=404, detail="Course or Rubric not found")
    ev = Evaluation(
        school_id=user.school_id,
        course_id=course.id,
        rubric_id=rubric.id,
        title=payload.title,
        settings=payload.settings,
        status="draft",
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


@router.get("", response_model=list[EvaluationOut])
def list_evaluations(db: Session = Depends(get_db), user=Depends(get_current_user)):
    qs = (
        db.query(Evaluation)
        .filter(Evaluation.school_id == user.school_id)
        .order_by(Evaluation.id.desc())
    )
    return qs.all()


@router.patch("/{evaluation_id}/status", response_model=EvaluationOut)
def update_status(
    evaluation_id: int,
    payload: EvaluationUpdateStatus,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ev = (
        db.query(Evaluation)
        .filter(Evaluation.id == evaluation_id, Evaluation.school_id == user.school_id)
        .first()
    )
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    if payload.status not in {"draft", "open", "closed"}:
        raise HTTPException(status_code=400, detail="Invalid status")
    ev.status = payload.status
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev
