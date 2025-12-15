from __future__ import annotations
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import Optional, Dict, List
from datetime import datetime
from collections import defaultdict

from app.api.v1.deps import get_db, get_current_user
from app.core.grading import score_to_grade as _score_to_grade
from app.infra.db.models import (
    User,
    Course,
    ProjectAssessment,
    ProjectAssessmentScore,
    Group,
    Rubric,
    RubricCriterion,
    Project,
    Client,
)
from app.api.v1.schemas.project_overview import (
    ProjectOverviewListResponse,
    ProjectOverviewItem,
    ProjectTrendsResponse,
    CategoryTrendDataPoint,
    ProjectAiSummaryResponse,
    AiSummary,
)

router = APIRouter(prefix="/project-overview", tags=["project-overview"])


def _calculate_project_average_score(
    db: Session, assessment_id: int, rubric_id: int
) -> Optional[float]:
    """
    Calculate overall average score for a project assessment across all teams
    """
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id).first()
    if not rubric:
        return None

    criteria = db.query(RubricCriterion).filter(
        RubricCriterion.rubric_id == rubric_id
    ).all()

    if not criteria:
        return None

    # Get all scores for this assessment
    scores = db.query(ProjectAssessmentScore).filter(
        ProjectAssessmentScore.assessment_id == assessment_id
    ).all()

    if not scores:
        return None

    # Group scores by team_number
    teams_scores = defaultdict(list)
    for score in scores:
        team_key = score.team_number if score.team_number else 0
        teams_scores[team_key].append(score)

    # Calculate average for each team, then average across teams
    team_averages = []
    criterion_weights = {c.id: c.weight for c in criteria}

    for team_scores in teams_scores.values():
        score_map = {s.criterion_id: s.score for s in team_scores}
        total_weighted_score = 0.0
        total_weight = 0.0

        for criterion in criteria:
            if criterion.id in score_map:
                total_weighted_score += score_map[criterion.id] * criterion_weights[criterion.id]
                total_weight += criterion_weights[criterion.id]

        if total_weight > 0:
            avg_score = total_weighted_score / total_weight
            # Normalize to 1-10 scale
            grade = _score_to_grade(avg_score, rubric.scale_min, rubric.scale_max)
            team_averages.append(grade)

    if not team_averages:
        return None

    return round(sum(team_averages) / len(team_averages), 1)


def _calculate_category_averages(
    db: Session, assessment_id: int, rubric_id: int
) -> Dict[str, float]:
    """
    Calculate average scores by category for a project assessment
    """
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id).first()
    if not rubric:
        return {}

    criteria = db.query(RubricCriterion).filter(
        RubricCriterion.rubric_id == rubric_id
    ).all()

    if not criteria:
        return {}

    # Get all scores for this assessment
    scores = db.query(ProjectAssessmentScore).filter(
        ProjectAssessmentScore.assessment_id == assessment_id
    ).all()

    if not scores:
        return {}

    # Group criteria by category
    criteria_by_category = defaultdict(list)
    for criterion in criteria:
        category = criterion.category or "general"
        criteria_by_category[category].append(criterion)

    # Calculate average per category
    category_averages = {}
    score_map = {s.criterion_id: s.score for s in scores}

    for category, cat_criteria in criteria_by_category.items():
        total_weighted_score = 0.0
        total_weight = 0.0
        
        for criterion in cat_criteria:
            if criterion.id in score_map:
                total_weighted_score += score_map[criterion.id] * criterion.weight
                total_weight += criterion.weight

        if total_weight > 0:
            avg_score = total_weighted_score / total_weight
            # Normalize to 1-10 scale
            grade = _score_to_grade(avg_score, rubric.scale_min, rubric.scale_max)
            category_averages[category] = round(grade, 1)

    return category_averages


def _get_period_label(project: Optional[Project], fallback_date: Optional[datetime] = None) -> str:
    """
    Generate period label from project dates (e.g., P1 2024-2025)
    Dutch school year typically runs: P1=Aug-Oct, P2=Nov-Jan, P3=Feb-Apr, P4=May-Jul
    """
    # Use project start_date if available, otherwise use fallback
    date_to_use = None
    if project and project.start_date:
        date_to_use = project.start_date
    elif fallback_date:
        date_to_use = fallback_date
    
    if not date_to_use:
        return "Onbekend"
    
    # Determine period based on month
    month = date_to_use.month
    year = date_to_use.year
    
    # Determine which period and school year
    if month >= 8:  # August onwards
        period = "P1" if month <= 10 else "P2"
        school_year_start = year
    else:  # Before August
        if month <= 1:
            period = "P2"
            school_year_start = year - 1
        elif month <= 4:
            period = "P3"
            school_year_start = year - 1
        else:  # May-July
            period = "P4"
            school_year_start = year - 1
    
    return f"{period} {school_year_start}-{school_year_start + 1}"


def _determine_school_year_from_date(date: Optional[datetime]) -> str:
    """
    Determine school year string from a date (e.g., 2024-2025)
    School year starts in August
    """
    if not date:
        return f"{datetime.now().year}-{datetime.now().year + 1}"
    
    year = date.year
    if date.month >= 8:
        return f"{year}-{year + 1}"
    else:
        return f"{year - 1}-{year}"


@router.get("/projects", response_model=ProjectOverviewListResponse)
def get_project_overview_list(
    school_year: Optional[str] = Query(None, description="Filter by school year (e.g., 2024-2025)"),
    course_id: Optional[int] = Query(None, description="Filter by course"),
    period: Optional[str] = Query(None, description="Filter by period (e.g., Q1, Q2)"),
    status_filter: Optional[str] = Query(None, description="Filter by status (active|completed|all)"),
    search_query: Optional[str] = Query(None, description="Search in project name or client name"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get list of project assessments with aggregated statistics for overview
    """
    school_id = current_user.school_id
    
    # Base query for project assessments
    query = db.query(
        ProjectAssessment,
        Group,
        Course,
        Project,
    ).join(
        Group, ProjectAssessment.group_id == Group.id
    ).outerjoin(
        Course, Group.course_id == Course.id
    ).outerjoin(
        Project, ProjectAssessment.project_id == Project.id
    ).filter(
        ProjectAssessment.school_id == school_id,
        # Only show published assessments by default
        ProjectAssessment.status == "published"
    )
    
    # Apply filters
    if course_id:
        query = query.filter(Group.course_id == course_id)
    
    # Override status filter if explicitly requested
    if status_filter and status_filter != "all" and status_filter != "completed":
        if status_filter == "active":
            query = query.filter(ProjectAssessment.status == "draft")
    
    # School year filter - use Project dates if available
    if school_year:
        try:
            start_year = int(school_year.split("-")[0])
            # School year typically runs from August to July
            school_year_start = datetime(start_year, 8, 1).date()
            school_year_end = datetime(start_year + 1, 7, 31).date()
            
            # Filter by Project start_date if available, otherwise fall back to assessment dates
            query = query.filter(
                or_(
                    # Projects with start_date in the school year
                    and_(
                        Project.start_date.isnot(None),
                        Project.start_date >= school_year_start,
                        Project.start_date <= school_year_end
                    ),
                    # Projects without start_date - use assessment published_at
                    and_(
                        Project.start_date.is_(None),
                        or_(
                            and_(
                                ProjectAssessment.published_at.isnot(None),
                                ProjectAssessment.published_at >= datetime(start_year, 8, 1),
                                ProjectAssessment.published_at <= datetime(start_year + 1, 7, 31, 23, 59, 59)
                            ),
                            and_(
                                ProjectAssessment.published_at.is_(None),
                                ProjectAssessment.created_at >= datetime(start_year, 8, 1),
                                ProjectAssessment.created_at <= datetime(start_year + 1, 7, 31, 23, 59, 59)
                            )
                        )
                    )
                )
            )
        except (ValueError, IndexError):
            pass
    
    # Search filter
    if search_query:
        search_pattern = f"%{search_query}%"
        filters = [ProjectAssessment.title.ilike(search_pattern)]
        # Only add Project.name filter if it's not null
        filters.append(and_(Project.name.isnot(None), Project.name.ilike(search_pattern)))
        query = query.filter(or_(*filters))
    
    # Execute query
    results = query.all()
    
    # Build response items
    items = []
    for assessment, group, course, project in results:
        # Get client name if project has a client
        client_name = None
        if project and project.client_id:
            client = db.query(Client).filter(Client.id == project.client_id).first()
            if client:
                client_name = client.name
        
        # Calculate statistics
        avg_score = _calculate_project_average_score(db, assessment.id, assessment.rubric_id)
        category_scores = _calculate_category_averages(db, assessment.id, assessment.rubric_id)
        
        # Get period label using Project dates if available
        period_label = _get_period_label(project, assessment.published_at or assessment.created_at)
        
        # Apply period filter
        if period and period != "Alle periodes":
            if period not in period_label:
                continue
        
        # Count teams (unique team numbers in scores for this assessment)
        team_count = db.query(func.count(func.distinct(ProjectAssessmentScore.team_number))).filter(
            ProjectAssessmentScore.assessment_id == assessment.id
        ).scalar() or 1
        
        # Determine year from period_label or project dates
        if project and project.start_date:
            year = project.start_date.year
        else:
            date_for_year = assessment.published_at or assessment.created_at
            year = date_for_year.year if date_for_year else datetime.now().year
        
        # Determine status
        status = "completed" if assessment.status == "published" else "active"
        
        items.append(ProjectOverviewItem(
            project_id=assessment.project_id,
            assessment_id=assessment.id,
            project_name=assessment.title,
            course_name=course.name if course else None,
            client_name=client_name,
            period_label=period_label,
            year=year,
            num_teams=team_count,
            average_score_overall=avg_score,
            average_scores_by_category=category_scores,
            status=status,
        ))
    
    return ProjectOverviewListResponse(
        items=items,
        total=len(items)
    )


def _parse_period_for_sorting(period_label: str) -> tuple:
    """
    Parse period label (e.g., 'P1 2024-2025' or 'Q1 2025') to a sortable tuple (year, period).
    Returns (SORT_LAST_YEAR, SORT_LAST_PERIOD) for unparseable strings to sort them last.
    """
    # Constants for sorting unparseable periods last
    SORT_LAST_YEAR = 9999
    SORT_LAST_PERIOD = 9
    
    try:
        parts = period_label.split()
        if len(parts) >= 2:
            period_str = parts[0]  # e.g., "P1" or "Q1"
            year_str = parts[1]     # e.g., "2024-2025" or "2025"
            
            # Extract period number (works for both P1-P4 and Q1-Q4)
            if (period_str.startswith("P") or period_str.startswith("Q")) and period_str[1:].isdigit():
                period = int(period_str[1:])
            else:
                return (SORT_LAST_YEAR, SORT_LAST_PERIOD)
            
            # Extract year (handle both "2024-2025" and "2025" formats)
            if "-" in year_str:
                # Extract start year from school year format
                year = int(year_str.split("-")[0])
            elif year_str.isdigit():
                year = int(year_str)
            else:
                return (SORT_LAST_YEAR, SORT_LAST_PERIOD)
            
            return (year, period)
    except (ValueError, IndexError):
        pass
    
    return (SORT_LAST_YEAR, SORT_LAST_PERIOD)


@router.get("/trends", response_model=ProjectTrendsResponse)
def get_project_trends(
    school_year: Optional[str] = Query(None),
    course_id: Optional[int] = Query(None),
    period: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get category trends across projects for visualization
    """
    # Reuse the projects list with same filters
    projects_response = get_project_overview_list(
        school_year=school_year,
        course_id=course_id,
        period=period,
        status_filter="completed",  # Only completed projects for trends
        search_query=None,
        db=db,
        current_user=current_user,
    )
    
    # Transform to trend data points
    trends = []
    for item in projects_response.items:
        if item.average_scores_by_category:
            trends.append(CategoryTrendDataPoint(
                project_label=item.period_label,
                scores=item.average_scores_by_category
            ))
    
    # Sort by period label chronologically using helper function
    trends.sort(key=lambda x: _parse_period_for_sorting(x.project_label))
    
    return ProjectTrendsResponse(trends=trends)


@router.get("/ai-summary", response_model=ProjectAiSummaryResponse)
def get_project_ai_summary(
    school_year: Optional[str] = Query(None),
    course_id: Optional[int] = Query(None),
    period: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get AI-generated summary of project feedback and trends
    
    TODO: This is a placeholder that returns mock data.
    In the future, this should call an AI service to generate insights
    based on actual project data, reflections, and scores.
    """
    # For now, return mock AI summary
    # In production, this would:
    # 1. Fetch all project reflections and feedback
    # 2. Analyze category scores and trends
    # 3. Call AI service (e.g., OpenAI) to generate insights
    # 4. Return structured summary
    
    summary = AiSummary(
        sterke_punten=[
            "Goede samenwerking binnen teams",
            "Hoge kwaliteit eindresultaten in technische projecten",
            "Effectieve communicatie met opdrachtgevers",
        ],
        verbeter_punten=[
            "Projectplanning kan strakker",
            "Documentatie vaak onvolledig",
            "Meer aandacht voor tussentijdse evaluaties",
        ],
        algemene_trend="Over het algemeen laten projecten een positieve trend zien, met name op het gebied van samenwerking en eindresultaat. Er is ruimte voor verbetering in het projectproces, met specifieke aandacht voor planning en documentatie.",
    )
    
    return ProjectAiSummaryResponse(summary=summary)
