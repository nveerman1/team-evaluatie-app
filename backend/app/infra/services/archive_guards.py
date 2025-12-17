"""
Academic Year Archive Guards

Helper functions to enforce read-only protection on archived academic years.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.infra.db.models import AcademicYear, Course, Project


def require_year_not_archived(db: Session, year_id: int) -> None:
    """
    Check if an academic year is archived and raise 403 if it is.
    
    Args:
        db: Database session
        year_id: Academic year ID to check
        
    Raises:
        HTTPException: 403 if the year is archived
    """
    year = db.query(AcademicYear).filter(AcademicYear.id == year_id).first()
    if year and year.is_archived:
        raise HTTPException(
            status_code=403,
            detail="Academisch jaar is gearchiveerd (alleen-lezen)."
        )


def require_course_year_not_archived(db: Session, course_id: int) -> None:
    """
    Check if the academic year of a course is archived and raise 403 if it is.
    
    Args:
        db: Database session
        course_id: Course ID to check
        
    Raises:
        HTTPException: 403 if the course's academic year is archived
    """
    course = db.query(Course).filter(Course.id == course_id).first()
    if course and course.academic_year_id:
        require_year_not_archived(db, course.academic_year_id)


def require_project_year_not_archived(db: Session, project_id: int) -> None:
    """
    Check if the academic year of a project (via its course) is archived and raise 403 if it is.
    
    Args:
        db: Database session
        project_id: Project ID to check
        
    Raises:
        HTTPException: 403 if the project's academic year is archived
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if project and project.course_id:
        require_course_year_not_archived(db, project.course_id)
