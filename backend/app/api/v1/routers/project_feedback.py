"""
Project Feedback API endpoints (Projectfeedback door leerlingen)
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.core.rbac import require_role
from app.infra.db.models import (
    Project,
    ProjectFeedbackAnswer,
    ProjectFeedbackQuestion,
    ProjectFeedbackResponse,
    ProjectFeedbackRound,
    ProjectTeam,
    ProjectTeamMember,
    User,
)
from app.api.v1.schemas.project_feedback import (
    AnswerIn,
    ProjectFeedbackQuestionOut,
    ProjectFeedbackResults,
    ProjectFeedbackRoundCreate,
    ProjectFeedbackRoundDetail,
    ProjectFeedbackRoundOut,
    ProjectFeedbackRoundUpdate,
    ProjectFeedbackResponseOut,
    ProjectFeedbackAnswerOut,
    ProjectFeedbackSubmission,
    QuestionResultOut,
)

router = APIRouter(prefix="/project-feedback", tags=["project-feedback"])

# ---------- Default questions ----------

DEFAULT_QUESTIONS = [
    # project
    {"question_text": "Het project was leerzaam", "question_type": "rating", "order": 1, "is_required": True},
    {"question_text": "Het project was interessant", "question_type": "rating", "order": 2, "is_required": True},
    {"question_text": "Het project voelde als een echte opdracht", "question_type": "rating", "order": 3, "is_required": True},
    {"question_text": "De moeilijkheidsgraad was passend", "question_type": "rating", "order": 4, "is_required": True},
    {"question_text": "Wat werkte goed in dit project?", "question_type": "open", "order": 5, "is_required": False},
    # organisatie
    {"question_text": "De opdracht was duidelijk", "question_type": "rating", "order": 6, "is_required": True},
    {"question_text": "Het project was goed georganiseerd", "question_type": "rating", "order": 7, "is_required": True},
    {"question_text": "Ik had voldoende tijd", "question_type": "rating", "order": 8, "is_required": True},
    {"question_text": "Ik wist tijdens het project welke stap we moesten doen (bijv. onderzoek, ideeën, ontwerp)", "question_type": "rating", "order": 9, "is_required": True},
    {"question_text": "Wat zou je verbeteren aan de organisatie?", "question_type": "open", "order": 10, "is_required": False},
    # begeleiding
    {"question_text": "De feedback van de docent hielp mij verder", "question_type": "rating", "order": 11, "is_required": True},
    {"question_text": "Ik kon op tijd hulp krijgen", "question_type": "rating", "order": 12, "is_required": True},
    {"question_text": "Hoe kan de begeleiding beter?", "question_type": "open", "order": 13, "is_required": False},
    # samenwerking
    {"question_text": "Mijn team werkte goed samen tijdens het project", "question_type": "rating", "order": 14, "is_required": True},
    # eindvragen
    {"question_text": "Welk cijfer geef je dit project?", "question_type": "scale10", "order": 15, "is_required": True},
    {"question_text": "Ik zou dit project aanraden aan andere leerlingen", "question_type": "rating", "order": 16, "is_required": True},
    {"question_text": "Wat is je belangrijkste tip voor verbetering?", "question_type": "open", "order": 17, "is_required": False},
]


# ---------- Helpers ----------


def _get_round_or_404(db: Session, round_id: int, school_id: int) -> ProjectFeedbackRound:
    r = (
        db.query(ProjectFeedbackRound)
        .filter(
            ProjectFeedbackRound.id == round_id,
            ProjectFeedbackRound.school_id == school_id,
        )
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Feedback round not found")
    return r


def _count_students_for_project(db: Session, project_id: int, school_id: int) -> int:
    """Count unique students in all project teams for a project."""
    return (
        db.query(func.count(func.distinct(ProjectTeamMember.user_id)))
        .join(ProjectTeam, ProjectTeam.id == ProjectTeamMember.project_team_id)
        .filter(
            ProjectTeam.project_id == project_id,
            ProjectTeam.school_id == school_id,
        )
        .scalar()
        or 0
    )


def _build_round_out(db: Session, r: ProjectFeedbackRound, school_id: int) -> ProjectFeedbackRoundOut:
    question_count = (
        db.query(func.count(ProjectFeedbackQuestion.id))
        .filter(ProjectFeedbackQuestion.round_id == r.id)
        .scalar()
        or 0
    )
    response_count = (
        db.query(func.count(ProjectFeedbackResponse.id))
        .filter(
            ProjectFeedbackResponse.round_id == r.id,
            ProjectFeedbackResponse.submitted_at.isnot(None),
        )
        .scalar()
        or 0
    )
    total_students = _count_students_for_project(db, r.project_id, school_id)

    # Average rating across all rating answers for this round
    avg_rating = (
        db.query(func.avg(ProjectFeedbackAnswer.rating_value))
        .join(
            ProjectFeedbackResponse,
            ProjectFeedbackResponse.id == ProjectFeedbackAnswer.response_id,
        )
        .join(
            ProjectFeedbackQuestion,
            ProjectFeedbackQuestion.id == ProjectFeedbackAnswer.question_id,
        )
        .filter(
            ProjectFeedbackResponse.round_id == r.id,
            ProjectFeedbackQuestion.question_type == "rating",
            ProjectFeedbackAnswer.rating_value.isnot(None),
        )
        .scalar()
    )

    return ProjectFeedbackRoundOut(
        id=r.id,
        project_id=r.project_id,
        title=r.title,
        status=r.status,
        question_count=question_count,
        response_count=response_count,
        total_students=total_students,
        avg_rating=round(float(avg_rating), 2) if avg_rating is not None else None,
        created_at=r.created_at,
    )


# ============================================================
# Teacher / Admin endpoints
# ============================================================


@router.post("", response_model=ProjectFeedbackRoundOut, status_code=status.HTTP_201_CREATED)
def create_feedback_round(
    payload: ProjectFeedbackRoundCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new feedback round for a project (teacher/admin only)."""
    require_role(user, ["teacher", "admin"])

    # Verify project belongs to school
    project = (
        db.query(Project)
        .filter(Project.id == payload.project_id, Project.school_id == user.school_id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    round_ = ProjectFeedbackRound(
        school_id=user.school_id,
        project_id=payload.project_id,
        teacher_id=user.id,
        title=payload.title,
        status="draft",
    )
    db.add(round_)
    db.flush()

    # Seed questions: use provided questions or defaults
    questions_to_seed = payload.questions or []
    if not questions_to_seed:
        for q in DEFAULT_QUESTIONS:
            db.add(
                ProjectFeedbackQuestion(
                    school_id=user.school_id,
                    round_id=round_.id,
                    **q,
                )
            )
    else:
        for q in questions_to_seed:
            db.add(
                ProjectFeedbackQuestion(
                    school_id=user.school_id,
                    round_id=round_.id,
                    question_text=q.question_text,
                    question_type=q.question_type,
                    order=q.order,
                    is_required=q.is_required,
                )
            )

    db.commit()
    db.refresh(round_)
    return _build_round_out(db, round_, user.school_id)


@router.get("", response_model=List[ProjectFeedbackRoundOut])
def list_feedback_rounds(
    project_id: Optional[int] = Query(None),
    round_status: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List feedback rounds (teacher/admin) or open rounds (student)."""
    q = db.query(ProjectFeedbackRound).filter(
        ProjectFeedbackRound.school_id == user.school_id
    )
    if project_id:
        q = q.filter(ProjectFeedbackRound.project_id == project_id)
    if round_status:
        q = q.filter(ProjectFeedbackRound.status == round_status)
    if user.role == "student":
        q = q.filter(ProjectFeedbackRound.status == "open")

    rounds = q.order_by(ProjectFeedbackRound.created_at.desc()).all()
    return [_build_round_out(db, r, user.school_id) for r in rounds]


@router.get("/student", response_model=List[ProjectFeedbackRoundOut])
def list_student_feedback_rounds(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List open feedback rounds for the current student based on their project teams."""
    require_role(user, ["student"])

    # Find projects this student belongs to
    project_ids = (
        db.query(func.distinct(ProjectTeam.project_id))
        .join(ProjectTeamMember, ProjectTeamMember.project_team_id == ProjectTeam.id)
        .filter(
            ProjectTeamMember.user_id == user.id,
            ProjectTeam.school_id == user.school_id,
        )
        .all()
    )
    project_id_list = [p[0] for p in project_ids]

    rounds = (
        db.query(ProjectFeedbackRound)
        .filter(
            ProjectFeedbackRound.school_id == user.school_id,
            ProjectFeedbackRound.status == "open",
            ProjectFeedbackRound.project_id.in_(project_id_list),
        )
        .order_by(ProjectFeedbackRound.created_at.desc())
        .all()
    )
    return [_build_round_out(db, r, user.school_id) for r in rounds]


@router.get("/{round_id}", response_model=ProjectFeedbackRoundDetail)
def get_feedback_round(
    round_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get round detail with questions."""
    r = _get_round_or_404(db, round_id, user.school_id)

    # Students can only see open rounds
    if user.role == "student" and r.status != "open":
        raise HTTPException(status_code=403, detail="Round is not open")

    base = _build_round_out(db, r, user.school_id)
    questions = (
        db.query(ProjectFeedbackQuestion)
        .filter(ProjectFeedbackQuestion.round_id == round_id)
        .order_by(ProjectFeedbackQuestion.order.asc())
        .all()
    )
    return ProjectFeedbackRoundDetail(
        **base.model_dump(),
        questions=[ProjectFeedbackQuestionOut.model_validate(q) for q in questions],
        closed_at=r.closed_at,
    )


@router.put("/{round_id}", response_model=ProjectFeedbackRoundOut)
def update_feedback_round(
    round_id: int,
    payload: ProjectFeedbackRoundUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update round title and/or questions (teacher/admin only)."""
    require_role(user, ["teacher", "admin"])
    r = _get_round_or_404(db, round_id, user.school_id)

    if payload.title is not None:
        r.title = payload.title

    if payload.questions is not None:
        # Replace all questions
        db.query(ProjectFeedbackQuestion).filter(
            ProjectFeedbackQuestion.round_id == round_id
        ).delete()
        for q in payload.questions:
            db.add(
                ProjectFeedbackQuestion(
                    school_id=user.school_id,
                    round_id=round_id,
                    question_text=q.question_text,
                    question_type=q.question_type,
                    order=q.order,
                    is_required=q.is_required,
                )
            )

    db.commit()
    db.refresh(r)
    return _build_round_out(db, r, user.school_id)


@router.delete("/{round_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_feedback_round(
    round_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a feedback round (teacher/admin only)."""
    require_role(user, ["teacher", "admin"])
    r = _get_round_or_404(db, round_id, user.school_id)
    db.delete(r)
    db.commit()


@router.post("/{round_id}/open", response_model=ProjectFeedbackRoundOut)
def open_feedback_round(
    round_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Open a feedback round so students can submit responses."""
    require_role(user, ["teacher", "admin"])
    r = _get_round_or_404(db, round_id, user.school_id)
    if r.status == "open":
        raise HTTPException(status_code=400, detail="Round is already open")
    r.status = "open"
    db.commit()
    db.refresh(r)
    return _build_round_out(db, r, user.school_id)


@router.post("/{round_id}/close", response_model=ProjectFeedbackRoundOut)
def close_feedback_round(
    round_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Close a feedback round."""
    require_role(user, ["teacher", "admin"])
    r = _get_round_or_404(db, round_id, user.school_id)
    if r.status == "closed":
        raise HTTPException(status_code=400, detail="Round is already closed")
    r.status = "closed"
    r.closed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(r)
    return _build_round_out(db, r, user.school_id)


@router.get("/{round_id}/results", response_model=ProjectFeedbackResults)
def get_feedback_results(
    round_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get aggregated results for a feedback round (teacher/admin only)."""
    require_role(user, ["teacher", "admin"])
    r = _get_round_or_404(db, round_id, user.school_id)
    round_out = _build_round_out(db, r, user.school_id)

    questions = (
        db.query(ProjectFeedbackQuestion)
        .filter(ProjectFeedbackQuestion.round_id == round_id)
        .order_by(ProjectFeedbackQuestion.order.asc())
        .all()
    )

    # Gather all submitted responses for this round
    submitted_response_ids = [
        row[0]
        for row in db.query(ProjectFeedbackResponse.id)
        .filter(
            ProjectFeedbackResponse.round_id == round_id,
            ProjectFeedbackResponse.submitted_at.isnot(None),
        )
        .all()
    ]

    question_results: List[QuestionResultOut] = []
    for q in questions:
        answers = (
            db.query(ProjectFeedbackAnswer)
            .filter(
                ProjectFeedbackAnswer.question_id == q.id,
                ProjectFeedbackAnswer.response_id.in_(submitted_response_ids),
            )
            .all()
        )

        if q.question_type in ("rating", "scale10"):
            rating_values = [a.rating_value for a in answers if a.rating_value is not None]
            avg = round(sum(rating_values) / len(rating_values), 2) if rating_values else None
            distribution: dict[int, int] = {}
            for v in rating_values:
                distribution[v] = distribution.get(v, 0) + 1
            question_results.append(
                QuestionResultOut(
                    id=q.id,
                    question_text=q.question_text,
                    question_type=q.question_type,
                    order=q.order,
                    is_required=q.is_required,
                    avg_rating=avg,
                    rating_distribution=distribution if distribution else None,
                    open_answers=None,
                )
            )
        else:
            text_answers = [a.text_value for a in answers if a.text_value]
            question_results.append(
                QuestionResultOut(
                    id=q.id,
                    question_text=q.question_text,
                    question_type=q.question_type,
                    order=q.order,
                    is_required=q.is_required,
                    avg_rating=None,
                    rating_distribution=None,
                    open_answers=text_answers,
                )
            )

    total_students = round_out.total_students
    response_rate = (
        round(round_out.response_count / total_students * 100, 1)
        if total_students > 0
        else 0.0
    )

    return ProjectFeedbackResults(
        round=round_out,
        questions=question_results,
        response_rate=response_rate,
    )


# ============================================================
# Student endpoints
# ============================================================


@router.get("/{round_id}/my-response", response_model=ProjectFeedbackResponseOut)
def get_my_response(
    round_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get the current student's response for a round."""
    require_role(user, ["student"])
    _get_round_or_404(db, round_id, user.school_id)

    resp = (
        db.query(ProjectFeedbackResponse)
        .filter(
            ProjectFeedbackResponse.round_id == round_id,
            ProjectFeedbackResponse.student_id == user.id,
        )
        .first()
    )
    if not resp:
        raise HTTPException(status_code=404, detail="No response found")

    answers = (
        db.query(ProjectFeedbackAnswer)
        .filter(ProjectFeedbackAnswer.response_id == resp.id)
        .all()
    )
    return ProjectFeedbackResponseOut(
        id=resp.id,
        round_id=resp.round_id,
        student_id=resp.student_id,
        submitted_at=resp.submitted_at,
        answers=[ProjectFeedbackAnswerOut.model_validate(a) for a in answers],
    )


@router.post("/{round_id}/submit", response_model=ProjectFeedbackResponseOut, status_code=status.HTTP_201_CREATED)
def submit_feedback(
    round_id: int,
    payload: ProjectFeedbackSubmission,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Submit feedback answers for a round (student only)."""
    require_role(user, ["student"])
    r = _get_round_or_404(db, round_id, user.school_id)

    if r.status != "open":
        raise HTTPException(status_code=400, detail="Round is not open for submissions")

    # Check for existing response
    existing = (
        db.query(ProjectFeedbackResponse)
        .filter(
            ProjectFeedbackResponse.round_id == round_id,
            ProjectFeedbackResponse.student_id == user.id,
        )
        .first()
    )
    if existing and existing.submitted_at is not None:
        raise HTTPException(status_code=400, detail="You have already submitted feedback for this round")

    # Validate question ids belong to this round
    valid_question_ids = {
        row[0]
        for row in db.query(ProjectFeedbackQuestion.id)
        .filter(ProjectFeedbackQuestion.round_id == round_id)
        .all()
    }
    for answer in payload.answers:
        if answer.question_id not in valid_question_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Question {answer.question_id} does not belong to this round",
            )

    now = datetime.now(timezone.utc)

    if existing:
        # Update existing draft
        resp = existing
        resp.submitted_at = now
        db.query(ProjectFeedbackAnswer).filter(
            ProjectFeedbackAnswer.response_id == resp.id
        ).delete()
    else:
        resp = ProjectFeedbackResponse(
            school_id=user.school_id,
            round_id=round_id,
            student_id=user.id,
            submitted_at=now,
        )
        db.add(resp)
        db.flush()

    for answer_in in payload.answers:
        db.add(
            ProjectFeedbackAnswer(
                school_id=user.school_id,
                response_id=resp.id,
                question_id=answer_in.question_id,
                rating_value=answer_in.rating_value,
                text_value=answer_in.text_value,
            )
        )

    db.commit()
    db.refresh(resp)

    answers = (
        db.query(ProjectFeedbackAnswer)
        .filter(ProjectFeedbackAnswer.response_id == resp.id)
        .all()
    )
    return ProjectFeedbackResponseOut(
        id=resp.id,
        round_id=resp.round_id,
        student_id=resp.student_id,
        submitted_at=resp.submitted_at,
        answers=[ProjectFeedbackAnswerOut.model_validate(a) for a in answers],
    )
