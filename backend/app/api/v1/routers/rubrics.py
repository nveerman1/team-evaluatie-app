from __future__ import annotations

from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    Rubric,
    RubricCriterion,
    LearningObjective,
    RubricCriterionLearningObjective,
)
from app.api.v1.schemas.rubrics import (
    RubricCreate,
    RubricUpdate,
    RubricOut,
    CriterionCreate,
    CriterionUpdate,
    CriterionOut,
    RubricListResponse,
    RubricListItem,
    CriterionBatchUpsertRequest,
    CriterionBatchUpsertResponse,
)

router = APIRouter(prefix="/rubrics", tags=["rubrics"])


# ---------- utils ----------

LEVEL_KEYS = ("level1", "level2", "level3", "level4", "level5")


def _school_filter(query, model, school_id: int):
    return query.where(model.school_id == school_id)


def _apply_order(obj, order: Optional[int]):
    # Alleen zetten als het model dit attribuut heeft
    if order is not None and hasattr(obj, "order"):
        setattr(obj, "order", order)


def _ensure5(d: Optional[Dict[str, Any]]) -> Dict[str, str]:
    """
    Zorg dat descriptors altijd 5 niveaus bevat, als strings.
    - accepteert dict met level1..level5 of numeriek "1".."5" of partiële dicts
    - ontbrekende levels worden op "" gezet
    """
    out = {k: "" for k in LEVEL_KEYS}
    if not isinstance(d, dict):
        return out
    # directe keys
    for i, k in enumerate(LEVEL_KEYS, start=1):
        val = d.get(k, d.get(str(i), ""))
        out[k] = "" if val is None else str(val)
    return out


def _to_out_rubric(r: Rubric) -> RubricOut:
    return RubricOut.model_validate(
        {
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "scale_min": r.scale_min,
            "scale_max": r.scale_max,
            "scope": r.scope,
            "metadata_json": r.metadata_json or {},
        }
    )


def _to_out_criterion(c: RubricCriterion) -> CriterionOut:
    payload: Dict[str, Any] = {
        "id": c.id,
        "rubric_id": c.rubric_id,
        "name": c.name,
        "weight": float(c.weight),
        "descriptors": _ensure5(c.descriptors),  # <-- altijd 5 niveaus naar buiten
        "category": getattr(c, "category", None),
        "learning_objective_ids": [lo.id for lo in c.learning_objectives] if hasattr(c, "learning_objectives") and c.learning_objectives else [],
    }
    if hasattr(c, "order"):
        payload["order"] = getattr(c, "order")
    return CriterionOut.model_validate(payload)


def _sync_learning_objectives(
    db: Session,
    criterion: RubricCriterion,
    learning_objective_ids: List[int],
    school_id: int,
):
    """
    Synchronize learning objective associations for a criterion.
    Removes old associations and adds new ones.
    """
    # Remove existing associations
    db.execute(
        select(RubricCriterionLearningObjective)
        .where(RubricCriterionLearningObjective.criterion_id == criterion.id)
    )
    existing = db.execute(
        select(RubricCriterionLearningObjective)
        .where(RubricCriterionLearningObjective.criterion_id == criterion.id)
    ).scalars().all()
    
    for assoc in existing:
        db.delete(assoc)
    
    # Add new associations
    for lo_id in learning_objective_ids:
        # Verify learning objective exists and belongs to the same school
        lo = db.execute(
            select(LearningObjective)
            .where(
                LearningObjective.id == lo_id,
                LearningObjective.school_id == school_id,
            )
        ).scalar_one_or_none()
        
        if lo:
            assoc = RubricCriterionLearningObjective(
                school_id=school_id,
                criterion_id=criterion.id,
                learning_objective_id=lo_id,
            )
            db.add(assoc)


# ---------- CRUD Rubrics ----------


@router.post("", response_model=RubricOut, status_code=status.HTTP_201_CREATED)
def create_rubric(
    payload: RubricCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    r = Rubric(
        school_id=user.school_id,
        title=payload.title,
        description=payload.description,
        scale_min=payload.scale_min,
        scale_max=payload.scale_max,
        scope=payload.scope,
        metadata_json=payload.metadata_json,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return _to_out_rubric(r)


@router.get("", response_model=RubricListResponse)
def list_rubrics(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    q: Optional[str] = Query(None, description="Zoek op titel/omschrijving"),
    scope: Optional[str] = Query(None, description="Filter op scope: peer of project"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
):
    stmt = select(Rubric).where(Rubric.school_id == user.school_id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where((Rubric.title.ilike(like)) | (Rubric.description.ilike(like)))
    if scope:
        stmt = stmt.where(Rubric.scope == scope)
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    stmt = stmt.order_by(Rubric.id.desc()).limit(limit).offset((page - 1) * limit)
    rows: List[Rubric] = db.execute(stmt).scalars().all()

    # criteria_count ophalen
    counts = dict(
        db.execute(
            select(RubricCriterion.rubric_id, func.count(RubricCriterion.id))
            .where(RubricCriterion.school_id == user.school_id)
            .group_by(RubricCriterion.rubric_id)
        ).all()
    )
    items = [
        RubricListItem(
            **_to_out_rubric(r).model_dump(), criteria_count=counts.get(r.id, 0)
        )
        for r in rows
    ]
    return RubricListResponse(items=items, page=page, limit=limit, total=total)


@router.get("/{rubric_id}", response_model=RubricOut)
def get_rubric(
    rubric_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    r = (
        db.query(Rubric)
        .filter(Rubric.id == rubric_id, Rubric.school_id == user.school_id)
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Rubric not found")
    return _to_out_rubric(r)


@router.put("/{rubric_id}", response_model=RubricOut)
def update_rubric(
    rubric_id: int,
    payload: RubricUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    r = (
        db.query(Rubric)
        .filter(Rubric.id == rubric_id, Rubric.school_id == user.school_id)
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Rubric not found")
    if payload.title is not None:
        r.title = payload.title
    if payload.description is not None:
        r.description = payload.description
    if payload.scale_min is not None:
        r.scale_min = payload.scale_min
    if payload.scale_max is not None:
        r.scale_max = payload.scale_max
    if payload.scope is not None:
        r.scope = payload.scope
    if payload.metadata_json is not None:
        r.metadata_json = payload.metadata_json
    db.add(r)
    db.commit()
    db.refresh(r)
    return _to_out_rubric(r)


@router.delete("/{rubric_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rubric(
    rubric_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    r = (
        db.query(Rubric)
        .filter(Rubric.id == rubric_id, Rubric.school_id == user.school_id)
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Rubric not found")

    # veiligheid: alleen verwijderen als rubric niet gekoppeld is (afhankelijk van je model/foreign keys)
    # hier simpel: verwijder eerst criteria
    db.query(RubricCriterion).filter(
        RubricCriterion.school_id == user.school_id,
        RubricCriterion.rubric_id == r.id,
    ).delete()
    db.delete(r)
    db.commit()
    return None


# ---------- Duplicate ----------


@router.post(
    "/{rubric_id}/duplicate",
    response_model=RubricOut,
    status_code=status.HTTP_201_CREATED,
)
def duplicate_rubric(
    rubric_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    src = (
        db.query(Rubric)
        .filter(Rubric.id == rubric_id, Rubric.school_id == user.school_id)
        .first()
    )
    if not src:
        raise HTTPException(status_code=404, detail="Rubric not found")

    dup = Rubric(
        school_id=user.school_id,
        title=f"{src.title} (kopie)",
        description=src.description,
        scale_min=src.scale_min,
        scale_max=src.scale_max,
        scope=src.scope,
        metadata_json=src.metadata_json or {},
    )
    db.add(dup)
    db.commit()
    db.refresh(dup)

    # criteria kopiëren (en normaliseren naar 5 niveaus)
    crits = (
        db.query(RubricCriterion)
        .filter(
            RubricCriterion.school_id == user.school_id,
            RubricCriterion.rubric_id == src.id,
        )
        .all()
    )
    for c in crits:
        nc = RubricCriterion(
            school_id=user.school_id,
            rubric_id=dup.id,
            name=c.name,
            weight=c.weight,
            descriptors=_ensure5(c.descriptors),  # <-- normalize bij dupliceren
            category=getattr(c, "category", None),
        )
        if hasattr(c, "order"):
            setattr(nc, "order", getattr(c, "order"))
        db.add(nc)
    db.commit()

    return _to_out_rubric(dup)


# ---------- Criteria: list / create / update / delete ----------


@router.get("/{rubric_id}/criteria", response_model=List[CriterionOut])
def list_criteria(
    rubric_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    qs = db.query(RubricCriterion).filter(
        RubricCriterion.school_id == user.school_id,
        RubricCriterion.rubric_id == rubric_id,
    )
    # indien order-kolom bestaat: sorteer daarop
    if hasattr(RubricCriterion, "order"):
        qs = qs.order_by(
            RubricCriterion.order.asc().nulls_last(), RubricCriterion.id.asc()
        )
    else:
        qs = qs.order_by(RubricCriterion.id.asc())
    return [_to_out_criterion(c) for c in qs.all()]


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
        descriptors=payload.descriptors,  # schemas normaliseert naar 5
        category=payload.category,
    )
    _apply_order(c, payload.order)
    db.add(c)
    db.flush()  # Get ID before syncing learning objectives
    
    # Sync learning objectives
    if payload.learning_objective_ids:
        _sync_learning_objectives(db, c, payload.learning_objective_ids, user.school_id)
    
    db.commit()
    db.refresh(c)
    return _to_out_criterion(c)


@router.patch("/{rubric_id}/criteria/{criterion_id}", response_model=CriterionOut)
def update_criterion(
    rubric_id: int,
    criterion_id: int,
    payload: CriterionUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    c = (
        db.query(RubricCriterion)
        .filter(
            RubricCriterion.id == criterion_id,
            RubricCriterion.rubric_id == rubric_id,
            RubricCriterion.school_id == user.school_id,
        )
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Criterion not found")

    if payload.name is not None:
        c.name = payload.name
    if payload.weight is not None:
        c.weight = payload.weight
    if payload.descriptors is not None:  # schemas normaliseert naar 5
        c.descriptors = payload.descriptors
    # Allow updating category to None (clearing it) or to a new value
    # We check if the field was provided in the request using model_dump
    update_data = payload.model_dump(exclude_unset=True)
    if 'category' in update_data:
        c.category = payload.category
    if payload.order is not None:
        _apply_order(c, payload.order)
    
    # Sync learning objectives if provided
    if 'learning_objective_ids' in update_data:
        _sync_learning_objectives(db, c, payload.learning_objective_ids or [], user.school_id)

    db.add(c)
    db.commit()
    db.refresh(c)
    return _to_out_criterion(c)


@router.delete(
    "/{rubric_id}/criteria/{criterion_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_criterion(
    rubric_id: int,
    criterion_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    c = (
        db.query(RubricCriterion)
        .filter(
            RubricCriterion.id == criterion_id,
            RubricCriterion.rubric_id == rubric_id,
            RubricCriterion.school_id == user.school_id,
        )
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Criterion not found")

    db.delete(c)
    db.commit()
    return None


# ---------- Batch upsert (create/update + reorder in één call) ----------


@router.put("/{rubric_id}/criteria/batch", response_model=CriterionBatchUpsertResponse)
def batch_upsert_criteria(
    rubric_id: int,
    payload: CriterionBatchUpsertRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    # check rubric scope
    rubric = (
        db.query(Rubric)
        .filter(Rubric.id == rubric_id, Rubric.school_id == user.school_id)
        .first()
    )
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")

    out: List[RubricCriterion] = []

    for item in payload.items:
        if item.id:
            c = (
                db.query(RubricCriterion)
                .filter(
                    RubricCriterion.id == item.id,
                    RubricCriterion.rubric_id == rubric_id,
                    RubricCriterion.school_id == user.school_id,
                )
                .first()
            )
            if not c:
                raise HTTPException(
                    status_code=404, detail=f"Criterion {item.id} not found"
                )
            c.name = item.name
            c.weight = item.weight
            c.descriptors = item.descriptors  # schemas → 5 levels
            c.category = item.category
            _apply_order(c, item.order)
            db.add(c)
            db.flush()
            # Sync learning objectives
            _sync_learning_objectives(db, c, item.learning_objective_ids or [], user.school_id)
            out.append(c)
        else:
            c = RubricCriterion(
                school_id=user.school_id,
                rubric_id=rubric.id,
                name=item.name,
                weight=item.weight,
                descriptors=item.descriptors,  # schemas → 5 levels
                category=item.category,
            )
            _apply_order(c, item.order)
            db.add(c)
            db.flush()  # id verkrijgen
            # Sync learning objectives
            _sync_learning_objectives(db, c, item.learning_objective_ids or [], user.school_id)
            out.append(c)

    db.commit()
    # herladen in gewenste volgorde
    result = [
        _to_out_criterion(c)
        for c in db.query(RubricCriterion)
        .filter(
            RubricCriterion.school_id == user.school_id,
            RubricCriterion.rubric_id == rubric_id,
        )
        .order_by(
            getattr(RubricCriterion, "order", RubricCriterion.id).asc(),
            RubricCriterion.id.asc(),
        )
        .all()
    ]
    return CriterionBatchUpsertResponse(items=result)
