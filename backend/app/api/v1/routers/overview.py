from __future__ import annotations
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from io import StringIO
import csv
from datetime import datetime
from typing import Optional
import logging
from collections import defaultdict

from app.api.v1.deps import get_db, get_current_user
from app.core.grading import score_to_grade as _score_to_grade
from app.infra.db.models import (
    User,
    Course,
    ProjectAssessment,
    ProjectAssessmentScore,
    ProjectAssessmentTeam,
    Evaluation,
    CompetencyWindow,
    CompetencySelfScore,
    CourseEnrollment,
    Rubric,
    RubricCriterion,
    Grade,
    PublishedGrade,
    Allocation,
    Project,
    Client,
    ClientProjectLink,
    AcademicYear,
    Score,
    Reflection,
    ProjectTeam,
    ProjectTeamMember,
)
from app.services.omza_weighted_scores import compute_weighted_omza_scores_batch
from app.api.v1.schemas.overview import (
    OverviewItemOut,
    OverviewListResponse,
    ProjectOverviewListResponse,
    ProjectTrendResponse,
    ProjectOverviewItem,
    CategoryTrendData,
    CategoryStatistics,
    ProjectTeamScore,
    ProjectTeamsResponse,
    PeerOverviewDashboardResponse,
    FeedbackCollectionResponse,
    OmzaTrendDataPoint,
    StudentHeatmapRow,
    OmzaCategoryScore,
    PeerEvaluationDetail,
    KpiData,
    KpiStudent,
    FeedbackItem,
    TeacherFeedbackResponse,
    ReflectionItem,
    ReflectionResponse,
    AggregatedFeedbackItem,
    AggregatedFeedbackResponse,
    CriterionDetail,
)

logger = logging.getLogger(__name__)

# Grade calculation constants
# GCF (Group Correction Factor) typically ranges from 0.5 to 1.5 in normal cases
# We set the warning threshold higher (2.0) to allow for exceptional cases
# while still logging potentially incorrect values for review
MAX_REASONABLE_GCF = 2.0

# Mapping from full Dutch category names to short abbreviations
# This ensures frontend compatibility
CATEGORY_NAME_TO_ABBREV = {
    "Organiseren": "O",
    "Meedoen": "M",
    "Zelfvertrouwen": "Z",
    "Autonomie": "A",
    # Fallback: first letter uppercase
}

def get_category_abbrev(category_name: str) -> str:
    """Convert full category name to abbreviation for frontend compatibility"""
    return CATEGORY_NAME_TO_ABBREV.get(category_name, category_name[0].upper() if category_name else "")

router = APIRouter(prefix="/overview", tags=["overview"])


def _calculate_statistics(values: list[float]) -> CategoryStatistics:
    """
    Calculate statistical measures from a list of values
    Returns mean, median, percentiles, min, max, and IQR
    """
    if not values:
        return CategoryStatistics(count_teams=0, count_assessments=0)
    
    sorted_values = sorted(values)
    n = len(sorted_values)
    
    # Calculate mean
    mean = sum(sorted_values) / n
    
    # Calculate median
    if n % 2 == 0:
        median = (sorted_values[n // 2 - 1] + sorted_values[n // 2]) / 2
    else:
        median = sorted_values[n // 2]
    
    # Calculate percentiles
    def percentile(data: list[float], p: float) -> float:
        """Calculate the p-th percentile (p between 0 and 100)"""
        k = (len(data) - 1) * (p / 100.0)
        f = int(k)
        c = f + 1
        if c >= len(data):
            return data[-1]
        if f < 0:
            return data[0]
        d0 = data[f] * (c - k)
        d1 = data[c] * (k - f)
        return d0 + d1
    
    p10 = percentile(sorted_values, 10)
    p25 = percentile(sorted_values, 25)
    p75 = percentile(sorted_values, 75)
    p90 = percentile(sorted_values, 90)
    
    # Min and max
    min_val = sorted_values[0]
    max_val = sorted_values[-1]
    
    # IQR (Interquartile Range)
    iqr = p75 - p25
    
    return CategoryStatistics(
        mean=round(mean, 2),
        median=round(median, 2),
        p25=round(p25, 2),
        p75=round(p75, 2),
        p10=round(p10, 2),
        p90=round(p90, 2),
        min=round(min_val, 2),
        max=round(max_val, 2),
        iqr=round(iqr, 2),
        count_teams=n,
        count_assessments=n
    )


def _calculate_project_score(db: Session, assessment_id: int, rubric_id: int, team_number: int) -> Optional[float]:
    """
    Calculate final grade for a project assessment for a specific team
    Uses weighted average based on criterion weights, then normalizes to 1-10 scale using curved mapping
    """
    # Get rubric scale
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id).first()
    if not rubric:
        return None
    
    # Get all criteria for this rubric
    criteria = db.query(RubricCriterion).filter(
        RubricCriterion.rubric_id == rubric_id
    ).all()
    
    if not criteria:
        return None
    
    # Get scores for this assessment and team
    scores = db.query(ProjectAssessmentScore).filter(
        ProjectAssessmentScore.assessment_id == assessment_id,
        ProjectAssessmentScore.team_number == team_number
    ).all()
    
    if not scores:
        return None
    
    # Create a map of criterion_id -> score
    score_map = {s.criterion_id: s.score for s in scores}
    
    # Calculate weighted average
    total_weighted_score = 0.0
    total_weight = 0.0
    
    for criterion in criteria:
        if criterion.id in score_map:
            total_weighted_score += score_map[criterion.id] * criterion.weight
            total_weight += criterion.weight
    
    if total_weight == 0:
        return None
    
    avg_score = total_weighted_score / total_weight
    
    # Normalize to 1-10 scale using curved mapping
    return _score_to_grade(avg_score, rubric.scale_min, rubric.scale_max)


def _get_grade_value(grade: Grade, field_name: str, meta_key: str = None) -> Optional[float]:
    """
    Helper to get a grade value from either direct field or meta dictionary.
    
    Args:
        grade: Grade object
        field_name: Name of the direct field attribute
        meta_key: Key in the meta dictionary (defaults to field_name if not provided)
    
    Returns:
        Float value or None
    """
    if meta_key is None:
        meta_key = field_name
    
    # Try direct field first
    value = getattr(grade, field_name, None)
    
    # Fallback to meta dictionary for backwards compatibility
    if value is None and grade.meta and isinstance(grade.meta, dict):
        value = grade.meta.get(meta_key)
    
    return value


def _calculate_peer_score(db: Session, evaluation_id: int, user_id: int) -> Optional[float]:
    """
    Get final peer evaluation grade for a student (Eindcijfer)
    Priority order:
    1. Direct override from Grade.grade field (cell override)
    2. Group grade × GCF (Grade.group_grade × Grade.gcf)
    3. Suggested grade (Grade.suggested_grade or from meta)
    """
    # Try to get from PublishedGrade table first (published grades take precedence)
    published = db.query(PublishedGrade).filter(
        PublishedGrade.evaluation_id == evaluation_id,
        PublishedGrade.user_id == user_id
    ).first()
    
    if published and published.grade is not None:
        return round(float(published.grade), 1)
    
    # Get grade record from Grade table
    grade = db.query(Grade).filter(
        Grade.evaluation_id == evaluation_id,
        Grade.user_id == user_id
    ).first()
    
    if grade:
        # Priority 1: Direct override in cell (Grade.grade)
        if grade.grade is not None:
            return round(float(grade.grade), 1)
        
        # Priority 2: Group grade × GCF
        group_grade = _get_grade_value(grade, 'group_grade')
        gcf = _get_grade_value(grade, 'gcf')
        
        if group_grade is not None and gcf is not None:
            try:
                group_grade_float = float(group_grade)
                gcf_float = float(gcf)
                
                # Validate that values are reasonable for grade calculations
                # Group grades typically range from 1 to 10, GCF from 0.5 to 1.5
                if group_grade_float <= 0 or gcf_float <= 0:
                    logger.warning(
                        f"Non-positive group_grade ({group_grade_float}) or gcf ({gcf_float}) for "
                        f"evaluation_id={evaluation_id}, user_id={user_id}"
                    )
                    # Continue to next priority instead of returning invalid grade
                else:
                    # Log suspiciously high GCF (> 2.0) but still use it to preserve teacher flexibility
                    # Teachers may have valid reasons for exceptional GCF values
                    if gcf_float > MAX_REASONABLE_GCF:
                        logger.warning(
                            f"Unusually high gcf ({gcf_float}) for "
                            f"evaluation_id={evaluation_id}, user_id={user_id}"
                        )
                    final_grade = group_grade_float * gcf_float
                    return round(final_grade, 1)
            except (ValueError, TypeError) as e:
                logger.warning(
                    f"Invalid group_grade ({group_grade}) or gcf ({gcf}) for "
                    f"evaluation_id={evaluation_id}, user_id={user_id}: {e}"
                )
        
        # Priority 3: Suggested grade
        suggested_grade = _get_grade_value(grade, 'suggested_grade', 'suggested')
        if suggested_grade is not None:
            try:
                return round(float(suggested_grade), 1)
            except (ValueError, TypeError) as e:
                logger.warning(
                    f"Invalid suggested_grade ({suggested_grade}) for "
                    f"evaluation_id={evaluation_id}, user_id={user_id}: {e}"
                )
    
    return None


def _calculate_competency_score(db: Session, window_id: int, user_id: int) -> Optional[float]:
    """
    Calculate average competency score for a student in a window
    Converts from 1-5 scale to 1-10 scale (grade)
    """
    scores = db.query(func.avg(CompetencySelfScore.score)).filter(
        CompetencySelfScore.window_id == window_id,
        CompetencySelfScore.user_id == user_id
    ).scalar()
    
    if not scores:
        return None
    
    # Convert from 1-5 scale to 1-10 scale
    avg_score = float(scores)
    grade = 1 + ((avg_score - 1) / 4) * 9  # Maps 1-5 to 1-10
    
    return round(grade, 1)


@router.get("/all-items", response_model=OverviewListResponse)
def get_overview_all_items(
    student_id: Optional[int] = Query(None),
    course_id: Optional[int] = Query(None),
    teacher_id: Optional[int] = Query(None),
    type_filter: Optional[str] = Query(None, alias="type"),
    status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    team_number: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("date"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all overview items (projects, peer evaluations, competency windows) combined
    """
    school_id = current_user.school_id
    items = []
    
    # Parse date filters
    date_from_dt = datetime.fromisoformat(date_from) if date_from else None
    date_to_dt = datetime.fromisoformat(date_to) if date_to else None
    
    # ==================== PROJECT ASSESSMENTS ====================
    if not type_filter or type_filter == "project":
        # Query project assessments with student data via project teams
        # Join through ProjectAssessmentTeam junction table to match new data model
        project_query = db.query(
            ProjectAssessment,
            User,
            Course,
            ProjectTeam,
        ).join(
            ProjectAssessmentTeam, ProjectAssessmentTeam.project_assessment_id == ProjectAssessment.id
        ).join(
            ProjectTeam, ProjectTeam.id == ProjectAssessmentTeam.project_team_id
        ).join(
            User, User.id == ProjectAssessment.teacher_id  # Teacher as creator
        ).join(
            Project, ProjectTeam.project_id == Project.id
        ).outerjoin(
            Course, Project.course_id == Course.id
        ).filter(
            ProjectAssessment.school_id == school_id
        )
        
        # Apply filters
        if course_id:
            project_query = project_query.filter(Project.course_id == course_id)
        if teacher_id:
            project_query = project_query.filter(ProjectAssessment.teacher_id == teacher_id)
        if status:
            project_query = project_query.filter(ProjectAssessment.status == status)
        if date_from_dt:
            project_query = project_query.filter(ProjectAssessment.published_at >= date_from_dt)
        if date_to_dt:
            project_query = project_query.filter(ProjectAssessment.published_at <= date_to_dt)
        if team_number:
            project_query = project_query.filter(ProjectTeam.team_number == team_number)
        if search:
            search_pattern = f"%{search}%"
            project_query = project_query.filter(
                or_(
                    ProjectAssessment.title.ilike(search_pattern),
                    ProjectTeam.display_name_at_time.ilike(search_pattern)
                )
            )
        
        # Get results and create items for each team member
        for assessment, teacher, course, project_team in project_query.all():
            # Get all project team members
            members = db.query(User).join(
                ProjectTeamMember, ProjectTeamMember.user_id == User.id
            ).filter(
                ProjectTeamMember.project_team_id == project_team.id
            ).all()
            
            # Filter by student_id if specified
            if student_id:
                members = [m for m in members if m.id == student_id]
            
            # Create an item for each student in the group
            for member in members:
                score = _calculate_project_score(db, assessment.id, assessment.rubric_id)
                
                items.append({
                    "id": assessment.id,
                    "type": "project",
                    "student_id": member.id,
                    "student_name": member.name,
                    "student_class": member.class_name,
                    "title": assessment.title,
                    "course_name": course.name if course else None,
                    "course_id": course.id if course else None,
                    "teacher_name": teacher.name,
                    "teacher_id": teacher.id,
                    "date": assessment.published_at,
                    "score": score,
                    "score_label": f"{score:.1f}" if score else "—",
                    "status": assessment.status,
                    "detail_url": f"/teacher/project-assessments/{assessment.id}/overview",
                    "team_number": group.team_number,
                    "team_name": group.name,
                })
    
    # ==================== PEER EVALUATIONS ====================
    if not type_filter or type_filter == "peer":
        # Query evaluations
        eval_query = db.query(
            Evaluation,
            Course,
        ).outerjoin(
            Course, Evaluation.course_id == Course.id
        ).filter(
            Evaluation.school_id == school_id
        )
        
        # Apply filters
        if course_id:
            eval_query = eval_query.filter(Evaluation.course_id == course_id)
        if status:
            eval_query = eval_query.filter(Evaluation.status == status)
        if search:
            search_pattern = f"%{search}%"
            eval_query = eval_query.filter(Evaluation.title.ilike(search_pattern))
        
        # Get all students who participated in evaluations
        for evaluation, course in eval_query.all():
            # Get all students in this evaluation (via allocations or class)
            students = db.query(User).filter(
                User.school_id == school_id,
                User.role == "student"
            )
            
            # Filter by student_id if specified
            if student_id:
                students = students.filter(User.id == student_id)
            
            # For now, we'll get all students - in a real implementation,
            # you'd filter by students who actually participated in the evaluation
            students = students.limit(100).all()  # Limit to avoid huge result sets
            
            for student in students:
                score = _calculate_peer_score(db, evaluation.id, student.id)
                
                items.append({
                    "id": evaluation.id,
                    "type": "peer",
                    "student_id": student.id,
                    "student_name": student.name,
                    "student_class": student.class_name,
                    "title": evaluation.title,
                    "course_name": course.name if course else None,
                    "course_id": course.id if course else None,
                    "teacher_name": None,  # Could be enriched if you track this
                    "teacher_id": None,
                    "date": None,  # Could use evaluation creation date or deadline
                    "score": score,
                    "score_label": f"{score:.1f}" if score else "—",
                    "status": evaluation.status,
                    "detail_url": f"/teacher/evaluations/{evaluation.id}/dashboard",
                    "team_number": student.team_number,
                    "team_name": None,
                })
    
    # ==================== COMPETENCY WINDOWS ====================
    if not type_filter or type_filter == "competency":
        # Query competency windows
        window_query = db.query(
            CompetencyWindow,
            Course,
        ).outerjoin(
            Course, CompetencyWindow.course_id == Course.id
        ).filter(
            CompetencyWindow.school_id == school_id
        )
        
        # Apply filters
        if course_id:
            window_query = window_query.filter(CompetencyWindow.course_id == course_id)
        if status:
            window_query = window_query.filter(CompetencyWindow.status == status)
        if date_from_dt:
            window_query = window_query.filter(CompetencyWindow.end_date >= date_from_dt)
        if date_to_dt:
            window_query = window_query.filter(CompetencyWindow.start_date <= date_to_dt)
        if search:
            search_pattern = f"%{search}%"
            window_query = window_query.filter(CompetencyWindow.title.ilike(search_pattern))
        
        for window, course in window_query.all():
            # Get students who have self-scores in this window
            students_with_scores = db.query(User).join(
                CompetencySelfScore, CompetencySelfScore.user_id == User.id
            ).filter(
                CompetencySelfScore.window_id == window.id
            ).distinct()
            
            # Filter by student_id if specified
            if student_id:
                students_with_scores = students_with_scores.filter(User.id == student_id)
            
            for student in students_with_scores.all():
                score = _calculate_competency_score(db, window.id, student.id)
                
                items.append({
                    "id": window.id,
                    "type": "competency",
                    "student_id": student.id,
                    "student_name": student.name,
                    "student_class": student.class_name,
                    "title": window.title,
                    "course_name": course.name if course else None,
                    "course_id": course.id if course else None,
                    "teacher_name": None,
                    "teacher_id": None,
                    "date": window.end_date,
                    "score": score,
                    "score_label": f"{score:.1f}" if score else "—",
                    "status": window.status,
                    "detail_url": f"/teacher/competencies/windows/{window.id}",
                    "team_number": student.team_number,
                    "team_name": None,
                })
    
    # ==================== SORT & PAGINATE ====================
    # Sort items
    if sort_by == "date":
        items.sort(key=lambda x: x["date"] or datetime.min, reverse=(sort_order == "desc"))
    elif sort_by == "student":
        items.sort(key=lambda x: x["student_name"], reverse=(sort_order == "desc"))
    elif sort_by == "score":
        items.sort(key=lambda x: x["score"] or 0, reverse=(sort_order == "desc"))
    
    # Calculate totals
    total = len(items)
    total_projects = sum(1 for item in items if item["type"] == "project")
    total_peers = sum(1 for item in items if item["type"] == "peer")
    total_competencies = sum(1 for item in items if item["type"] == "competency")
    
    # Paginate
    start = (page - 1) * limit
    end = start + limit
    paginated_items = items[start:end]
    
    return OverviewListResponse(
        items=[OverviewItemOut(**item) for item in paginated_items],
        total=total,
        page=page,
        limit=limit,
        total_projects=total_projects,
        total_peers=total_peers,
        total_competencies=total_competencies,
    )


@router.get("/all-items/export.csv")
def export_overview_csv(
    student_id: Optional[int] = Query(None),
    course_id: Optional[int] = Query(None),
    teacher_id: Optional[int] = Query(None),
    type_filter: Optional[str] = Query(None, alias="type"),
    status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    team_number: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export overview items to CSV with applied filters
    """
    # Get all items with filters (no pagination)
    result = get_overview_all_items(
        student_id=student_id,
        course_id=course_id,
        teacher_id=teacher_id,
        type_filter=type_filter,
        status=status,
        date_from=date_from,
        date_to=date_to,
        team_number=team_number,
        search=search,
        sort_by="date",
        sort_order="desc",
        page=1,
        limit=10000,  # High limit to get all items
        db=db,
        current_user=current_user,
    )
    
    # Create CSV
    output = StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "Leerling",
        "Klas",
        "Type",
        "Titel",
        "Vak",
        "Docent",
        "Datum",
        "Score",
        "Status",
        "Team",
    ])
    
    # Data rows
    for item in result.items:
        writer.writerow([
            item.student_name,
            item.student_class or "",
            item.type,
            item.title,
            item.course_name or "",
            item.teacher_name or "",
            item.date.strftime("%Y-%m-%d") if item.date else "",
            item.score_label,
            item.status,
            item.team_name or item.team_number or "",
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=overzicht-alle-items-{datetime.now().strftime('%Y%m%d')}.csv"
        }
    )


# ==================== MATRIX VIEW ENDPOINT ====================

@router.get("/matrix")
def get_overview_matrix(
    course_id: Optional[int] = Query(None),
    class_name: Optional[str] = Query(None),
    student_name: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),  # Column key to sort by
    sort_order: str = Query("asc", regex="^(asc|desc)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get matrix view of all evaluations organized by students (rows) and evaluations (columns)
    Each cell represents one student's score in one evaluation
    Columns are sorted chronologically
    """
    from app.api.v1.schemas.overview import (
        OverviewMatrixResponse,
        StudentMatrixRowOut,
        MatrixColumnOut,
        MatrixCellOut,
    )
    
    school_id = current_user.school_id
    
    # Parse date filters
    date_from_dt = datetime.fromisoformat(date_from) if date_from else None
    date_to_dt = datetime.fromisoformat(date_to) if date_to else None
    
    # If course_id is specified, get all student IDs enrolled in that course
    allowed_student_ids = None
    if course_id:
        student_ids_query = db.query(User.id).join(
            CourseEnrollment, CourseEnrollment.student_id == User.id
        ).filter(
            CourseEnrollment.course_id == course_id,
            CourseEnrollment.active.is_(True),
            ~User.archived,
            User.role == "student"
        ).distinct()
        allowed_student_ids = set(sid for (sid,) in student_ids_query.all())
    
    # Dictionary to store all evaluations with metadata
    evaluations = []  # List of (key, type, title, date, evaluation_id)
    
    # Dictionary to store student data: student_id -> {evaluation_key -> cell_data}
    student_data = {}
    
    # ==================== COLLECT PROJECT ASSESSMENTS ====================
    # Join through ProjectAssessmentTeam junction table to match new data model
    project_query = db.query(
        ProjectAssessment,
        Course,
        ProjectTeam,
    ).join(
        ProjectAssessmentTeam, ProjectAssessmentTeam.project_assessment_id == ProjectAssessment.id
    ).join(
        ProjectTeam, ProjectTeam.id == ProjectAssessmentTeam.project_team_id
    ).join(
        Project, ProjectTeam.project_id == Project.id
    ).outerjoin(
        Course, Project.course_id == Course.id
    ).filter(
        ProjectAssessment.school_id == school_id,
        ProjectAssessment.status == "published",  # Only published projects
        ProjectAssessment.is_advisory.is_(False)  # Exclude external assessments
    )
    
    if course_id:
        project_query = project_query.filter(Project.course_id == course_id)
    if date_from_dt:
        project_query = project_query.filter(ProjectAssessment.published_at >= date_from_dt)
    if date_to_dt:
        project_query = project_query.filter(ProjectAssessment.published_at <= date_to_dt)
    
    for assessment, course, team in project_query.all():
        eval_key = f"project_{assessment.id}"
        evaluations.append({
            "key": eval_key,
            "type": "project",
            "title": assessment.title,
            "date": assessment.published_at,
            "evaluation_id": assessment.id,
        })
        
        # Get teacher for this assessment
        teacher = db.query(User).filter(User.id == assessment.teacher_id).first()
        teacher_name = teacher.name if teacher else None
        
        # Get all team members and their scores (only active students)
        members = db.query(User).join(
            ProjectTeamMember, ProjectTeamMember.user_id == User.id
        ).filter(
            ProjectTeamMember.team_id == team.id,
            ProjectTeamMember.active.is_(True),
            ~User.archived,
            User.role == "student"
        ).all()
        
        # Filter by class if specified
        if class_name:
            members = [m for m in members if m.class_name == class_name]
        
        # Filter by student name if specified
        if student_name:
            members = [m for m in members if student_name.lower() in m.name.lower()]
        
        # Filter by allowed students (if course filter is active)
        if allowed_student_ids is not None:
            members = [m for m in members if m.id in allowed_student_ids]
        
        for member in members:
            if member.id not in student_data:
                student_data[member.id] = {
                    "name": member.name,
                    "class": member.class_name,
                    "cells": {}
                }
            
            # Calculate score for this student's team
            team_num = member.team_number if hasattr(member, 'team_number') else None
            score = _calculate_project_score(db, assessment.id, assessment.rubric_id, team_num) if team_num else None
            
            student_data[member.id]["cells"][eval_key] = {
                "evaluation_id": assessment.id,
                "type": "project",
                "title": assessment.title,
                "score": score,
                "status": assessment.status,
                "date": assessment.published_at,
                "teacher_name": teacher_name,
                "detail_url": f"/teacher/project-assessments/{assessment.id}/overview",
            }
    
    # ==================== COLLECT PEER EVALUATIONS ====================
    eval_query = db.query(
        Evaluation,
        Course,
    ).outerjoin(
        Course, Evaluation.course_id == Course.id
    ).filter(
        Evaluation.school_id == school_id,
        or_(Evaluation.status == "open", Evaluation.status == "closed")
    )
    
    if course_id:
        eval_query = eval_query.filter(Evaluation.course_id == course_id)
    
    for evaluation, course in eval_query.all():
        eval_key = f"peer_{evaluation.id}"
        
        # Use settings deadline or created_at as date
        eval_date = None
        if evaluation.settings and evaluation.settings.get("deadlines"):
            deadline = evaluation.settings["deadlines"].get("review")
            if deadline:
                try:
                    eval_date = datetime.fromisoformat(deadline)
                except (ValueError, TypeError):
                    pass
        
        evaluations.append({
            "key": eval_key,
            "type": "peer",
            "title": evaluation.title,
            "date": eval_date,
            "evaluation_id": evaluation.id,
        })
        
        # Get all students who have allocations in this evaluation (as reviewees, only active students)
        students_in_eval = db.query(User).join(
            Allocation, Allocation.reviewee_id == User.id
        ).filter(
            Allocation.evaluation_id == evaluation.id,
            ~User.archived,
            User.role == "student"
        ).distinct().all()
        
        # Filter by class if specified
        if class_name:
            students_in_eval = [s for s in students_in_eval if s.class_name == class_name]
        
        # Filter by student name if specified
        if student_name:
            students_in_eval = [s for s in students_in_eval if student_name.lower() in s.name.lower()]
        
        # Filter by allowed students (if course filter is active)
        if allowed_student_ids is not None:
            students_in_eval = [s for s in students_in_eval if s.id in allowed_student_ids]
        
        for student in students_in_eval:
            if student.id not in student_data:
                student_data[student.id] = {
                    "name": student.name,
                    "class": student.class_name,
                    "cells": {}
                }
            
            score = _calculate_peer_score(db, evaluation.id, student.id)
            
            student_data[student.id]["cells"][eval_key] = {
                "evaluation_id": evaluation.id,
                "type": "peer",
                "title": evaluation.title,
                "score": score,
                "status": evaluation.status,
                "date": eval_date,
                "teacher_name": None,
                "detail_url": f"/teacher/evaluations/{evaluation.id}/dashboard",
            }
    
    # ==================== COLLECT COMPETENCY WINDOWS ====================
    window_query = db.query(
        CompetencyWindow,
        Course,
    ).outerjoin(
        Course, CompetencyWindow.course_id == Course.id
    ).filter(
        CompetencyWindow.school_id == school_id
    )
    
    if course_id:
        window_query = window_query.filter(CompetencyWindow.course_id == course_id)
    if date_from_dt:
        window_query = window_query.filter(CompetencyWindow.end_date >= date_from_dt)
    if date_to_dt:
        window_query = window_query.filter(CompetencyWindow.start_date <= date_to_dt)
    
    for window, course in window_query.all():
        eval_key = f"competency_{window.id}"
        evaluations.append({
            "key": eval_key,
            "type": "competency",
            "title": window.title,
            "date": window.end_date,
            "evaluation_id": window.id,
        })
        
        # Get students who have self-scores in this window (only active students)
        students_with_scores = db.query(User).join(
            CompetencySelfScore, CompetencySelfScore.user_id == User.id
        ).filter(
            CompetencySelfScore.window_id == window.id,
            ~User.archived,
            User.role == "student"
        ).distinct().all()
        
        # Filter by class if specified
        if class_name:
            students_with_scores = [s for s in students_with_scores if s.class_name == class_name]
        
        # Filter by student name if specified
        if student_name:
            students_with_scores = [s for s in students_with_scores if student_name.lower() in s.name.lower()]
        
        # Filter by allowed students (if course filter is active)
        if allowed_student_ids is not None:
            students_with_scores = [s for s in students_with_scores if s.id in allowed_student_ids]
        
        for student in students_with_scores:
            if student.id not in student_data:
                student_data[student.id] = {
                    "name": student.name,
                    "class": student.class_name,
                    "cells": {}
                }
            
            score = _calculate_competency_score(db, window.id, student.id)
            
            student_data[student.id]["cells"][eval_key] = {
                "evaluation_id": window.id,
                "type": "competency",
                "title": window.title,
                "score": score,
                "status": window.status,
                "date": window.end_date,
                "teacher_name": None,
                "detail_url": f"/teacher/competencies/windows/{window.id}",
            }
    
    # ==================== SORT EVALUATIONS CHRONOLOGICALLY ====================
    # Sort by date (None dates go to the end)
    evaluations.sort(key=lambda x: (x["date"] is None, x["date"] if x["date"] else datetime.max))
    
    # Create column headers with order
    columns = []
    for idx, eval_info in enumerate(evaluations):
        columns.append(MatrixColumnOut(
            key=eval_info["key"],
            type=eval_info["type"],
            title=eval_info["title"],
            date=eval_info["date"],
            order=idx
        ))
    
    # ==================== BUILD STUDENT ROWS ====================
    rows = []
    for student_id, data in student_data.items():
        # Build cells dict with all columns (None for missing data)
        cells = {}
        scores_for_avg = []
        
        for col in columns:
            if col.key in data["cells"]:
                cell_data = data["cells"][col.key]
                cells[col.key] = MatrixCellOut(**cell_data)
                if cell_data["score"] is not None:
                    scores_for_avg.append(cell_data["score"])
            else:
                cells[col.key] = None
        
        # Calculate average
        average = round(sum(scores_for_avg) / len(scores_for_avg), 2) if scores_for_avg else None
        
        rows.append(StudentMatrixRowOut(
            student_id=student_id,
            student_name=data["name"],
            student_class=data["class"],
            cells=cells,
            average=average
        ))
    
    # ==================== SORT ROWS ====================
    # Sort by specified column or default to student name
    if sort_by and sort_by != "student":
        # Sort by a specific evaluation column
        def get_sort_key(row):
            cell = row.cells.get(sort_by)
            if cell and cell.score is not None:
                return cell.score
            # Put rows without data at the end
            return -999999 if sort_order == "desc" else 999999
        
        rows.sort(key=get_sort_key, reverse=(sort_order == "desc"))
    else:
        # Sort by student name (default)
        rows.sort(key=lambda x: x.student_name, reverse=(sort_order == "desc"))
    
    # ==================== CALCULATE COLUMN AVERAGES ====================
    column_averages = {}
    for col in columns:
        scores = []
        for row in rows:
            cell = row.cells.get(col.key)
            if cell and cell.score is not None:
                scores.append(cell.score)
        
        column_averages[col.key] = round(sum(scores) / len(scores), 2) if scores else None
    
    # ==================== RETURN MATRIX ====================
    return OverviewMatrixResponse(
        columns=columns,
        rows=rows,
        column_averages=column_averages,
        total_students=len(rows)
    )


@router.get("/matrix/export.csv")
def export_matrix_csv(
    course_id: Optional[int] = Query(None),
    class_name: Optional[str] = Query(None),
    student_name: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: str = Query("asc", regex="^(asc|desc)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export matrix view to CSV
    """
    # Get matrix data with filters
    matrix_data = get_overview_matrix(
        course_id=course_id,
        class_name=class_name,
        student_name=student_name,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_order=sort_order,
        db=db,
        current_user=current_user,
    )
    
    # Create CSV
    output = StringIO()
    writer = csv.writer(output)
    
    # Header row
    header = ["Leerling", "Klas"]
    for col in matrix_data.columns:
        header.append(f"{col.title} ({col.type})")
    writer.writerow(header)
    
    # Data rows
    for row in matrix_data.rows:
        csv_row = [row.student_name, row.student_class or ""]
        for col in matrix_data.columns:
            cell = row.cells.get(col.key)
            if cell and cell.score is not None:
                csv_row.append(f"{cell.score:.1f}")
            else:
                csv_row.append("")
        writer.writerow(csv_row)
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=overzicht-matrix-{datetime.now().strftime('%Y%m%d')}.csv"
        }
    )


# ==================== PROJECT OVERVIEW ENDPOINTS ====================

@router.get("/projects", response_model=ProjectOverviewListResponse)
def get_project_overview(
    school_year: Optional[str] = Query(None),  # e.g., "2024-2025"
    course_id: Optional[int] = Query(None),
    period: Optional[str] = Query(None),  # e.g., "Q1", "Q2"
    status_filter: Optional[str] = Query(None),  # "all", "active", "completed"
    search_query: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get project overview data for the teacher overview page
    Returns aggregated project data with category scores
    """
    school_id = current_user.school_id
    
    # Query project assessments with optional project and client info
    # Join through ProjectAssessmentTeam junction table to match new data model
    query = db.query(
        ProjectAssessment,
        ProjectTeam,
        Course,
        Project,
        Client,
    ).join(
        ProjectAssessmentTeam, ProjectAssessmentTeam.project_assessment_id == ProjectAssessment.id
    ).join(
        ProjectTeam, ProjectTeam.id == ProjectAssessmentTeam.project_team_id
    ).join(
        Project, ProjectTeam.project_id == Project.id
    ).outerjoin(
        Course, Project.course_id == Course.id
    ).outerjoin(
        ClientProjectLink, ClientProjectLink.project_id == Project.id
    ).outerjoin(
        Client, ClientProjectLink.client_id == Client.id
    ).filter(
        ProjectAssessment.school_id == school_id,
        ProjectAssessment.is_advisory.is_(False),  # Exclude external assessments
        ProjectAssessment.status.in_(["published", "closed"])  # Only show published or closed assessments
    )
    
    # Apply filters
    if course_id:
        query = query.filter(Project.course_id == course_id)
    
    if school_year:
        # Parse school year like "2024-2025"
        try:
            start_year = int(school_year.split("-")[0])
            query = query.filter(
                or_(
                    func.extract("year", ProjectAssessment.published_at) == start_year,
                    func.extract("year", ProjectAssessment.published_at) == start_year + 1
                )
            )
        except (ValueError, IndexError):
            pass
    
    if status_filter and status_filter != "all":
        if status_filter == "completed":
            query = query.filter(ProjectAssessment.status == "published")
        elif status_filter == "active":
            query = query.filter(ProjectAssessment.status.in_(["draft", "open"]))
    
    if search_query:
        search_pattern = f"%{search_query}%"
        query = query.filter(
            or_(
                ProjectAssessment.title.ilike(search_pattern),
                ProjectTeam.name.ilike(search_pattern)
            )
        )
    
    # Get results
    results = query.all()
    
    # Build project overview items
    projects = []
    for assessment, team, course, project, client in results:
        # Get client name from the joined Client object
        client_name = client.organization if client else None
        
        # Get period from project (P1, P2, P3, P4) and year from assessment
        period_label = "Unknown"
        year = datetime.now().year
        if project and project.period:
            period_label = project.period  # e.g., "P1", "P2", "P3", "P4"
            if assessment.published_at:
                year = assessment.published_at.year
                period_label = f"{project.period} {year}"  # e.g., "P1 2025"
        elif assessment.published_at:
            # Fallback: calculate from date if no project period
            year = assessment.published_at.year
            month = assessment.published_at.month
            if month <= 3:
                period_label = f"Q1 {year}"
            elif month <= 6:
                period_label = f"Q2 {year}"
            elif month <= 9:
                period_label = f"Q3 {year}"
            else:
                period_label = f"Q4 {year}"
        
        # Apply period filter if specified
        if period and period != "Alle periodes":
            # Match against the period part (P1, P2, P3, P4)
            if project and project.period != period:
                continue
            elif not project:
                # For backwards compatibility, check if period is in label
                if period not in period_label:
                    continue
        
        # Count teams in this project by distinct team numbers in scores
        num_teams = db.query(func.count(func.distinct(ProjectAssessmentScore.team_number))).filter(
            ProjectAssessmentScore.assessment_id == assessment.id,
            ProjectAssessmentScore.team_number.isnot(None)
        ).scalar() or 1  # Default to 1 if no scores yet
        
        # Calculate average score overall
        rubric = db.query(Rubric).filter(Rubric.id == assessment.rubric_id).first()
        if not rubric:
            average_score_overall = None
            average_scores_by_category = {}
        else:
            # Get all scores for this assessment
            all_scores = db.query(ProjectAssessmentScore).filter(
                ProjectAssessmentScore.assessment_id == assessment.id,
                ProjectAssessmentScore.team_number.isnot(None)
            ).all()
            
            if not all_scores:
                average_score_overall = None
                average_scores_by_category = {}
            else:
                # Get criteria with categories
                criteria = db.query(RubricCriterion).filter(
                    RubricCriterion.rubric_id == rubric.id
                ).all()
                
                # Group scores by team_number
                team_scores = defaultdict(list)
                for score in all_scores:
                    team_scores[score.team_number].append(score)
                
                # Calculate grade for each team, then average across teams
                team_grades = []
                team_category_grades = defaultdict(list)
                
                for team_number, scores in team_scores.items():
                    # Create score map for this team
                    score_map = {s.criterion_id: s.score for s in scores}
                    
                    # Calculate weighted average for this team
                    total_weighted_score = 0.0
                    total_weight = 0.0
                    for criterion in criteria:
                        if criterion.id in score_map:
                            total_weighted_score += score_map[criterion.id] * criterion.weight
                            total_weight += criterion.weight
                    
                    if total_weight > 0:
                        avg_score = total_weighted_score / total_weight
                        team_grade = _score_to_grade(avg_score, rubric.scale_min, rubric.scale_max)
                        team_grades.append(team_grade)
                    
                    # Calculate weighted average by category for this team
                    category_scores = {}
                    category_weights = {}
                    
                    for criterion in criteria:
                        if criterion.id in score_map and criterion.category:
                            cat = criterion.category.lower()
                            if cat not in category_scores:
                                category_scores[cat] = 0.0
                                category_weights[cat] = 0.0
                            category_scores[cat] += score_map[criterion.id] * criterion.weight
                            category_weights[cat] += criterion.weight
                    
                    for cat, total_score in category_scores.items():
                        if category_weights[cat] > 0:
                            avg = total_score / category_weights[cat]
                            cat_grade = _score_to_grade(avg, rubric.scale_min, rubric.scale_max)
                            team_category_grades[cat].append(cat_grade)
                
                # Average across all teams
                if team_grades:
                    average_score_overall = sum(team_grades) / len(team_grades)
                    # Calculate overall statistics
                    overall_statistics = _calculate_statistics(team_grades)
                else:
                    average_score_overall = None
                    overall_statistics = None
                
                average_scores_by_category = {}
                category_statistics = {}
                for cat, grades in team_category_grades.items():
                    if grades:
                        average_scores_by_category[cat] = round(sum(grades) / len(grades), 1)
                        category_statistics[cat] = _calculate_statistics(grades)
        
        # Determine status
        status = "active" if assessment.status in ["draft", "open"] else "completed"
        
        projects.append(ProjectOverviewItem(
            project_id=assessment.id,
            project_name=assessment.title,
            course_name=course.name if course else None,
            client_name=client_name,
            period_label=period_label,
            year=year,
            num_teams=num_teams,
            average_score_overall=round(average_score_overall, 1) if average_score_overall else None,
            average_scores_by_category=average_scores_by_category,
            status=status,
            overall_statistics=overall_statistics,
            category_statistics=category_statistics
        ))
    
    return ProjectOverviewListResponse(
        projects=projects,
        total=len(projects)
    )


@router.get("/projects/trends", response_model=ProjectTrendResponse)
def get_project_trends(
    school_year: Optional[str] = Query(None),
    course_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get trend data for project categories over time
    """
    school_id = current_user.school_id
    
    # Query project assessments with scores
    # Join through ProjectAssessmentTeam junction table to match new data model
    query = db.query(
        ProjectAssessment,
        ProjectTeam,
    ).join(
        ProjectAssessmentTeam, ProjectAssessmentTeam.project_assessment_id == ProjectAssessment.id
    ).join(
        ProjectTeam, ProjectTeam.id == ProjectAssessmentTeam.project_team_id
    ).join(
        Project, ProjectTeam.project_id == Project.id
    ).filter(
        ProjectAssessment.school_id == school_id,
        ProjectAssessment.status.in_(["published", "closed"]),  # Include published and closed assessments
        ProjectAssessment.is_advisory.is_(False)  # Exclude external assessments
    ).order_by(ProjectAssessment.published_at.asc())
    
    # Apply filters
    if course_id:
        query = query.filter(Project.course_id == course_id)
    
    if school_year:
        try:
            start_year = int(school_year.split("-")[0])
            query = query.filter(
                or_(
                    func.extract("year", ProjectAssessment.published_at) == start_year,
                    func.extract("year", ProjectAssessment.published_at) == start_year + 1
                )
            )
        except (ValueError, IndexError):
            pass
    
    results = query.all()
    
    # Build trend data
    trend_data = []
    for assessment, team in results:
        if not assessment.published_at:
            continue
        
        # Get rubric
        rubric = db.query(Rubric).filter(Rubric.id == assessment.rubric_id).first()
        if not rubric:
            continue
        
        # Get scores (only with team numbers)
        all_scores = db.query(ProjectAssessmentScore).filter(
            ProjectAssessmentScore.assessment_id == assessment.id,
            ProjectAssessmentScore.team_number.isnot(None)
        ).all()
        
        if not all_scores:
            continue
        
        # Get criteria
        criteria = db.query(RubricCriterion).filter(
            RubricCriterion.rubric_id == rubric.id
        ).all()
        
        # Group scores by team_number
        team_scores = defaultdict(list)
        for score in all_scores:
            team_scores[score.team_number].append(score)
        
        # Calculate grades per team, then average across teams by category
        team_category_grades = defaultdict(list)
        
        for team_number, scores_list in team_scores.items():
            # Create score map for this team
            score_map = {s.criterion_id: s.score for s in scores_list}
            
            # Calculate weighted average by category for this team
            category_scores = {}
            category_weights = {}
            
            for criterion in criteria:
                if criterion.id in score_map and criterion.category:
                    cat = criterion.category.lower()
                    if cat not in category_scores:
                        category_scores[cat] = 0.0
                        category_weights[cat] = 0.0
                    category_scores[cat] += score_map[criterion.id] * criterion.weight
                    category_weights[cat] += criterion.weight
            
            for cat, total_score in category_scores.items():
                if category_weights[cat] > 0:
                    avg = total_score / category_weights[cat]
                    cat_grade = _score_to_grade(avg, rubric.scale_min, rubric.scale_max)
                    team_category_grades[cat].append(cat_grade)
        
        # Average across all teams by category
        scores = {}
        statistics = {}
        for cat, grades in team_category_grades.items():
            if grades:
                scores[cat] = round(sum(grades) / len(grades), 1)
                statistics[cat] = _calculate_statistics(grades)
        
        # Create label
        month = assessment.published_at.month
        year = assessment.published_at.year
        if month <= 3:
            quarter = "Q1"
        elif month <= 6:
            quarter = "Q2"
        elif month <= 9:
            quarter = "Q3"
        else:
            quarter = "Q4"
        
        project_label = f"{quarter} {year} - {assessment.title[:20]}"
        
        trend_data.append(CategoryTrendData(
            project_label=project_label,
            project_id=assessment.id,
            scores=scores,
            statistics=statistics
        ))
    
    return ProjectTrendResponse(trend_data=trend_data)


@router.get("/projects/{project_id}/teams", response_model=ProjectTeamsResponse)
def get_project_teams(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get team scores for a specific project assessment
    """
    school_id = current_user.school_id
    
    # Get the project assessment
    assessment = db.query(ProjectAssessment).filter(
        ProjectAssessment.id == project_id,
        ProjectAssessment.school_id == school_id
    ).first()
    
    if not assessment:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get rubric
    rubric = db.query(Rubric).filter(Rubric.id == assessment.rubric_id).first()
    if not rubric:
        return ProjectTeamsResponse(
            project_id=project_id,
            project_name=assessment.title,
            teams=[]
        )
    
    # Get all scores for this assessment
    all_scores = db.query(ProjectAssessmentScore).filter(
        ProjectAssessmentScore.assessment_id == assessment.id,
        ProjectAssessmentScore.team_number.isnot(None)
    ).all()
    
    if not all_scores:
        return ProjectTeamsResponse(
            project_id=project_id,
            project_name=assessment.title,
            teams=[]
        )
    
    # Get criteria with categories
    criteria = db.query(RubricCriterion).filter(
        RubricCriterion.rubric_id == rubric.id
    ).all()
    
    # Group scores by team_number
    team_scores_map = defaultdict(list)
    for score in all_scores:
        team_scores_map[score.team_number].append(score)
    
    # Get team information (names and members)
    project_teams = db.query(ProjectTeam).filter(
        ProjectTeam.project_id == assessment.project_id
    ).all() if assessment.project_id else []
    
    team_info_map = {}
    for pt in project_teams:
        members = db.query(ProjectTeamMember).join(
            User, ProjectTeamMember.user_id == User.id
        ).filter(
            ProjectTeamMember.project_team_id == pt.id
        ).all()
        
        team_info_map[pt.team_number] = {
            "name": pt.display_name_at_time,
            "members": [m.user.name for m in members]
        }
    
    # Calculate scores for each team
    teams = []
    for team_number in sorted(team_scores_map.keys()):
        scores = team_scores_map[team_number]
        score_map = {s.criterion_id: s.score for s in scores}
        
        # Calculate weighted average overall
        total_weighted_score = 0.0
        total_weight = 0.0
        for criterion in criteria:
            if criterion.id in score_map:
                total_weighted_score += score_map[criterion.id] * criterion.weight
                total_weight += criterion.weight
        
        overall_score = None
        if total_weight > 0:
            avg_score = total_weighted_score / total_weight
            overall_score = _score_to_grade(avg_score, rubric.scale_min, rubric.scale_max)
        
        # Calculate scores by category
        category_scores_dict = {}
        category_weights_dict = {}
        
        for criterion in criteria:
            if criterion.id in score_map and criterion.category:
                cat = criterion.category.lower()
                if cat not in category_scores_dict:
                    category_scores_dict[cat] = 0.0
                    category_weights_dict[cat] = 0.0
                category_scores_dict[cat] += score_map[criterion.id] * criterion.weight
                category_weights_dict[cat] += criterion.weight
        
        category_scores = {}
        for cat, total_score in category_scores_dict.items():
            if category_weights_dict[cat] > 0:
                avg = total_score / category_weights_dict[cat]
                category_scores[cat] = round(_score_to_grade(avg, rubric.scale_min, rubric.scale_max), 1)
        
        # Get team info
        team_info = team_info_map.get(team_number, {"name": None, "members": []})
        
        teams.append(ProjectTeamScore(
            team_number=team_number,
            team_name=team_info["name"] or f"Team {team_number}",
            team_members=team_info["members"],
            overall_score=round(overall_score, 1) if overall_score else None,
            category_scores=category_scores
        ))
    
    return ProjectTeamsResponse(
        project_id=project_id,
        project_name=assessment.title,
        teams=teams
    )


@router.get("/academic-years")
def get_academic_years(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all academic years for the current school
    """
    school_id = current_user.school_id
    
    academic_years = db.query(AcademicYear).filter(
        AcademicYear.school_id == school_id,
        AcademicYear.is_archived.is_(False)
    ).order_by(AcademicYear.start_date.desc()).all()
    
    return [{"label": ay.label, "id": ay.id} for ay in academic_years]


@router.get("/courses")
def get_courses_for_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all active courses for the current school
    """
    school_id = current_user.school_id
    
    courses = db.query(Course).filter(
        Course.school_id == school_id,
        Course.is_active.is_(True)
    ).order_by(Course.name).all()
    
    return [{"id": c.id, "name": c.name} for c in courses]


@router.get("/peer-evaluations/dashboard", response_model=PeerOverviewDashboardResponse)
def get_peer_evaluation_dashboard(
    course_id: Optional[int] = Query(None),
    project_id: Optional[int] = Query(None),
    period: str = Query("6months"),  # "3months" | "6months" | "year"
    student_name: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get dashboard data for peer evaluations overview including:
    - OMZA trend data over time
    - Student heatmap with current scores and trends
    - KPI data (top performers, concerns, etc.)
    
    Filters:
    - course_id: Filter by specific course (vak)
    - project_id: Filter by specific project
    - period: Time period for trends (3months, 6months, year)
    - student_name: Filter by student name
    """
    from datetime import datetime, timedelta
    from collections import defaultdict
    
    school_id = current_user.school_id
    
    # Calculate date range based on period
    end_date = datetime.now()
    if period == "3months":
        start_date = end_date - timedelta(days=90)
    elif period == "year":
        start_date = end_date - timedelta(days=365)
    else:  # 6months (default)
        start_date = end_date - timedelta(days=180)
    
    # Get evaluations matching filters
    eval_query = db.query(Evaluation).filter(
        Evaluation.school_id == school_id,
        Evaluation.evaluation_type == "peer"  # Only peer evaluations
    )
    
    if course_id:
        eval_query = eval_query.filter(Evaluation.course_id == course_id)
    if project_id:
        eval_query = eval_query.filter(Evaluation.project_id == project_id)
    
    evaluations = eval_query.all()
    evaluation_ids = [e.id for e in evaluations]
    
    if not evaluation_ids:
        # Return empty data if no evaluations found
        return PeerOverviewDashboardResponse(
            trendData=[],
            heatmapData=[],
            kpiData=KpiData()
        )
    
    # Get rubric criteria with OMZA categories
    rubric_ids = list(set([e.rubric_id for e in evaluations]))
    criteria = db.query(RubricCriterion).filter(
        RubricCriterion.rubric_id.in_(rubric_ids),
        RubricCriterion.category.isnot(None)
    ).all()
    
    # Map category names to normalized keys
    category_map = {
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
    
    # Group criteria by normalized category
    category_criteria = defaultdict(list)
    for criterion in criteria:
        if criterion.category:
            normalized_cat = category_map.get(criterion.category)
            if normalized_cat:
                category_criteria[normalized_cat].append(criterion.id)
    
    # Get all students
    students_query = db.query(User).filter(
        User.school_id == school_id,
        User.role == "student",
        User.archived.is_(False)
    )
    
    if student_name:
        students_query = students_query.filter(User.name.ilike(f"%{student_name}%"))
    
    students = students_query.all()
    
    # Build heatmap data with current scores
    heatmap_data = []
    student_overall_scores = {}  # For KPI calculations
    
    # Pre-compute scores for all students and evaluations using batch function for efficiency
    evaluation_scores_cache = {}
    for evaluation in evaluations:
        student_ids = [s.id for s in students]
        batch_scores = compute_weighted_omza_scores_batch(
            db, evaluation.id, student_ids
        )
        evaluation_scores_cache[evaluation.id] = batch_scores
    
    for student in students:
        student_scores = {}
        self_scores = {}
        peer_scores = {}
        teacher_comment = None
        
        # Calculate per-category scores by aggregating per-evaluation averages
        # Using pre-computed weighted scores from shared service
        category_peer_scores = defaultdict(list)
        category_self_scores = defaultdict(list)
        
        # Collect all unique category names from all evaluations
        all_categories = set()
        for evaluation in evaluations:
            eval_scores = evaluation_scores_cache.get(evaluation.id, {})
            student_eval_scores = eval_scores.get(student.id, {})
            all_categories.update(student_eval_scores.keys())
        
        for evaluation in evaluations:
            # Get weighted scores from cache
            eval_scores = evaluation_scores_cache.get(evaluation.id, {})
            student_eval_scores = eval_scores.get(student.id, {})
            
            # Aggregate scores by actual category names from rubric
            for cat_name in all_categories:
                cat_scores = student_eval_scores.get(cat_name, {})
                
                peer_score = cat_scores.get("peer")
                if peer_score is not None:
                    category_peer_scores[cat_name].append(float(peer_score))
                
                self_score = cat_scores.get("self")
                if self_score is not None:
                    category_self_scores[cat_name].append(float(self_score))
        
        # Now aggregate the per-evaluation averages into overall category scores
        for cat_name in all_categories:
            peer_evals = category_peer_scores.get(cat_name, [])
            self_evals = category_self_scores.get(cat_name, [])
            
            # Average of peer evaluation averages
            peer_overall = sum(peer_evals) / len(peer_evals) if peer_evals else None
            # Average of self evaluation averages  
            self_overall = sum(self_evals) / len(self_evals) if self_evals else None
            
            # Get teacher score from most recent evaluation settings
            teacher_score = None
            if evaluations:
                # Try to find teacher score in the most recent evaluation
                for evaluation in reversed(evaluations):  # Start with most recent
                    if evaluation.settings:
                        # Try full category name first
                        teacher_key = f"teacher_score_{student.id}_{cat_name}"
                        if teacher_key in evaluation.settings:
                            teacher_score = int(evaluation.settings[teacher_key])
                            break
                        # Fallback to abbreviated (first letter uppercase)
                        cat_abbrev = get_category_abbrev(cat_name)
                        teacher_key = f"teacher_score_{student.id}_{cat_abbrev}"
                        if teacher_key in evaluation.settings:
                            teacher_score = int(evaluation.settings[teacher_key])
                            break
            
            # Combined average (peer scores primarily)
            combined_avg = peer_overall if peer_overall else self_overall
            
            if combined_avg:
                # Use abbreviated category name for frontend compatibility
                cat_abbrev = get_category_abbrev(cat_name)
                student_scores[cat_abbrev] = OmzaCategoryScore(
                    current=float(combined_avg),
                    trend="neutral",  # TODO: Calculate trend by comparing time periods
                    teacher_score=teacher_score
                )
                
                if self_overall:
                    self_scores[cat_abbrev] = float(self_overall)
                if peer_overall:
                    peer_scores[cat_abbrev] = float(peer_overall)
        
        # Get teacher comment from most recent evaluation
        if evaluations:
            for evaluation in reversed(evaluations):
                if evaluation.settings:
                    comment_key = f"teacher_comment_{student.id}"
                    if comment_key in evaluation.settings:
                        teacher_comment = evaluation.settings[comment_key]
                        break
        
        # Build list of individual evaluations for this student (for row expansion)
        student_evaluations = []
        if evaluations:
            for evaluation in evaluations:
                # Get project name
                project = db.query(Project).filter(Project.id == evaluation.project_id).first()
                project_name = project.title if project else f"Evaluatie {evaluation.id}"
                
                # Get eval date
                eval_date = evaluation.closed_at or evaluation.created_at
                if eval_date:
                    if hasattr(eval_date, 'tzinfo') and eval_date.tzinfo is not None:
                        eval_date = eval_date.replace(tzinfo=None)
                    date_str = eval_date.isoformat()
                else:
                    date_str = ""
                
                # Get weighted scores from cache for this evaluation
                eval_student_scores = evaluation_scores_cache.get(evaluation.id, {}).get(student.id, {})
                eval_scores = {}
                
                # Extract scores for all actual categories (using abbreviated names for frontend)
                for cat_name in eval_student_scores.keys():
                    cat_scores = eval_student_scores.get(cat_name, {})
                    peer_score = cat_scores.get("peer")
                    if peer_score is not None:
                        cat_abbrev = get_category_abbrev(cat_name)
                        eval_scores[cat_abbrev] = float(peer_score)
                
                # Extract teacher scores for this evaluation
                eval_teacher_scores = {}
                if evaluation.settings:
                    for cat_name in eval_student_scores.keys():
                        cat_abbrev = get_category_abbrev(cat_name)
                        # Try full category name first
                        teacher_key = f"teacher_score_{student.id}_{cat_name}"
                        if teacher_key in evaluation.settings:
                            try:
                                eval_teacher_scores[cat_abbrev] = int(evaluation.settings[teacher_key])
                            except (ValueError, TypeError):
                                pass
                        else:
                            # Fallback to abbreviated
                            teacher_key = f"teacher_score_{student.id}_{cat_abbrev}"
                            if teacher_key in evaluation.settings:
                                try:
                                    eval_teacher_scores[cat_abbrev] = int(evaluation.settings[teacher_key])
                                except (ValueError, TypeError):
                                    pass
                
                if eval_scores:  # Only add if there are scores
                    student_evaluations.append(PeerEvaluationDetail(
                        id=evaluation.id,
                        date=date_str,
                        label=project_name,
                        scores=eval_scores,
                        teacher_scores=eval_teacher_scores if eval_teacher_scores else None
                    ))
        
        # Sort evaluations by date (newest first)
        student_evaluations.sort(key=lambda e: e.date, reverse=True)
        
        # Only include student in heatmap if they have scores in at least one category
        if student_scores:
            # Calculate self vs peer difference (average across all categories)
            self_vs_peer_diff = None
            if self_scores and peer_scores:
                common_cats = set(self_scores.keys()) & set(peer_scores.keys())
                if common_cats:
                    diffs = [self_scores[cat] - peer_scores[cat] for cat in common_cats]
                    self_vs_peer_diff = sum(diffs) / len(diffs)
            
            # Calculate overall average for KPI
            overall_avg = sum(s.current for s in student_scores.values()) / len(student_scores)
            student_overall_scores[student.id] = {
                'name': student.name,
                'score': overall_avg,
                'self_vs_peer_diff': abs(self_vs_peer_diff) if self_vs_peer_diff else 0
            }
            
            heatmap_data.append(StudentHeatmapRow(
                student_id=student.id,
                student_name=student.name,
                class_name=student.class_name,
                scores=student_scores,
                self_vs_peer_diff=self_vs_peer_diff,
                teacher_comment=teacher_comment,
                 evaluations=student_evaluations if student_evaluations else None
            ))
        else:
            logger.warning(f"Student {student.name} (id={student.id}) has no scores, not adding to heatmap. all_categories={sorted(all_categories)}")
    
    # Calculate trend data - group evaluations by month
    trend_data = []
    if evaluations:
        # Sort evaluations by closed_at or created_at
        sorted_evals = sorted(
            [e for e in evaluations if e.closed_at or e.created_at],
            key=lambda e: e.closed_at or e.created_at
        )
        
        # Group by month
        from datetime import datetime
        monthly_data = defaultdict(lambda: defaultdict(list))
        
        for evaluation in sorted_evals:
            eval_date = evaluation.closed_at or evaluation.created_at
            # Make timezone-naive for comparison
            if eval_date:
                if hasattr(eval_date, 'tzinfo') and eval_date.tzinfo is not None:
                    eval_date = eval_date.replace(tzinfo=None)
                
                if eval_date >= start_date:
                    month_key = eval_date.strftime("%b %Y")  # e.g., "Dec 2024"
                    
                    # Use cached scores from batch calculation
                    eval_all_scores = evaluation_scores_cache.get(evaluation.id, {})
                    
                    # Aggregate all students' scores for this evaluation/month
                    for student_id in eval_all_scores:
                        student_omza = eval_all_scores[student_id]
                        # Add peer scores to monthly aggregation (use actual category names from rubric)
                        for cat_name in student_omza.keys():
                            peer_score = student_omza.get(cat_name, {}).get("peer")
                            if peer_score is not None:
                                # Use the actual category name from the rubric
                                monthly_data[month_key][cat_name].append(float(peer_score))
        
        # Convert to trend data points
        # Note: OmzaTrendDataPoint expects specific lowercase fields, so we need to map
        # actual category names to the expected format
        # Map short codes to full lowercase names
        short_code_to_full = {
            "O": "organiseren",
            "M": "meedoen",
            "Z": "zelfvertrouwen",
            "A": "autonomie",
        }
        
        for month_key in sorted(monthly_data.keys(), key=lambda x: datetime.strptime(x, "%b %Y")):
            scores = monthly_data[month_key]
            
            # Create a flexible mapping - normalize category names to lowercase
            normalized_scores = {}
            for cat_name, cat_scores in scores.items():
                # Check if it's a short code, otherwise use lowercase
                normalized_key = short_code_to_full.get(cat_name, cat_name.lower())
                if cat_scores:
                    normalized_scores[normalized_key] = sum(cat_scores) / len(cat_scores)
                else:
                    normalized_scores[normalized_key] = 0
            
            # Create trend point with available categories, defaulting to 0 for missing ones
            trend_point = OmzaTrendDataPoint(
                date=month_key,
                organiseren=normalized_scores.get('organiseren', 0),
                meedoen=normalized_scores.get('meedoen', 0),
                zelfvertrouwen=normalized_scores.get('zelfvertrouwen', 0),
                autonomie=normalized_scores.get('autonomie', 0)
            )
            trend_data.append(trend_point)
    
    # Calculate KPI data
    kpi_students = list(student_overall_scores.items())
    
    # Grootste stijgers - students with highest scores
    top_performers = sorted(
        kpi_students,
        key=lambda x: x[1]['score'],
        reverse=True
    )[:3]
    
    # Grootste dalers - students with lowest scores
    bottom_performers = sorted(
        kpi_students,
        key=lambda x: x[1]['score']
    )[:3]
    
    # Structureel laag - students consistently below 3.0
    structurally_low = [
        (student_id, data) for student_id, data in kpi_students
        if data['score'] < 3.0
    ][:5]
    
    # Inconsistenties - students with large self vs peer differences
    inconsistencies = sorted(
        kpi_students,
        key=lambda x: x[1]['self_vs_peer_diff'],
        reverse=True
    )[:5]
    
    kpi_data = KpiData(
        grootsteStijgers=[
            KpiStudent(student_id=sid, student_name=data['name'], value=data['score'])
            for sid, data in top_performers
        ],
        grootsteDalers=[
            KpiStudent(student_id=sid, student_name=data['name'], value=data['score'])
            for sid, data in bottom_performers
        ],
        structureelLaag=[
            KpiStudent(student_id=sid, student_name=data['name'], value=data['score'])
            for sid, data in structurally_low
        ],
        inconsistenties=[
            KpiStudent(student_id=sid, student_name=data['name'], value=data['self_vs_peer_diff'])
            for sid, data in inconsistencies if data['self_vs_peer_diff'] > 0
        ]
    )
    
    # Debug: Log what we're returning
    print(f"[OVERVIEW DEBUG] Returning {len(heatmap_data)} students in heatmap")
    for student_row in heatmap_data[:3]:  # Log first 3 students
        print(f"[OVERVIEW DEBUG] Student: {student_row.student_name}, scores keys: {list(student_row.scores.keys())}")
        for cat_name, score_obj in student_row.scores.items():
            print(f"[OVERVIEW DEBUG]   {cat_name}: current={score_obj.current}, teacher_score={score_obj.teacher_score}")
    
    return PeerOverviewDashboardResponse(
        trendData=trend_data,
        heatmapData=heatmap_data,
        kpiData=kpi_data
    )


@router.get("/peer-evaluations/feedback", response_model=FeedbackCollectionResponse)
def get_peer_evaluation_feedback(
    course_id: Optional[int] = Query(None),
    project_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),  # OMZA category filter
    sentiment: Optional[str] = Query(None),  # sentiment filter
    search_text: Optional[str] = Query(None),
    risk_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get feedback collection data from peer evaluations including:
    - Individual feedback items with text
    - Categories (OMZA)
    - Sentiment analysis
    - Risk behavior flags
    
    Filters:
    - course_id: Filter by specific course
    - project_id: Filter by specific project
    - category: Filter by OMZA category
    - sentiment: Filter by sentiment
    - search_text: Search in feedback text
    - risk_only: Show only risk behavior items
    """
    
    school_id = current_user.school_id
    
    # Get evaluations matching filters
    eval_query = db.query(Evaluation).filter(
        Evaluation.school_id == school_id,
        Evaluation.evaluation_type == "peer"
    )
    
    if course_id:
        eval_query = eval_query.filter(Evaluation.course_id == course_id)
    if project_id:
        eval_query = eval_query.filter(Evaluation.project_id == project_id)
    
    evaluations = eval_query.all()
    evaluation_ids = [e.id for e in evaluations]
    
    if not evaluation_ids:
        return FeedbackCollectionResponse(
            feedbackItems=[],
            totalCount=0
        )
    
    # Get rubric criteria with OMZA categories
    rubric_ids = list(set([e.rubric_id for e in evaluations]))
    criteria = db.query(RubricCriterion).filter(
        RubricCriterion.rubric_id.in_(rubric_ids),
        RubricCriterion.category.isnot(None)
    ).all()
    
    # Map category names to normalized keys
    category_map = {
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
    
    # Create criterion_id -> category mapping
    criterion_category_map = {}
    for criterion in criteria:
        if criterion.category:
            normalized_cat = category_map.get(criterion.category)
            if normalized_cat:
                criterion_category_map[criterion.id] = normalized_cat
    
    # Get all scores with comments (feedback text)
    scores_with_comments = db.query(
        Score, Allocation, User, Evaluation, Project
    ).join(
        Allocation, Allocation.id == Score.allocation_id
    ).join(
        User, User.id == Allocation.reviewee_id
    ).join(
        Evaluation, Evaluation.id == Allocation.evaluation_id
    ).outerjoin(
        Project, Project.id == Evaluation.project_id
    ).filter(
        Allocation.evaluation_id.in_(evaluation_ids),
        Score.comment.isnot(None),
        Score.comment != "",
        Score.status == "submitted"
    ).all()
    
    feedback_items = []
    
    for score, allocation, user, evaluation, project in scores_with_comments:
        # Determine category from criterion
        item_category = criterion_category_map.get(score.criterion_id, "algemeen")
        
        # Apply category filter
        if category and item_category != category:
            continue
        
        # Apply search filter
        if search_text and search_text.lower() not in score.comment.lower():
            continue
        
        # Simple sentiment analysis based on keywords
        comment_lower = score.comment.lower()
        sentiment_value = "neutraal"
        
        positive_keywords = ["goed", "uitstekend", "prima", "sterk", "helpt", "positief", "actief"]
        negative_keywords = ["slecht", "zwak", "niet", "weinig", "probleem", "moeilijk", "laag"]
        warning_keywords = ["aandacht", "verbeteren", "soms", "onzeker"]
        
        if any(word in comment_lower for word in positive_keywords):
            sentiment_value = "positief"
        elif any(word in comment_lower for word in negative_keywords):
            sentiment_value = "kritiek"
        elif any(word in comment_lower for word in warning_keywords):
            sentiment_value = "waarschuwing"
        
        # Apply sentiment filter
        if sentiment and sentiment_value != sentiment:
            continue
        
        # Determine if it's risk behavior (very negative sentiment or specific keywords)
        is_risk = any(word in comment_lower for word in ["probleem", "onzeker", "zwak", "niet"])
        
        # Apply risk filter
        if risk_only and not is_risk:
            continue
        
        # Extract simple keywords (first few significant words)
        words = [w for w in score.comment.split() if len(w) > 3]
        keywords = words[:3] if len(words) > 3 else words
        
        # Determine feedback type (self vs peer)
        feedback_type = "self" if allocation.reviewer_id == allocation.reviewee_id else "peer"
        
        # Get from student name (who gave this feedback)
        from_student = None
        from_student_name = None
        if feedback_type == "peer":
            from_student = db.query(User).filter(User.id == allocation.reviewer_id).first()
            from_student_name = from_student.name if from_student else "Onbekend"
        
        feedback_items.append(FeedbackItem(
            id=str(score.id),
            student_id=user.id,
            student_name=user.name,
            project_name=project.title if project else evaluation.title,
            date=evaluation.closed_at or evaluation.created_at,
            category=item_category,
            sentiment=sentiment_value,
            text=score.comment,
            keywords=keywords,
            is_risk_behavior=is_risk,
            feedback_type=feedback_type,
            score=float(score.score) if score.score else None,
            from_student_name=from_student_name
        ))
    
    return FeedbackCollectionResponse(
        feedbackItems=feedback_items,
        totalCount=len(feedback_items)
    )


@router.get("/peer-evaluations/aggregated-feedback", response_model=AggregatedFeedbackResponse)
def get_aggregated_peer_feedback(
    course_id: Optional[int] = Query(None),
    project_id: Optional[int] = Query(None),
    evaluation_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get aggregated feedback per allocation (per peer review instance).
    Each allocation represents one complete peer review with:
    - OMZA category scores (O, M, Z, A)
    - Combined feedback from all criteria
    - Detailed breakdown of individual criteria for expansion
    
    Filters:
    - course_id: Filter by specific course
    - project_id: Filter by specific project
    - evaluation_id: Filter by specific evaluation
    """
    from collections import defaultdict
    
    school_id = current_user.school_id
    
    # Get evaluations matching filters
    eval_query = db.query(Evaluation).filter(
        Evaluation.school_id == school_id,
        Evaluation.evaluation_type == "peer"
    )
    
    if course_id:
        eval_query = eval_query.filter(Evaluation.course_id == course_id)
    if project_id:
        eval_query = eval_query.filter(Evaluation.project_id == project_id)
    if evaluation_id:
        eval_query = eval_query.filter(Evaluation.id == evaluation_id)
    
    evaluations = eval_query.all()
    evaluation_ids = [e.id for e in evaluations]
    
    if not evaluation_ids:
        return AggregatedFeedbackResponse(
            feedbackItems=[],
            totalCount=0
        )
    
    # Create evaluation_id -> (evaluation, project) mapping
    eval_map = {}
    for evaluation in evaluations:
        project = None
        if evaluation.project_id:
            project = db.query(Project).filter(Project.id == evaluation.project_id).first()
        eval_map[evaluation.id] = (evaluation, project)
    
    # Get all allocations for these evaluations
    # Note: Status is tracked on Score, not Allocation
    allocations = db.query(Allocation).filter(
        Allocation.evaluation_id.in_(evaluation_ids)
    ).all()
    
    # Get rubric criteria with categories
    rubric_ids = list(set([e.rubric_id for e in evaluations]))
    criteria = db.query(RubricCriterion).filter(
        RubricCriterion.rubric_id.in_(rubric_ids),
        RubricCriterion.category.isnot(None)
    ).all()
    
    # Create criterion_id -> (criterion, category) mapping
    criterion_map = {}
    for criterion in criteria:
        # Normalize category to abbreviated form (O, M, Z, A)
        cat_abbrev = get_category_abbrev(criterion.category)
        criterion_map[criterion.id] = (criterion, cat_abbrev)
    
    # Get all scores for these allocations
    allocation_ids = [a.id for a in allocations]
    scores = db.query(Score).filter(
        Score.allocation_id.in_(allocation_ids),
        Score.status == "submitted"
    ).all()
    
    # Group scores by allocation_id
    allocation_scores = defaultdict(list)
    for score in scores:
        allocation_scores[score.allocation_id].append(score)
    
    # Build aggregated feedback items
    aggregated_items = []
    
    for allocation in allocations:
        evaluation, project = eval_map.get(allocation.evaluation_id, (None, None))
        if not evaluation:
            continue
        
        # Get reviewee (student receiving feedback)
        reviewee = db.query(User).filter(User.id == allocation.reviewee_id).first()
        if not reviewee:
            continue
        
        # Determine feedback type
        feedback_type = "self" if allocation.reviewer_id == allocation.reviewee_id else "peer"
        
        # Get reviewer info (for peer feedback)
        from_student = None
        from_student_name = None
        if feedback_type == "peer":
            from_student = db.query(User).filter(User.id == allocation.reviewer_id).first()
            from_student_name = from_student.name if from_student else "Onbekend"
            from_student_id = from_student.id if from_student else None
        else:
            from_student_id = None
        
        # Get scores for this allocation
        alloc_scores = allocation_scores.get(allocation.id, [])
        
        # Skip allocations with no submitted scores
        if not alloc_scores:
            continue
        
        # Calculate OMZA category averages and collect feedback
        category_scores = defaultdict(list)  # category -> list of scores
        category_feedback = defaultdict(list)  # category -> list of feedback texts
        criteria_details = []
        
        for score in alloc_scores:
            if score.criterion_id not in criterion_map:
                continue
            
            criterion, cat_abbrev = criterion_map[score.criterion_id]
            
            # Add score to category average
            if score.score is not None:
                category_scores[cat_abbrev].append(float(score.score))
            
            # Collect feedback text
            if score.comment and score.comment.strip():
                category_feedback[cat_abbrev].append(score.comment.strip())
            
            # Add to criteria details for expansion
            criteria_details.append(CriterionDetail(
                criterion_id=criterion.id,
                criterion_name=criterion.name,
                category=cat_abbrev,
                score=float(score.score) if score.score is not None else None,
                feedback=score.comment if score.comment else None
            ))
        
        # Calculate category averages
        score_O = sum(category_scores["O"]) / len(category_scores["O"]) if category_scores["O"] else None
        score_M = sum(category_scores["M"]) / len(category_scores["M"]) if category_scores["M"] else None
        score_Z = sum(category_scores["Z"]) / len(category_scores["Z"]) if category_scores["Z"] else None
        score_A = sum(category_scores["A"]) / len(category_scores["A"]) if category_scores["A"] else None
        
        # Combine all feedback texts
        all_feedback = []
        for cat in ["O", "M", "Z", "A"]:
            all_feedback.extend(category_feedback[cat])
        combined_feedback = " | ".join(all_feedback) if all_feedback else "Geen feedback"
        
        # Create aggregated item
        aggregated_items.append(AggregatedFeedbackItem(
            allocation_id=allocation.id,
            student_id=reviewee.id,
            student_name=reviewee.name,
            project_name=project.title if project else evaluation.title,
            evaluation_id=evaluation.id,
            date=evaluation.closed_at or evaluation.created_at,
            feedback_type=feedback_type,
            from_student_id=from_student_id,
            from_student_name=from_student_name,
            score_O=score_O,
            score_M=score_M,
            score_Z=score_Z,
            score_A=score_A,
            combined_feedback=combined_feedback,
            criteria_details=criteria_details
        ))
    
    return AggregatedFeedbackResponse(
        feedbackItems=aggregated_items,
        totalCount=len(aggregated_items)
    )


@router.get("/peer-evaluations/teacher-feedback", response_model=TeacherFeedbackResponse)
def get_teacher_feedback(
    course_id: Optional[int] = None,
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get teacher feedback/assessments from OMZA evaluations including:
    - Teacher emoticon scores per OMZA category (1-3)
    - General teacher comments
    
    Filters:
    - course_id: Filter by specific course
    - project_id: Filter by specific project
    """
    from app.api.v1.schemas.overview import TeacherFeedbackItem, TeacherFeedbackResponse
    
    school_id = current_user.school_id
    
    # Get evaluations matching filters
    eval_query = db.query(Evaluation).filter(
        Evaluation.school_id == school_id,
        Evaluation.evaluation_type == "peer"
    )
    
    if course_id:
        eval_query = eval_query.filter(Evaluation.course_id == course_id)
    if project_id:
        eval_query = eval_query.filter(Evaluation.project_id == project_id)
    
    evaluations = eval_query.all()
    
    if not evaluations:
        return TeacherFeedbackResponse(
            feedbackItems=[],
            totalCount=0
        )
    
    # Get all students
    students = db.query(User).filter(
        User.school_id == school_id,
        User.role == "student",
        User.archived.is_(False)
    ).all()
    
    teacher_feedback_items = []
    
    for evaluation in evaluations:
        if not evaluation.settings:
            continue
        
        # Check if this evaluation has any teacher assessments
        has_teacher_data = any(
            key.startswith("teacher_score_") or key.startswith("teacher_comment_")
            for key in evaluation.settings.keys()
        )
        
        if not has_teacher_data:
            continue
        
        # Get project name
        project_name = evaluation.project.title if evaluation.project else f"Peer Evaluatie {evaluation.id}"
        eval_date = evaluation.closed_at or evaluation.created_at
        
        # Extract teacher assessments for each student
        for student in students:
            # Get teacher scores for each OMZA category
            org_key = f"teacher_score_{student.id}_O"
            mee_key = f"teacher_score_{student.id}_M"
            zel_key = f"teacher_score_{student.id}_Z"
            aut_key = f"teacher_score_{student.id}_A"
            comment_key = f"teacher_comment_{student.id}"
            
            org_score = evaluation.settings.get(org_key)
            mee_score = evaluation.settings.get(mee_key)
            zel_score = evaluation.settings.get(zel_key)
            aut_score = evaluation.settings.get(aut_key)
            comment = evaluation.settings.get(comment_key)
            
            # Only include if at least one score or comment exists
            if org_score or mee_score or zel_score or aut_score or comment:
                teacher_feedback_items.append(TeacherFeedbackItem(
                    id=evaluation.id * 10000 + student.id,  # Unique ID
                    student_id=student.id,
                    student_name=student.name,
                    project_name=project_name,
                    evaluation_id=evaluation.id,
                    date=eval_date,
                    organiseren_score=int(org_score) if org_score else None,
                    meedoen_score=int(mee_score) if mee_score else None,
                    zelfvertrouwen_score=int(zel_score) if zel_score else None,
                    autonomie_score=int(aut_score) if aut_score else None,
                    teacher_comment=comment
                ))
    
    return TeacherFeedbackResponse(
        feedbackItems=teacher_feedback_items,
        totalCount=len(teacher_feedback_items)
    )


@router.get("/peer-evaluations/reflections", response_model=ReflectionResponse)
def get_peer_evaluation_reflections(
    course_id: Optional[int] = Query(None),
    project_id: Optional[int] = Query(None),
    student_name: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all reflections from peer evaluations including:
    - Student reflections per evaluation
    - Word count
    - Date submitted
    
    Filters:
    - course_id: Filter by specific course
    - project_id: Filter by specific project
    - student_name: Filter by student name (partial match)
    """
    school_id = current_user.school_id
    
    # Get evaluations matching filters
    eval_query = db.query(Evaluation).filter(
        Evaluation.school_id == school_id,
        Evaluation.evaluation_type == "peer"
    )
    
    if course_id:
        eval_query = eval_query.filter(Evaluation.course_id == course_id)
    if project_id:
        eval_query = eval_query.filter(Evaluation.project_id == project_id)
    
    evaluations = eval_query.all()
    evaluation_ids = [e.id for e in evaluations]
    
    if not evaluation_ids:
        return ReflectionResponse(
            reflectionItems=[],
            totalCount=0
        )
    
    # Get reflections from the Reflection table
    reflection_query = db.query(Reflection).join(User, Reflection.user_id == User.id).filter(
        Reflection.evaluation_id.in_(evaluation_ids),
        Reflection.text.isnot(None),
        Reflection.text != ""
    )
    
    if student_name:
        reflection_query = reflection_query.filter(
            User.name.ilike(f"%{student_name}%")
        )
    
    reflections = reflection_query.all()
    
    reflection_items = []
    for reflection in reflections:
        # Get student info
        student = db.query(User).filter(User.id == reflection.user_id).first()
        if not student:
            continue
        
        # Get evaluation and project info
        evaluation = db.query(Evaluation).filter(Evaluation.id == reflection.evaluation_id).first()
        if not evaluation:
            continue
        
        project_name = evaluation.project.title if evaluation.project else f"Peer Evaluatie {evaluation.id}"
        eval_date = evaluation.closed_at or evaluation.created_at
        
        # Strip timezone if present
        if eval_date and hasattr(eval_date, 'tzinfo') and eval_date.tzinfo is not None:
            eval_date = eval_date.replace(tzinfo=None)
        
        reflection_items.append(ReflectionItem(
            id=reflection.id,
            student_id=student.id,
            student_name=student.name,
            project_name=project_name,
            evaluation_id=evaluation.id,
            date=eval_date,
            reflection_text=reflection.text,
            word_count=reflection.word_count
        ))
    
    return ReflectionResponse(
        reflectionItems=reflection_items,
        totalCount=len(reflection_items)
    )
