"""
Academic Years API Router
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
import logging
from datetime import datetime

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import User, AcademicYear
from app.api.v1.schemas.academic_years import (
    AcademicYearCreate,
    AcademicYearUpdate,
    AcademicYearOut,
    AcademicYearListOut,
    AcademicYearTransitionRequest,
    AcademicYearTransitionResult,
)
from app.infra.services.academic_year_transition import AcademicYearTransitionService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/academic-years", tags=["admin-academic-years"])


@router.get("", response_model=AcademicYearListOut)
def list_academic_years(
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List academic years for the current user's school"""
    
    # Require admin role
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    school_id = current_user.school_id
    
    # Get total count
    total = db.query(func.count(AcademicYear.id)).filter(
        AcademicYear.school_id == school_id
    ).scalar() or 0
    
    # Get paginated results
    query = db.query(AcademicYear).filter(AcademicYear.school_id == school_id)
    query = query.order_by(AcademicYear.start_date.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    
    academic_years = query.all()
    
    return AcademicYearListOut(
        academic_years=[AcademicYearOut.model_validate(ay) for ay in academic_years],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("", response_model=AcademicYearOut)
def create_academic_year(
    data: AcademicYearCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new academic year"""
    
    # Require admin role
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    
    school_id = current_user.school_id
    
    # Check if academic year with same label already exists
    existing = db.query(AcademicYear).filter(
        AcademicYear.school_id == school_id,
        AcademicYear.label == data.label,
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Academic year with label '{data.label}' already exists"
        )
    
    # Create academic year
    academic_year = AcademicYear(
        school_id=school_id,
        label=data.label,
        start_date=data.start_date,
        end_date=data.end_date,
    )
    
    db.add(academic_year)
    db.commit()
    db.refresh(academic_year)
    
    return AcademicYearOut.model_validate(academic_year)


@router.get("/{academic_year_id}", response_model=AcademicYearOut)
def get_academic_year(
    academic_year_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific academic year"""
    
    academic_year = db.query(AcademicYear).filter(
        AcademicYear.id == academic_year_id,
        AcademicYear.school_id == current_user.school_id,
    ).first()
    
    if not academic_year:
        raise HTTPException(status_code=404, detail="Academic year not found")
    
    return AcademicYearOut.model_validate(academic_year)


@router.patch("/{academic_year_id}", response_model=AcademicYearOut)
def update_academic_year(
    academic_year_id: int,
    data: AcademicYearUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an academic year"""
    
    # Require admin role
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    
    academic_year = db.query(AcademicYear).filter(
        AcademicYear.id == academic_year_id,
        AcademicYear.school_id == current_user.school_id,
    ).first()
    
    if not academic_year:
        raise HTTPException(status_code=404, detail="Academic year not found")
    
    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(academic_year, key, value)
    
    db.commit()
    db.refresh(academic_year)
    
    return AcademicYearOut.model_validate(academic_year)


@router.delete("/{academic_year_id}")
def delete_academic_year(
    academic_year_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an academic year (only if no related data exists)"""
    
    # Require admin role
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    
    academic_year = db.query(AcademicYear).filter(
        AcademicYear.id == academic_year_id,
        AcademicYear.school_id == current_user.school_id,
    ).first()
    
    if not academic_year:
        raise HTTPException(status_code=404, detail="Academic year not found")
    
    # Note: Cascade delete will handle related classes, memberships, courses
    # This might not be desirable in production - consider soft delete instead
    db.delete(academic_year)
    db.commit()
    
    return {"status": "deleted", "id": academic_year_id}


@router.post("/{source_year_id}/transition", response_model=AcademicYearTransitionResult)
def transition_academic_year(
    source_year_id: int,
    data: AcademicYearTransitionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Transition students and classes to a new academic year
    
    This endpoint performs a bulk year transition:
    1. Validates source and target academic years
    2. Creates new classes in the target year based on the class mapping
    3. Copies student class memberships to the new classes
    4. Optionally copies courses and course enrollments
    
    All operations are performed in a single transaction.
    If any error occurs, the entire transition is rolled back.
    
    Historical data (old memberships, enrollments, projects, teams) remains intact.
    
    # TODO: Frontend wizard integration
    # This endpoint is designed to be used with a frontend wizard that:
    # - Lists available academic years
    # - Shows classes from the source year
    # - Allows mapping each source class to a target class name
    # - Provides option to copy course enrollments
    # - Shows preview of what will be created
    # - Displays results after transition
    """
    
    # Require admin role
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    
    school_id = current_user.school_id
    
    try:
        # Execute transition within a transaction
        result = AcademicYearTransitionService.execute_transition(
            db=db,
            school_id=school_id,
            source_year_id=source_year_id,
            target_year_id=data.target_academic_year_id,
            class_mapping=data.class_mapping,
            copy_course_enrollments=data.copy_course_enrollments,
        )
        
        # Commit the transaction
        db.commit()
        
        logger.info(
            f"Academic year transition completed successfully: "
            f"source={source_year_id}, target={data.target_academic_year_id}, "
            f"school={school_id}, result={result}"
        )
        
        return AcademicYearTransitionResult(**result)
        
    except HTTPException:
        # Re-raise HTTP exceptions (validation errors)
        db.rollback()
        raise
    except Exception as e:
        # Rollback on any unexpected error
        db.rollback()
        logger.error(
            f"Academic year transition failed: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Transition failed: {str(e)}",
        )


@router.post("/{academic_year_id}/archive", response_model=AcademicYearOut)
def archive_academic_year(
    academic_year_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Archive an academic year - makes it read-only
    
    Once archived, no mutations (POST/PATCH/DELETE) are allowed on:
    - Classes in this year
    - Courses in this year
    - Course enrollments
    - Projects (via courses)
    - Evaluations (via projects)
    
    Read operations (GET) remain allowed.
    Archiving cannot be undone.
    """
    
    # Require admin role
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    
    academic_year = db.query(AcademicYear).filter(
        AcademicYear.id == academic_year_id,
        AcademicYear.school_id == current_user.school_id,
    ).first()
    
    if not academic_year:
        raise HTTPException(status_code=404, detail="Academic year not found")
    
    if academic_year.is_archived:
        raise HTTPException(status_code=400, detail="Academic year is already archived")
    
    # Archive the year
    academic_year.is_archived = True
    academic_year.archived_at = datetime.utcnow()
    
    db.commit()
    db.refresh(academic_year)
    
    logger.info(
        f"Academic year archived: id={academic_year_id}, "
        f"label={academic_year.label}, school={current_user.school_id}"
    )
    
    return AcademicYearOut.model_validate(academic_year)
