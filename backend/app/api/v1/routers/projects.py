"""
Projects API endpoints
"""

from __future__ import annotations
from typing import Optional, List, Dict
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc
from datetime import datetime

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    User,
    Project,
    ProjectNotesContext,
    Evaluation,
    ClientProjectLink,
    Client,
    Course,
    Rubric,
)
from app.api.v1.schemas.projects import (
    ProjectCreate,
    ProjectUpdate,
    ProjectOut,
    ProjectListItem,
    ProjectListOut,
    ProjectDetailOut,
    WizardProjectCreate,
    WizardProjectOut,
    WizardEvaluationOut,
    ProjectNoteOut,
)
from app.core.rbac import (
    require_role,
    scope_query_by_school,
    can_access_course,
    get_accessible_course_ids,
)
from app.core.audit import log_action

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=ProjectListOut)
def list_projects(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    course_id: Optional[int] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
):
    """
    List all projects for the current school.
    Teachers only see projects for courses they have access to.
    """
    require_role(user, ["admin", "teacher"])

    # Base query - filter by school
    query = scope_query_by_school(db.query(Project), Project, user)

    # Filter by course
    if course_id:
        if not can_access_course(db, user, course_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this course",
            )
        query = query.filter(Project.course_id == course_id)
    elif user.role == "teacher":
        # Teacher: only show projects for courses they can access
        accessible_courses = get_accessible_course_ids(db, user)
        if not accessible_courses:
            # Teacher has no course access
            return ProjectListOut(items=[], total=0, page=page, per_page=per_page)
        query = query.filter(
            (Project.course_id.in_(accessible_courses)) | (Project.course_id.is_(None))
        )

    # Filter by status
    if status:
        query = query.filter(Project.status == status)

    # Search filter
    if search:
        search_filter = or_(
            Project.title.ilike(f"%{search}%"),
            Project.description.ilike(f"%{search}%"),
            Project.class_name.ilike(f"%{search}%"),
        )
        query = query.filter(search_filter)

    # Count total before pagination
    total = query.count()

    # Apply pagination and ordering
    query = query.order_by(desc(Project.created_at))
    query = query.offset((page - 1) * per_page).limit(per_page)

    # Get projects
    projects = query.all()

    items = [
        ProjectListItem(
            id=p.id,
            title=p.title,
            course_id=p.course_id,
            class_name=p.class_name,
            start_date=p.start_date,
            end_date=p.end_date,
            status=p.status,
            created_at=p.created_at,
        )
        for p in projects
    ]

    return ProjectListOut(items=items, total=total, page=page, per_page=per_page)


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Create a new project
    """
    require_role(user, ["admin", "teacher"])

    # Validate course access if course_id provided
    if payload.course_id:
        if not can_access_course(db, user, payload.course_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this course",
            )

    # Create project
    project = Project(
        school_id=user.school_id,
        course_id=payload.course_id,
        title=payload.title,
        slug=payload.slug,
        description=payload.description,
        class_name=payload.class_name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status=payload.status,
        created_by_id=user.id,
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    # Audit log
    log_action(
        db=db,
        user=user,
        action="create_project",
        entity_type="project",
        entity_id=project.id,
        details={"title": project.title},
        request=request,
    )

    return project


@router.get("/{project_id}", response_model=ProjectDetailOut)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get project details with aggregated information
    """
    require_role(user, ["admin", "teacher"])

    # Get project
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.school_id == user.school_id)
        .first()
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Check course access
    if project.course_id and not can_access_course(db, user, project.course_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this project",
        )

    # Get evaluation counts by type
    eval_counts = (
        db.query(
            Evaluation.evaluation_type, func.count(Evaluation.id).label("count")
        )
        .filter(Evaluation.project_id == project_id)
        .group_by(Evaluation.evaluation_type)
        .all()
    )
    evaluation_counts = {eval_type: count for eval_type, count in eval_counts}

    # Get note count
    note_count = (
        db.query(func.count(ProjectNotesContext.id))
        .filter(ProjectNotesContext.project_id == project_id)
        .scalar()
        or 0
    )

    # Get client count
    client_count = (
        db.query(func.count(ClientProjectLink.id))
        .filter(ClientProjectLink.project_id == project_id)
        .scalar()
        or 0
    )

    return ProjectDetailOut(
        id=project.id,
        school_id=project.school_id,
        course_id=project.course_id,
        title=project.title,
        slug=project.slug,
        description=project.description,
        class_name=project.class_name,
        start_date=project.start_date,
        end_date=project.end_date,
        status=project.status,
        created_by_id=project.created_by_id,
        created_at=project.created_at,
        updated_at=project.updated_at,
        evaluation_counts=evaluation_counts,
        note_count=note_count,
        client_count=client_count,
    )


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Update project details
    """
    require_role(user, ["admin", "teacher"])

    # Get project
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.school_id == user.school_id)
        .first()
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Check course access for existing project
    if project.course_id and not can_access_course(db, user, project.course_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this project",
        )

    # Validate new course access if changing course
    if payload.course_id is not None and payload.course_id != project.course_id:
        if not can_access_course(db, user, payload.course_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to the new course",
            )

    # Update fields
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    db.commit()
    db.refresh(project)

    # Audit log
    log_action(
        db=db,
        user=user,
        action="update_project",
        entity_type="project",
        entity_id=project.id,
        details=update_data,
        request=request,
    )

    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Delete (archive) a project
    """
    require_role(user, ["admin", "teacher"])

    # Get project
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.school_id == user.school_id)
        .first()
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Check course access
    if project.course_id and not can_access_course(db, user, project.course_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this project",
        )

    # Soft delete by marking as archived
    project.status = "archived"
    db.commit()

    # Audit log
    log_action(
        db=db,
        user=user,
        action="delete_project",
        entity_type="project",
        entity_id=project.id,
        details={"title": project.title},
        request=request,
    )

    return None


@router.get("/{project_id}/notes")
def get_project_notes(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get all notes for a project
    """
    require_role(user, ["admin", "teacher"])

    # Get project and verify access
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.school_id == user.school_id)
        .first()
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    if project.course_id and not can_access_course(db, user, project.course_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this project",
        )

    # Get notes contexts for this project
    notes_contexts = (
        db.query(ProjectNotesContext)
        .filter(ProjectNotesContext.project_id == project_id)
        .all()
    )

    return notes_contexts


@router.post("/wizard-create", response_model=WizardProjectOut, status_code=status.HTTP_201_CREATED)
def wizard_create_project(
    payload: WizardProjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Create a project with linked evaluations, notes, and clients via wizard
    """
    require_role(user, ["admin", "teacher"])

    # Validate course access
    if payload.project.course_id:
        if not can_access_course(db, user, payload.project.course_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this course",
            )

    # 1. Create the project
    project = Project(
        school_id=user.school_id,
        course_id=payload.project.course_id,
        title=payload.project.title,
        slug=payload.project.slug,
        description=payload.project.description,
        class_name=payload.project.class_name,
        start_date=payload.project.start_date,
        end_date=payload.project.end_date,
        status=payload.project.status,
        created_by_id=user.id,
    )
    db.add(project)
    db.flush()  # Get project.id without committing

    created_evaluations: List[Evaluation] = []

    # 2. Create evaluations based on configuration
    # First, get default rubrics for each type
    def get_default_rubric(scope: str) -> Optional[Rubric]:
        return (
            db.query(Rubric)
            .filter(Rubric.school_id == user.school_id, Rubric.scope == scope)
            .first()
        )

    peer_rubric = get_default_rubric("peer")
    project_rubric = get_default_rubric("project")

    if payload.evaluations.create_peer_tussen and peer_rubric:
        eval_tussen = Evaluation(
            school_id=user.school_id,
            course_id=project.course_id,
            project_id=project.id,
            rubric_id=peer_rubric.id,
            title=f"{project.title} – Peerevaluatie (tussentijds)",
            evaluation_type="peer",
            status="draft",
            settings={},
        )
        db.add(eval_tussen)
        created_evaluations.append(eval_tussen)

    if payload.evaluations.create_peer_eind and peer_rubric:
        eval_eind = Evaluation(
            school_id=user.school_id,
            course_id=project.course_id,
            project_id=project.id,
            rubric_id=peer_rubric.id,
            title=f"{project.title} – Peerevaluatie (eind)",
            evaluation_type="peer",
            status="draft",
            settings={},
        )
        db.add(eval_eind)
        created_evaluations.append(eval_eind)

    if payload.evaluations.create_project_assessment and project_rubric:
        eval_project = Evaluation(
            school_id=user.school_id,
            course_id=project.course_id,
            project_id=project.id,
            rubric_id=project_rubric.id,
            title=f"{project.title} – Projectbeoordeling",
            evaluation_type="project",
            status="draft",
            settings={},
        )
        db.add(eval_project)
        created_evaluations.append(eval_project)

    if payload.evaluations.create_competency_scan:
        # For competency scan, we might use a different rubric or handle differently
        # For now, using peer rubric as fallback
        if peer_rubric:
            eval_competency = Evaluation(
                school_id=user.school_id,
                course_id=project.course_id,
                project_id=project.id,
                rubric_id=peer_rubric.id,
                title=f"{project.title} – Competentiescan",
                evaluation_type="competency",
                status="draft",
                settings={},
            )
            db.add(eval_competency)
            created_evaluations.append(eval_competency)

    # 3. Create project notes context if requested
    note_context = None
    if payload.create_default_note:
        note_context = ProjectNotesContext(
            school_id=user.school_id,
            project_id=project.id,
            course_id=project.course_id,
            class_name=project.class_name,
            title=f"Projectaantekeningen – {project.title}",
            description="Standaard projectaantekeningen voor dit project",
            created_by=user.id,
            settings={},
        )
        db.add(note_context)

    # 4. Link clients if provided
    linked_clients = []
    for idx, client_id in enumerate(payload.client_ids):
        # Verify client belongs to school
        client = (
            db.query(Client)
            .filter(Client.id == client_id, Client.school_id == user.school_id)
            .first()
        )
        if client:
            role = "main" if idx == 0 else "secondary"
            link = ClientProjectLink(
                client_id=client_id,
                project_id=project.id,
                role=role,
                start_date=project.start_date,
                end_date=project.end_date,
            )
            db.add(link)
            linked_clients.append(client_id)

    # Commit all changes
    db.commit()
    db.refresh(project)
    for evaluation in created_evaluations:
        db.refresh(evaluation)
    if note_context:
        db.refresh(note_context)

    # Audit log
    log_action(
        db=db,
        user=user,
        action="wizard_create_project",
        entity_type="project",
        entity_id=project.id,
        details={
            "title": project.title,
            "evaluations_count": len(created_evaluations),
            "clients_count": len(linked_clients),
            "has_note": note_context is not None,
        },
        request=request,
    )

    # Prepare response
    eval_outputs = [
        WizardEvaluationOut(
            id=e.id,
            title=e.title,
            evaluation_type=e.evaluation_type,
            status=e.status,
        )
        for e in created_evaluations
    ]

    note_output = None
    if note_context:
        note_output = ProjectNoteOut(
            id=note_context.id,
            school_id=note_context.school_id,
            project_id=project.id,
            author_id=user.id,
            title=note_context.title,
            body=note_context.description,
            note_type="general",
            created_at=note_context.created_at,
            updated_at=note_context.updated_at,
        )

    return WizardProjectOut(
        project=ProjectOut.model_validate(project),
        evaluations=eval_outputs,
        note=note_output,
        linked_clients=linked_clients,
    )
