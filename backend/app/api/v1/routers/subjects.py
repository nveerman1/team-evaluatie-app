"""
Subjects API endpoints
"""

from __future__ import annotations
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import Subject, Course, User
from app.api.v1.schemas.subjects import (
    SubjectCreate,
    SubjectUpdate,
    SubjectOut,
    SubjectListOut,
)
from app.api.v1.schemas.courses import CourseOut
from app.core.rbac import require_role, scope_query_by_school
from app.core.audit import log_create, log_update, log_delete

router = APIRouter(prefix="/subjects", tags=["subjects"])


@router.get("", response_model=SubjectListOut)
def list_subjects(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    is_active: Optional[bool] = True,
    search: Optional[str] = None,
):
    """
    List all subjects accessible to the user

    - Admin/Teacher/Student: sees all subjects in their school
    """
    if not user or not user.school_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )

    # Base query scoped to school
    query = db.query(Subject).filter(Subject.school_id == user.school_id)

    # Apply filters
    if is_active is not None:
        query = query.filter(Subject.is_active == is_active)
    if search:
        query = query.filter(
            (Subject.name.ilike(f"%{search}%")) | (Subject.code.ilike(f"%{search}%"))
        )

    # Get total count
    total = query.count()

    # Pagination
    offset = (page - 1) * per_page
    subjects = query.order_by(Subject.name).offset(offset).limit(per_page).all()

    return SubjectListOut(
        subjects=[SubjectOut.model_validate(s) for s in subjects],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/{subject_id}", response_model=SubjectOut)
def get_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get a specific subject by ID
    """
    if not user or not user.school_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )

    subject = (
        db.query(Subject)
        .filter(Subject.id == subject_id, Subject.school_id == user.school_id)
        .first()
    )

    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found"
        )

    return SubjectOut.model_validate(subject)


@router.get("/{subject_id}/courses", response_model=List[CourseOut])
def get_subject_courses(
    subject_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    is_active: Optional[bool] = True,
):
    """
    Get all courses for a specific subject
    """
    if not user or not user.school_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )

    # Verify subject exists and belongs to user's school
    subject = (
        db.query(Subject)
        .filter(Subject.id == subject_id, Subject.school_id == user.school_id)
        .first()
    )

    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found"
        )

    # Query courses for this subject
    query = db.query(Course).filter(Course.subject_id == subject_id)

    if is_active is not None:
        query = query.filter(Course.is_active == is_active)

    courses = query.order_by(Course.name).all()

    return [CourseOut.model_validate(c) for c in courses]


@router.post("", response_model=SubjectOut, status_code=status.HTTP_201_CREATED)
def create_subject(
    subject_data: SubjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Create a new subject (admin/teacher only)
    """
    require_role(user, ["admin", "teacher"])

    if not user.school_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User has no school"
        )

    # Check for duplicate code in school
    existing = (
        db.query(Subject)
        .filter(
            Subject.school_id == user.school_id,
            Subject.code == subject_data.code,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Subject with code '{subject_data.code}' already exists in this school",
        )

    # Create new subject
    new_subject = Subject(
        school_id=user.school_id,
        name=subject_data.name,
        code=subject_data.code,
        color=subject_data.color,
        icon=subject_data.icon,
        is_active=True,
    )

    db.add(new_subject)
    db.commit()
    db.refresh(new_subject)

    # Audit log
    log_create(db, user, "subject", new_subject.id, request)

    return SubjectOut.model_validate(new_subject)


@router.patch("/{subject_id}", response_model=SubjectOut)
def update_subject(
    subject_id: int,
    subject_data: SubjectUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Update a subject (admin/teacher only)
    """
    require_role(user, ["admin", "teacher"])

    if not user.school_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User has no school"
        )

    # Get subject
    subject = (
        db.query(Subject)
        .filter(Subject.id == subject_id, Subject.school_id == user.school_id)
        .first()
    )

    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found"
        )

    # Check for code conflicts if code is being updated
    if subject_data.code and subject_data.code != subject.code:
        existing = (
            db.query(Subject)
            .filter(
                Subject.school_id == user.school_id,
                Subject.code == subject_data.code,
                Subject.id != subject_id,
            )
            .first()
        )

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Subject with code '{subject_data.code}' already exists in this school",
            )

    # Update fields
    update_data = subject_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(subject, field, value)

    db.commit()
    db.refresh(subject)

    # Audit log
    log_update(db, user, "subject", subject.id, request)

    return SubjectOut.model_validate(subject)


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Delete (soft delete) a subject (admin only)

    Sets is_active to False. Courses linked to this subject will have
    subject_id set to NULL due to ON DELETE SET NULL.
    """
    require_role(user, ["admin"])

    if not user.school_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User has no school"
        )

    # Get subject
    subject = (
        db.query(Subject)
        .filter(Subject.id == subject_id, Subject.school_id == user.school_id)
        .first()
    )

    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found"
        )

    # Soft delete: set is_active to False
    subject.is_active = False
    db.commit()

    # Audit log
    log_delete(db, user, "subject", subject.id, request)

    return None
