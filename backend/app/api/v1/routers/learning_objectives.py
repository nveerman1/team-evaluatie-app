from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.api.v1.schemas.learning_objectives import (
    LearningObjectiveCreate,
    LearningObjectiveImportRequest,
    LearningObjectiveImportResponse,
    LearningObjectiveListResponse,
    LearningObjectiveOut,
    LearningObjectiveOverviewResponse,
    LearningObjectiveUpdate,
    StudentLearningObjectiveOverview,
    StudentLearningObjectiveProgress,
)
from app.infra.db.models import (
    Allocation,
    CourseEnrollment,
    LearningObjective,
    ProjectAssessment,
    ProjectAssessmentScore,
    RubricCriterionLearningObjective,
    Score,
    TeacherCourse,
    User,
)

router = APIRouter(prefix="/learning-objectives", tags=["learning-objectives"])


def _get_user_course_ids(db: Session, user: User) -> list[int]:
    """Get all course IDs that a teacher is assigned to"""
    if user.role not in ("teacher", "admin"):
        return []
    
    course_ids_query = select(TeacherCourse.course_id).where(
        TeacherCourse.school_id == user.school_id,
        TeacherCourse.teacher_id == user.id,
        TeacherCourse.is_active.is_(True),
    )
    result = db.execute(course_ids_query).scalars().all()
    return list(result)


def _to_out(obj: LearningObjective) -> LearningObjectiveOut:
    """Convert a LearningObjective model to output schema"""
    return LearningObjectiveOut.model_validate(
        {
            "id": obj.id,
            "domain": obj.domain,
            "title": obj.title,
            "description": obj.description,
            "order": obj.order,
            "phase": obj.phase,
            "subject_id": obj.subject_id,
            "teacher_id": obj.teacher_id,
            "course_id": obj.course_id,
            "is_template": obj.is_template,
            "objective_type": "template" if obj.is_template else "teacher",
            "metadata_json": obj.metadata_json or {},
        }
    )


def _check_can_modify(obj: LearningObjective, user: User) -> bool:
    """
    Check if user can modify the learning objective.
    
    - Admins can modify template/central objectives (is_template=True)
    - Teachers can only modify their own teacher-specific objectives (teacher_id=current_user)
    """
    if obj.is_template:
        # Template objectives can only be modified by admins
        return user.role == "admin"
    else:
        # Teacher-specific objectives can only be modified by the owner
        return obj.teacher_id == user.id


# ---------- CRUD Operations ----------


@router.post(
    "", response_model=LearningObjectiveOut, status_code=status.HTTP_201_CREATED
)
def create_learning_objective(
    payload: LearningObjectiveCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Create a new learning objective.
    
    For central/template objectives (admin only):
    - Set is_template=True
    - subject_id should be provided
    
    For teacher-specific objectives:
    - Set is_template=False (default)
    - teacher_id is automatically set to current user
    - course_id is optional
    """
    # Validate: only admins can create template objectives
    if payload.is_template and user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only admins can create central/template learning objectives"
        )
    
    # Set teacher_id for teacher-specific objectives
    teacher_id = None if payload.is_template else user.id
    
    obj = LearningObjective(
        school_id=user.school_id,
        subject_id=payload.subject_id,
        teacher_id=teacher_id,
        course_id=payload.course_id,
        is_template=payload.is_template,
        domain=payload.domain,
        title=payload.title,
        description=payload.description,
        order=payload.order,
        phase=payload.phase,
        metadata_json=payload.metadata_json,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _to_out(obj)


@router.get("", response_model=LearningObjectiveListResponse)
def list_learning_objectives(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    domain: Optional[str] = None,
    phase: Optional[str] = None,
    search: Optional[str] = None,
    subject_id: Optional[int] = None,
    objective_type: Optional[Literal["template", "teacher", "all"]] = None,
    include_teacher_objectives: bool = Query(False, description="Include teacher's own objectives"),
    include_course_objectives: bool = Query(False, description="Include teacher objectives from shared courses"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    List learning objectives with filtering and pagination.
    
    Filtering logic:
    - objective_type="template": Only central/template objectives
    - objective_type="teacher": Only the current teacher's own objectives
    - objective_type="all" or not specified: 
      - If include_teacher_objectives=True: both template and user's teacher objectives
      - Otherwise: template objectives only (backward compatible)
    
    - include_course_objectives: Also show teacher objectives that are linked to courses
      that the current user is also assigned to (shared course objectives)
    
    - subject_id: If provided, filter templates by subject. If NULL, show school-wide templates.
    """
    query = select(LearningObjective).where(
        LearningObjective.school_id == user.school_id
    )

    # Get course IDs the current user is assigned to (for shared course objectives)
    user_course_ids = []
    if include_teacher_objectives or include_course_objectives or objective_type == "teacher":
        user_course_ids = _get_user_course_ids(db, user)

    # Filter by objective type
    if objective_type == "template":
        query = query.where(LearningObjective.is_template.is_(True))
    elif objective_type == "teacher":
        # Show own objectives + objectives from shared courses
        if user_course_ids:
            query = query.where(
                LearningObjective.is_template.is_(False),
                or_(
                    LearningObjective.teacher_id == user.id,
                    LearningObjective.course_id.in_(user_course_ids)
                )
            )
        else:
            query = query.where(
                LearningObjective.is_template.is_(False),
                LearningObjective.teacher_id == user.id
            )
    elif include_teacher_objectives or include_course_objectives:
        # Include templates + own objectives + shared course objectives
        conditions = [LearningObjective.is_template.is_(True)]
        
        if include_teacher_objectives:
            conditions.append(LearningObjective.teacher_id == user.id)
        
        if include_course_objectives and user_course_ids:
            # Include teacher objectives from shared courses (but not templates)
            conditions.append(
                (LearningObjective.is_template.is_(False)) & 
                LearningObjective.course_id.in_(user_course_ids)
            )
        
        query = query.where(or_(*conditions))
    else:
        # Default: backward compatible - only templates
        query = query.where(LearningObjective.is_template.is_(True))

    # Filter by subject_id - if provided, show only subject-specific ones
    # if not provided, show only school-wide ones (NULL subject_id)
    if subject_id is not None:
        query = query.where(LearningObjective.subject_id == subject_id)
    elif objective_type != "teacher" and not include_teacher_objectives and not include_course_objectives:
        # For templates without subject_id filter, show school-wide
        # Skip this filter for teacher objectives as they may not have subject_id
        query = query.where(LearningObjective.subject_id.is_(None))

    if domain is not None:
        query = query.where(LearningObjective.domain == domain)

    if phase is not None:
        query = query.where(LearningObjective.phase == phase)

    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                LearningObjective.title.ilike(search_pattern),
                LearningObjective.description.ilike(search_pattern),
            )
        )

    # Order by order field, then by title
    query = query.order_by(LearningObjective.order, LearningObjective.title)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = db.execute(count_query).scalar() or 0

    # Paginate
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)

    items = db.execute(query).scalars().all()

    return LearningObjectiveListResponse(
        items=[_to_out(obj) for obj in items],
        page=page,
        limit=limit,
        total=total,
    )


@router.get("/{objective_id}", response_model=LearningObjectiveOut)
def get_learning_objective(
    objective_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get a specific learning objective"""
    obj = db.execute(
        select(LearningObjective)
        .where(
            LearningObjective.id == objective_id,
            LearningObjective.school_id == user.school_id,
        )
    ).scalar_one_or_none()

    if not obj:
        raise HTTPException(status_code=404, detail="Learning objective not found")

    # Check visibility:
    # - Templates are visible to all
    # - Teacher objectives are visible to owner
    # - Teacher objectives with course_id are visible to other teachers of that course
    if not obj.is_template and obj.teacher_id != user.id:
        # Check if this is a shared course objective
        if obj.course_id:
            user_course_ids = _get_user_course_ids(db, user)
            if obj.course_id not in user_course_ids:
                raise HTTPException(status_code=404, detail="Learning objective not found")
        else:
            raise HTTPException(status_code=404, detail="Learning objective not found")

    return _to_out(obj)


@router.put("/{objective_id}", response_model=LearningObjectiveOut)
def update_learning_objective(
    objective_id: int,
    payload: LearningObjectiveUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Update a learning objective.
    
    - Template objectives: only admins can update
    - Teacher objectives: only the owning teacher can update
    """
    obj = db.execute(
        select(LearningObjective)
        .where(
            LearningObjective.id == objective_id,
            LearningObjective.school_id == user.school_id,
        )
    ).scalar_one_or_none()

    if not obj:
        raise HTTPException(status_code=404, detail="Learning objective not found")

    # Check permission
    if not _check_can_modify(obj, user):
        if obj.is_template:
            raise HTTPException(
                status_code=403,
                detail="Only admins can modify central/template learning objectives"
            )
        else:
            raise HTTPException(
                status_code=403,
                detail="You can only modify your own learning objectives"
            )

    # Update fields (exclude is_template and teacher_id - these cannot be changed)
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(obj, key, value)

    db.commit()
    db.refresh(obj)
    return _to_out(obj)


@router.delete("/{objective_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_learning_objective(
    objective_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Delete a learning objective.
    
    - Template objectives: only admins can delete
    - Teacher objectives: only the owning teacher can delete
    """
    obj = db.execute(
        select(LearningObjective)
        .where(
            LearningObjective.id == objective_id,
            LearningObjective.school_id == user.school_id,
        )
    ).scalar_one_or_none()

    if not obj:
        raise HTTPException(status_code=404, detail="Learning objective not found")

    # Check permission
    if not _check_can_modify(obj, user):
        if obj.is_template:
            raise HTTPException(
                status_code=403,
                detail="Only admins can delete central/template learning objectives"
            )
        else:
            raise HTTPException(
                status_code=403,
                detail="You can only delete your own learning objectives"
            )

    db.delete(obj)
    db.commit()


# ---------- Import ----------


@router.post("/import", response_model=LearningObjectiveImportResponse)
def import_learning_objectives(
    payload: LearningObjectiveImportRequest,
    subject_id: Optional[int] = Query(None, description="Subject ID for template imports"),
    is_template: bool = Query(True, description="Import as template (admin) or teacher objectives"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Import learning objectives from CSV data.
    Updates existing objectives with matching (domain, order) or creates new ones.
    
    - is_template=True: Import as central/template objectives (admin only)
    - is_template=False: Import as teacher-specific objectives
    """
    # Validate permission for template imports
    if is_template and user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only admins can import central/template learning objectives"
        )
    
    created = 0
    updated = 0
    errors = []

    teacher_id = None if is_template else user.id

    for idx, item in enumerate(payload.items):
        try:
            # Try to find existing by domain + order + subject_id + teacher_id
            existing = None
            if item.domain and item.order:
                query = select(LearningObjective).where(
                    LearningObjective.school_id == user.school_id,
                    LearningObjective.domain == item.domain,
                    LearningObjective.order == item.order,
                    LearningObjective.is_template == is_template,
                )
                
                # Match subject_id scope
                if subject_id is not None:
                    query = query.where(LearningObjective.subject_id == subject_id)
                else:
                    query = query.where(LearningObjective.subject_id.is_(None))
                
                # For teacher objectives, also match teacher_id
                if not is_template:
                    query = query.where(LearningObjective.teacher_id == teacher_id)
                
                existing = db.execute(query).scalar_one_or_none()

            if existing:
                # Update existing
                existing.title = item.title
                existing.description = item.description
                existing.phase = item.phase
                updated += 1
            else:
                # Create new
                new_obj = LearningObjective(
                    school_id=user.school_id,
                    subject_id=subject_id,
                    teacher_id=teacher_id,
                    is_template=is_template,
                    domain=item.domain,
                    title=item.title,
                    description=item.description,
                    order=item.order,
                    phase=item.phase,
                    metadata_json={},
                )
                db.add(new_obj)
                created += 1
        except Exception as e:
            errors.append(f"Row {idx + 1}: {str(e)}")

    db.commit()

    return LearningObjectiveImportResponse(
        created=created,
        updated=updated,
        errors=errors,
    )


# ---------- Overview / Progress ----------


@router.get("/overview/students", response_model=LearningObjectiveOverviewResponse)
def get_learning_objectives_overview(
    class_name: Optional[str] = None,
    course_id: Optional[int] = None,
    evaluation_id: Optional[int] = None,
    learning_objective_id: Optional[int] = None,
    include_teacher_objectives: bool = Query(False, description="Include teacher's own objectives"),
    include_course_objectives: bool = Query(False, description="Include teacher objectives from shared courses"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Get an overview of student progress on learning objectives.
    
    This aggregates scores from:
    - Peer evaluations (via Score model)
    - Project assessments (via ProjectAssessmentScore model)
    
    Filters:
    - class_name: Filter by student class
    - course_id: Filter by course (affects which evaluations/groups are included)
    - evaluation_id: Filter to a specific evaluation
    - learning_objective_id: Filter to a specific learning objective
    - include_teacher_objectives: Include teacher's own objectives in overview
    - include_course_objectives: Include teacher objectives from shared courses
    """
    # Build query for students
    students_query = select(User).where(
        User.school_id == user.school_id,
        User.role == "student",
        User.archived.is_(False),
    )

    if class_name:
        students_query = students_query.where(User.class_name == class_name)

    if course_id:
        # Filter students to only those enrolled in this course
        students_query = students_query.join(
            CourseEnrollment, CourseEnrollment.student_id == User.id
        ).where(
            CourseEnrollment.course_id == course_id,
            CourseEnrollment.active.is_(True),
        ).distinct()

    students = db.execute(students_query).scalars().all()

    # Get course IDs the current user is assigned to (for shared course objectives)
    user_course_ids = []
    if include_teacher_objectives or include_course_objectives:
        user_course_ids = _get_user_course_ids(db, user)

    # Get learning objectives
    lo_query = select(LearningObjective).where(
        LearningObjective.school_id == user.school_id
    )

    if learning_objective_id:
        lo_query = lo_query.where(LearningObjective.id == learning_objective_id)
    else:
        # Build visibility conditions
        conditions = [LearningObjective.is_template.is_(True)]
        
        if include_teacher_objectives:
            conditions.append(LearningObjective.teacher_id == user.id)
        
        if include_course_objectives and user_course_ids:
            # Include teacher objectives from shared courses
            conditions.append(
                (LearningObjective.is_template.is_(False)) & 
                LearningObjective.course_id.in_(user_course_ids)
            )
        
        lo_query = lo_query.where(or_(*conditions))

    lo_query = lo_query.order_by(
        LearningObjective.is_template.desc(),  # Templates first
        LearningObjective.order,
        LearningObjective.title
    )
    learning_objectives = db.execute(lo_query).scalars().all()

    # Build result
    result_students = []

    for student in students:
        objectives_progress = []

        for lo in learning_objectives:
            # Get all criteria linked to this learning objective (only for templates)
            criteria_ids = []
            if lo.is_template:
                criteria_ids_query = select(
                    RubricCriterionLearningObjective.criterion_id
                ).where(
                    RubricCriterionLearningObjective.learning_objective_id
                    == lo.id,
                    RubricCriterionLearningObjective.school_id == user.school_id,
                )
                criteria_ids = [
                    row[0] for row in db.execute(criteria_ids_query).all()
                ]

            if not criteria_ids:
                # No criteria linked to this objective (or it's a teacher objective)
                objectives_progress.append(
                    StudentLearningObjectiveProgress(
                        learning_objective_id=lo.id,
                        learning_objective_title=lo.title,
                        domain=lo.domain,
                        average_score=None,
                        assessment_count=0,
                        assessments=[],
                    )
                )
                continue

            # Get scores from peer evaluations
            scores_from_peer = []
            allocations_query = select(Allocation).where(
                Allocation.school_id == user.school_id,
                Allocation.reviewee_id == student.id,
            )

            if evaluation_id:
                allocations_query = allocations_query.where(
                    Allocation.evaluation_id == evaluation_id
                )

            allocations = db.execute(allocations_query).scalars().all()

            for allocation in allocations:
                scores_query = select(Score).where(
                    Score.allocation_id == allocation.id,
                    Score.criterion_id.in_(criteria_ids),
                )
                scores = db.execute(scores_query).scalars().all()
                scores_from_peer.extend(scores)

            # Get scores from project assessments
            scores_from_project = []

            # Find project teams the student is in
            from app.infra.db.models import ProjectTeam, ProjectTeamMember, Project, ProjectAssessmentTeam

            team_members_query = select(ProjectTeamMember).where(
                ProjectTeamMember.school_id == user.school_id,
                ProjectTeamMember.user_id == student.id,
                ProjectTeamMember.active.is_(True),
            )
            team_members = db.execute(team_members_query).scalars().all()

            for tm in team_members:
                # Find project assessments for this team via junction table
                assessments_query = select(ProjectAssessment).join(
                    ProjectAssessmentTeam, 
                    ProjectAssessmentTeam.project_assessment_id == ProjectAssessment.id
                ).where(
                    ProjectAssessment.school_id == user.school_id,
                    ProjectAssessmentTeam.project_team_id == tm.team_id,
                    ProjectAssessment.status == "published",
                )

                if course_id:
                    # Join with ProjectTeam and Project to filter by course
                    assessments_query = assessments_query.join(
                        ProjectTeam, ProjectTeam.id == ProjectAssessmentTeam.project_team_id
                    ).join(
                        Project, Project.id == ProjectTeam.project_id
                    ).where(Project.course_id == course_id)

                assessments = db.execute(assessments_query).scalars().all()

                for assessment in assessments:
                    # First, try to get individual scores for this student's team_number
                    proj_scores = []
                    if student.team_number is not None:
                        individual_scores_query = select(ProjectAssessmentScore).where(
                            ProjectAssessmentScore.assessment_id == assessment.id,
                            ProjectAssessmentScore.criterion_id.in_(criteria_ids),
                            ProjectAssessmentScore.team_number == student.team_number,
                        )
                        proj_scores = db.execute(individual_scores_query).scalars().all()
                    
                    # If no individual scores found, fall back to group scores
                    if not proj_scores:
                        group_scores_query = select(ProjectAssessmentScore).where(
                            ProjectAssessmentScore.assessment_id == assessment.id,
                            ProjectAssessmentScore.criterion_id.in_(criteria_ids),
                            ProjectAssessmentScore.team_number.is_(None),
                        )
                        proj_scores = db.execute(group_scores_query).scalars().all()
                    
                    scores_from_project.extend(proj_scores)

            # Calculate average score
            all_scores = [s.score for s in scores_from_peer] + [
                s.score for s in scores_from_project
            ]

            avg_score = None
            if all_scores:
                avg_score = sum(all_scores) / len(all_scores)

            objectives_progress.append(
                StudentLearningObjectiveProgress(
                    learning_objective_id=lo.id,
                    learning_objective_title=lo.title,
                    domain=lo.domain,
                    average_score=avg_score,
                    assessment_count=len(all_scores),
                    assessments=[],
                )
            )

        result_students.append(
            StudentLearningObjectiveOverview(
                user_id=student.id,
                user_name=student.name,
                class_name=student.class_name,
                objectives=objectives_progress,
            )
        )

    return LearningObjectiveOverviewResponse(
        students=result_students,
        filters={
            "class_name": class_name,
            "course_id": course_id,
            "evaluation_id": evaluation_id,
            "learning_objective_id": learning_objective_id,
            "include_teacher_objectives": include_teacher_objectives,
        },
    )
