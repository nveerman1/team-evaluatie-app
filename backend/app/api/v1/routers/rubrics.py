from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import Rubric, RubricCriterion
from app.api.v1.schemas.rubrics import (
    RubricCreate,
    RubricOut,
    CriterionCreate,
    CriterionOut,
)

router = APIRouter(prefix="/rubrics", tags=["rubrics"])


@router.post("", response_model=RubricOut, status_code=status.HTTP_201_CREATED)
def create_rubric(
    payload: RubricCreate, db: Session = Depends(get_db), user=Depends(get_current_user)
):
    # school scope via current user
    r = Rubric(
        school_id=user.school_id,
        title=payload.title,
        description=payload.description,
        scale_min=payload.scale_min,
        scale_max=payload.scale_max,
        metadata_json=payload.metadata_json,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.get("", response_model=list[RubricOut])
def list_rubrics(db: Session = Depends(get_db), user=Depends(get_current_user)):
    qs = (
        db.query(Rubric)
        .filter(Rubric.school_id == user.school_id)
        .order_by(Rubric.id.desc())
    )
    return qs.all()


@router.post(
    "/{rubric_id}/criteria",
    response_model=CriterionOut,
    status_code=status.HTTP_201_CREATED,
)
def add_criterion(
    rubric_id: int,
    payload: CriterionCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    rubric = (
        db.query(Rubric)
        .filter(Rubric.id == rubric_id, Rubric.school_id == user.school_id)
        .first()
    )
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    c = RubricCriterion(
        school_id=user.school_id,
        rubric_id=rubric.id,
        name=payload.name,
        weight=payload.weight,
        descriptors=payload.descriptors,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("/{rubric_id}/criteria", response_model=list[CriterionOut])
def list_criteria(
    rubric_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)
):
    qs = db.query(RubricCriterion).filter(
        RubricCriterion.school_id == user.school_id,
        RubricCriterion.rubric_id == rubric_id,
    )
    return qs.all()
