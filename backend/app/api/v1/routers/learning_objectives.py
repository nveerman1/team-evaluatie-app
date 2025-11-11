from __future__ import annotations

from typing import Optional

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
    Group,
    GroupMember,
    LearningObjective,
    ProjectAssessment,
    ProjectAssessmentScore,
    RubricCriterionLearningObjective,
    Score,
    User,
)

router = APIRouter(prefix="/learning-objectives", tags=["learning-objectives"])


def _to_out(obj: LearningObjective) -> LearningObjectiveOut:
    return LearningObjectiveOut.model_validate(
        {
            "id": obj.id,
            "domain": obj.domain,
            "title": obj.title,
            "description": obj.description,
            "order": obj.order,
            "phase": obj.phase,
            "metadata_json": obj.metadata_json or {},
        }
    )


# ---------- CRUD Operations ----------


@router.post(
    "", response_model=LearningObjectiveOut, status_code=status.HTTP_201_CREATED
)
def create_learning_objective(
    payload: LearningObjectiveCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Create a new learning objective"""
    obj = LearningObjective(
        school_id=user.school_id,
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
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """List learning objectives with filtering and pagination"""
    query = select(LearningObjective).where(
        LearningObjective.school_id == user.school_id
    )

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

    return _to_out(obj)


@router.put("/{objective_id}", response_model=LearningObjectiveOut)
def update_learning_objective(
    objective_id: int,
    payload: LearningObjectiveUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Update a learning objective"""
    obj = db.execute(
        select(LearningObjective)
        .where(
            LearningObjective.id == objective_id,
            LearningObjective.school_id == user.school_id,
        )
    ).scalar_one_or_none()

    if not obj:
        raise HTTPException(status_code=404, detail="Learning objective not found")

    # Update fields
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
    """Delete a learning objective"""
    obj = db.execute(
        select(LearningObjective)
        .where(
            LearningObjective.id == objective_id,
            LearningObjective.school_id == user.school_id,
        )
    ).scalar_one_or_none()

    if not obj:
        raise HTTPException(status_code=404, detail="Learning objective not found")

    db.delete(obj)
    db.commit()


# ---------- Import ----------


@router.post("/import", response_model=LearningObjectiveImportResponse)
def import_learning_objectives(
    payload: LearningObjectiveImportRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Import learning objectives from CSV data.
    Updates existing objectives with matching (domain, order) or creates new ones.
    """
    created = 0
    updated = 0
    errors = []

    for idx, item in enumerate(payload.items):
        try:
            # Try to find existing by domain + order
            existing = None
            if item.domain and item.order:
                existing = db.execute(
                    select(LearningObjective)
                    .where(
                        LearningObjective.school_id == user.school_id,
                        LearningObjective.domain == item.domain,
                        LearningObjective.order == item.order,
                    )
                ).scalar_one_or_none()

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
    """
    # Build query for students
    students_query = select(User).where(
        User.school_id == user.school_id,
        User.role == "student",
        not User.archived,
    )

    if class_name:
        students_query = students_query.where(User.class_name == class_name)

    students = db.execute(students_query).scalars().all()

    # Get learning objectives
    lo_query = select(LearningObjective).where(
        LearningObjective.school_id == user.school_id
    )

    if learning_objective_id:
        lo_query = lo_query.where(LearningObjective.id == learning_objective_id)

    lo_query = lo_query.order_by(
        LearningObjective.order, LearningObjective.title
    )
    learning_objectives = db.execute(lo_query).scalars().all()

    # Build result
    result_students = []

    for student in students:
        objectives_progress = []

        for lo in learning_objectives:
            # Get all criteria linked to this learning objective
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
                # No criteria linked to this objective
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

            # Find groups the student is in
            group_members_query = select(GroupMember).where(
                GroupMember.school_id == user.school_id,
                GroupMember.user_id == student.id,
                GroupMember.active,
            )
            group_members = db.execute(group_members_query).scalars().all()

            for gm in group_members:
                # Find project assessments for this group
                assessments_query = select(ProjectAssessment).where(
                    ProjectAssessment.school_id == user.school_id,
                    ProjectAssessment.group_id == gm.group_id,
                    ProjectAssessment.status == "published",
                )

                if course_id:
                    # Join with Group to filter by course
                    assessments_query = assessments_query.join(
                        Group, Group.id == ProjectAssessment.group_id
                    ).where(Group.course_id == course_id)

                assessments = db.execute(assessments_query).scalars().all()

                for assessment in assessments:
                    proj_scores_query = select(ProjectAssessmentScore).where(
                        ProjectAssessmentScore.assessment_id == assessment.id,
                        ProjectAssessmentScore.criterion_id.in_(criteria_ids),
                    )
                    proj_scores = db.execute(proj_scores_query).scalars().all()
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
        },
    )
