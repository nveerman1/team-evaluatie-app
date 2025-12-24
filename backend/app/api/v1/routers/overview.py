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
from app.core.grading import score_to_grade as _score_to_grade
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
    RubricCriterion,
    Grade,
    PublishedGrade,
    Allocation,
    Project,
    Client,
    ClientProjectLink,
    AcademicYear,
)
from app.api.v1.schemas.overview import (
    OverviewItemOut,
    OverviewListResponse,
    ProjectOverviewListResponse,
    ProjectTrendResponse,
    ProjectOverviewItem,
    CategoryTrendData,
    PeerOverviewDashboardResponse,
    FeedbackCollectionResponse,
    OmzaTrendDataPoint,
    StudentHeatmapRow,
    OmzaCategoryScore,
    KpiData,
    KpiStudent,
    FeedbackItem,
)

router = APIRouter(prefix="/overview", tags=["overview"])


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


def _calculate_peer_score(db: Session, evaluation_id: int, user_id: int) -> Optional[float]:
    """
    Get final peer evaluation grade for a student (Eindcijfer)
    Returns the published grade from the Grade table (1-10 scale)
    """
    # Try to get from PublishedGrade table first
    published = db.query(PublishedGrade).filter(
        PublishedGrade.evaluation_id == evaluation_id,
        PublishedGrade.user_id == user_id
    ).first()
    
    if published and published.grade is not None:
        return round(float(published.grade), 1)
    
    # Otherwise try to get grade from Grade table (use 'grade' field, not 'published_grade')
    grade = db.query(Grade).filter(
        Grade.evaluation_id == evaluation_id,
        Grade.user_id == user_id
    ).first()
    
    if grade and grade.grade is not None:
        return round(float(grade.grade), 1)
    
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
    
    # Dictionary to store all evaluations with metadata
    evaluations = []  # List of (key, type, title, date, evaluation_id)
    
    # Dictionary to store student data: student_id -> {evaluation_key -> cell_data}
    student_data = {}
    
    # ==================== COLLECT PROJECT ASSESSMENTS ====================
    project_query = db.query(
        ProjectAssessment,
        Course,
        Group,
    ).join(
        Group, ProjectAssessment.group_id == Group.id
    ).outerjoin(
        Course, Group.course_id == Course.id
    ).filter(
        ProjectAssessment.school_id == school_id,
        ProjectAssessment.status == "published"  # Only published projects
    )
    
    if course_id:
        project_query = project_query.filter(Group.course_id == course_id)
    if date_from_dt:
        project_query = project_query.filter(ProjectAssessment.published_at >= date_from_dt)
    if date_to_dt:
        project_query = project_query.filter(ProjectAssessment.published_at <= date_to_dt)
    
    for assessment, course, group in project_query.all():
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
        
        # Get all group members and their scores (only active students)
        members = db.query(User).join(
            Group.members
        ).filter(
            Group.id == group.id,
            ~User.archived,
            User.role == "student"
        ).all()
        
        # Filter by class if specified
        if class_name:
            members = [m for m in members if m.class_name == class_name]
        
        # Filter by student name if specified
        if student_name:
            members = [m for m in members if student_name.lower() in m.name.lower()]
        
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
    query = db.query(
        ProjectAssessment,
        Group,
        Course,
        Project,
        Client,
    ).join(
        Group, ProjectAssessment.group_id == Group.id
    ).outerjoin(
        Course, Group.course_id == Course.id
    ).outerjoin(
        Project, ProjectAssessment.project_id == Project.id
    ).outerjoin(
        ClientProjectLink, ClientProjectLink.project_id == Project.id
    ).outerjoin(
        Client, ClientProjectLink.client_id == Client.id
    ).filter(
        ProjectAssessment.school_id == school_id,
        ProjectAssessment.is_advisory == False,  # Exclude external assessments
        ProjectAssessment.status.in_(["published", "closed"])  # Only show published or closed assessments
    )
    
    # Apply filters
    if course_id:
        query = query.filter(Group.course_id == course_id)
    
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
                Group.name.ilike(search_pattern)
            )
        )
    
    # Get results
    results = query.all()
    
    # Build project overview items
    projects = []
    for assessment, group, course, project, client in results:
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
                ProjectAssessmentScore.assessment_id == assessment.id
            ).all()
            
            if not all_scores:
                average_score_overall = None
                average_scores_by_category = {}
            else:
                # Get criteria with categories
                criteria = db.query(RubricCriterion).filter(
                    RubricCriterion.rubric_id == rubric.id
                ).all()
                
                # Create score map
                score_map = {s.criterion_id: s.score for s in all_scores}
                
                # Calculate weighted average overall
                total_weighted_score = 0.0
                total_weight = 0.0
                for criterion in criteria:
                    if criterion.id in score_map:
                        total_weighted_score += score_map[criterion.id] * criterion.weight
                        total_weight += criterion.weight
                
                if total_weight == 0:
                    average_score_overall = None
                else:
                    avg_score = total_weighted_score / total_weight
                    average_score_overall = _score_to_grade(avg_score, rubric.scale_min, rubric.scale_max)
                
                # Calculate average by category
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
                
                average_scores_by_category = {}
                for cat, total_score in category_scores.items():
                    if category_weights[cat] > 0:
                        avg = total_score / category_weights[cat]
                        average_scores_by_category[cat] = round(_score_to_grade(avg, rubric.scale_min, rubric.scale_max), 1)
        
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
            status=status
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
    query = db.query(
        ProjectAssessment,
        Group,
    ).join(
        Group, ProjectAssessment.group_id == Group.id
    ).filter(
        ProjectAssessment.school_id == school_id,
        ProjectAssessment.status.in_(["published", "closed"]),  # Include published and closed assessments
        ProjectAssessment.is_advisory == False  # Exclude external assessments
    ).order_by(ProjectAssessment.published_at.asc())
    
    # Apply filters
    if course_id:
        query = query.filter(Group.course_id == course_id)
    
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
    for assessment, group in results:
        if not assessment.published_at:
            continue
        
        # Get rubric
        rubric = db.query(Rubric).filter(Rubric.id == assessment.rubric_id).first()
        if not rubric:
            continue
        
        # Get scores
        all_scores = db.query(ProjectAssessmentScore).filter(
            ProjectAssessmentScore.assessment_id == assessment.id
        ).all()
        
        if not all_scores:
            continue
        
        # Get criteria
        criteria = db.query(RubricCriterion).filter(
            RubricCriterion.rubric_id == rubric.id
        ).all()
        
        score_map = {s.criterion_id: s.score for s in all_scores}
        
        # Calculate average by category
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
        
        scores = {}
        for cat, total_score in category_scores.items():
            if category_weights[cat] > 0:
                avg = total_score / category_weights[cat]
                scores[cat] = round(_score_to_grade(avg, rubric.scale_min, rubric.scale_max), 1)
        
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
            scores=scores
        ))
    
    return ProjectTrendResponse(trend_data=trend_data)


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
        AcademicYear.is_archived == False
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
        Course.is_active == True
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
    from sqlalchemy import func, case
    
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
    
    # For now, return mock data structure
    # TODO: Implement real data aggregation from Score table
    # This would involve:
    # 1. Query all scores for these evaluations
    # 2. Group by student and category
    # 3. Calculate averages and trends over time
    # 4. Calculate self vs peer differences
    # 5. Identify top/bottom performers
    
    return PeerOverviewDashboardResponse(
        trendData=[],
        heatmapData=[],
        kpiData=KpiData()
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
    
    # For now, return mock data structure
    # TODO: Implement real feedback aggregation
    # This would involve:
    # 1. Query Reflection table for written feedback
    # 2. Extract and categorize feedback text
    # 3. Apply filters
    # 4. Return structured feedback items
    
    return FeedbackCollectionResponse(
        feedbackItems=[],
        totalCount=0
    )
