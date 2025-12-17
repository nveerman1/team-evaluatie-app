"""
Classes API Router
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import User, Class, AcademicYear
from app.api.v1.schemas.classes import (
    ClassCreate,
    ClassUpdate,
    ClassOut,
    ClassListOut,
    ClassWithStudentCount,
    BulkClassCreate,
)

router = APIRouter(prefix="/admin/classes", tags=["admin-classes"])


@router.get("", response_model=ClassListOut)
def list_classes(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    academic_year_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List classes for the current user's school"""
    
    # Require admin or teacher role
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    school_id = current_user.school_id
    
    # Build query
    query = db.query(Class).filter(Class.school_id == school_id)
    
    if academic_year_id:
        query = query.filter(Class.academic_year_id == academic_year_id)
    
    # Get total count
    total = query.count()
    
    # Get paginated results with academic year label
    query = query.join(AcademicYear, Class.academic_year_id == AcademicYear.id)
    query = query.order_by(AcademicYear.start_date.desc(), Class.name)
    query = query.offset((page - 1) * per_page).limit(per_page)
    
    classes = query.all()
    
    # Enrich with academic year label
    classes_out = []
    for cls in classes:
        cls_dict = ClassOut.model_validate(cls).model_dump()
        cls_dict["academic_year_label"] = cls.academic_year.label
        classes_out.append(ClassOut(**cls_dict))
    
    return ClassListOut(
        classes=classes_out,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("", response_model=ClassOut)
def create_class(
    data: ClassCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new class"""
    
    # Require admin role
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    
    school_id = current_user.school_id
    
    # Verify academic year exists and belongs to school
    academic_year = db.query(AcademicYear).filter(
        AcademicYear.id == data.academic_year_id,
        AcademicYear.school_id == school_id,
    ).first()
    
    if not academic_year:
        raise HTTPException(status_code=404, detail="Academic year not found")
    
    # Check if class with same name already exists for this academic year
    existing = db.query(Class).filter(
        Class.school_id == school_id,
        Class.academic_year_id == data.academic_year_id,
        Class.name == data.name,
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Class '{data.name}' already exists for this academic year"
        )
    
    # Create class
    new_class = Class(
        school_id=school_id,
        academic_year_id=data.academic_year_id,
        name=data.name,
    )
    
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    
    # Enrich with academic year label
    cls_dict = ClassOut.model_validate(new_class).model_dump()
    cls_dict["academic_year_label"] = academic_year.label
    
    return ClassOut(**cls_dict)


@router.post("/bulk", response_model=ClassListOut)
def bulk_create_classes(
    data: BulkClassCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk create classes for an academic year"""
    
    # Require admin role
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    
    school_id = current_user.school_id
    
    # Verify academic year exists and belongs to school
    academic_year = db.query(AcademicYear).filter(
        AcademicYear.id == data.academic_year_id,
        AcademicYear.school_id == school_id,
    ).first()
    
    if not academic_year:
        raise HTTPException(status_code=404, detail="Academic year not found")
    
    created_classes = []
    
    for class_name in data.class_names:
        # Check if already exists
        existing = db.query(Class).filter(
            Class.school_id == school_id,
            Class.academic_year_id == data.academic_year_id,
            Class.name == class_name,
        ).first()
        
        if not existing:
            new_class = Class(
                school_id=school_id,
                academic_year_id=data.academic_year_id,
                name=class_name,
            )
            db.add(new_class)
            db.flush()  # Get ID without committing
            created_classes.append(new_class)
    
    db.commit()
    
    # Refresh and enrich
    classes_out = []
    for cls in created_classes:
        db.refresh(cls)
        cls_dict = ClassOut.model_validate(cls).model_dump()
        cls_dict["academic_year_label"] = academic_year.label
        classes_out.append(ClassOut(**cls_dict))
    
    return ClassListOut(
        classes=classes_out,
        total=len(classes_out),
        page=1,
        per_page=len(classes_out),
    )


@router.get("/{class_id}", response_model=ClassOut)
def get_class(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific class"""
    
    cls = db.query(Class).filter(
        Class.id == class_id,
        Class.school_id == current_user.school_id,
    ).first()
    
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Enrich with academic year label
    cls_dict = ClassOut.model_validate(cls).model_dump()
    cls_dict["academic_year_label"] = cls.academic_year.label
    
    return ClassOut(**cls_dict)


@router.patch("/{class_id}", response_model=ClassOut)
def update_class(
    class_id: int,
    data: ClassUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a class"""
    
    # Require admin role
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    
    cls = db.query(Class).filter(
        Class.id == class_id,
        Class.school_id == current_user.school_id,
    ).first()
    
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(cls, key, value)
    
    db.commit()
    db.refresh(cls)
    
    # Enrich with academic year label
    cls_dict = ClassOut.model_validate(cls).model_dump()
    cls_dict["academic_year_label"] = cls.academic_year.label
    
    return ClassOut(**cls_dict)


@router.delete("/{class_id}")
def delete_class(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a class (only if no students are enrolled)"""
    
    # Require admin role
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    
    cls = db.query(Class).filter(
        Class.id == class_id,
        Class.school_id == current_user.school_id,
    ).first()
    
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Note: Cascade delete will handle related memberships
    db.delete(cls)
    db.commit()
    
    return {"status": "deleted", "id": class_id}
