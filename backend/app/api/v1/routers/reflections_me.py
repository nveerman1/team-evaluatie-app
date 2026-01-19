from __future__ import annotations
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    Evaluation,
    Reflection,
    Allocation,
    CourseEnrollment,
)

router = APIRouter(prefix="/evaluations", tags=["reflections"])


class ReflectionUpsertIn(BaseModel):
    text: str = Field(min_length=1)
    submit: Optional[bool] = False


class ReflectionOut(BaseModel):
    evaluation_id: int
    user_id: int
    text: str
    word_count: int
    submitted_at: Optional[datetime]


def _has_access_to_evaluation(db: Session, evaluation_id: int, user_id: int) -> bool:
    """
    Check if user has access to evaluation.
    Returns True if:
    - User has an allocation for this evaluation (as reviewer), OR
    - User is a member of a group in the evaluation's course
    """
    # Check for allocation using exists() for better performance
    has_alloc = (
        db.query(Allocation.id)
        .filter(
            Allocation.evaluation_id == evaluation_id,
            Allocation.reviewer_id == user_id,
        )
        .limit(1)
        .scalar()
        is not None
    )
    if has_alloc:
        return True

    # Check if user is enrolled in the evaluation's course
    ev = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
    if not ev or not ev.course_id:
        return False

    is_enrolled = (
        db.query(CourseEnrollment.id)
        .filter(
            CourseEnrollment.course_id == ev.course_id,
            CourseEnrollment.user_id == user_id,
            CourseEnrollment.active.is_(True),
        )
        .limit(1)
        .scalar()
        is not None
    )

    return is_enrolled


@router.get("/{evaluation_id}/reflections/me", response_model=ReflectionOut)
def get_my_reflection(
    evaluation_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)
):
    # Check if user has access to this evaluation
    if not _has_access_to_evaluation(db, evaluation_id, user.id):
        # Check if evaluation exists
        ev = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
        if not ev:
            raise HTTPException(status_code=404, detail="Evaluation not found")
        # User is authenticated but doesn't have access to this evaluation
        raise HTTPException(status_code=403, detail="No access to this evaluation")

    ref = (
        db.query(Reflection)
        .filter(
            Reflection.evaluation_id == evaluation_id, Reflection.user_id == user.id
        )
        .first()
    )

    if not ref:
        return ReflectionOut(
            evaluation_id=evaluation_id,
            user_id=user.id,
            text="",
            word_count=0,
            submitted_at=None,
        )

    words = (
        int(ref.word_count)
        if ref.word_count is not None
        else len((ref.text or "").split())
    )
    return ReflectionOut(
        evaluation_id=evaluation_id,
        user_id=user.id,
        text=ref.text or "",
        word_count=words,
        submitted_at=ref.submitted_at,
    )


@router.post(
    "/{evaluation_id}/reflections/me",
    response_model=ReflectionOut,
    status_code=status.HTTP_200_OK,
)
def upsert_my_reflection(
    evaluation_id: int,
    payload: ReflectionUpsertIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not _has_access_to_evaluation(db, evaluation_id, user.id):
        ev = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
        if not ev:
            raise HTTPException(status_code=404, detail="Evaluation not found")
        raise HTTPException(status_code=403, detail="No access to this evaluation")

    text = (payload.text or "").strip()
    word_count = len(text.split()) if text else 0

    ref = (
        db.query(Reflection)
        .filter(
            Reflection.evaluation_id == evaluation_id, Reflection.user_id == user.id
        )
        .first()
    )

    if ref is None:
        ref = Reflection(
            school_id=user.school_id,
            evaluation_id=evaluation_id,
            user_id=user.id,
            text=text,
            word_count=word_count,
            submitted_at=datetime.utcnow() if payload.submit else None,
        )
        db.add(ref)
    else:
        ref.text = text
        ref.word_count = word_count
        if payload.submit:
            ref.submitted_at = datetime.utcnow()

    db.commit()
    db.refresh(ref)

    return ReflectionOut(
        evaluation_id=evaluation_id,
        user_id=user.id,
        text=ref.text or "",
        word_count=ref.word_count or 0,
        submitted_at=ref.submitted_at,
    )
