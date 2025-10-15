from __future__ import annotations

from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, aliased
import io
import csv
from starlette.responses import StreamingResponse

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    Evaluation,
    Course,
    Rubric,
    User,
    Allocation,
    Score,
    Reflection,
    RubricCriterion,
)

from app.api.v1.schemas.evaluations import (
    EvaluationCreate,
    EvaluationOut,
    EvaluationUpdateStatus,
    EvaluationUpdate,
)

router = APIRouter(prefix="/evaluations", tags=["evaluations"])


def _extract_deadlines(settings: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(settings, dict):
        return None
    review = settings.get("review_deadline") or settings.get("deadlines", {}).get(
        "review"
    )
    reflection = settings.get("reflection_deadline") or settings.get(
        "deadlines", {}
    ).get("reflection")
    if review or reflection:
        return {"review": review, "reflection": reflection}
    return None


def _to_out(ev: Evaluation) -> EvaluationOut:
    return EvaluationOut.model_validate(
        {
            "id": ev.id,
            "course_id": ev.course_id,
            "rubric_id": ev.rubric_id,
            "title": ev.title,
            "status": ev.status,
            "settings": ev.settings or {},
            "deadlines": _extract_deadlines(ev.settings),
        }
    )


@router.post("", response_model=EvaluationOut, status_code=status.HTTP_201_CREATED)
def create_evaluation(
    payload: EvaluationCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
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
    return _to_out(ev)


@router.get("/{evaluation_id}", response_model=EvaluationOut)
def get_evaluation(
    evaluation_id: int,
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
    return _to_out(ev)


@router.get("", response_model=List[EvaluationOut])
def list_evaluations(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    q: Optional[str] = Query(None, description="Zoek in titel"),
    status: Optional[str] = Query(
        None, pattern="^(draft|open|closed)$", description="Filter op status"
    ),
    course_id: Optional[int] = Query(None, description="Filter op course/klas ID"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
):
    stmt = select(Evaluation).where(Evaluation.school_id == user.school_id)
    if q:
        stmt = stmt.where(Evaluation.title.ilike(f"%{q}%"))
    if status:
        stmt = stmt.where(Evaluation.status == status)
    if course_id:
        stmt = stmt.where(Evaluation.course_id == course_id)
    stmt = stmt.order_by(Evaluation.id.desc()).limit(limit).offset((page - 1) * limit)
    rows = db.execute(stmt).scalars().all()
    return [_to_out(ev) for ev in rows]


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
    return _to_out(ev)


@router.put("/{evaluation_id}", response_model=EvaluationOut)
def update_evaluation(
    evaluation_id: int,
    payload: EvaluationUpdate,
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

    if payload.title is not None:
        ev.title = payload.title

    if payload.course_id is not None:
        course = (
            db.query(Course)
            .filter(Course.id == payload.course_id, Course.school_id == user.school_id)
            .first()
        )
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        ev.course_id = course.id

    if payload.rubric_id is not None:
        rubric = (
            db.query(Rubric)
            .filter(Rubric.id == payload.rubric_id, Rubric.school_id == user.school_id)
            .first()
        )
        if not rubric:
            raise HTTPException(status_code=404, detail="Rubric not found")
        ev.rubric_id = rubric.id

    if payload.settings is not None:
        ev.settings = payload.settings

    db.add(ev)
    db.commit()
    db.refresh(ev)
    return _to_out(ev)


@router.get("/{evaluation_id}/feedback")
def get_feedback_by_evaluation(
    evaluation_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    limit: int = Query(500, ge=1, le=5000),
    offset: int = Query(0, ge=0),
):
    ev = (
        db.query(Evaluation)
        .filter(Evaluation.id == evaluation_id, Evaluation.school_id == user.school_id)
        .first()
    )
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    U_from = aliased(User)
    U_to = aliased(User)

    rows = (
        db.query(
            Allocation.reviewee_id.label("to_id"),
            U_to.name.label("to_name"),
            Allocation.reviewer_id.label("from_id"),
            U_from.name.label("from_name"),
            Allocation.is_self.label("is_self"),
            Score.comment.label("text"),
            Score.criterion_id.label("criterion_id"),
            RubricCriterion.name.label("criterion_name"),
        )
        .join(U_to, U_to.id == Allocation.reviewee_id)
        .join(U_from, U_from.id == Allocation.reviewer_id)
        .join(Score, Score.allocation_id == Allocation.id)
        .join(RubricCriterion, RubricCriterion.id == Score.criterion_id)
        .filter(
            Allocation.school_id == user.school_id,
            Allocation.evaluation_id == evaluation_id,
            Score.comment.isnot(None),
            Score.comment != "",
        )
        .order_by(U_to.name.asc(), RubricCriterion.id.asc(), Allocation.id.asc())
        .limit(limit)
        .offset(offset)
        .all()
    )

    items_by_student: Dict[int, Dict[str, Any]] = {}
    for r in rows:
        to_id = int(r.to_id)
        if to_id not in items_by_student:
            items_by_student[to_id] = {
                "student_id": to_id,
                "student_name": r.to_name,
                "comments": [],
            }
        items_by_student[to_id]["comments"].append(
            {
                "to_student_id": to_id,
                "to_student_name": r.to_name,
                "from_student_id": int(r.from_id) if r.from_id is not None else None,
                "from_student_name": r.from_name,
                "criterion_id": (
                    int(r.criterion_id) if r.criterion_id is not None else None
                ),
                "criterion_name": r.criterion_name,
                "text": r.text or "",
                "type": "self" if bool(r.is_self) else "peer",
            }
        )

    items = sorted(items_by_student.values(), key=lambda x: (x["student_name"] or ""))
    return {"items": items, "limit": limit, "offset": offset, "count": len(rows)}


@router.get("/{evaluation_id}/reflections")
def get_reflections_by_evaluation(
    evaluation_id: int,
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

    rows = (
        db.query(
            Reflection.user_id.label("student_id"),
            User.name.label("student_name"),
            Reflection.text.label("text"),
            Reflection.word_count.label("word_count"),
            Reflection.submitted_at.label("submitted_at"),
        )
        .join(User, User.id == Reflection.user_id)
        .filter(
            Reflection.school_id == user.school_id,
            Reflection.evaluation_id == evaluation_id,
        )
        .order_by(User.name.asc())
        .all()
    )

    items = []
    for r in rows:
        text = r.text or ""
        words = (
            int(r.word_count)
            if r.word_count is not None
            else (len(text.split()) if text else 0)
        )
        items.append(
            {
                "student_id": int(r.student_id),
                "student_name": r.student_name,
                "text": text,
                "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
                "words": words,
            }
        )

    return {"items": items}


@router.get("/{evaluation_id}/feedback/export.csv")
def export_feedback_csv(
    evaluation_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    # zelfde scope/joins als JSON-feedback
    ev = (
        db.query(Evaluation)
        .filter(Evaluation.id == evaluation_id, Evaluation.school_id == user.school_id)
        .first()
    )
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    U_from = aliased(User)
    U_to = aliased(User)

    rows = (
        db.query(
            Allocation.reviewee_id.label("to_id"),
            U_to.name.label("to_name"),
            Allocation.reviewer_id.label("from_id"),
            U_from.name.label("from_name"),
            Allocation.is_self.label("is_self"),
            Score.comment.label("text"),
            Score.criterion_id.label("criterion_id"),
            RubricCriterion.name.label("criterion_name"),
        )
        .join(U_to, U_to.id == Allocation.reviewee_id)
        .join(U_from, U_from.id == Allocation.reviewer_id)
        .join(Score, Score.allocation_id == Allocation.id)
        .join(RubricCriterion, RubricCriterion.id == Score.criterion_id)
        .filter(
            Allocation.school_id == user.school_id,
            Allocation.evaluation_id == evaluation_id,
            Score.comment.isnot(None),
            Score.comment != "",
        )
        .order_by(U_to.name.asc(), RubricCriterion.id.asc(), Allocation.id.asc())
        .all()
    )

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(
        [
            "to_student_id",
            "to_student_name",
            "from_student_id",
            "from_student_name",
            "type",
            "criterion_id",
            "criterion_name",
            "comment",
        ]
    )
    for r in rows:
        w.writerow(
            [
                int(r.to_id),
                r.to_name or "",
                (int(r.from_id) if r.from_id is not None else ""),
                r.from_name or "",
                ("self" if bool(r.is_self) else "peer"),
                (int(r.criterion_id) if r.criterion_id is not None else ""),
                r.criterion_name or "",
                r.text or "",
            ]
        )

    buf.seek(0)
    filename = f"feedback_evaluation_{evaluation_id}.csv"
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{evaluation_id}/reflections/export.csv")
def export_reflections_csv(
    evaluation_id: int,
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

    rows = (
        db.query(
            Reflection.user_id.label("student_id"),
            User.name.label("student_name"),
            Reflection.text.label("text"),
            Reflection.word_count.label("word_count"),
            Reflection.submitted_at.label("submitted_at"),
        )
        .join(User, User.id == Reflection.user_id)
        .filter(
            Reflection.school_id == user.school_id,
            Reflection.evaluation_id == evaluation_id,
        )
        .order_by(User.name.asc())
        .all()
    )

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["student_id", "student_name", "submitted_at", "words", "text"])
    for r in rows:
        w.writerow(
            [
                int(r.student_id),
                r.student_name or "",
                (r.submitted_at.isoformat() if r.submitted_at else ""),
                (int(r.word_count) if r.word_count is not None else ""),
                r.text or "",
            ]
        )

    buf.seek(0)
    filename = f"reflections_evaluation_{evaluation_id}.csv"
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/courses")
def list_courses_for_eval(
    db: Session = Depends(get_db), user=Depends(get_current_user)
):
    from app.infra.db.models import Course

    rows = (
        db.query(Course)
        .filter(Course.school_id == user.school_id)
        .order_by(Course.name.asc(), Course.id.asc())
        .all()
    )
    return [{"id": c.id, "name": getattr(c, "name", f"Course {c.id}")} for c in rows]
