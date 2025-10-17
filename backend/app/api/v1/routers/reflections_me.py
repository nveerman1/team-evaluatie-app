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
)  # <-- Allocation toegevoegd

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


def _has_allocation(db: Session, evaluation_id: int, user_id: int) -> bool:
    return (
        db.query(Allocation)
        .filter(
            Allocation.evaluation_id == evaluation_id,
            Allocation.reviewer_id
            == user_id,  # of reviewee_id als dat in jouw model hoort
        )
        .first()
        is not None
    )


@router.get("/{evaluation_id}/reflections/me", response_model=ReflectionOut)
def get_my_reflection(
    evaluation_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)
):
    # Authorisatie via allocation i.p.v. school_id
    if not _has_allocation(db, evaluation_id, user.id):
        # fallback: bestaat de evaluatie überhaupt?
        ev = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
        if not ev:
            raise HTTPException(status_code=404, detail="Evaluation not found")
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
    if not _has_allocation(db, evaluation_id, user.id):
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
