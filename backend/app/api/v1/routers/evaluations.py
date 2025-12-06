from __future__ import annotations

from typing import Optional, List, Dict, Any
import io
import csv

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, aliased
from starlette.responses import StreamingResponse

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    Evaluation,
    Rubric,
    User,
    Allocation,
    Score,
    Reflection,
    RubricCriterion,
    Course,
    Group,
    GroupMember,
    FeedbackSummary,
    Grade,
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
    # compat: 'cluster' in schema blijft tijdelijk bestaan als label = course.name
    return EvaluationOut.model_validate(
        {
            "id": ev.id,
            "course_id": ev.course_id,
            "cluster": getattr(ev.course, "name", None)
            or "",  # compat voor oude frontend
            "rubric_id": ev.rubric_id,
            "title": ev.title,
            "evaluation_type": ev.evaluation_type,
            "status": ev.status,
            "created_at": ev.created_at,
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
    if not user or not getattr(user, "school_id", None):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Niet ingelogd"
        )

    # valideer rubric binnen school
    rubric = (
        db.query(Rubric)
        .filter(Rubric.id == payload.rubric_id, Rubric.school_id == user.school_id)
        .first()
    )
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")

    # valideer course binnen school (en minstens 1 actief student-lid via group_members)
    course = (
        db.query(Course)
        .filter(Course.id == payload.course_id, Course.school_id == user.school_id)
        .first()
    )
    if not course:
        raise HTTPException(status_code=422, detail="Onbekende course voor deze school")

    has_active_member = (
        db.query(User.id)
        .join(Group, Group.course_id == course.id)
        .filter(
            User.school_id == user.school_id,
            User.role == "student",
            User.archived.is_(False),
        )
        .first()
    )
    if not has_active_member:
        # we staan het alsnog toe; je kunt later teams toevoegen
        pass

    ev = Evaluation(
        school_id=user.school_id,
        rubric_id=rubric.id,
        title=payload.title,
        status="draft",
        course_id=course.id,
        settings=payload.settings or {},
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
    status_: Optional[str] = Query(
        None, pattern="^(draft|open|closed)$", description="Filter op status"
    ),
    course_id: Optional[int] = Query(None, description="Filter op course_id"),
    evaluation_type: Optional[str] = Query(None, description="Filter op evaluation_type (peer, project, competency)"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
):
    stmt = select(Evaluation).where(Evaluation.school_id == user.school_id)

    # If user is a student, only show evaluations for courses they're enrolled in
    if user.role == "student":
        # Get course IDs where student is an active member
        student_course_ids = (
            db.query(Group.course_id)
            .join(GroupMember, GroupMember.group_id == Group.id)
            .filter(
                GroupMember.user_id == user.id,
                GroupMember.active.is_(True),
                Group.school_id == user.school_id,
            )
            .distinct()
            .all()
        )
        course_ids = [cid for (cid,) in student_course_ids]

        if course_ids:
            stmt = stmt.where(Evaluation.course_id.in_(course_ids))
        else:
            # Student has no courses, filter to impossible condition to return empty
            stmt = stmt.where(Evaluation.id == -1)

    if q:
        stmt = stmt.where(Evaluation.title.ilike(f"%{q}%"))
    if status_:
        stmt = stmt.where(Evaluation.status == status_)
    if course_id is not None:
        stmt = stmt.where(Evaluation.course_id == course_id)
    if evaluation_type:
        stmt = stmt.where(Evaluation.evaluation_type == evaluation_type)
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
            raise HTTPException(
                status_code=422, detail="Onbekende course voor deze school"
            )
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
            Score.score.label("score"),
            Score.criterion_id.label("criterion_id"),
            RubricCriterion.name.label("criterion_name"),
            Score.created_at.label("created_at"),
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
                "from_student_id": (int(r.from_id) if r.from_id is not None else None),
                "from_student_name": r.from_name,
                "criterion_id": (
                    int(r.criterion_id) if r.criterion_id is not None else None
                ),
                "criterion_name": r.criterion_name,
                "text": r.text or "",
                "score": float(r.score) if r.score is not None else None,
                "created_at": (
                    r.created_at.isoformat()
                    if hasattr(r, "created_at") and r.created_at
                    else None
                ),
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
            Score.score.label("score"),
            Score.criterion_id.label("criterion_id"),
            RubricCriterion.name.label("criterion_name"),
            Score.created_at.label("created_at"),
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
            "score",
            "criterion_id",
            "criterion_name",
            "created_at",
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
                (float(r.score) if r.score is not None else ""),
                (int(r.criterion_id) if r.criterion_id is not None else ""),
                r.criterion_name or "",
                (
                    r.created_at.strftime("%d-%m-%Y")
                    if hasattr(r, "created_at") and r.created_at
                    else ""
                ),
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


@router.delete("/{evaluation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_evaluation(
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

    db.delete(ev)
    db.commit()
    return None


# ============================================================
# Student Peer Feedback Results Endpoint (OMZA format)
# ============================================================

OMZA_CATEGORY_MAP = {
    "Organiseren": "organiseren",
    "Meedoen": "meedoen",
    "Zelfvertrouwen": "zelfvertrouwen",
    "Autonomie": "autonomie",
    "organiseren": "organiseren",
    "meedoen": "meedoen",
    "zelfvertrouwen": "zelfvertrouwen",
    "autonomie": "autonomie",
    "O": "organiseren",
    "M": "meedoen",
    "Z": "zelfvertrouwen",
    "A": "autonomie",
}

OMZA_KEYS = ["organiseren", "meedoen", "zelfvertrouwen", "autonomie"]
OMZA_SHORT_CODES = ["O", "M", "Z", "A"]



def _normalize_category(category: Optional[str]) -> Optional[str]:
    """Normalize category name to lowercase OMZA key."""
    if not category:
        return None
    return OMZA_CATEGORY_MAP.get(category, category.lower())


def _get_omza_scores_for_student(
    db: Session,
    evaluation_id: int,
    student_id: int,
    is_self: bool = False,
) -> Dict[str, List[float]]:
    """
    Get scores per OMZA category for a student.
    Returns dict like {"organiseren": [4.0, 3.5], "meedoen": [3.0], ...}
    """
    # Build query for scores received by this student
    query = (
        db.query(
            RubricCriterion.category,
            Score.score,
        )
        .join(Score, Score.criterion_id == RubricCriterion.id)
        .join(Allocation, Allocation.id == Score.allocation_id)
        .filter(
            Allocation.evaluation_id == evaluation_id,
            Allocation.reviewee_id == student_id,
            Score.score.isnot(None),
        )
    )

    if is_self:
        query = query.filter(Allocation.is_self.is_(True))
    else:
        query = query.filter(Allocation.is_self.is_(False))

    rows = query.all()

    # Group scores by normalized category
    scores_by_cat: Dict[str, List[float]] = {k: [] for k in OMZA_KEYS}
    for cat, score in rows:
        norm_cat = _normalize_category(cat)
        if norm_cat and norm_cat in scores_by_cat and score is not None:
            scores_by_cat[norm_cat].append(float(score))

    return scores_by_cat


def _calc_avg(scores: List[float]) -> float:
    """Calculate average, return 0 if empty."""
    if not scores:
        return 0.0
    return round(sum(scores) / len(scores), 1)


@router.get("/my/peer-results")
def get_my_peer_feedback_results(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Get peer feedback results for the current student across all evaluations.
    Returns data in OMZA format for the student results page.
    """
    if not user or not getattr(user, "school_id", None):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Niet ingelogd"
        )

    # Get all evaluations where the student participated (has allocations as reviewee)
    student_eval_ids = (
        db.query(Allocation.evaluation_id)
        .filter(
            Allocation.school_id == user.school_id,
            Allocation.reviewee_id == user.id,
        )
        .distinct()
        .subquery()
    )

    evaluations = (
        db.query(Evaluation)
        .filter(
            Evaluation.school_id == user.school_id,
            Evaluation.id.in_(select(student_eval_ids)),
            Evaluation.status.in_(["open", "closed"]),  # Only show open and closed evaluations
        )
        .order_by(Evaluation.created_at.desc())
        .all()
    )

    results = []
    for ev in evaluations:
        # Get course info
        course = db.query(Course).filter(Course.id == ev.course_id).first()
        course_name = course.name if course else ""

        # Get deadline from settings
        deadline_iso = None
        if ev.settings and isinstance(ev.settings, dict):
            deadlines = ev.settings.get("deadlines", {})
            deadline_iso = deadlines.get("review")

        # Get evaluation status (only open or closed at this point)
        eval_status = ev.status

        # Get peer scores per OMZA category
        peer_scores_by_cat = _get_omza_scores_for_student(
            db, ev.id, user.id, is_self=False
        )

        # Get self scores per OMZA category
        self_scores_by_cat = _get_omza_scores_for_student(
            db, ev.id, user.id, is_self=True
        )

        # Build peer objects with individual scores
        # Group by reviewer to show per-peer feedback
        peer_feedback_query = (
            db.query(
                Allocation.reviewer_id,
                User.name.label("reviewer_name"),
                RubricCriterion.category,
                Score.score,
                Score.comment,
            )
            .join(User, User.id == Allocation.reviewer_id)
            .join(Score, Score.allocation_id == Allocation.id)
            .join(RubricCriterion, RubricCriterion.id == Score.criterion_id)
            .filter(
                Allocation.evaluation_id == ev.id,
                Allocation.reviewee_id == user.id,
                Allocation.is_self.is_(False),
            )
            .all()
        )

        # Group by reviewer
        peers_data: Dict[int, Dict[str, Any]] = {}
        for reviewer_id, reviewer_name, cat, score, comment in peer_feedback_query:
            if reviewer_id not in peers_data:
                peers_data[reviewer_id] = {
                    "peerLabel": "Teamgenoot",  # Anonymized label
                    "notes": [],
                    "scores": {k: [] for k in OMZA_KEYS},
                }
            # Add score if present
            if score is not None:
                norm_cat = _normalize_category(cat)
                if norm_cat and norm_cat in peers_data[reviewer_id]["scores"]:
                    peers_data[reviewer_id]["scores"][norm_cat].append(float(score))
            # Collect all comments
            if comment and comment.strip():
                peers_data[reviewer_id]["notes"].append(comment.strip())

        # Convert to peers array with averaged scores and anonymous labels
        peers = []
        for idx, (reviewer_id, data) in enumerate(peers_data.items(), start=1):
            # Combine all notes into one string
            notes_text = " | ".join(data["notes"]) if data["notes"] else None
            peer_entry = {
                "peerLabel": f"Teamgenoot {chr(64 + idx)}",  # A, B, C, ...
                "notes": notes_text,
                "scores": {
                    k: _calc_avg(data["scores"][k]) for k in OMZA_KEYS
                },
            }
            peers.append(peer_entry)

        # Build self score object
        self_score = None
        if any(self_scores_by_cat.values()):
            self_score = {k: _calc_avg(self_scores_by_cat[k]) for k in OMZA_KEYS}

        # Get AI summary from FeedbackSummary if available
        ai_summary = None
        summary_record = (
            db.query(FeedbackSummary)
            .filter(
                FeedbackSummary.evaluation_id == ev.id,
                FeedbackSummary.student_id == user.id,
            )
            .first()
        )
        if summary_record:
            ai_summary = summary_record.summary_text

        # Get GCF and grade from Grade table - check both direct column and meta JSON field
        gcf_score = None
        teacher_grade = None
        teacher_grade_comment = None
        grade_record = (
            db.query(Grade)
            .filter(
                Grade.school_id == user.school_id,
                Grade.evaluation_id == ev.id,
                Grade.user_id == user.id,
            )
            .first()
        )
        if grade_record:
            # First try direct gcf column
            if grade_record.gcf is not None:
                gcf_score = int(round(grade_record.gcf * 100))
            # Also check meta JSON field for gcf
            elif grade_record.meta and isinstance(grade_record.meta, dict):
                meta_gcf = grade_record.meta.get("gcf")
                if meta_gcf is not None:
                    gcf_score = int(round(float(meta_gcf) * 100))
            
            # Get teacher grade (prefer published_grade, fallback to grade)
            if grade_record.published_grade is not None:
                teacher_grade = float(grade_record.published_grade)
            elif grade_record.grade is not None:
                teacher_grade = float(grade_record.grade)
            
            # Get teacher comment/reason
            if grade_record.override_reason:
                teacher_grade_comment = grade_record.override_reason

        # Get teacher OMZA scores and comments from evaluation settings
        teacher_omza_scores = {}
        teacher_comments = None
        if ev.settings and isinstance(ev.settings, dict):
            # Get teacher OMZA scores per category
            for cat_key in OMZA_SHORT_CODES:
                teacher_key = f"teacher_score_{user.id}_{cat_key}"
                if teacher_key in ev.settings and ev.settings[teacher_key] is not None:
                    teacher_omza_scores[cat_key] = ev.settings[teacher_key]
            
            # Get teacher comment
            teacher_comment_key = f"teacher_comment_{user.id}"
            if teacher_comment_key in ev.settings:
                teacher_comments = ev.settings[teacher_comment_key]
        
        # Get reflection for this student
        reflection_data = None
        reflection_record = (
            db.query(Reflection)
            .filter(
                Reflection.school_id == user.school_id,
                Reflection.evaluation_id == ev.id,
                Reflection.user_id == user.id,
            )
            .first()
        )
        if reflection_record and reflection_record.text:
            reflection_data = {
                "text": reflection_record.text,
                "submittedAt": reflection_record.submitted_at.isoformat() if reflection_record.submitted_at else None,
            }

        # Build trend data (historical averages)
        # For now, we'll use the current averages as a single point
        # In a full implementation, this would look at previous evaluations
        trend = {}
        for k in OMZA_KEYS:
            if peer_scores_by_cat[k]:
                trend[k] = [_calc_avg(peer_scores_by_cat[k])]

        result_item = {
            "id": f"ev-{ev.id}",
            "title": ev.title,
            "course": course_name,
            "deadlineISO": deadline_iso,
            "status": eval_status,
            "aiSummary": ai_summary,
            "peers": peers,
            "selfScore": self_score,
            "trend": trend if trend else None,
            "gcfScore": gcf_score,
            "reflection": reflection_data,
            # Teacher data
            "teacherComments": teacher_comments,
            "teacherGrade": teacher_grade,
            "teacherGradeComment": teacher_grade_comment,
            "teacherOmza": teacher_omza_scores or None,
        }
        results.append(result_item)

    return results
