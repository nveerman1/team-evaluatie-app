"""
Utility functions for teacher-related operations.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.infra.db.models import User, TeacherCourse


def get_teacher_course_ids(db: Session, user: User) -> list[int]:
    """
    Get all course IDs that a teacher is assigned to via teacher_courses.

    Args:
        db: Database session
        user: Current user

    Returns:
        List of course IDs. Empty list for admins (indicating no filtering needed)
        or non-teacher users.
    """
    if user.role == "admin":
        # Admins see everything, return empty list to indicate no filtering
        return []
    if user.role != "teacher":
        return []

    course_ids_query = select(TeacherCourse.course_id).where(
        TeacherCourse.school_id == user.school_id,
        TeacherCourse.teacher_id == user.id,
        TeacherCourse.is_active.is_(True),
    )
    result = db.execute(course_ids_query).scalars().all()
    return list(result)
