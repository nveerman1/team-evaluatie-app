"""
Course Enrollment API Router
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import User, Course, CourseEnrollment
from app.api.v1.schemas.course_enrollments import (
    CourseEnrollmentCreate,
    CourseEnrollmentOut,
    CourseEnrollmentListOut,
    BulkEnrollmentCreate,
    BulkEnrollmentDelete,
)
from app.infra.services.archive_guards import require_course_year_not_archived

router = APIRouter(
    prefix="/admin/course-enrollments", tags=["admin-course-enrollments"]
)


@router.get("", response_model=CourseEnrollmentListOut)
def list_course_enrollments(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    course_id: Optional[int] = Query(None),
    student_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List course enrollments"""

    # Require admin or teacher role
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    school_id = current_user.school_id

    # Build query
    query = (
        db.query(CourseEnrollment).join(Course).filter(Course.school_id == school_id)
    )

    if course_id:
        query = query.filter(CourseEnrollment.course_id == course_id)

    if student_id:
        query = query.filter(CourseEnrollment.student_id == student_id)

    # Get total count
    total = query.count()

    # Get paginated results
    query = query.offset((page - 1) * per_page).limit(per_page)
    enrollments = query.all()

    # Enrich with course and student names
    enrollments_out = []
    for enrollment in enrollments:
        enrollment_dict = CourseEnrollmentOut.model_validate(enrollment).model_dump()
        enrollment_dict["course_name"] = (
            enrollment.course.name if enrollment.course else None
        )
        enrollment_dict["student_name"] = (
            enrollment.student.name if enrollment.student else None
        )
        enrollments_out.append(CourseEnrollmentOut(**enrollment_dict))

    return CourseEnrollmentListOut(
        enrollments=enrollments_out,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("", response_model=CourseEnrollmentOut)
def create_course_enrollment(
    data: CourseEnrollmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Enroll a student in a course"""

    # Require admin or teacher role
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    school_id = current_user.school_id

    # Verify course exists and belongs to school
    course = (
        db.query(Course)
        .filter(
            Course.id == data.course_id,
            Course.school_id == school_id,
        )
        .first()
    )

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Check if course's year is archived
    require_course_year_not_archived(db, data.course_id)

    # Verify student exists and belongs to school
    student = (
        db.query(User)
        .filter(
            User.id == data.student_id,
            User.school_id == school_id,
            User.role == "student",
        )
        .first()
    )

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Check if enrollment already exists
    existing = (
        db.query(CourseEnrollment)
        .filter(
            CourseEnrollment.course_id == data.course_id,
            CourseEnrollment.student_id == data.student_id,
        )
        .first()
    )

    if existing:
        # If inactive, reactivate
        if not existing.active:
            existing.active = True
            db.commit()
            db.refresh(existing)
            return CourseEnrollmentOut.model_validate(existing)

        raise HTTPException(
            status_code=400, detail="Student is already enrolled in this course"
        )

    # Create enrollment
    enrollment = CourseEnrollment(
        course_id=data.course_id,
        student_id=data.student_id,
        active=True,
    )

    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)

    # Enrich with course and student names
    enrollment_dict = CourseEnrollmentOut.model_validate(enrollment).model_dump()
    enrollment_dict["course_name"] = course.name
    enrollment_dict["student_name"] = student.name

    return CourseEnrollmentOut(**enrollment_dict)


@router.post("/bulk", response_model=dict)
def bulk_create_enrollments(
    data: BulkEnrollmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk enroll students in a course"""

    # Require admin or teacher role
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    school_id = current_user.school_id

    # Verify course exists and belongs to school
    course = (
        db.query(Course)
        .filter(
            Course.id == data.course_id,
            Course.school_id == school_id,
        )
        .first()
    )

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    created_count = 0
    reactivated_count = 0
    already_enrolled_count = 0

    for student_id in data.student_ids:
        # Verify student exists and belongs to school
        student = (
            db.query(User)
            .filter(
                User.id == student_id,
                User.school_id == school_id,
                User.role == "student",
            )
            .first()
        )

        if not student:
            continue  # Skip invalid students

        # Check if enrollment already exists
        existing = (
            db.query(CourseEnrollment)
            .filter(
                CourseEnrollment.course_id == data.course_id,
                CourseEnrollment.student_id == student_id,
            )
            .first()
        )

        if existing:
            if not existing.active:
                existing.active = True
                reactivated_count += 1
            else:
                already_enrolled_count += 1
        else:
            enrollment = CourseEnrollment(
                course_id=data.course_id,
                student_id=student_id,
                active=True,
            )
            db.add(enrollment)
            created_count += 1

    db.commit()

    return {
        "created": created_count,
        "reactivated": reactivated_count,
        "already_enrolled": already_enrolled_count,
        "total_processed": len(data.student_ids),
    }


@router.delete("/{enrollment_id}")
def delete_course_enrollment(
    enrollment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a student from a course"""

    # Require admin or teacher role
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    school_id = current_user.school_id

    # Verify enrollment exists and belongs to school
    enrollment = (
        db.query(CourseEnrollment)
        .join(Course)
        .filter(
            CourseEnrollment.id == enrollment_id,
            Course.school_id == school_id,
        )
        .first()
    )

    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    # Check if course's year is archived
    require_course_year_not_archived(db, enrollment.course_id)

    db.delete(enrollment)
    db.commit()

    return {"status": "deleted", "id": enrollment_id}


@router.delete("/bulk")
def bulk_delete_enrollments(
    data: BulkEnrollmentDelete,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk remove students from a course"""

    # Require admin or teacher role
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    school_id = current_user.school_id

    # Verify course exists and belongs to school
    course = (
        db.query(Course)
        .filter(
            Course.id == data.course_id,
            Course.school_id == school_id,
        )
        .first()
    )

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Check if course's year is archived
    require_course_year_not_archived(db, data.course_id)

    deleted_count = 0

    for student_id in data.student_ids:
        enrollment = (
            db.query(CourseEnrollment)
            .filter(
                CourseEnrollment.course_id == data.course_id,
                CourseEnrollment.student_id == student_id,
            )
            .first()
        )

        if enrollment:
            db.delete(enrollment)
            deleted_count += 1

    db.commit()

    return {
        "deleted": deleted_count,
        "total_processed": len(data.student_ids),
    }
