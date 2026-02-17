"""
API endpoints for Skill Trainings (Vaardigheidstrainingen)
"""

from __future__ import annotations
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    User,
    SkillTraining,
    SkillTrainingProgress,
    CompetencyCategory,
    LearningObjective,
    CourseEnrollment,
)
from app.api.v1.schemas.skill_trainings import (
    SkillTrainingCreate,
    SkillTrainingUpdate,
    SkillTrainingOut,
    SkillTrainingProgressOut,
    StudentProgressRow,
    TeacherProgressMatrixResponse,
    BulkProgressUpdate,
    StudentTrainingItem,
    StudentTrainingListResponse,
    StudentStatusUpdate,
    STUDENT_ALLOWED_STATUSES,
)

router = APIRouter(prefix="/skill-trainings", tags=["skill-trainings"])


# ============ Helper Functions ============


def _to_skill_training_out(training: SkillTraining) -> SkillTrainingOut:
    """Convert SkillTraining model to output schema with computed fields"""
    return SkillTrainingOut(
        id=training.id,
        school_id=training.school_id,
        title=training.title,
        url=training.url,
        competency_category_id=training.competency_category_id,
        learning_objective_id=training.learning_objective_id,
        level=training.level,
        est_minutes=training.est_minutes,
        is_active=training.is_active,
        competency_category_name=training.competency_category.name if training.competency_category else None,
        learning_objective_title=training.learning_objective.title if training.learning_objective else None,
        created_at=training.created_at,
        updated_at=training.updated_at,
    )


# ============ Teacher CRUD Endpoints ============


@router.get("", response_model=List[SkillTrainingOut])
def list_trainings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
):
    """
    List all skill trainings for the current user's school.
    
    - Teacher/Admin: Can view all trainings
    - Student: Can view active trainings only
    """
    if not user or not user.school_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    # Base query scoped to school with eager loading
    query = select(SkillTraining).where(
        SkillTraining.school_id == user.school_id
    ).options(
        joinedload(SkillTraining.competency_category),
        joinedload(SkillTraining.learning_objective)
    )
    
    # Students can only see active trainings
    if user.role == "student":
        query = query.where(SkillTraining.is_active == True)
    elif is_active is not None:
        # Teachers/admins can filter by is_active
        query = query.where(SkillTraining.is_active == is_active)
    
    # Order by category and title
    query = query.order_by(
        SkillTraining.competency_category_id,
        SkillTraining.title
    )
    
    trainings = db.execute(query).scalars().all()
    
    return [_to_skill_training_out(t) for t in trainings]


@router.post("", response_model=SkillTrainingOut, status_code=status.HTTP_201_CREATED)
def create_training(
    payload: SkillTrainingCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Create a new skill training.
    
    - Teacher/Admin only
    """
    if not user or not user.school_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    # Check role
    if user.role not in ("teacher", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can create trainings"
        )
    
    # Verify competency category exists and belongs to school
    category = db.get(CompetencyCategory, payload.competency_category_id)
    if not category or category.school_id != user.school_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competency category not found"
        )
    
    # Verify learning objective exists and belongs to school (if provided)
    if payload.learning_objective_id:
        objective = db.get(LearningObjective, payload.learning_objective_id)
        if not objective or objective.school_id != user.school_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Learning objective not found"
            )
    
    # Create training
    training = SkillTraining(
        school_id=user.school_id,
        title=payload.title,
        url=payload.url,
        competency_category_id=payload.competency_category_id,
        learning_objective_id=payload.learning_objective_id,
        level=payload.level,
        est_minutes=payload.est_minutes,
        is_active=payload.is_active,
    )
    
    db.add(training)
    db.commit()
    db.refresh(training)
    
    # Eager load relationships for output
    training = db.execute(
        select(SkillTraining)
        .where(SkillTraining.id == training.id)
        .options(
            joinedload(SkillTraining.competency_category),
            joinedload(SkillTraining.learning_objective)
        )
    ).scalar_one()
    
    return _to_skill_training_out(training)


@router.patch("/{training_id}", response_model=SkillTrainingOut)
def update_training(
    training_id: int = Path(..., description="Training ID"),
    payload: SkillTrainingUpdate = ...,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Update a skill training.
    
    - Teacher/Admin only
    """
    if not user or not user.school_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    # Check role
    if user.role not in ("teacher", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can update trainings"
        )
    
    # Get training
    training = db.get(SkillTraining, training_id)
    if not training or training.school_id != user.school_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training not found"
        )
    
    # Verify competency category if being updated
    if payload.competency_category_id is not None:
        category = db.get(CompetencyCategory, payload.competency_category_id)
        if not category or category.school_id != user.school_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Competency category not found"
            )
    
    # Verify learning objective if being updated
    if payload.learning_objective_id is not None:
        objective = db.get(LearningObjective, payload.learning_objective_id)
        if not objective or objective.school_id != user.school_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Learning objective not found"
            )
    
    # Update fields
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(training, field, value)
    
    db.commit()
    db.refresh(training)
    
    # Eager load relationships for output
    training = db.execute(
        select(SkillTraining)
        .where(SkillTraining.id == training.id)
        .options(
            joinedload(SkillTraining.competency_category),
            joinedload(SkillTraining.learning_objective)
        )
    ).scalar_one()
    
    return _to_skill_training_out(training)


# ============ Teacher Progress Endpoints ============


@router.get("/progress", response_model=TeacherProgressMatrixResponse)
def get_progress_matrix(
    course_id: int = Query(..., description="Course ID"),
    class_name: Optional[str] = Query(None, description="Filter by class name"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get progress matrix for a course.
    
    Returns all active trainings and all students in the course with their progress.
    
    - Teacher/Admin only
    """
    if not user or not user.school_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    # Check role
    if user.role not in ("teacher", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can view progress"
        )
    
    # Get all active trainings for school
    trainings_query = select(SkillTraining).where(
        SkillTraining.school_id == user.school_id,
        SkillTraining.is_active == True
    ).options(
        joinedload(SkillTraining.competency_category),
        joinedload(SkillTraining.learning_objective)
    ).order_by(
        SkillTraining.competency_category_id,
        SkillTraining.title
    )
    
    trainings = db.execute(trainings_query).scalars().all()
    
    # Get all students enrolled in the course
    enrollments_query = select(CourseEnrollment).where(
        CourseEnrollment.course_id == course_id,
        CourseEnrollment.active == True
    ).options(joinedload(CourseEnrollment.student))
    
    enrollments = db.execute(enrollments_query).scalars().all()
    
    # Filter by class_name if provided
    if class_name:
        enrollments = [e for e in enrollments if e.student.class_name == class_name]
    
    # Get all progress records for these students and this course
    student_ids = [e.student_id for e in enrollments]
    
    progress_query = select(SkillTrainingProgress).where(
        SkillTrainingProgress.course_id == course_id,
        SkillTrainingProgress.student_id.in_(student_ids)
    )
    
    progress_records = db.execute(progress_query).scalars().all()
    
    # Build progress map: student_id -> training_id -> status
    progress_map = {}
    for p in progress_records:
        if p.student_id not in progress_map:
            progress_map[p.student_id] = {}
        progress_map[p.student_id][p.training_id] = p.status
    
    # Build student rows
    students = []
    for enrollment in enrollments:
        student = enrollment.student
        student_progress = progress_map.get(student.id, {})
        
        students.append(StudentProgressRow(
            student_id=student.id,
            student_name=student.name,
            class_name=student.class_name,
            progress=student_progress
        ))
    
    # Sort students by name
    students.sort(key=lambda s: s.student_name)
    
    return TeacherProgressMatrixResponse(
        trainings=[_to_skill_training_out(t) for t in trainings],
        students=students
    )


@router.patch("/progress/{student_id}/{training_id}", response_model=SkillTrainingProgressOut)
def update_single_progress(
    student_id: int = Path(..., description="Student ID"),
    training_id: int = Path(..., description="Training ID"),
    course_id: int = Query(..., description="Course ID"),
    status: str = Query(..., description="New status"),
    note: Optional[str] = Query(None, description="Optional note"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Update a single student's progress for a training.
    
    - Teacher/Admin only
    """
    if not user or not user.school_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    # Check role
    if user.role not in ("teacher", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can update progress"
        )
    
    # Verify student exists and belongs to school
    student = db.get(User, student_id)
    if not student or student.school_id != user.school_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Verify training exists and belongs to school
    training = db.get(SkillTraining, training_id)
    if not training or training.school_id != user.school_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training not found"
        )
    
    # Get or create progress record
    progress = db.execute(
        select(SkillTrainingProgress).where(
            SkillTrainingProgress.student_id == student_id,
            SkillTrainingProgress.training_id == training_id,
            SkillTrainingProgress.course_id == course_id
        )
    ).scalar_one_or_none()
    
    if progress:
        # Update existing
        progress.status = status
        progress.note = note
        progress.updated_by_user_id = user.id
    else:
        # Create new
        progress = SkillTrainingProgress(
            school_id=user.school_id,
            course_id=course_id,
            student_id=student_id,
            training_id=training_id,
            status=status,
            note=note,
            updated_by_user_id=user.id
        )
        db.add(progress)
    
    db.commit()
    db.refresh(progress)
    
    return SkillTrainingProgressOut.model_validate(progress)


@router.post("/progress/bulk", status_code=status.HTTP_204_NO_CONTENT)
def bulk_update_progress(
    course_id: int = Query(..., description="Course ID"),
    payload: BulkProgressUpdate = ...,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Bulk update progress for multiple students and trainings.
    
    - Teacher/Admin only
    """
    if not user or not user.school_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    # Check role
    if user.role not in ("teacher", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can update progress"
        )
    
    # Update or create progress for each combination
    for student_id in payload.student_ids:
        for training_id in payload.training_ids:
            # Get or create progress record
            progress = db.execute(
                select(SkillTrainingProgress).where(
                    SkillTrainingProgress.student_id == student_id,
                    SkillTrainingProgress.training_id == training_id,
                    SkillTrainingProgress.course_id == course_id
                )
            ).scalar_one_or_none()
            
            if progress:
                # Update existing
                progress.status = payload.status
                progress.updated_by_user_id = user.id
            else:
                # Create new
                progress = SkillTrainingProgress(
                    school_id=user.school_id,
                    course_id=course_id,
                    student_id=student_id,
                    training_id=training_id,
                    status=payload.status,
                    updated_by_user_id=user.id
                )
                db.add(progress)
    
    db.commit()
    
    return None


# ============ Student Endpoints ============


@router.get("/me/skill-trainings", response_model=StudentTrainingListResponse)
def get_my_trainings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get all trainings with the student's progress.
    
    - Student only
    """
    if not user or not user.school_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    if user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is for students only"
        )
    
    # Get student's courses
    enrollments = db.execute(
        select(CourseEnrollment).where(
            CourseEnrollment.student_id == user.id,
            CourseEnrollment.active == True
        )
    ).scalars().all()
    
    if not enrollments:
        # Student not enrolled in any course
        return StudentTrainingListResponse(items=[])
    
    # Use first active enrollment for now (could be extended to support multiple courses)
    course_id = enrollments[0].course_id
    
    # Get all active trainings
    trainings_query = select(SkillTraining).where(
        SkillTraining.school_id == user.school_id,
        SkillTraining.is_active == True
    ).options(
        joinedload(SkillTraining.competency_category),
        joinedload(SkillTraining.learning_objective)
    ).order_by(
        SkillTraining.competency_category_id,
        SkillTraining.title
    )
    
    trainings = db.execute(trainings_query).scalars().all()
    
    # Get student's progress
    progress_query = select(SkillTrainingProgress).where(
        SkillTrainingProgress.student_id == user.id,
        SkillTrainingProgress.course_id == course_id
    )
    
    progress_records = db.execute(progress_query).scalars().all()
    
    # Build progress map
    progress_map = {p.training_id: p for p in progress_records}
    
    # Build items
    items = []
    for training in trainings:
        progress = progress_map.get(training.id)
        
        items.append(StudentTrainingItem(
            training=_to_skill_training_out(training),
            status=progress.status if progress else "none",
            note=progress.note if progress else None,
            updated_at=progress.updated_at if progress else None
        ))
    
    return StudentTrainingListResponse(items=items)


@router.patch("/me/skill-trainings/{training_id}", response_model=SkillTrainingProgressOut)
def update_my_status(
    training_id: int = Path(..., description="Training ID"),
    payload: StudentStatusUpdate = ...,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Update the student's own status for a training.
    
    - Student only
    - Can only set status to: none, planned, in_progress, submitted
    - Cannot update if current status is completed or mastered
    """
    if not user or not user.school_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    if user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is for students only"
        )
    
    # Validate status is allowed for students
    if payload.status not in STUDENT_ALLOWED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Students can only set status to: {', '.join(STUDENT_ALLOWED_STATUSES)}"
        )
    
    # Verify training exists and belongs to school
    training = db.get(SkillTraining, training_id)
    if not training or training.school_id != user.school_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training not found"
        )
    
    # Get student's course
    enrollment = db.execute(
        select(CourseEnrollment).where(
            CourseEnrollment.student_id == user.id,
            CourseEnrollment.active == True
        )
    ).scalars().first()
    
    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student not enrolled in any active course"
        )
    
    course_id = enrollment.course_id
    
    # Get or create progress record
    progress = db.execute(
        select(SkillTrainingProgress).where(
            SkillTrainingProgress.student_id == user.id,
            SkillTrainingProgress.training_id == training_id,
            SkillTrainingProgress.course_id == course_id
        )
    ).scalar_one_or_none()
    
    # Check if current status is locked (completed/mastered)
    if progress and progress.status in ("completed", "mastered"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update status once it has been marked as completed or mastered by teacher"
        )
    
    if progress:
        # Update existing
        progress.status = payload.status
        progress.note = payload.note
        progress.updated_by_user_id = user.id
    else:
        # Create new
        progress = SkillTrainingProgress(
            school_id=user.school_id,
            course_id=course_id,
            student_id=user.id,
            training_id=training_id,
            status=payload.status,
            note=payload.note,
            updated_by_user_id=user.id
        )
        db.add(progress)
    
    db.commit()
    db.refresh(progress)
    
    return SkillTrainingProgressOut.model_validate(progress)
