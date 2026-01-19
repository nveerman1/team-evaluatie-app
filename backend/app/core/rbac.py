"""
RBAC (Role-Based Access Control) policies and helpers

This module provides centralized authorization logic for the application:
- require_role: Check if user has required role
- scope_by_school: Ensure all queries are scoped to user's school
- can_access_course: Check if teacher can access specific course
- can_access_evaluation: Check if user can access specific evaluation
"""

from __future__ import annotations
from typing import List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.infra.db.models import User, Course, Evaluation, TeacherCourse, CourseEnrollment


class RBACError(HTTPException):
    """Custom exception for RBAC violations"""

    def __init__(self, detail: str = "Access denied"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def require_role(user: User, allowed_roles: List[str]) -> None:
    """
    Check if user has one of the allowed roles

    Args:
        user: Current user
        allowed_roles: List of allowed role names (e.g., ["admin", "teacher"])

    Raises:
        RBACError: If user doesn't have required role
    """
    if not user or not user.role:
        raise RBACError("Authentication required")

    if user.role not in allowed_roles:
        raise RBACError(
            f"Insufficient permissions. Required roles: {', '.join(allowed_roles)}"
        )


def ensure_school_access(user: User, school_id: int) -> None:
    """
    Ensure user has access to the specified school

    Args:
        user: Current user
        school_id: School ID to check access for

    Raises:
        RBACError: If user doesn't have access to school
    """
    if not user or not user.school_id:
        raise RBACError("Authentication required")

    if user.school_id != school_id:
        raise RBACError("Access denied: school mismatch")


def can_access_course(db: Session, user: User, course_id: int) -> bool:
    """
    Check if user can access a specific course

    Rules:
    - Admin: can access any course in their school
    - Teacher: can access courses they're assigned to
    - Student: can access courses they're enrolled in

    Args:
        db: Database session
        user: Current user
        course_id: Course ID to check

    Returns:
        bool: True if user can access the course
    """
    if not user or not user.school_id:
        return False

    # Get course and check school
    course = (
        db.query(Course)
        .filter(Course.id == course_id, Course.school_id == user.school_id)
        .first()
    )

    if not course:
        return False

    # Admin has full access
    if user.role == "admin":
        return True

    # Teacher: check TeacherCourse mapping
    if user.role == "teacher":
        teacher_course = (
            db.query(TeacherCourse)
            .filter(
                TeacherCourse.teacher_id == user.id,
                TeacherCourse.course_id == course_id,
                TeacherCourse.is_active.is_(True),
            )
            .first()
        )
        return teacher_course is not None

    # Student: check if they're enrolled in the course
    if user.role == "student":
        enrollment = (
            db.query(CourseEnrollment)
            .filter(
                CourseEnrollment.student_id == user.id,
                CourseEnrollment.course_id == course_id,
                CourseEnrollment.active.is_(True),
            )
            .first()
        )
        return enrollment is not None

    return False


def require_course_access(db: Session, user: User, course_id: int) -> None:
    """
    Require user to have access to a specific course

    Args:
        db: Database session
        user: Current user
        course_id: Course ID to check

    Raises:
        RBACError: If user doesn't have access
    """
    if not can_access_course(db, user, course_id):
        raise RBACError("Access denied: course access required")


def can_access_evaluation(db: Session, user: User, evaluation_id: int) -> bool:
    """
    Check if user can access a specific evaluation

    Rules:
    - Admin: can access any evaluation in their school
    - Teacher: can access evaluations for courses they teach
    - Student: can access evaluations they're allocated to

    Args:
        db: Database session
        user: Current user
        evaluation_id: Evaluation ID to check

    Returns:
        bool: True if user can access the evaluation
    """
    if not user or not user.school_id:
        return False

    # Get evaluation and check school
    evaluation = (
        db.query(Evaluation)
        .filter(Evaluation.id == evaluation_id, Evaluation.school_id == user.school_id)
        .first()
    )

    if not evaluation:
        return False

    # Admin has full access
    if user.role == "admin":
        return True

    # Teacher: check course access
    if user.role == "teacher" and evaluation.course_id:
        return can_access_course(db, user, evaluation.course_id)

    # Student: check if they have any allocation for this evaluation
    if user.role == "student":
        from app.infra.db.models import Allocation

        allocation = (
            db.query(Allocation)
            .filter(
                Allocation.evaluation_id == evaluation_id,
                (Allocation.reviewer_id == user.id)
                | (Allocation.reviewee_id == user.id),
            )
            .first()
        )
        return allocation is not None

    return False


def require_evaluation_access(db: Session, user: User, evaluation_id: int) -> None:
    """
    Require user to have access to a specific evaluation

    Args:
        db: Database session
        user: Current user
        evaluation_id: Evaluation ID to check

    Raises:
        RBACError: If user doesn't have access
    """
    if not can_access_evaluation(db, user, evaluation_id):
        raise RBACError("Access denied: evaluation access required")


def get_accessible_course_ids(db: Session, user: User) -> List[int]:
    """
    Get list of course IDs that user can access

    Args:
        db: Database session
        user: Current user

    Returns:
        List of course IDs
    """
    if not user or not user.school_id:
        return []

    # Admin can access all courses in their school
    if user.role == "admin":
        courses = (
            db.query(Course.id)
            .filter(Course.school_id == user.school_id, Course.is_active.is_(True))
            .all()
        )
        return [c.id for c in courses]

    # Teacher: get courses they teach
    if user.role == "teacher":
        teacher_courses = (
            db.query(TeacherCourse.course_id)
            .filter(
                TeacherCourse.teacher_id == user.id, TeacherCourse.is_active.is_(True)
            )
            .all()
        )
        return [tc.course_id for tc in teacher_courses]

    # Student: get courses from their enrollments
    if user.role == "student":
        enrollments = (
            db.query(CourseEnrollment.course_id)
            .filter(
                CourseEnrollment.student_id == user.id,
                CourseEnrollment.active.is_(True),
            )
            .distinct()
            .all()
        )
        return [e.course_id for e in enrollments]

    return []


def scope_query_by_school(query, model, user: User):
    """
    Scope a SQLAlchemy query to user's school

    Args:
        query: SQLAlchemy query object
        model: Model class to scope (must have school_id)
        user: Current user

    Returns:
        Scoped query
    """
    if not user or not user.school_id:
        # Return empty query
        return query.filter(model.school_id == -1)

    return query.filter(model.school_id == user.school_id)
