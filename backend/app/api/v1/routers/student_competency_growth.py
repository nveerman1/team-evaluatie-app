"""
Student Competency Growth API endpoints
======================================

Provides endpoints for the student growth page showing:
- Scan history with OMZA scores
- Competency profile (aggregated scores by category)
- Learning goals
- Reflections
- AI-generated summary
"""

from __future__ import annotations
from typing import Dict, List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    User,
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


# ============ Constants ============

# Maximum length for reflection snippet in the growth page
REFLECTION_SNIPPET_MAX_LENGTH = 150

# Default score when no data is available (middle of 1-5 scale)
DEFAULT_OMZA_SCORE = 3.0

# Default mapping from competency categories to OMZA domains
# Note: In a production system, this could be configured per school in the database
DEFAULT_OMZA_CATEGORY_MAPPING: Dict[str, str] = {
    # Plannen & Organiseren -> Organiseren
    "Plannen & Organiseren": "organiseren",
    "plannen & organiseren": "organiseren",
    "organiseren": "organiseren",
    "Organiseren": "organiseren",
    # Samenwerken -> Meedoen
    "Samenwerken": "meedoen",
    "samenwerken": "meedoen",
    "meedoen": "meedoen",
    "Meedoen": "meedoen",
    # Communicatie & Presenteren -> Zelfvertrouwen
    "Communicatie & Presenteren": "zelfvertrouwen",
    "communicatie & presenteren": "zelfvertrouwen",
    "zelfvertrouwen": "zelfvertrouwen",
    "Zelfvertrouwen": "zelfvertrouwen",
    # Reflectie & Professionele houding -> Autonomie
    "Reflectie & Professionele houding": "autonomie",
    "reflectie & professionele houding": "autonomie",
    "autonomie": "autonomie",
    "Autonomie": "autonomie",
    # Additional mappings for flexibility
    "Creatief denken & probleemoplossen": "autonomie",
    "Technische vaardigheden": "organiseren",
}


# ============ Response Schemas ============


class OMZAScores(BaseModel):
    organiseren: float
    meedoen: float
    zelfvertrouwen: float
    autonomie: float


class GrowthScanSummary(BaseModel):
    id: str
    title: str
    date: str
    type: str  # start, tussen, eind, los
    omza: OMZAScores
    gcf: float
    has_reflection: bool
    goals_linked: int


class GrowthCategoryScore(BaseModel):
    name: str
    value: float


class GrowthGoal(BaseModel):
    id: str
    title: str
    status: str  # active, completed
    related_competencies: List[str]
    progress: int


class GrowthReflection(BaseModel):
    id: str
    date: str
    scan_title: str
    snippet: str


class GrowthCompetencyScore(BaseModel):
    competency_id: int
    competency_name: str
    category_name: Optional[str]
    most_recent_score: Optional[float]
    window_id: Optional[int]
    window_title: Optional[str]
    scan_date: Optional[str]


class StudentGrowthData(BaseModel):
    scans: List[GrowthScanSummary]
    competency_profile: List[GrowthCategoryScore]
    competency_scores: List[GrowthCompetencyScore]  # New field
    goals: List[GrowthGoal]
    reflections: List[GrowthReflection]
    ai_summary: Optional[str]


class AISummaryResponse(BaseModel):
    ai_summary: str


router = APIRouter(prefix="/student/competency", tags=["student-competency-growth"])


# ============ Helper Functions ============


def _determine_scan_type(title: str) -> str:
    """Determine scan type based on title keywords"""
    title_lower = title.lower()
    if "start" in title_lower:
        return "start"
    elif "tussen" in title_lower or "mid" in title_lower:
        return "tussen"
    elif "eind" in title_lower or "final" in title_lower:
        return "eind"
    else:
        return "los"


def _format_date(dt: Optional[datetime]) -> str:
    """Format datetime to DD-MM-YYYY string"""
    if dt is None:
        return ""
    return dt.strftime("%d-%m-%Y")


def _calculate_average_or_default(
    scores: List[float], default: float = DEFAULT_OMZA_SCORE
) -> float:
    """Calculate average of scores or return default if empty"""
    if not scores:
        return default
    return sum(scores) / len(scores)


def _calculate_omza_scores(
    db: Session, window_id: int, user_id: int, school_id: int
) -> OMZAScores:
    """
    Calculate OMZA scores from self-assessment scores for a window.
    Maps competency categories to OMZA domains.
    """
    # Get all self scores for this window and user
    self_scores = (
        db.execute(
            select(CompetencySelfScore, Competency)
            .join(Competency, Competency.id == CompetencySelfScore.competency_id)
            .where(
                CompetencySelfScore.window_id == window_id,
                CompetencySelfScore.user_id == user_id,
                CompetencySelfScore.school_id == school_id,
            )
        )
        .all()
    )

    # Aggregate scores by OMZA domain
    omza_scores: Dict[str, List[float]] = {
        "organiseren": [],
        "meedoen": [],
        "zelfvertrouwen": [],
        "autonomie": [],
    }

    for score, competency in self_scores:
        # Try to map via category name from the competency's category relationship
        category_name = None
        if competency.category_id:
            category = db.get(CompetencyCategory, competency.category_id)
            if category:
                category_name = category.name

        # Fallback to legacy category field
        if not category_name:
            category_name = competency.category

        if category_name:
            domain = DEFAULT_OMZA_CATEGORY_MAPPING.get(category_name)
            if domain:
                omza_scores[domain].append(float(score.score))

    # Calculate averages using helper function
    return OMZAScores(
        organiseren=_calculate_average_or_default(omza_scores["organiseren"]),
        meedoen=_calculate_average_or_default(omza_scores["meedoen"]),
        zelfvertrouwen=_calculate_average_or_default(omza_scores["zelfvertrouwen"]),
        autonomie=_calculate_average_or_default(omza_scores["autonomie"]),
    )


def _calculate_competency_profile(
    db: Session, user_id: int, school_id: int
) -> List[GrowthCategoryScore]:
    """
    Calculate competency profile aggregated across all windows.
    Returns average scores per competency category.
    """
    # Get all self scores for this user grouped by category
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
            .order_by(CompetencyCategory.name)
        )
        .all()
    )

    profile = []
    for name, avg_score in results:
        if name and avg_score:
            profile.append(
                GrowthCategoryScore(
                    name=name,
                    value=round(float(avg_score), 1),
                )
            )

    # If no profile data, return empty list
    return profile


def _calculate_competency_scores(
    db: Session, user_id: int, school_id: int
) -> List[GrowthCompetencyScore]:
    """
    Calculate most recent scores for all competencies the student has assessed.
    Returns a list with the most recent score for each competency.
    """
    # Get all competencies the student has scored, with their most recent score
    # Group by competency and get the latest window
    results = (
        db.execute(
            select(
                CompetencySelfScore.competency_id,
                CompetencySelfScore.window_id,
                CompetencySelfScore.score,
                Competency.name,
                CompetencyCategory.name.label("category_name"),
                CompetencyWindow.title,
                CompetencyWindow.start_date,
            )
            .select_from(CompetencySelfScore)
            .join(Competency, Competency.id == CompetencySelfScore.competency_id)
            .outerjoin(
                CompetencyCategory, CompetencyCategory.id == Competency.category_id
            )
            .join(CompetencyWindow, CompetencyWindow.id == CompetencySelfScore.window_id)
            .where(
                CompetencySelfScore.user_id == user_id,
                CompetencySelfScore.school_id == school_id,
            )
            .order_by(
                CompetencySelfScore.competency_id,
                CompetencyWindow.start_date.desc(),
            )
        )
        .all()
    )

    # Get the most recent score for each competency
    competency_scores = {}
    for (
        competency_id,
        window_id,
        score,
        competency_name,
        category_name,
        window_title,
        start_date,
    ) in results:
        # Only keep the first (most recent) entry for each competency
        if competency_id not in competency_scores:
            competency_scores[competency_id] = GrowthCompetencyScore(
                competency_id=competency_id,
                competency_name=competency_name,
                category_name=category_name,
                most_recent_score=round(float(score), 1) if score else None,
                window_id=window_id,
                window_title=window_title,
                scan_date=_format_date(start_date),
            )

    # Convert to list and sort by category then competency name
    scores_list = list(competency_scores.values())
    scores_list.sort(
        key=lambda x: (
            x.category_name or "ZZZ",  # Sort None to end
            x.competency_name,
        )
    )

    return scores_list


def _get_goal_progress(goal_status: str) -> int:
    """Convert goal status to progress percentage"""
    if goal_status == "achieved":
        return 100
    elif goal_status == "not_achieved":
        return 0
    else:  # in_progress
        return 50  # Default progress for in-progress goals


def _get_goal_status_mapped(goal_status: str) -> str:
    """Map internal status to frontend status"""
    if goal_status == "achieved":
        return "completed"
    else:
        return "active"


def _generate_ai_summary(
    scans: List[GrowthScanSummary],
    profile: List[GrowthCategoryScore],
    goals: List[GrowthGoal],
) -> Optional[str]:
    """
    Generate a simple AI summary based on the growth data.
    In production, this would call an LLM API.
    """
    if not scans and not profile:
        return None

    # Find strongest and weakest categories
    if profile:
        sorted_profile = sorted(profile, key=lambda x: x.value, reverse=True)
        strongest = sorted_profile[0] if sorted_profile else None
        weakest = sorted_profile[-1] if len(sorted_profile) > 1 else None
    else:
        strongest = None
        weakest = None

    # Count active vs completed goals
    active_goals = len([g for g in goals if g.status == "active"])
    completed_goals = len([g for g in goals if g.status == "completed"])

    # Build summary
    parts = []

    if strongest:
        parts.append(
            f"Je laat de meeste groei zien in {strongest.name} "
            f"(gemiddeld {strongest.value:.1f})."
        )

    if weakest and weakest != strongest:
        parts.append(
            f"{weakest.name} is nog een aandachtspunt "
            f"(gemiddeld {weakest.value:.1f})."
        )

    if active_goals > 0:
        parts.append(
            f"Je hebt {active_goals} actief leerdoel{'en' if active_goals > 1 else ''}."
        )

    if completed_goals > 0:
        parts.append(
            f"Je hebt al {completed_goals} leerdoel{'en' if completed_goals > 1 else ''} behaald!"
        )

    if len(scans) > 1:
        parts.append(
            "Bekijk je voortgang in de grafieken om te zien hoe je je ontwikkelt over tijd."
        )

    return " ".join(parts) if parts else None


# ============ API Endpoints ============


@router.get("/growth", response_model=StudentGrowthData)
def get_student_growth_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get comprehensive growth data for the current student.
    Returns scan history, competency profile, goals, reflections, and AI summary.
    
    This endpoint returns data for the authenticated user regardless of role.
    Teachers/admins can use this to preview the student experience.
    """
    school_id = current_user.school_id
    user_id = current_user.id

    # Get course IDs where student is enrolled
    student_course_ids = (
        db.query(Group.course_id)
        .join(GroupMember, GroupMember.group_id == Group.id)
        .filter(
            GroupMember.user_id == user_id,
            GroupMember.active.is_(True),
            Group.school_id == school_id,
        )
        .distinct()
        .all()
    )
    course_ids = [cid for (cid,) in student_course_ids if cid]

    # 1. Get all windows where student has submitted scores
    window_ids_with_scores = (
        db.query(CompetencySelfScore.window_id)
        .filter(
            CompetencySelfScore.user_id == user_id,
            CompetencySelfScore.school_id == school_id,
        )
        .distinct()
        .all()
    )
    window_ids = [wid for (wid,) in window_ids_with_scores]

    # Get windows ordered by date
    windows = []
    if window_ids:
        windows = (
            db.query(CompetencyWindow)
            .filter(
                CompetencyWindow.id.in_(window_ids),
                CompetencyWindow.school_id == school_id,
            )
            .order_by(CompetencyWindow.start_date.asc())
            .all()
        )

    # 2. Build scan summaries
    scans = []
    for window in windows:
        # Calculate OMZA scores for this window
        omza = _calculate_omza_scores(db, window.id, user_id, school_id)

        # Check if reflection exists
        has_reflection = (
            db.query(CompetencyReflection)
            .filter(
                CompetencyReflection.window_id == window.id,
                CompetencyReflection.user_id == user_id,
            )
            .first()
            is not None
        )

        # Count linked goals
        goals_linked = (
            db.query(CompetencyGoal)
            .filter(
                CompetencyGoal.window_id == window.id,
                CompetencyGoal.user_id == user_id,
            )
            .count()
        )

        # Calculate GCF (Group Contribution Factor) - simplified average
        gcf = (omza.organiseren + omza.meedoen + omza.zelfvertrouwen + omza.autonomie) / 4

        scans.append(
            GrowthScanSummary(
                id=str(window.id),
                title=window.title,
                date=_format_date(window.start_date),
                type=_determine_scan_type(window.title),
                omza=omza,
                gcf=round(gcf, 1),
                has_reflection=has_reflection,
                goals_linked=goals_linked,
            )
        )

    # 3. Calculate competency profile
    competency_profile = _calculate_competency_profile(db, user_id, school_id)

    # 3b. Calculate individual competency scores (most recent per competency)
    competency_scores = _calculate_competency_scores(db, user_id, school_id)

    # 4. Get goals (all windows, most recent first)
    goals_data = (
        db.query(CompetencyGoal, Competency)
        .outerjoin(Competency, Competency.id == CompetencyGoal.competency_id)
        .filter(
            CompetencyGoal.user_id == user_id,
            CompetencyGoal.school_id == school_id,
        )
        .order_by(CompetencyGoal.updated_at.desc())
        .all()
    )

    goals = []
    for goal, competency in goals_data:
        # Get related competency categories
        related_competencies = []
        if competency:
            if competency.category_id:
                category = db.get(CompetencyCategory, competency.category_id)
                if category:
                    related_competencies.append(category.name)
            elif competency.category:
                related_competencies.append(competency.category)

        goals.append(
            GrowthGoal(
                id=str(goal.id),
                title=goal.goal_text,
                status=_get_goal_status_mapped(goal.status),
                related_competencies=related_competencies,
                progress=_get_goal_progress(goal.status),
            )
        )

    # 5. Get reflections (all windows, most recent first)
    reflections_data = (
        db.query(CompetencyReflection, CompetencyWindow)
        .join(CompetencyWindow, CompetencyWindow.id == CompetencyReflection.window_id)
        .filter(
            CompetencyReflection.user_id == user_id,
            CompetencyReflection.school_id == school_id,
        )
        .order_by(CompetencyReflection.submitted_at.desc())
        .all()
    )

    reflections = []
    for reflection, window in reflections_data:
        # Get snippet (truncate to max length)
        text = reflection.text
        if len(text) > REFLECTION_SNIPPET_MAX_LENGTH:
            snippet = text[:REFLECTION_SNIPPET_MAX_LENGTH] + "..."
        else:
            snippet = text

        reflections.append(
            GrowthReflection(
                id=str(reflection.id),
                date=_format_date(reflection.submitted_at),
                scan_title=window.title,
                snippet=snippet,
            )
        )

    # 6. Generate AI summary
    ai_summary = _generate_ai_summary(scans, competency_profile, goals)

    return StudentGrowthData(
        scans=scans,
        competency_profile=competency_profile,
        competency_scores=competency_scores,
        goals=goals,
        reflections=reflections,
        ai_summary=ai_summary,
    )


@router.post("/growth/summary", response_model=AISummaryResponse)
def regenerate_growth_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Regenerate the AI summary for the student's growth data.
    In production, this would call an LLM API to generate a fresh summary.
    """
    # Get growth data first
    growth_data = get_student_growth_data(db, current_user)

    # Generate new summary
    new_summary = _generate_ai_summary(
        growth_data.scans,
        growth_data.competency_profile,
        growth_data.goals,
    )

    if not new_summary:
        new_summary = "Er is nog niet genoeg data om een samenvatting te genereren. Vul eerst een competentiescan in."

    return AISummaryResponse(ai_summary=new_summary)
