"""
Analytics API endpoints
"""

from __future__ import annotations
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    Course,
    User,
    Evaluation,
    Group,
    GroupMember,
    RubricCriterion,
    LearningObjective,
)
from app.api.v1.schemas.analytics import (
    CourseSummaryOut,
    LearningObjectiveProgressOut,
    EvaluationTypeStatsOut,
)
from app.core.rbac import require_course_access

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/courses/{course_id}/summary", response_model=CourseSummaryOut)
def get_course_summary(
    course_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get summary analytics for a course
    
    Returns:
    - Total student count
    - Total evaluations
    - Completed evaluations
    - Average grade
    - Participation rate
    """
    require_course_access(db, user, course_id)
    
    # Verify course exists
    course = (
        db.query(Course)
        .filter(Course.id == course_id, Course.school_id == user.school_id)
        .first()
    )
    
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course not found"
        )
    
    # Count students in the course
    total_students = (
        db.query(func.count(func.distinct(User.id)))
        .join(GroupMember, GroupMember.user_id == User.id)
        .join(Group, Group.id == GroupMember.group_id)
        .filter(
            Group.course_id == course_id,
            User.role == "student",
            GroupMember.active == True,
        )
        .scalar()
    ) or 0
    
    # Count evaluations
    total_evaluations = (
        db.query(func.count(Evaluation.id))
        .filter(Evaluation.course_id == course_id)
        .scalar()
    ) or 0
    
    completed_evaluations = (
        db.query(func.count(Evaluation.id))
        .filter(Evaluation.course_id == course_id, Evaluation.status == "closed")
        .scalar()
    ) or 0
    
    # Calculate average grade (mock for now - would need to join with grades table)
    # TODO: Implement actual grade calculation from grades/scores tables
    average_score = 7.5  # Mock value
    
    # Calculate participation rate (mock for now)
    # TODO: Implement actual participation calculation
    participation_rate = 85 if total_students > 0 else 0
    
    return CourseSummaryOut(
        total_students=total_students,
        total_evaluations=total_evaluations,
        completed_evaluations=completed_evaluations,
        average_score=average_score,
        participation_rate=participation_rate,
    )


@router.get(
    "/courses/{course_id}/learning-objectives",
    response_model=List[LearningObjectiveProgressOut],
)
def get_learning_objectives_progress(
    course_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get learning objectives progress for a course
    
    Returns coverage and average scores per learning objective
    """
    require_course_access(db, user, course_id)
    
    # Verify course exists
    course = (
        db.query(Course)
        .filter(Course.id == course_id, Course.school_id == user.school_id)
        .first()
    )
    
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course not found"
        )
    
    # Get learning objectives used in course evaluations
    # This is a simplified version - actual implementation would need to:
    # 1. Find all evaluations for the course
    # 2. Get rubrics used in those evaluations
    # 3. Get criteria from those rubrics
    # 4. Get learning objectives linked to those criteria
    # 5. Calculate coverage and scores
    
    # For now, return mock data structure
    # TODO: Implement actual learning objective analytics
    learning_objectives = (
        db.query(LearningObjective)
        .filter(LearningObjective.school_id == user.school_id)
        .limit(10)
        .all()
    )
    
    result = []
    for lo in learning_objectives:
        # Use domain as code, or generate a code from domain and order
        code = f"{lo.domain or 'LO'}{lo.order}" if lo.domain else f"LO{lo.order}"
        
        result.append(
            LearningObjectiveProgressOut(
                id=lo.id,
                code=code,
                description=lo.description or lo.title or "",
                coverage=75,  # Mock value - percentage of students who have been assessed
                average_score=7.5,  # Mock value
                student_count=30,  # Mock value
            )
        )
    
    return result


@router.get(
    "/courses/{course_id}/evaluation-types",
    response_model=List[EvaluationTypeStatsOut],
)
def get_evaluation_type_stats(
    course_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get statistics per evaluation type for a course
    
    Returns count, average score, and completion rate per type
    """
    require_course_access(db, user, course_id)
    
    # Verify course exists
    course = (
        db.query(Course)
        .filter(Course.id == course_id, Course.school_id == user.school_id)
        .first()
    )
    
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course not found"
        )
    
    # Get evaluation statistics by type
    stats = (
        db.query(
            Evaluation.evaluation_type,
            func.count(Evaluation.id).label("count"),
            func.sum(
                case((Evaluation.status == "closed", 1), else_=0)
            ).label("completed"),
        )
        .filter(Evaluation.course_id == course_id)
        .group_by(Evaluation.evaluation_type)
        .all()
    )
    
    result = []
    for eval_type, count, completed in stats:
        completion_rate = (completed / count * 100) if count > 0 else 0
        
        # Mock average score - would need to calculate from actual scores
        avg_score = 7.5
        
        result.append(
            EvaluationTypeStatsOut(
                type=eval_type,
                count=count,
                avg_score=avg_score,
                completion_rate=completion_rate,
            )
        )
    
    return result
