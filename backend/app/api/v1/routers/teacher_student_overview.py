"""
Teacher Student Overview API endpoints
======================================

Provides endpoints for teachers to view comprehensive student overview data,
including peer evaluations, competency data, learning goals, reflections, and project assessments.
"""

from __future__ import annotations
from typing import List, Dict, Any, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, and_
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    User,
    Evaluation,
    Allocation,
    Grade,
    CompetencyWindow,
    CompetencySelfScore,
    CompetencyGoal,
    CompetencyReflection,
    CompetencyCategory,
    Competency,
    Group,
    GroupMember,
)
from pydantic import BaseModel


router = APIRouter(prefix="/teacher/students", tags=["teacher-student-overview"])


# ============ Response Schemas ============


class OMZAAverage(BaseModel):
    key: str
    label: str
    value: float


class TeacherOMZA(BaseModel):
    O: Optional[int] = None
    M: Optional[int] = None
    Z: Optional[int] = None
    A: Optional[int] = None


class PeerScore(BaseModel):
    peerLabel: str
    scores: Dict[str, float]  # OMZA scores as a dictionary
    notes: Optional[str] = None


class EvaluationResultForOverview(BaseModel):
    id: int
    title: str
    status: str
    omzaAverages: List[OMZAAverage]
    peers: List[PeerScore]
    teacherOmza: Optional[TeacherOMZA] = None
    teacherComments: Optional[str] = None
    teacherGradeComment: Optional[str] = None
    aiSummary: Optional[str] = None


class CompetencyProfile(BaseModel):
    category: str
    value: float


class LearningGoal(BaseModel):
    id: str
    title: str
    status: str
    related: str
    since: Optional[str] = None


class Reflection(BaseModel):
    id: str
    title: str
    type: str
    date: str


class ProjectResult(BaseModel):
    id: str
    project: str
    meta: Optional[str] = None
    opdrachtgever: Optional[str] = None
    periode: Optional[str] = None
    eindcijfer: Optional[float] = None
    proces: Optional[float] = None
    eindresultaat: Optional[float] = None
    communicatie: Optional[float] = None


class StudentOverviewResponse(BaseModel):
    peerResults: List[EvaluationResultForOverview]
    competencyProfile: List[CompetencyProfile]
    learningGoals: List[LearningGoal]
    reflections: List[Reflection]
    projectResults: List[ProjectResult]


# ============ Helper Functions ============

DEFAULT_OMZA_CATEGORY_MAPPING: Dict[str, str] = {
    "Plannen & Organiseren": "organiseren",
    "plannen & organiseren": "organiseren",
    "organiseren": "organiseren",
    "Organiseren": "organiseren",
    "Samenwerken": "meedoen",
    "samenwerken": "meedoen",
    "meedoen": "meedoen",
    "Meedoen": "meedoen",
    "Communicatie & Presenteren": "zelfvertrouwen",
    "communicatie & presenteren": "zelfvertrouwen",
    "zelfvertrouwen": "zelfvertrouwen",
    "Zelfvertrouwen": "zelfvertrouwen",
    "Reflectie & Professionele houding": "autonomie",
    "reflectie & professionele houding": "autonomie",
    "autonomie": "autonomie",
    "Autonomie": "autonomie",
    "Creatief denken & probleemoplossen": "autonomie",
    "Technische vaardigheden": "organiseren",
}


def _calculate_competency_profile(
    db: Session, user_id: int, school_id: int
) -> List[CompetencyProfile]:
    """Calculate competency profile aggregated across all windows."""
    results = (
        db.execute(
            select(
                CompetencyCategory.name,
                func.avg(CompetencySelfScore.score).label("avg_score"),
            )
            .select_from(CompetencySelfScore)
            .join(Competency, Competency.id == CompetencySelfScore.competency_id)
            .join(
                CompetencyCategory, CompetencyCategory.id == Competency.category_id
            )
            .where(
                CompetencySelfScore.user_id == user_id,
                CompetencySelfScore.school_id == school_id,
            )
            .group_by(CompetencyCategory.name)
        )
        .all()
    )

    return [
        CompetencyProfile(category=name, value=round(float(avg_score), 2))
        for name, avg_score in results
        if avg_score is not None
    ]


def _get_learning_goals(
    db: Session, user_id: int, school_id: int
) -> List[LearningGoal]:
    """Get all learning goals for a student."""
    goals = (
        db.query(CompetencyGoal)
        .filter(
            CompetencyGoal.user_id == user_id,
            CompetencyGoal.school_id == school_id,
        )
        .order_by(CompetencyGoal.created_at.desc())
        .all()
    )

    result = []
    for goal in goals:
        # Get related competency categories
        related_categories = []
        if goal.competency_id:
            competency = db.get(Competency, goal.competency_id)
            if competency and competency.category_id:
                category = db.get(CompetencyCategory, competency.category_id)
                if category:
                    related_categories.append(category.name)

        # Map status: achieved -> afgerond, else -> actief
        status = "afgerond" if goal.status == "achieved" else "actief"

        result.append(
            LearningGoal(
                id=str(goal.id),
                title=goal.goal_text or "Leerdoel",
                status=status,
                related=", ".join(related_categories) if related_categories else "",
                since=goal.created_at.strftime("%d-%m-%Y") if goal.created_at else None,
            )
        )

    return result


def _get_reflections(db: Session, user_id: int, school_id: int) -> List[Reflection]:
    """Get all reflections for a student (competency scans and peer evaluations)."""
    reflections_list = []

    # Get competency scan reflections
    comp_reflections = (
        db.query(CompetencyReflection, CompetencyWindow)
        .join(
            CompetencyWindow,
            CompetencyWindow.id == CompetencyReflection.window_id,
        )
        .filter(
            CompetencyReflection.user_id == user_id,
            CompetencyReflection.school_id == school_id,
        )
        .order_by(CompetencyReflection.created_at.desc())
        .all()
    )

    for refl, window in comp_reflections:
        reflections_list.append(
            Reflection(
                id=f"comp-{refl.id}",
                title=window.title or "Competentiescan",
                type="Competentiescan",
                date=refl.created_at.strftime("%d-%m-%Y") if refl.created_at else "",
            )
        )

    # Get peer evaluation reflections
    from app.infra.db.models import Reflection as EvalReflection

    eval_reflections = (
        db.query(EvalReflection, Evaluation)
        .join(Evaluation, Evaluation.id == EvalReflection.evaluation_id)
        .filter(
            EvalReflection.user_id == user_id,
            EvalReflection.school_id == school_id,
            EvalReflection.submitted_at.isnot(None),
        )
        .order_by(EvalReflection.submitted_at.desc())
        .all()
    )

    for refl, evaluation in eval_reflections:
        reflections_list.append(
            Reflection(
                id=f"eval-{refl.id}",
                title=evaluation.title or "Peerevaluatie",
                type="Peerevaluatie",
                date=(
                    refl.submitted_at.strftime("%d-%m-%Y")
                    if refl.submitted_at
                    else ""
                ),
            )
        )

    return reflections_list


def _get_peer_results(
    db: Session, user_id: int, school_id: int
) -> List[EvaluationResultForOverview]:
    """Get peer evaluation results for a student."""
    from app.infra.db.models import Score, RubricCriterion

    # Get evaluations where student was evaluated
    # Use distinct on ID to avoid issues with JSON columns
    evaluation_ids = (
        db.query(Evaluation.id)
        .join(Allocation, Allocation.evaluation_id == Evaluation.id)
        .filter(
            Allocation.reviewee_id == user_id,
            Allocation.school_id == school_id,
            Evaluation.status == "closed",
        )
        .distinct()
        .all()
    )
    
    # Fetch full evaluation objects if we have IDs
    if not evaluation_ids:
        return []
    
    evaluation_id_list = [e_id for (e_id,) in evaluation_ids]
    evaluations = (
        db.query(Evaluation)
        .filter(Evaluation.id.in_(evaluation_id_list))
        .order_by(Evaluation.created_at.desc())
        .all()
    )

    results = []
    for evaluation in evaluations:
        # Get all scores received by this student in this evaluation
        allocations = (
            db.query(Allocation)
            .filter(
                Allocation.evaluation_id == evaluation.id,
                Allocation.reviewee_id == user_id,
                Allocation.school_id == school_id,
            )
            .all()
        )

        # Calculate OMZA averages from peer scores
        omza_scores = {
            "organiseren": [],
            "meedoen": [],
            "zelfvertrouwen": [],
            "autonomie": [],
        }

        peers = []
        for alloc in allocations:
            if alloc.reviewer_id == user_id:  # Skip self-assessment
                continue

            reviewer = db.get(User, alloc.reviewer_id)
            if not reviewer:
                continue

            # Get scores for this allocation
            scores = (
                db.query(Score, RubricCriterion)
                .join(RubricCriterion, RubricCriterion.id == Score.criterion_id)
                .filter(Score.allocation_id == alloc.id)
                .all()
            )

            # Map scores to OMZA categories (simplified mapping)
            peer_omza = {
                "organiseren": 3.0,
                "meedoen": 3.0,
                "zelfvertrouwen": 3.0,
                "autonomie": 3.0,
            }

            # Average all scores as a simple approach
            if scores:
                avg_score = sum(s.score for s, _ in scores) / len(scores)
                for key in peer_omza:
                    peer_omza[key] = avg_score
                    omza_scores[key].append(avg_score)

            # Create PeerScore with peerLabel and scores dict
            peers.append(
                PeerScore(
                    peerLabel=reviewer.name,
                    scores=peer_omza,
                )
            )

        # Calculate OMZA averages
        omza_averages = []
        labels = {
            "organiseren": "Organiseren",
            "meedoen": "Meedoen",
            "zelfvertrouwen": "Zelfvertrouwen",
            "autonomie": "Autonomie",
        }
        for key, label in labels.items():
            values = omza_scores[key]
            avg = sum(values) / len(values) if values else 0.0
            omza_averages.append(
                OMZAAverage(key=key[0].upper(), label=label, value=round(avg, 1))
            )

        # Get grade and teacher comments
        grade = (
            db.query(Grade)
            .filter(
                Grade.evaluation_id == evaluation.id,
                Grade.user_id == user_id,
                Grade.school_id == school_id,
            )
            .first()
        )

        teacher_omza = None
        teacher_comments = None
        if grade:
            meta = grade.meta or {}
            if "teacher_omza" in meta:
                tomza = meta["teacher_omza"]
                teacher_omza = TeacherOMZA(
                    O=tomza.get("O"),
                    M=tomza.get("M"),
                    Z=tomza.get("Z"),
                    A=tomza.get("A"),
                )
            teacher_comments = grade.override_reason

        results.append(
            EvaluationResultForOverview(
                id=evaluation.id,
                title=evaluation.title or "Evaluatie",
                status=evaluation.status,
                omzaAverages=omza_averages,
                peers=peers,
                teacherOmza=teacher_omza,
                teacherComments=teacher_comments,
                teacherGradeComment=teacher_comments,
                aiSummary=None,
            )
        )

    return results


# ============ API Endpoints ============


@router.get("/{student_id}/overview", response_model=StudentOverviewResponse)
def get_student_overview(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get comprehensive overview data for a specific student.
    This endpoint is for teachers to view student data.
    
    Returns the same structure as the student overview tab, including:
    - Peer evaluation results with OMZA scores
    - Competency profile
    - Learning goals
    - Reflections
    - Project assessments (currently empty - will be populated from frontend)
    """
    # Verify student exists and belongs to same school
    student = (
        db.query(User)
        .filter(
            User.id == student_id,
            User.school_id == current_user.school_id,
        )
        .first()
    )

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    school_id = current_user.school_id

    # Get all overview data
    peer_results = _get_peer_results(db, student_id, school_id)
    competency_profile = _calculate_competency_profile(db, student_id, school_id)
    learning_goals = _get_learning_goals(db, student_id, school_id)
    reflections = _get_reflections(db, student_id, school_id)

    # Project results are fetched from frontend since they use existing
    # project assessment service
    project_results = []

    return StudentOverviewResponse(
        peerResults=peer_results,
        competencyProfile=competency_profile,
        learningGoals=learning_goals,
        reflections=reflections,
        projectResults=project_results,
    )
