"""
API endpoints for Competency Monitor
"""

from __future__ import annotations
from typing import List, Literal, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import IntegrityError

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    User,
    Competency,
    CompetencyCategory,
    CompetencyRubricLevel,
    CompetencyWindow,
    CompetencySelfScore,
    CompetencyTeacherObservation,
    CompetencyGoal,
    CompetencyReflection,
    CompetencyExternalScore,
    Group,
    GroupMember,
    TeacherCourse,
)
from app.api.v1.schemas.competencies import (
    CompetencyCategoryCreate,
    CompetencyCategoryUpdate,
    CompetencyCategoryOut,
    CompetencyCreate,
    CompetencyUpdate,
    CompetencyOut,
    CompetencyListResponse,
    CompetencyWithCategoryOut,
    CompetencyTree,
    CompetencyCategoryTreeItem,
    CompetencyTreeItem,
    CompetencyReorderRequest,
    CompetencyRubricLevelCreate,
    CompetencyRubricLevelUpdate,
    CompetencyRubricLevelOut,
    CompetencyWindowCreate,
    CompetencyWindowUpdate,
    CompetencyWindowOut,
    CompetencySelfScoreBulkCreate,
    CompetencySelfScoreOut,
    CompetencyTeacherObservationCreate,
    CompetencyTeacherObservationOut,
    CompetencyGoalCreate,
    CompetencyGoalUpdate,
    CompetencyGoalOut,
    CompetencyReflectionCreate,
    CompetencyReflectionOut,
    ClassHeatmap,
    ClassHeatmapRow,
    CompetencyScore,
    StudentCompetencyOverview,
    TeacherGoalItem,
    TeacherGoalsList,
    TeacherReflectionItem,
    TeacherReflectionsList,
)

router = APIRouter(prefix="/competencies", tags=["competencies"])

# Constants
COMPETENCY_UNIQUE_NAME_CONSTRAINT = "uq_competency_name_per_school_teacher"
CATEGORY_UNIQUE_NAME_CONSTRAINT = "uq_competency_category_name_per_school"


# ============ Helper Functions ============


def _get_user_course_ids(db: Session, user: User) -> list[int]:
    """Get all course IDs that a teacher is assigned to"""
    if user.role not in ("teacher", "admin"):
        return []

    course_ids_query = select(TeacherCourse.course_id).where(
        TeacherCourse.school_id == user.school_id,
        TeacherCourse.teacher_id == user.id,
        TeacherCourse.is_active == True,
    )
    result = db.execute(course_ids_query).scalars().all()
    return list(result)


def _to_competency_out(comp: Competency, current_user_id: int) -> CompetencyOut:
    """Convert a Competency model to output schema with computed type"""
    # Determine competency_type
    if comp.is_template:
        competency_type = "central"
    elif comp.teacher_id == current_user_id:
        competency_type = "teacher"
    else:
        competency_type = "shared"

    # Get category info if available
    category_name = None
    category_description = None
    if comp.competency_category:
        category_name = comp.competency_category.name
        category_description = comp.competency_category.description

    # Build level_descriptors dict from rubric_levels relationship
    level_descriptors = {}
    if hasattr(comp, "rubric_levels") and comp.rubric_levels:
        for rl in comp.rubric_levels:
            level_descriptors[str(rl.level)] = rl.description

    return CompetencyOut.model_validate(
        {
            "id": comp.id,
            "school_id": comp.school_id,
            "name": comp.name,
            "description": comp.description,
            "category": comp.category,
            "category_id": comp.category_id,
            "subject_id": comp.subject_id,
            "teacher_id": comp.teacher_id,
            "course_id": comp.course_id,
            "is_template": comp.is_template,
            "competency_type": competency_type,
            "phase": getattr(comp, "phase", None),  # Optional phase field
            "category_name": category_name,
            "category_description": category_description,
            "level_descriptors": level_descriptors,
            "order": comp.order,
            "active": comp.active,
            "scale_min": comp.scale_min,
            "scale_max": comp.scale_max,
            "scale_labels": comp.scale_labels or {},
            "metadata_json": comp.metadata_json or {},
            "created_at": comp.created_at,
            "updated_at": comp.updated_at,
        }
    )


def _check_can_modify(comp: Competency, user: User) -> bool:
    """
    Check if user can modify the competency.

    - Admins can modify template/central competencies (is_template=True)
    - Teachers can only modify their own teacher-specific competencies (teacher_id=current_user)
    """
    if comp.is_template:
        # Template competencies can only be modified by admins
        return user.role == "admin"
    else:
        # Teacher-specific competencies can only be modified by the owner
        return comp.teacher_id == user.id


# ============ Competency Category CRUD ============


@router.get("/categories", response_model=List[CompetencyCategoryOut])
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all competency categories for the school"""
    query = (
        select(CompetencyCategory)
        .where(CompetencyCategory.school_id == current_user.school_id)
        .order_by(CompetencyCategory.order_index, CompetencyCategory.name)
    )
    categories = db.execute(query).scalars().all()
    return categories


@router.post(
    "/categories",
    response_model=CompetencyCategoryOut,
    status_code=status.HTTP_201_CREATED,
)
def create_category(
    data: CompetencyCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new competency category (teacher only)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=403, detail="Only teachers can create categories"
        )

    category = CompetencyCategory(school_id=current_user.school_id, **data.model_dump())
    db.add(category)
    try:
        db.commit()
        db.refresh(category)
        return category
    except IntegrityError as e:
        db.rollback()
        if CATEGORY_UNIQUE_NAME_CONSTRAINT in str(e.orig):
            raise HTTPException(
                status_code=409,
                detail=f"A category with the name '{data.name}' already exists for this school",
            )
        raise HTTPException(status_code=400, detail="Database constraint violation")


@router.get("/categories/{category_id}", response_model=CompetencyCategoryOut)
def get_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific competency category"""
    category = db.get(CompetencyCategory, category_id)
    if not category or category.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.patch("/categories/{category_id}", response_model=CompetencyCategoryOut)
def update_category(
    category_id: int,
    data: CompetencyCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a competency category (teacher only)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=403, detail="Only teachers can update categories"
        )

    category = db.get(CompetencyCategory, category_id)
    if not category or category.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Category not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(category, key, value)

    try:
        db.commit()
        db.refresh(category)
        return category
    except IntegrityError as e:
        db.rollback()
        if CATEGORY_UNIQUE_NAME_CONSTRAINT in str(e.orig):
            conflicting_name = data.name if data.name is not None else category.name
            raise HTTPException(
                status_code=409,
                detail=f"A category with the name '{conflicting_name}' already exists for this school",
            )
        raise HTTPException(status_code=400, detail="Database constraint violation")


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a competency category (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete categories")

    category = db.get(CompetencyCategory, category_id)
    if not category or category.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Category not found")

    db.delete(category)
    db.commit()
    return None


# ============ Competency Tree Endpoint ============


@router.get("/tree", response_model=CompetencyTree)
def get_competency_tree(
    active_only: bool = Query(True),
    templates_only: bool = Query(
        True, description="Only show central/template competencies (for admin views)"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the full competency tree: categories → competencies
    This is useful for dropdown selectors and hierarchical displays.

    By default, only shows central/template competencies (is_template=True).
    Set templates_only=False to include all competencies.
    """
    # Get all categories with their competencies
    query = (
        select(CompetencyCategory)
        .where(CompetencyCategory.school_id == current_user.school_id)
        .options(selectinload(CompetencyCategory.competencies))
        .order_by(CompetencyCategory.order_index, CompetencyCategory.name)
    )
    categories = db.execute(query).scalars().all()

    # Build tree structure
    tree_items = []
    for cat in categories:
        competencies = cat.competencies

        # Filter by is_template if templates_only is True
        if templates_only:
            competencies = [c for c in competencies if c.is_template]

        if active_only:
            competencies = [c for c in competencies if c.active]

        # Sort competencies by order
        competencies = sorted(competencies, key=lambda c: (c.order, c.name))

        tree_items.append(
            CompetencyCategoryTreeItem(
                id=cat.id,
                name=cat.name,
                description=cat.description,
                color=cat.color,
                icon=cat.icon,
                order_index=cat.order_index,
                competencies=[
                    CompetencyTreeItem(
                        id=c.id,
                        name=c.name,
                        description=c.description,
                        order=c.order,
                        active=c.active,
                    )
                    for c in competencies
                ],
            )
        )

    return CompetencyTree(categories=tree_items)


# ============ Competency CRUD ============


@router.get("/", response_model=List[CompetencyOut])
def list_competencies(
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all competencies for the school.

    This is the legacy endpoint that returns only central/template competencies
    for backward compatibility. Use /teacher-list for the full two-tier view.
    """
    query = (
        select(Competency)
        .options(
            selectinload(Competency.competency_category),
            selectinload(Competency.rubric_levels),
        )
        .where(
            Competency.school_id == current_user.school_id,
            Competency.is_template == True,  # Only templates for backward compatibility
        )
    )
    if active_only:
        query = query.where(Competency.active == True)
    query = query.order_by(Competency.order, Competency.name)

    competencies = db.execute(query).scalars().all()
    return [_to_competency_out(c, current_user.id) for c in competencies]


@router.get("/teacher-list", response_model=CompetencyListResponse)
def list_teacher_competencies(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    active_only: bool = Query(True),
    competency_type: Optional[Literal["central", "teacher", "shared", "all"]] = None,
    include_teacher_competencies: bool = Query(
        False, description="Include teacher's own competencies"
    ),
    include_course_competencies: bool = Query(
        False, description="Include teacher competencies from shared courses"
    ),
    subject_id: Optional[int] = None,
    category_id: Optional[int] = None,
    phase: Optional[str] = Query(
        None, description="Filter by phase: 'onderbouw' or 'bovenbouw'"
    ),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List competencies with two-tier filtering for teachers.

    Filtering logic:
    - competency_type="central": Only central/template competencies
    - competency_type="teacher": Only the current teacher's own competencies
    - competency_type="shared": Only shared competencies from courses the teacher is in
    - competency_type="all" or not specified:
      - If include_teacher_competencies=True: both central and user's teacher competencies
      - If include_course_competencies=True: also include shared course competencies
      - Otherwise: central competencies only (backward compatible)

    - subject_id: Filter by subject (for central competencies)
    - category_id: Filter by competency category
    - phase: Filter by phase ('onderbouw' or 'bovenbouw')
    - search: Search in name/description
    """
    query = (
        select(Competency)
        .options(
            selectinload(Competency.competency_category),
            selectinload(Competency.rubric_levels),
        )
        .where(Competency.school_id == current_user.school_id)
    )

    if active_only:
        query = query.where(Competency.active == True)

    # Get course IDs the current user is assigned to (for shared course competencies)
    user_course_ids = []
    if (
        include_teacher_competencies
        or include_course_competencies
        or competency_type in ("teacher", "shared", "all")
    ):
        user_course_ids = _get_user_course_ids(db, current_user)

    # Filter by competency type
    if competency_type == "central":
        query = query.where(Competency.is_template == True)
    elif competency_type == "teacher":
        query = query.where(
            Competency.is_template == False, Competency.teacher_id == current_user.id
        )
    elif competency_type == "shared":
        if user_course_ids:
            query = query.where(
                Competency.is_template == False,
                Competency.teacher_id != current_user.id,
                Competency.course_id.in_(user_course_ids),
            )
        else:
            # No shared competencies if user has no courses
            query = query.where(Competency.id == -1)  # No results
    elif (
        competency_type == "all"
        or include_teacher_competencies
        or include_course_competencies
    ):
        # Include central + own + shared based on flags
        conditions = [Competency.is_template == True]

        if include_teacher_competencies or competency_type == "all":
            conditions.append(Competency.teacher_id == current_user.id)

        if (
            include_course_competencies or competency_type == "all"
        ) and user_course_ids:
            # Include teacher competencies from shared courses
            conditions.append(
                (Competency.is_template == False)
                & (Competency.teacher_id != current_user.id)
                & Competency.course_id.in_(user_course_ids)
            )

        query = query.where(or_(*conditions))
    else:
        # Default: backward compatible - only central/templates
        query = query.where(Competency.is_template == True)

    # Filter by subject_id (for central competencies)
    if subject_id is not None:
        query = query.where(Competency.subject_id == subject_id)

    # Filter by category_id
    if category_id is not None:
        query = query.where(Competency.category_id == category_id)

    # Filter by phase (onderbouw/bovenbouw)
    if phase is not None:
        query = query.where(Competency.phase == phase)

    # Search filter
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                Competency.name.ilike(search_pattern),
                Competency.description.ilike(search_pattern),
            )
        )

    # Order: central first, then by order and name
    query = query.order_by(
        Competency.is_template.desc(),  # Central first
        Competency.order,
        Competency.name,
    )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = db.execute(count_query).scalar() or 0

    # Paginate
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)

    competencies = db.execute(query).scalars().all()

    return CompetencyListResponse(
        items=[_to_competency_out(c, current_user.id) for c in competencies],
        page=page,
        limit=limit,
        total=total,
    )


@router.post("/", response_model=CompetencyOut, status_code=status.HTTP_201_CREATED)
def create_competency(
    data: CompetencyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new competency.

    For central/template competencies (admin only):
    - Set is_template=True
    - subject_id should be provided

    For teacher-specific competencies:
    - Set is_template=False (default)
    - teacher_id is automatically set to current user
    - course_id is optional (enables sharing)
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=403, detail="Only teachers can create competencies"
        )

    # Validate: only admins can create template competencies
    if data.is_template and current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only admins can create central/template competencies",
        )

    # Set teacher_id for teacher-specific competencies
    teacher_id = None if data.is_template else current_user.id

    # Extract level_descriptors before creating competency
    level_descriptors = data.level_descriptors if data.level_descriptors else {}

    # Create competency without level_descriptors (it's not a column)
    data_dict = data.model_dump(exclude={"level_descriptors"})
    competency = Competency(
        school_id=current_user.school_id, teacher_id=teacher_id, **data_dict
    )
    db.add(competency)
    try:
        db.flush()  # Get the competency ID

        # Create rubric levels
        for level_str, description in level_descriptors.items():
            if description and description.strip():
                rubric_level = CompetencyRubricLevel(
                    school_id=current_user.school_id,
                    competency_id=competency.id,
                    level=int(level_str),
                    description=description.strip(),
                )
                db.add(rubric_level)

        db.commit()
        db.refresh(competency)

        # Re-fetch with relationships loaded
        query = (
            select(Competency)
            .options(
                selectinload(Competency.competency_category),
                selectinload(Competency.rubric_levels),
            )
            .where(Competency.id == competency.id)
        )
        competency = db.execute(query).scalar_one()

        return _to_competency_out(competency, current_user.id)
    except IntegrityError as e:
        db.rollback()
        # Check if it's a duplicate name constraint violation
        if COMPETENCY_UNIQUE_NAME_CONSTRAINT in str(e.orig):
            raise HTTPException(
                status_code=409,
                detail=f"A competency with the name '{data.name}' already exists for you",
            )
        # Re-raise for other integrity errors
        raise HTTPException(status_code=400, detail="Database constraint violation")


@router.get("/{competency_id}", response_model=CompetencyOut)
def get_competency(
    competency_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific competency"""
    query = (
        select(Competency)
        .options(
            selectinload(Competency.competency_category),
            selectinload(Competency.rubric_levels),
        )
        .where(Competency.id == competency_id)
    )
    competency = db.execute(query).scalar_one_or_none()

    if not competency or competency.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Competency not found")

    # Check visibility:
    # - Templates are visible to all
    # - Teacher competencies are visible to owner
    # - Teacher competencies with course_id are visible to other teachers of that course
    if not competency.is_template and competency.teacher_id != current_user.id:
        # Check if this is a shared course competency
        if competency.course_id:
            user_course_ids = _get_user_course_ids(db, current_user)
            if competency.course_id not in user_course_ids:
                raise HTTPException(status_code=404, detail="Competency not found")
        else:
            raise HTTPException(status_code=404, detail="Competency not found")

    return _to_competency_out(competency, current_user.id)


@router.patch("/{competency_id}", response_model=CompetencyOut)
def update_competency(
    competency_id: int,
    data: CompetencyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update a competency.

    - Template competencies: only admins can update
    - Teacher competencies: only the owning teacher can update
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=403, detail="Only teachers can update competencies"
        )

    competency = db.get(Competency, competency_id)
    if not competency or competency.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Competency not found")

    # Check permission
    if not _check_can_modify(competency, current_user):
        if competency.is_template:
            raise HTTPException(
                status_code=403,
                detail="Only admins can modify central/template competencies",
            )
        else:
            raise HTTPException(
                status_code=403, detail="You can only modify your own competencies"
            )

    # Extract level_descriptors if provided
    level_descriptors = (
        data.level_descriptors if data.level_descriptors is not None else None
    )

    # Update fields (exclude is_template, teacher_id, and level_descriptors)
    update_data = data.model_dump(exclude_unset=True, exclude={"level_descriptors"})
    for key, value in update_data.items():
        if key not in ("is_template", "teacher_id"):  # These cannot be changed
            setattr(competency, key, value)

    # Update rubric levels if provided
    if level_descriptors is not None:
        # Delete existing rubric levels
        for rl in competency.rubric_levels[:]:  # Create a copy to iterate
            db.delete(rl)

        # Create new rubric levels
        for level_str, description in level_descriptors.items():
            if description and description.strip():
                rubric_level = CompetencyRubricLevel(
                    school_id=current_user.school_id,
                    competency_id=competency.id,
                    level=int(level_str),
                    description=description.strip(),
                )
                db.add(rubric_level)

    try:
        db.commit()

        # Re-fetch with relationships loaded
        query = (
            select(Competency)
            .options(
                selectinload(Competency.competency_category),
                selectinload(Competency.rubric_levels),
            )
            .where(Competency.id == competency.id)
        )
        competency = db.execute(query).scalar_one()

        return _to_competency_out(competency, current_user.id)
    except IntegrityError as e:
        db.rollback()
        # Check if it's a duplicate name constraint violation
        if COMPETENCY_UNIQUE_NAME_CONSTRAINT in str(e.orig):
            # Use the updated name if provided, otherwise use the existing name
            conflicting_name = data.name if data.name is not None else competency.name
            raise HTTPException(
                status_code=409,
                detail=f"A competency with the name '{conflicting_name}' already exists for you",
            )
        # Re-raise for other integrity errors
        raise HTTPException(status_code=400, detail="Database constraint violation")


@router.delete("/{competency_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_competency(
    competency_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a competency.

    - Template competencies: only admins can delete
    - Teacher competencies: only the owning teacher can delete
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=403, detail="Only teachers can delete competencies"
        )

    competency = db.get(Competency, competency_id)
    if not competency or competency.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Competency not found")

    # Check permission
    if not _check_can_modify(competency, current_user):
        if competency.is_template:
            raise HTTPException(
                status_code=403,
                detail="Only admins can delete central/template competencies",
            )
        else:
            raise HTTPException(
                status_code=403, detail="You can only delete your own competencies"
            )

    db.delete(competency)
    db.commit()
    return None


# ============ Competency Reorder ============


@router.patch("/reorder", response_model=List[CompetencyOut])
def reorder_competencies(
    data: CompetencyReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reorder competencies within a category (teacher only)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=403, detail="Only teachers can reorder competencies"
        )

    # Verify the category exists and belongs to the school
    category = db.get(CompetencyCategory, data.category_id)
    if not category or category.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Category not found")

    # Get all competency IDs from the request
    requested_ids = {item.id for item in data.items}

    # Fetch all competencies in this category for this school
    competencies = (
        db.execute(
            select(Competency).where(
                Competency.school_id == current_user.school_id,
                Competency.category_id == data.category_id,
            )
        )
        .scalars()
        .all()
    )

    # Validate that all requested competency IDs belong to this category
    competency_map = {c.id: c for c in competencies}
    for item in data.items:
        if item.id not in competency_map:
            raise HTTPException(
                status_code=400,
                detail=f"Competency {item.id} does not belong to category {data.category_id}",
            )

    # Update order_index for each competency
    updated = []
    for item in data.items:
        comp = competency_map[item.id]
        comp.order = item.order_index
        updated.append(comp)

    db.commit()

    # Refresh and return the updated competencies
    for comp in updated:
        db.refresh(comp)

    return updated


# ============ Competency Rubric Level CRUD ============


@router.get(
    "/{competency_id}/rubric-levels", response_model=List[CompetencyRubricLevelOut]
)
def list_rubric_levels(
    competency_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all rubric levels for a competency"""
    competency = db.get(Competency, competency_id)
    if not competency or competency.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Competency not found")

    levels = (
        db.execute(
            select(CompetencyRubricLevel)
            .where(CompetencyRubricLevel.competency_id == competency_id)
            .order_by(CompetencyRubricLevel.level)
        )
        .scalars()
        .all()
    )
    return levels


@router.post(
    "/{competency_id}/rubric-levels",
    response_model=CompetencyRubricLevelOut,
    status_code=status.HTTP_201_CREATED,
)
def create_rubric_level(
    competency_id: int,
    data: CompetencyRubricLevelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a rubric level for a competency (teacher only)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=403, detail="Only teachers can create rubric levels"
        )

    competency = db.get(Competency, competency_id)
    if not competency or competency.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Competency not found")

    # Verify the competency_id matches
    if data.competency_id != competency_id:
        raise HTTPException(status_code=400, detail="Competency ID mismatch")

    # Verify level is within scale
    if data.level < competency.scale_min or data.level > competency.scale_max:
        raise HTTPException(
            status_code=400,
            detail=f"Level must be between {competency.scale_min} and {competency.scale_max}",
        )

    rubric_level = CompetencyRubricLevel(
        school_id=current_user.school_id,
        competency_id=competency_id,
        level=data.level,
        label=data.label,
        description=data.description,
    )
    db.add(rubric_level)
    try:
        db.commit()
        db.refresh(rubric_level)
        return rubric_level
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"Rubric level {data.level} already exists for this competency",
        )


@router.patch(
    "/{competency_id}/rubric-levels/{level_id}", response_model=CompetencyRubricLevelOut
)
def update_rubric_level(
    competency_id: int,
    level_id: int,
    data: CompetencyRubricLevelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a rubric level (teacher only)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=403, detail="Only teachers can update rubric levels"
        )

    rubric_level = db.get(CompetencyRubricLevel, level_id)
    if (
        not rubric_level
        or rubric_level.competency_id != competency_id
        or rubric_level.school_id != current_user.school_id
    ):
        raise HTTPException(status_code=404, detail="Rubric level not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(rubric_level, key, value)

    db.commit()
    db.refresh(rubric_level)
    return rubric_level


@router.delete(
    "/{competency_id}/rubric-levels/{level_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_rubric_level(
    competency_id: int,
    level_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a rubric level (teacher only)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=403, detail="Only teachers can delete rubric levels"
        )

    rubric_level = db.get(CompetencyRubricLevel, level_id)
    if (
        not rubric_level
        or rubric_level.competency_id != competency_id
        or rubric_level.school_id != current_user.school_id
    ):
        raise HTTPException(status_code=404, detail="Rubric level not found")

    db.delete(rubric_level)
    db.commit()
    return None


# ============ Competency Window CRUD ============


@router.get("/windows/", response_model=List[CompetencyWindowOut])
def list_windows(
    status_filter: Optional[str] = Query(None),
    course_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all competency windows, optionally filtered by status and/or course"""
    query = select(CompetencyWindow).where(
        CompetencyWindow.school_id == current_user.school_id
    )

    # If user is a student, only show windows for courses they're enrolled in
    if current_user.role == "student":
        # Get course IDs where student is an active member
        student_course_ids = (
            db.query(Group.course_id)
            .join(GroupMember, GroupMember.group_id == Group.id)
            .filter(
                GroupMember.user_id == current_user.id,
                GroupMember.active.is_(True),
                Group.school_id == current_user.school_id,
            )
            .distinct()
            .all()
        )
        course_ids = [cid for (cid,) in student_course_ids]

        if course_ids:
            query = query.where(CompetencyWindow.course_id.in_(course_ids))
        else:
            # Student has no courses, filter to impossible condition
            query = query.where(CompetencyWindow.id == -1)

    if status_filter:
        query = query.where(CompetencyWindow.status == status_filter)
    if course_id:
        query = query.where(CompetencyWindow.course_id == course_id)
    query = query.order_by(CompetencyWindow.start_date.desc())

    windows = db.execute(query).scalars().all()
    return windows


@router.post(
    "/windows/", response_model=CompetencyWindowOut, status_code=status.HTTP_201_CREATED
)
def create_window(
    data: CompetencyWindowCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new competency window (teacher only)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Only teachers can create windows")

    window = CompetencyWindow(school_id=current_user.school_id, **data.model_dump())
    db.add(window)
    db.commit()
    db.refresh(window)
    return window


@router.get("/windows/{window_id}", response_model=CompetencyWindowOut)
def get_window(
    window_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific window"""
    window = db.get(CompetencyWindow, window_id)
    if not window or window.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Window not found")
    return window


@router.patch("/windows/{window_id}", response_model=CompetencyWindowOut)
def update_window(
    window_id: int,
    data: CompetencyWindowUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a window (teacher only)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Only teachers can update windows")

    window = db.get(CompetencyWindow, window_id)
    if not window or window.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Window not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(window, key, value)

    db.commit()
    db.refresh(window)
    return window


@router.delete("/windows/{window_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_window(
    window_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a window (teacher only)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Only teachers can delete windows")

    window = db.get(CompetencyWindow, window_id)
    if not window or window.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Window not found")

    db.delete(window)
    db.commit()
    return None


# ============ Self Score Endpoints ============


@router.post(
    "/self-scores/",
    response_model=List[CompetencySelfScoreOut],
    status_code=status.HTTP_201_CREATED,
)
def submit_self_scores(
    data: CompetencySelfScoreBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit self-assessment scores for a window"""
    window = db.get(CompetencyWindow, data.window_id)
    if not window or window.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Window not found")

    if window.status != "open":
        raise HTTPException(status_code=400, detail="Window is not open")

    results = []
    for score_data in data.scores:
        # Check if score already exists
        existing = db.execute(
            select(CompetencySelfScore).where(
                CompetencySelfScore.window_id == data.window_id,
                CompetencySelfScore.user_id == current_user.id,
                CompetencySelfScore.competency_id == score_data.competency_id,
            )
        ).scalar_one_or_none()

        if existing:
            # Update existing score
            existing.score = score_data.score
            existing.example = score_data.example
            existing.submitted_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            results.append(existing)
        else:
            # Create new score
            score = CompetencySelfScore(
                school_id=current_user.school_id,
                window_id=data.window_id,
                user_id=current_user.id,
                competency_id=score_data.competency_id,
                score=score_data.score,
                example=score_data.example,
                submitted_at=datetime.utcnow(),
            )
            db.add(score)
            db.commit()
            db.refresh(score)
            results.append(score)

    return results


@router.get("/self-scores/", response_model=List[CompetencySelfScoreOut])
def get_my_self_scores(
    window_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get my self-scores for a window"""
    scores = (
        db.execute(
            select(CompetencySelfScore).where(
                CompetencySelfScore.window_id == window_id,
                CompetencySelfScore.user_id == current_user.id,
            )
        )
        .scalars()
        .all()
    )
    return scores


# ============ Goal Endpoints ============


@router.post(
    "/goals/", response_model=CompetencyGoalOut, status_code=status.HTTP_201_CREATED
)
def create_goal(
    data: CompetencyGoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a learning goal for a window"""
    window = db.get(CompetencyWindow, data.window_id)
    if not window or window.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Window not found")

    goal = CompetencyGoal(
        school_id=current_user.school_id,
        window_id=data.window_id,
        user_id=current_user.id,
        goal_text=data.goal_text,
        success_criteria=data.success_criteria,
        competency_id=data.competency_id,
        status=data.status,
        submitted_at=datetime.utcnow(),
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.get("/goals/", response_model=List[CompetencyGoalOut])
def get_my_goals(
    window_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get my goals (optionally filtered by window)"""
    query = select(CompetencyGoal).where(
        CompetencyGoal.user_id == current_user.id,
        CompetencyGoal.school_id == current_user.school_id,
    )
    if window_id:
        query = query.where(CompetencyGoal.window_id == window_id)
    query = query.order_by(CompetencyGoal.submitted_at.desc())

    goals = db.execute(query).scalars().all()
    return goals


@router.patch("/goals/{goal_id}", response_model=CompetencyGoalOut)
def update_goal(
    goal_id: int,
    data: CompetencyGoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a goal"""
    goal = db.get(CompetencyGoal, goal_id)
    if not goal or goal.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Goal not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(goal, key, value)

    db.commit()
    db.refresh(goal)
    return goal


# ============ Reflection Endpoints ============


@router.post(
    "/reflections/",
    response_model=CompetencyReflectionOut,
    status_code=status.HTTP_201_CREATED,
)
def create_reflection(
    data: CompetencyReflectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a reflection for a window"""
    window = db.get(CompetencyWindow, data.window_id)
    if not window or window.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Window not found")

    # Check if reflection already exists
    existing = db.execute(
        select(CompetencyReflection).where(
            CompetencyReflection.window_id == data.window_id,
            CompetencyReflection.user_id == current_user.id,
        )
    ).scalar_one_or_none()

    if existing:
        # Update existing reflection
        existing.text = data.text
        existing.goal_id = data.goal_id
        existing.goal_achieved = data.goal_achieved
        existing.evidence = data.evidence
        existing.submitted_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing

    reflection = CompetencyReflection(
        school_id=current_user.school_id,
        window_id=data.window_id,
        user_id=current_user.id,
        text=data.text,
        goal_id=data.goal_id,
        goal_achieved=data.goal_achieved,
        evidence=data.evidence,
        submitted_at=datetime.utcnow(),
    )
    db.add(reflection)
    db.commit()
    db.refresh(reflection)
    return reflection


@router.get("/reflections/", response_model=List[CompetencyReflectionOut])
def get_my_reflections(
    window_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get my reflections (optionally filtered by window)"""
    query = select(CompetencyReflection).where(
        CompetencyReflection.user_id == current_user.id,
        CompetencyReflection.school_id == current_user.school_id,
    )
    if window_id:
        query = query.where(CompetencyReflection.window_id == window_id)
    query = query.order_by(CompetencyReflection.submitted_at.desc())

    reflections = db.execute(query).scalars().all()
    return reflections


# ============ Teacher Observation Endpoints ============


@router.post(
    "/observations/",
    response_model=CompetencyTeacherObservationOut,
    status_code=status.HTTP_201_CREATED,
)
def create_observation(
    data: CompetencyTeacherObservationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a teacher observation (teacher only)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=403, detail="Only teachers can create observations"
        )

    window = db.get(CompetencyWindow, data.window_id)
    if not window or window.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Window not found")

    # Check if observation already exists
    existing = db.execute(
        select(CompetencyTeacherObservation).where(
            CompetencyTeacherObservation.window_id == data.window_id,
            CompetencyTeacherObservation.user_id == data.user_id,
            CompetencyTeacherObservation.competency_id == data.competency_id,
        )
    ).scalar_one_or_none()

    if existing:
        # Update existing observation
        existing.score = data.score
        existing.comment = data.comment
        db.commit()
        db.refresh(existing)
        return existing

    observation = CompetencyTeacherObservation(
        school_id=current_user.school_id,
        window_id=data.window_id,
        user_id=data.user_id,
        competency_id=data.competency_id,
        teacher_id=current_user.id,
        score=data.score,
        comment=data.comment,
    )
    db.add(observation)
    db.commit()
    db.refresh(observation)
    return observation


# ============ Overview/Aggregate Endpoints ============


@router.get("/windows/{window_id}/overview", response_model=StudentCompetencyOverview)
def get_my_window_overview(
    window_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get my competency overview for a window"""
    window = db.get(CompetencyWindow, window_id)
    if not window or window.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Window not found")

    # If user is a student and window has a course, verify they're enrolled
    if current_user.role == "student" and window.course_id:
        # Check if student is in the window's course
        is_enrolled = (
            db.query(GroupMember.id)
            .join(Group, Group.id == GroupMember.group_id)
            .filter(
                GroupMember.user_id == current_user.id,
                GroupMember.active.is_(True),
                Group.course_id == window.course_id,
                Group.school_id == current_user.school_id,
            )
            .first()
        )
        if not is_enrolled:
            raise HTTPException(
                status_code=403, detail="You don't have access to this window"
            )

    # Get all competencies
    competencies = (
        db.execute(
            select(Competency)
            .where(
                Competency.school_id == current_user.school_id,
                Competency.active == True,
            )
            .order_by(Competency.order)
        )
        .scalars()
        .all()
    )

    # Get self scores
    self_scores = (
        db.execute(
            select(CompetencySelfScore).where(
                CompetencySelfScore.window_id == window_id,
                CompetencySelfScore.user_id == current_user.id,
            )
        )
        .scalars()
        .all()
    )
    self_score_map = {s.competency_id: s.score for s in self_scores}

    # Get external scores (average per competency)
    external_scores = (
        db.execute(
            select(CompetencyExternalScore).where(
                CompetencyExternalScore.window_id == window_id,
                CompetencyExternalScore.subject_user_id == current_user.id,
            )
        )
        .scalars()
        .all()
    )
    external_score_map = {}
    external_count_map = {}
    for score in external_scores:
        if score.competency_id not in external_score_map:
            external_score_map[score.competency_id] = []
        external_score_map[score.competency_id].append(score.score)

    # Calculate averages
    external_avg_map = {}
    for comp_id, scores in external_score_map.items():
        external_avg_map[comp_id] = sum(scores) / len(scores)
        external_count_map[comp_id] = len(scores)

    # Build scores list
    scores = []
    for comp in competencies:
        scores.append(
            CompetencyScore(
                competency_id=comp.id,
                competency_name=comp.name,
                self_score=self_score_map.get(comp.id),
                peer_score=None,  # TODO: implement peer score calculation
                teacher_score=None,  # TODO: implement teacher score retrieval
                external_score=external_avg_map.get(comp.id),
                external_count=external_count_map.get(comp.id, 0),
                final_score=self_score_map.get(comp.id),  # Simplified for now
                delta=None,  # TODO: implement delta calculation
            )
        )

    # Get goals
    goals = (
        db.execute(
            select(CompetencyGoal).where(
                CompetencyGoal.window_id == window_id,
                CompetencyGoal.user_id == current_user.id,
            )
        )
        .scalars()
        .all()
    )

    # Get reflection
    reflection = db.execute(
        select(CompetencyReflection).where(
            CompetencyReflection.window_id == window_id,
            CompetencyReflection.user_id == current_user.id,
        )
    ).scalar_one_or_none()

    return StudentCompetencyOverview(
        window_id=window_id,
        user_id=current_user.id,
        user_name=current_user.name,
        scores=scores,
        goals=goals,
        reflection=reflection,
    )


@router.get(
    "/windows/{window_id}/student/{user_id}/overview",
    response_model=StudentCompetencyOverview,
)
def get_student_window_overview(
    window_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a student's competency overview for a window (teacher only)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=403, detail="Only teachers can view student details"
        )

    window = db.get(CompetencyWindow, window_id)
    if not window or window.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Window not found")

    # Get the student
    student = db.get(User, user_id)
    if not student or student.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Student not found")

    # Get selected competencies for this window (if specified in settings)
    selected_competency_ids = (window.settings or {}).get("selected_competency_ids", [])

    if selected_competency_ids:
        # Filter to only selected competencies
        competencies = (
            db.execute(
                select(Competency)
                .options(selectinload(Competency.competency_category))
                .options(selectinload(Competency.rubric_levels))
                .where(
                    Competency.school_id == current_user.school_id,
                    Competency.active,
                    Competency.id.in_(selected_competency_ids),
                )
                .order_by(Competency.order)
            )
            .scalars()
            .all()
        )
    else:
        # Fallback: Get all active competencies (for windows created before this feature)
        competencies = (
            db.execute(
                select(Competency)
                .options(selectinload(Competency.competency_category))
                .options(selectinload(Competency.rubric_levels))
                .where(
                    Competency.school_id == current_user.school_id,
                    Competency.active,
                )
                .order_by(Competency.order)
            )
            .scalars()
            .all()
        )

    # Get self scores
    self_scores = (
        db.execute(
            select(CompetencySelfScore).where(
                CompetencySelfScore.window_id == window_id,
                CompetencySelfScore.user_id == user_id,
            )
        )
        .scalars()
        .all()
    )

    # Get teacher observations
    teacher_observations = (
        db.execute(
            select(CompetencyTeacherObservation).where(
                CompetencyTeacherObservation.window_id == window_id,
                CompetencyTeacherObservation.user_id == user_id,
            )
        )
        .scalars()
        .all()
    )

    # Get external scores (average per competency)
    external_scores = (
        db.execute(
            select(CompetencyExternalScore).where(
                CompetencyExternalScore.window_id == window_id,
                CompetencyExternalScore.subject_user_id == user_id,
            )
        )
        .scalars()
        .all()
    )
    external_score_map = {}
    external_count_map = {}
    for score in external_scores:
        if score.competency_id not in external_score_map:
            external_score_map[score.competency_id] = []
        external_score_map[score.competency_id].append(score.score)

    # Calculate averages
    external_avg_map = {}
    for comp_id, scores in external_score_map.items():
        external_avg_map[comp_id] = sum(scores) / len(scores)
        external_count_map[comp_id] = len(scores)

    # Build maps
    self_score_map = {s.competency_id: s for s in self_scores}
    teacher_obs_map = {o.competency_id: o for o in teacher_observations}

    # Build scores list with full details
    scores = []
    for comp in competencies:
        self_score_obj = self_score_map.get(comp.id)
        teacher_obs_obj = teacher_obs_map.get(comp.id)

        # Get category name from relationship
        category_name = None
        if comp.competency_category:
            category_name = comp.competency_category.name

        # Get rubric level description for self score
        self_level_description = None
        if self_score_obj and comp.rubric_levels:
            # Round to nearest integer level (1-5)
            level = round(self_score_obj.score)
            level = max(1, min(5, level))  # Clamp to 1-5 range
            # Find matching rubric level
            for rubric_level in comp.rubric_levels:
                if rubric_level.level == level:
                    self_level_description = rubric_level.description
                    break

        scores.append(
            CompetencyScore(
                competency_id=comp.id,
                competency_name=comp.name,
                category_name=category_name,
                self_score=float(self_score_obj.score) if self_score_obj else None,
                self_level_description=self_level_description,
                peer_score=None,  # TODO: implement peer score calculation
                teacher_score=float(teacher_obs_obj.score) if teacher_obs_obj else None,
                external_score=external_avg_map.get(comp.id),
                external_count=external_count_map.get(comp.id, 0),
                final_score=(
                    float(self_score_obj.score) if self_score_obj else None
                ),  # Simplified for now
                delta=None,  # TODO: implement delta calculation
            )
        )

    # Get goals
    goals = (
        db.execute(
            select(CompetencyGoal).where(
                CompetencyGoal.window_id == window_id,
                CompetencyGoal.user_id == user_id,
            )
        )
        .scalars()
        .all()
    )

    # Get reflection
    reflection = db.execute(
        select(CompetencyReflection).where(
            CompetencyReflection.window_id == window_id,
            CompetencyReflection.user_id == user_id,
        )
    ).scalar_one_or_none()

    return StudentCompetencyOverview(
        window_id=window_id,
        user_id=user_id,
        user_name=student.name,
        scores=scores,
        goals=goals,
        reflection=reflection,
    )


@router.get("/windows/{window_id}/heatmap", response_model=ClassHeatmap)
def get_class_heatmap(
    window_id: int,
    class_name: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get class heatmap for a window (teacher only)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Only teachers can view heatmap")

    window = db.get(CompetencyWindow, window_id)
    if not window or window.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Window not found")

    # Get selected competencies for this window (if specified in settings)
    selected_competency_ids = (window.settings or {}).get("selected_competency_ids", [])

    if selected_competency_ids:
        # Filter to only selected competencies
        competencies = (
            db.execute(
                select(Competency)
                .options(selectinload(Competency.competency_category))
                .where(
                    Competency.school_id == current_user.school_id,
                    Competency.active,
                    Competency.id.in_(selected_competency_ids),
                )
                .order_by(Competency.order)
            )
            .scalars()
            .all()
        )
    else:
        # Fallback: Get all active competencies (for windows created before this feature)
        competencies = (
            db.execute(
                select(Competency)
                .options(selectinload(Competency.competency_category))
                .where(
                    Competency.school_id == current_user.school_id,
                    Competency.active,
                )
                .order_by(Competency.order)
            )
            .scalars()
            .all()
        )

    # Get students from the window's course (filter by class if specified, exclude archived)
    if window.course_id:
        # Get students who are in groups for this course
        students_query = (
            select(User)
            .join(GroupMember, GroupMember.user_id == User.id)
            .join(Group, Group.id == GroupMember.group_id)
            .where(
                User.school_id == current_user.school_id,
                User.role == "student",
                User.archived.is_(False),
                Group.course_id == window.course_id,
                GroupMember.active.is_(True),
            )
        )
        if class_name:
            students_query = students_query.where(User.class_name == class_name)
        students_query = students_query.distinct()
        students = db.execute(students_query).scalars().all()
    else:
        # No course filter, show all students (legacy support)
        students_query = select(User).where(
            User.school_id == current_user.school_id,
            User.role == "student",
            User.archived.is_(False),
        )
        if class_name:
            students_query = students_query.where(User.class_name == class_name)
        students = db.execute(students_query).scalars().all()

    # Get all self scores for this window
    self_scores = (
        db.execute(
            select(CompetencySelfScore).where(
                CompetencySelfScore.window_id == window_id,
            )
        )
        .scalars()
        .all()
    )

    # Build score map: user_id -> {competency_id -> score}
    score_map = {}
    for score in self_scores:
        if score.user_id not in score_map:
            score_map[score.user_id] = {}
        score_map[score.user_id][score.competency_id] = float(score.score)

    # Build rows
    rows = []
    for student in students:
        student_scores = score_map.get(student.id, {})
        rows.append(
            ClassHeatmapRow(
                user_id=student.id,
                user_name=student.name,
                class_name=student.class_name,
                scores=student_scores,
                deltas={},  # TODO: implement delta calculation
            )
        )

    # Convert competencies to CompetencyOut schema with category info
    competencies_out = [
        _to_competency_out(comp, current_user.id) for comp in competencies
    ]

    return ClassHeatmap(
        window_id=window_id,
        window_title=window.title,
        competencies=competencies_out,
        rows=rows,
    )


# ============ Teacher View Endpoints ============


@router.get("/windows/{window_id}/goals", response_model=TeacherGoalsList)
def get_window_goals(
    window_id: int,
    class_name: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all goals for a window (teacher only)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Only teachers can view all goals")

    window = db.get(CompetencyWindow, window_id)
    if not window or window.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Window not found")

    # Build query for goals with user info
    query = (
        select(CompetencyGoal, User)
        .join(User, User.id == CompetencyGoal.user_id)
        .where(
            CompetencyGoal.window_id == window_id,
            CompetencyGoal.school_id == current_user.school_id,
        )
    )

    if class_name:
        query = query.where(User.class_name == class_name)
    if status:
        query = query.where(CompetencyGoal.status == status)

    query = query.order_by(User.name, CompetencyGoal.updated_at.desc())

    results = db.execute(query).all()

    # Get competency names
    competency_map = {}
    if results:
        comp_ids = [r[0].competency_id for r in results if r[0].competency_id]
        if comp_ids:
            competencies = (
                db.execute(select(Competency).where(Competency.id.in_(comp_ids)))
                .scalars()
                .all()
            )
            competency_map = {c.id: c.name for c in competencies}

    items = []
    for goal, user in results:
        items.append(
            TeacherGoalItem(
                id=goal.id,
                user_id=user.id,
                user_name=user.name,
                class_name=user.class_name,
                goal_text=goal.goal_text,
                success_criteria=goal.success_criteria,
                competency_id=goal.competency_id,
                competency_name=(
                    competency_map.get(goal.competency_id)
                    if goal.competency_id
                    else None
                ),
                status=goal.status,
                submitted_at=goal.submitted_at,
                updated_at=goal.updated_at,
            )
        )

    return TeacherGoalsList(
        window_id=window_id,
        window_title=window.title,
        items=items,
    )


@router.get("/windows/{window_id}/reflections", response_model=TeacherReflectionsList)
def get_window_reflections(
    window_id: int,
    class_name: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all reflections for a window (teacher only)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=403, detail="Only teachers can view all reflections"
        )

    window = db.get(CompetencyWindow, window_id)
    if not window or window.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Window not found")

    # Build query for reflections with user info
    query = (
        select(CompetencyReflection, User)
        .join(User, User.id == CompetencyReflection.user_id)
        .where(
            CompetencyReflection.window_id == window_id,
            CompetencyReflection.school_id == current_user.school_id,
        )
    )

    if class_name:
        query = query.where(User.class_name == class_name)

    query = query.order_by(User.name, CompetencyReflection.updated_at.desc())

    results = db.execute(query).all()

    # Get goal texts
    goal_map = {}
    if results:
        goal_ids = [r[0].goal_id for r in results if r[0].goal_id]
        if goal_ids:
            goals = (
                db.execute(
                    select(CompetencyGoal).where(CompetencyGoal.id.in_(goal_ids))
                )
                .scalars()
                .all()
            )
            goal_map = {g.id: g.goal_text for g in goals}

    items = []
    for reflection, user in results:
        items.append(
            TeacherReflectionItem(
                id=reflection.id,
                user_id=user.id,
                user_name=user.name,
                class_name=user.class_name,
                text=reflection.text,
                goal_id=reflection.goal_id,
                goal_text=(
                    goal_map.get(reflection.goal_id) if reflection.goal_id else None
                ),
                goal_achieved=reflection.goal_achieved,
                evidence=reflection.evidence,
                submitted_at=reflection.submitted_at,
                updated_at=reflection.updated_at,
            )
        )

    return TeacherReflectionsList(
        window_id=window_id,
        window_title=window.title,
        items=items,
    )
