"""
ProjectPlan (GO/NO-GO) API endpoints
"""

from __future__ import annotations
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, func, or_

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    User,
    ProjectPlan,
    ProjectPlanSection,
    Project,
    ProjectTeam,
    ProjectTeamMember,
)
from app.api.v1.schemas.projectplans import (
    ProjectPlanCreate,
    ProjectPlanUpdate,
    ProjectPlanOut,
    ProjectPlanListItem,
    ProjectPlanListOut,
    ProjectPlanSectionUpdate,
    ProjectPlanSectionOut,
    TeacherSectionReview,
    TeacherGlobalReview,
    ProjectPlanSubmit,
)
from app.core.rbac import require_role, can_access_course
from app.core.audit import log_action

# Define required sections for GO decision
REQUIRED_SECTIONS = ["client", "problem", "goal", "method", "planning"]

# Create separate routers for teacher and student endpoints
teacher_router = APIRouter(prefix="/teacher/projectplans", tags=["projectplans-teacher"])
student_router = APIRouter(prefix="/me/projectplans", tags=["projectplans-student"])


# ============ Helper Functions ============


def _get_plan_with_access_check(
    db: Session, plan_id: int, user: User, require_teacher: bool = False
) -> ProjectPlan:
    """
    Get a project plan and verify access.
    - Teachers: must have access to the project's course
    - Students: must be a team member of the project
    
    Raises HTTPException(404) if not found or no access.
    """
    plan = (
        db.query(ProjectPlan)
        .options(joinedload(ProjectPlan.sections))
        .filter(
            ProjectPlan.id == plan_id,
            ProjectPlan.school_id == user.school_id,
        )
        .first()
    )
    
    if not plan:
        raise HTTPException(status_code=404, detail="Project plan not found")
    
    # Get the project
    project = db.query(Project).filter(Project.id == plan.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check access based on role
    if require_teacher or user.role in ["teacher", "admin"]:
        require_role(user, ["teacher", "admin"])
        # Check course access
        if project.course_id and not can_access_course(db, user, project.course_id):
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this project's course"
            )
    else:
        # Student: check team membership
        is_member = (
            db.query(ProjectTeamMember)
            .join(ProjectTeam)
            .filter(
                ProjectTeam.project_id == project.id,
                ProjectTeamMember.user_id == user.id,
                ProjectTeamMember.school_id == user.school_id,
            )
            .first()
        )
        if not is_member:
            raise HTTPException(
                status_code=403,
                detail="You are not a member of this project"
            )
    
    return plan


def _check_student_project_access(db: Session, project_id: int, user: User) -> Project:
    """
    Check if student has access to a project via team membership.
    Returns the project if access is granted.
    """
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.school_id == user.school_id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check team membership
    is_member = (
        db.query(ProjectTeamMember)
        .join(ProjectTeam)
        .filter(
            ProjectTeam.project_id == project.id,
            ProjectTeamMember.user_id == user.id,
            ProjectTeamMember.school_id == user.school_id,
        )
        .first()
    )
    if not is_member:
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this project"
        )
    
    return project


def _is_section_filled(section: ProjectPlanSection) -> bool:
    """Check if a section is filled (has content)"""
    if section.key == "client":
        return bool(
            section.client_organisation
            and section.client_contact
            and section.client_email
        )
    else:
        return bool(section.text and section.text.strip())


def _calculate_required_complete(sections: List[ProjectPlanSection]) -> tuple[int, int]:
    """Calculate how many required sections are completed"""
    complete = 0
    total = len(REQUIRED_SECTIONS)
    
    for section in sections:
        if section.key in REQUIRED_SECTIONS:
            if section.status in ["submitted", "approved"]:
                complete += 1
    
    return complete, total


# ============ TEACHER ENDPOINTS ============


@teacher_router.get("", response_model=ProjectPlanListOut)
def list_projectplans(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    course_id: Optional[int] = None,
):
    """
    List all project plans with filtering and enriched data.
    Only plans from projects the teacher can access.
    """
    require_role(user, ["teacher", "admin"])
    
    # Base query - filter by school
    query = (
        db.query(ProjectPlan)
        .join(Project, ProjectPlan.project_id == Project.id)
        .filter(ProjectPlan.school_id == user.school_id)
    )
    
    # Teacher access: filter by accessible courses
    if user.role == "teacher":
        # Get accessible courses
        from app.core.rbac import get_accessible_course_ids
        accessible_courses = get_accessible_course_ids(db, user)
        if not accessible_courses:
            return ProjectPlanListOut(items=[], total=0, page=page, per_page=per_page)
        query = query.filter(
            (Project.course_id.in_(accessible_courses)) | (Project.course_id.is_(None))
        )
    
    # Filter by course
    if course_id:
        query = query.filter(Project.course_id == course_id)
    
    # Filter by status
    if status_filter:
        query = query.filter(ProjectPlan.status == status_filter)
    
    # Search filter (project title, team members)
    if search:
        search_filter = Project.title.ilike(f"%{search}%")
        query = query.filter(search_filter)
    
    # Count total
    total = query.count()
    
    # Apply pagination
    query = query.order_by(ProjectPlan.updated_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    
    # Get plans
    plans = query.all()
    
    # Build list items with enriched data
    items = []
    for plan in plans:
        project = db.query(Project).filter(Project.id == plan.project_id).first()
        
        # Get team info
        team = (
            db.query(ProjectTeam)
            .filter(ProjectTeam.project_id == plan.project_id)
            .first()
        )
        team_number = team.team_number if team else None
        
        # Get team member names
        team_members = []
        if team:
            members = (
                db.query(ProjectTeamMember)
                .join(User)
                .filter(ProjectTeamMember.project_team_id == team.id)
                .all()
            )
            team_members = [m.user.name for m in members]
        
        # Calculate required completion
        sections = (
            db.query(ProjectPlanSection)
            .filter(ProjectPlanSection.project_plan_id == plan.id)
            .all()
        )
        required_complete, required_total = _calculate_required_complete(sections)
        
        # Get course info
        from app.infra.db.models import Course
        course_id = project.course_id if project else None
        course_name = None
        if course_id:
            course = db.query(Course).filter(Course.id == course_id).first()
            if course:
                course_name = course.name
        
        items.append(
            ProjectPlanListItem(
                id=plan.id,
                project_id=plan.project_id,
                title=plan.title,
                status=plan.status,
                locked=plan.locked,
                updated_at=plan.updated_at,
                project_title=project.title if project else "",
                course_id=course_id,
                course_name=course_name,
                team_number=team_number,
                team_members=team_members,
                required_complete=required_complete,
                required_total=required_total,
                total_sections=len(sections),
            )
        )
    
    return ProjectPlanListOut(items=items, total=total, page=page, per_page=per_page)


@teacher_router.post("", response_model=ProjectPlanOut, status_code=status.HTTP_201_CREATED)
def create_projectplan(
    payload: ProjectPlanCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Create a new project plan for a project.
    Teacher must have access to the project's course.
    """
    require_role(user, ["teacher", "admin"])
    
    # Get the project and verify access
    project = db.query(Project).filter(Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if teacher has access to this project's course
    if user.role == "teacher" and project.course_id:
        from app.core.rbac import get_accessible_course_ids
        accessible_courses = get_accessible_course_ids(db, user)
        if project.course_id not in accessible_courses:
            raise HTTPException(status_code=403, detail="No access to this project's course")
    
    # Check if a plan already exists for this project
    existing_plan = (
        db.query(ProjectPlan)
        .filter(
            ProjectPlan.project_id == payload.project_id,
            ProjectPlan.school_id == user.school_id,
        )
        .first()
    )
    if existing_plan:
        raise HTTPException(
            status_code=400,
            detail="A project plan already exists for this project"
        )
    
    # Create the project plan
    project_plan = ProjectPlan(
        school_id=user.school_id,
        project_id=payload.project_id,
        title=payload.title,
        status="concept",
        locked=False,
    )
    db.add(project_plan)
    db.flush()  # Get project_plan.id
    
    # Define section metadata
    section_keys = [
        "client",
        "problem",
        "goal",
        "method",
        "planning",
        "tasks",
        "motivation",
        "risks",
    ]
    
    # Create empty sections
    for key in section_keys:
        section = ProjectPlanSection(
            school_id=user.school_id,
            project_plan_id=project_plan.id,
            key=key,
            status="empty",
        )
        db.add(section)
    
    db.commit()
    db.refresh(project_plan)
    
    # Log the action
    log_action(
        db=db,
        user_id=user.id,
        action="create_projectplan",
        resource_type="projectplan",
        resource_id=project_plan.id,
        details={"project_id": payload.project_id, "title": payload.title},
    )
    
    # Return with sections loaded
    plan = (
        db.query(ProjectPlan)
        .options(joinedload(ProjectPlan.sections))
        .filter(ProjectPlan.id == project_plan.id)
        .first()
    )
    
    return ProjectPlanOut.model_validate(plan)


@teacher_router.get("/{plan_id}", response_model=ProjectPlanOut)
def get_projectplan(
    plan_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get a single project plan with all sections.
    Teacher must have access to the project's course.
    """
    plan = _get_plan_with_access_check(db, plan_id, user, require_teacher=True)
    return ProjectPlanOut.model_validate(plan)


@teacher_router.patch("/{plan_id}", response_model=ProjectPlanOut)
def update_projectplan(
    plan_id: int,
    payload: TeacherGlobalReview,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Update project plan - GO/NO-GO decision, global note, lock/unlock.
    
    Business logic:
    - When status = "go": set locked=True, mark submitted sections as approved
    - When status = "no-go": set locked=False
    """
    plan = _get_plan_with_access_check(db, plan_id, user, require_teacher=True)
    
    # Update status
    old_status = plan.status
    plan.status = payload.status
    
    # Update global note if provided
    if payload.global_teacher_note is not None:
        plan.global_teacher_note = payload.global_teacher_note
    
    # Handle lock based on status
    if payload.status == "go":
        plan.locked = True
        # Mark all submitted sections as approved (if not already revision)
        for section in plan.sections:
            if section.status == "submitted":
                section.status = "approved"
    elif payload.status == "no-go":
        plan.locked = False
    
    # If locked is explicitly provided, use it
    if payload.locked is not None:
        plan.locked = payload.locked
    
    db.commit()
    db.refresh(plan)
    
    # Audit log
    log_action(
        db,
        user,
        "update_projectplan_status",
        "projectplan",
        plan.id,
        details={
            "old_status": old_status,
            "new_status": plan.status,
            "locked": plan.locked,
        },
    )
    
    return ProjectPlanOut.model_validate(plan)


@teacher_router.patch("/{plan_id}/sections/{section_key}", response_model=ProjectPlanSectionOut)
def update_projectplan_section_teacher(
    plan_id: int,
    section_key: str,
    payload: ProjectPlanSectionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Update a section - teacher feedback and status.
    
    Validation:
    - If status="revision", teacher_note must be non-empty
    """
    plan = _get_plan_with_access_check(db, plan_id, user, require_teacher=True)
    
    # Find the section
    section = (
        db.query(ProjectPlanSection)
        .filter(
            ProjectPlanSection.project_plan_id == plan.id,
            ProjectPlanSection.key == section_key,
        )
        .first()
    )
    
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    # Validate revision requires note
    if payload.status == "revision" and not payload.teacher_note:
        raise HTTPException(
            status_code=400,
            detail="Teacher note is required when setting status to 'revision'"
        )
    
    # Update fields
    if payload.status is not None:
        section.status = payload.status
    
    if payload.teacher_note is not None:
        section.teacher_note = payload.teacher_note
    
    db.commit()
    db.refresh(section)
    
    # Audit log
    log_action(
        db,
        user,
        "update_projectplan_section_feedback",
        "projectplan_section",
        section.id,
        details={"section_key": section_key, "status": section.status},
    )
    
    return ProjectPlanSectionOut.model_validate(section)


# ============ STUDENT ENDPOINTS ============


@student_router.get("", response_model=List[ProjectPlanListItem])
def list_student_projectplans(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    List all project plans for the current student.
    Returns plans for projects where the student is a team member.
    """
    # Get all projects where the user is a team member
    student_teams = (
        db.query(ProjectTeamMember)
        .filter(ProjectTeamMember.user_id == user.id)
        .all()
    )
    
    if not student_teams:
        return []
    
    # Get project IDs from teams
    project_team_ids = [tm.project_team_id for tm in student_teams]
    
    # Get projects from those teams
    project_teams = (
        db.query(ProjectTeam)
        .filter(ProjectTeam.id.in_(project_team_ids))
        .all()
    )
    
    project_ids = [pt.project_id for pt in project_teams]
    
    if not project_ids:
        return []
    
    # Get project plans for those projects
    plans = (
        db.query(ProjectPlan)
        .join(Project, ProjectPlan.project_id == Project.id)
        .filter(
            ProjectPlan.project_id.in_(project_ids),
            ProjectPlan.school_id == user.school_id,
        )
        .order_by(ProjectPlan.updated_at.desc())
        .all()
    )
    
    # Build list items with enriched data
    items = []
    for plan in plans:
        project = db.query(Project).filter(Project.id == plan.project_id).first()
        
        # Get team info for this project
        team = (
            db.query(ProjectTeam)
            .filter(ProjectTeam.project_id == plan.project_id)
            .first()
        )
        team_number = team.team_number if team else None
        
        # Get team member names
        team_members = []
        if team:
            members = (
                db.query(ProjectTeamMember)
                .join(User)
                .filter(ProjectTeamMember.project_team_id == team.id)
                .all()
            )
            team_members = [m.user.name for m in members]
        
        # Calculate required completion
        sections = (
            db.query(ProjectPlanSection)
            .filter(ProjectPlanSection.project_plan_id == plan.id)
            .all()
        )
        required_complete, required_total = _calculate_required_complete(sections)
        
        # Get course info
        from app.infra.db.models import Course
        course_id = project.course_id if project else None
        course_name = None
        if course_id:
            course = db.query(Course).filter(Course.id == course_id).first()
            if course:
                course_name = course.name
        
        items.append(
            ProjectPlanListItem(
                id=plan.id,
                project_id=plan.project_id,
                title=plan.title,
                status=plan.status,
                locked=plan.locked,
                updated_at=plan.updated_at,
                project_title=project.title if project else "",
                course_id=course_id,
                course_name=course_name,
                team_number=team_number,
                team_members=team_members,
                required_complete=required_complete,
                required_total=required_total,
                total_sections=len(sections),
            )
        )
    
    return items


@student_router.get("/{project_id}", response_model=ProjectPlanOut)
def get_projectplan_by_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get project plan by project_id for current student.
    Student must be a member of the project's team.
    """
    # Check project access
    project = _check_student_project_access(db, project_id, user)
    
    # Get the plan
    plan = (
        db.query(ProjectPlan)
        .options(joinedload(ProjectPlan.sections))
        .filter(
            ProjectPlan.project_id == project_id,
            ProjectPlan.school_id == user.school_id,
        )
        .first()
    )
    
    if not plan:
        raise HTTPException(status_code=404, detail="Project plan not found")
    
    return ProjectPlanOut.model_validate(plan)


@student_router.patch("/{plan_id}", response_model=ProjectPlanOut)
def update_projectplan_student(
    plan_id: int,
    payload: ProjectPlanUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Update project plan title only (student).
    Cannot update if locked=True.
    """
    plan = _get_plan_with_access_check(db, plan_id, user, require_teacher=False)
    
    # Check if locked
    if plan.locked:
        raise HTTPException(
            status_code=400,
            detail="Cannot update plan - it is locked"
        )
    
    # Only allow updating title
    if payload.title is not None:
        plan.title = payload.title
    
    db.commit()
    db.refresh(plan)
    
    return ProjectPlanOut.model_validate(plan)


@student_router.patch("/{plan_id}/sections/{section_key}", response_model=ProjectPlanSectionOut)
def update_projectplan_section_student(
    plan_id: int,
    section_key: str,
    payload: ProjectPlanSectionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Update section content (text or client fields).
    Cannot update if locked=True.
    Sets status to "draft" automatically when editing.
    """
    plan = _get_plan_with_access_check(db, plan_id, user, require_teacher=False)
    
    # Check if locked
    if plan.locked:
        raise HTTPException(
            status_code=400,
            detail="Cannot update section - plan is locked"
        )
    
    # Find the section
    section = (
        db.query(ProjectPlanSection)
        .filter(
            ProjectPlanSection.project_plan_id == plan.id,
            ProjectPlanSection.key == section_key,
        )
        .first()
    )
    
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    # Update content fields only (not teacher feedback)
    if payload.text is not None:
        section.text = payload.text
    
    if payload.client_organisation is not None:
        section.client_organisation = payload.client_organisation
    
    if payload.client_contact is not None:
        section.client_contact = payload.client_contact
    
    if payload.client_email is not None:
        section.client_email = payload.client_email
    
    if payload.client_phone is not None:
        section.client_phone = payload.client_phone
    
    if payload.client_description is not None:
        section.client_description = payload.client_description
    
    # Update status: respect payload.status if provided, otherwise set to draft if content changed
    if payload.status is not None:
        section.status = payload.status
    else:
        # Auto-set to draft when editing from empty state
        if section.status == "empty":
            section.status = "draft"
    
    db.commit()
    db.refresh(section)
    
    return ProjectPlanSectionOut.model_validate(section)


@student_router.post("/{plan_id}/submit", response_model=ProjectPlanOut)
def submit_projectplan(
    plan_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Submit project plan for review.
    
    Validation:
    - All required sections must be filled
    - Client section: organisation, contact, email must be non-empty
    - Other required sections: text must be non-empty
    
    Actions:
    - Set plan status = "ingediend"
    - For required sections: if filled and status is draft/empty, mark as "submitted"
    """
    plan = _get_plan_with_access_check(db, plan_id, user, require_teacher=False)
    
    # Check if locked
    if plan.locked:
        raise HTTPException(
            status_code=400,
            detail="Cannot submit plan - it is locked"
        )
    
    # Get all sections
    sections = (
        db.query(ProjectPlanSection)
        .filter(ProjectPlanSection.project_plan_id == plan.id)
        .all()
    )
    
    # Create a dict for easy lookup
    sections_dict = {s.key: s for s in sections}
    
    # Validate all required sections are filled
    missing_sections = []
    for req_key in REQUIRED_SECTIONS:
        section = sections_dict.get(req_key)
        if not section or not _is_section_filled(section):
            missing_sections.append(req_key)
    
    if missing_sections:
        raise HTTPException(
            status_code=400,
            detail=f"Required sections not filled: {', '.join(missing_sections)}"
        )
    
    # Mark required sections as submitted (if they are draft/empty and filled)
    for req_key in REQUIRED_SECTIONS:
        section = sections_dict.get(req_key)
        if section and _is_section_filled(section):
            if section.status in ["draft", "empty"]:
                section.status = "submitted"
    
    # Set plan status to ingediend
    plan.status = "ingediend"
    
    db.commit()
    db.refresh(plan)
    
    # Audit log
    log_action(
        db,
        user,
        "submit_projectplan",
        "projectplan",
        plan.id,
        details={"status": "ingediend"},
    )
    
    return ProjectPlanOut.model_validate(plan)


# Combine routers
router = APIRouter()
router.include_router(teacher_router)
router.include_router(student_router)
