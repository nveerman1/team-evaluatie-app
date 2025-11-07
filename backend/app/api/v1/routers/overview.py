from __future__ import annotations
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from io import StringIO
import csv
from datetime import datetime
from typing import Optional

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    User,
    Course,
    ProjectAssessment,
    ProjectAssessmentScore,
    Evaluation,
    CompetencyWindow,
    CompetencySelfScore,
    Group,
    Rubric,
)
from app.api.v1.schemas.overview import OverviewItemOut, OverviewListResponse

router = APIRouter(prefix="/overview", tags=["overview"])


def _calculate_project_score(db: Session, assessment_id: int, rubric_id: int) -> Optional[float]:
    """
    Calculate final score for a project assessment
    Returns average score normalized to 1-5 scale
    """
    # Get rubric scale
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id).first()
    if not rubric:
        return None
    
    # Get all scores for this assessment
    scores = db.query(ProjectAssessmentScore).filter(
        ProjectAssessmentScore.assessment_id == assessment_id
    ).all()
    
    if not scores:
        return None
    
    # Calculate weighted average
    total_score = sum(s.score for s in scores)
    avg_score = total_score / len(scores) if scores else None
    
    if avg_score is None:
        return None
    
    # Normalize to 1-5 scale if needed
    if rubric.scale_min != 1 or rubric.scale_max != 5:
        normalized = 1 + ((avg_score - rubric.scale_min) / (rubric.scale_max - rubric.scale_min)) * 4
        return round(normalized, 2)
    
    return round(avg_score, 2)


def _calculate_peer_score(db: Session, evaluation_id: int, user_id: int) -> Optional[float]:
    """
    Calculate final peer evaluation score for a student
    This is a simplified version - actual implementation depends on your scoring logic
    """
    # For now, return None - you can implement actual logic based on your grade calculation
    # This would typically involve aggregating scores from allocations
    return None


def _calculate_competency_score(db: Session, window_id: int, user_id: int) -> Optional[float]:
    """
    Calculate average competency score for a student in a window
    """
    scores = db.query(func.avg(CompetencySelfScore.score)).filter(
        CompetencySelfScore.window_id == window_id,
        CompetencySelfScore.user_id == user_id
    ).scalar()
    
    return round(float(scores), 2) if scores else None


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
        # Query project assessments with student data via group members
        project_query = db.query(
            ProjectAssessment,
            User,
            Course,
            Group,
        ).join(
            Group, ProjectAssessment.group_id == Group.id
        ).join(
            User, User.id == ProjectAssessment.teacher_id  # Teacher as creator
        ).outerjoin(
            Course, Group.course_id == Course.id
        ).filter(
            ProjectAssessment.school_id == school_id
        )
        
        # Apply filters
        if course_id:
            project_query = project_query.filter(Group.course_id == course_id)
        if teacher_id:
            project_query = project_query.filter(ProjectAssessment.teacher_id == teacher_id)
        if status:
            project_query = project_query.filter(ProjectAssessment.status == status)
        if date_from_dt:
            project_query = project_query.filter(ProjectAssessment.published_at >= date_from_dt)
        if date_to_dt:
            project_query = project_query.filter(ProjectAssessment.published_at <= date_to_dt)
        if team_number:
            project_query = project_query.filter(Group.team_number == team_number)
        if search:
            search_pattern = f"%{search}%"
            project_query = project_query.filter(
                or_(
                    ProjectAssessment.title.ilike(search_pattern),
                    Group.name.ilike(search_pattern)
                )
            )
        
        # Get results and create items for each group member
        for assessment, teacher, course, group in project_query.all():
            # Get all group members
            members = db.query(User).join(
                Group.members
            ).filter(
                Group.id == group.id
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
