"""
Projects API endpoints
"""

from __future__ import annotations
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    User,
    Project,
    ProjectNotesContext,
    Evaluation,
    ClientProjectLink,
    Client,
    Rubric,
    Group,
    ProjectAssessment,
    CompetencyWindow,
    Competency,
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
    WizardEntityOut,
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
    Create a project with linked evaluations, project assessments, competency windows, notes, and clients via wizard.
    
    Now creates proper entity types:
    - Peer evaluations -> Evaluation records with evaluation_type="peer"
    - Project assessments -> ProjectAssessment records (one per group)
    - Competency scans -> CompetencyWindow records
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

    # Track warnings for edge cases
    warnings: List[str] = []
    
    # Track all created entities
    created_entities: List[WizardEntityOut] = []

    # 2. Create peer evaluations (still use Evaluation records)
    def get_default_rubric(scope: str) -> Optional[Rubric]:
        return (
            db.query(Rubric)
            .filter(Rubric.school_id == user.school_id, Rubric.scope == scope)
            .first()
        )

    # Process peer_tussen
    if payload.evaluations.peer_tussen and payload.evaluations.peer_tussen.enabled:
        peer_config = payload.evaluations.peer_tussen
        peer_rubric_id = peer_config.rubric_id or (get_default_rubric("peer").id if get_default_rubric("peer") else None)
        
        if peer_rubric_id:
            title_suffix = peer_config.title_suffix or "tussentijds"
            eval_tussen = Evaluation(
                school_id=user.school_id,
                course_id=project.course_id,
                project_id=project.id,
                rubric_id=peer_rubric_id,
                title=f"{project.title} – Peerevaluatie ({title_suffix})",
                evaluation_type="peer",
                status="draft",
                settings={"deadline": peer_config.deadline.isoformat() if peer_config.deadline else None},
            )
            db.add(eval_tussen)
            db.flush()
            
            created_entities.append(WizardEntityOut(
                type="peer",
                data={
                    "id": eval_tussen.id,
                    "title": eval_tussen.title,
                    "evaluation_type": eval_tussen.evaluation_type,
                    "status": eval_tussen.status,
                    "deadline": peer_config.deadline.isoformat() if peer_config.deadline else None,
                }
            ))
        else:
            warnings.append("No peer rubric found for peer_tussen evaluation")

    # Process peer_eind
    if payload.evaluations.peer_eind and payload.evaluations.peer_eind.enabled:
        peer_config = payload.evaluations.peer_eind
        peer_rubric_id = peer_config.rubric_id or (get_default_rubric("peer").id if get_default_rubric("peer") else None)
        
        if peer_rubric_id:
            title_suffix = peer_config.title_suffix or "eind"
            eval_eind = Evaluation(
                school_id=user.school_id,
                course_id=project.course_id,
                project_id=project.id,
                rubric_id=peer_rubric_id,
                title=f"{project.title} – Peerevaluatie ({title_suffix})",
                evaluation_type="peer",
                status="draft",
                settings={"deadline": peer_config.deadline.isoformat() if peer_config.deadline else None},
            )
            db.add(eval_eind)
            db.flush()
            
            created_entities.append(WizardEntityOut(
                type="peer",
                data={
                    "id": eval_eind.id,
                    "title": eval_eind.title,
                    "evaluation_type": eval_eind.evaluation_type,
                    "status": eval_eind.status,
                    "deadline": peer_config.deadline.isoformat() if peer_config.deadline else None,
                }
            ))
        else:
            warnings.append("No peer rubric found for peer_eind evaluation")

    # 3. Create project assessments (now creates ProjectAssessment records, one per group)
    if payload.evaluations.project_assessment and payload.evaluations.project_assessment.enabled:
        pa_config = payload.evaluations.project_assessment
        
        if not project.course_id:
            warnings.append("Project assessment requires a course_id but none was provided")
        else:
            # Get all groups for this course
            groups = db.query(Group).filter(
                Group.school_id == user.school_id,
                Group.course_id == project.course_id
            ).all()
            
            if not groups:
                # Edge case: course has no groups
                warnings.append(
                    f"Course {project.course_id} has no groups. "
                    "Please create groups before creating project assessments, "
                    "or create them manually after wizard completion."
                )
            else:
                # Create one ProjectAssessment per group
                for group in groups:
                    assessment = ProjectAssessment(
                        school_id=user.school_id,
                        group_id=group.id,
                        teacher_id=user.id,
                        rubric_id=pa_config.rubric_id,
                        title=f"{project.title} – {group.name}",
                        version=pa_config.version,
                        status="draft",
                        metadata_json={
                            "project_id": project.id,
                            "deadline": pa_config.deadline.isoformat() if pa_config.deadline else None,
                        }
                    )
                    db.add(assessment)
                    db.flush()
                    
                    created_entities.append(WizardEntityOut(
                        type="project_assessment",
                        data={
                            "id": assessment.id,
                            "title": assessment.title,
                            "group_id": assessment.group_id,
                            "group_name": group.name,
                            "rubric_id": assessment.rubric_id,
                            "version": assessment.version,
                            "status": assessment.status,
                            "deadline": pa_config.deadline.isoformat() if pa_config.deadline else None,
                        }
                    ))

    # 4. Create competency window (now creates CompetencyWindow records)
    if payload.evaluations.competency_scan and payload.evaluations.competency_scan.enabled:
        cs_config = payload.evaluations.competency_scan
        
        # Validate competencies exist
        if cs_config.competency_ids:
            valid_competencies = db.query(Competency).filter(
                Competency.school_id == user.school_id,
                Competency.id.in_(cs_config.competency_ids)
            ).all()
            valid_competency_ids = [c.id for c in valid_competencies]
            
            if len(valid_competency_ids) != len(cs_config.competency_ids):
                warnings.append("Some competency IDs were invalid and were skipped")
        else:
            valid_competency_ids = []
            warnings.append("No competencies selected for competency scan")
        
        # Create CompetencyWindow
        title = cs_config.title or f"{project.title} – Competentiescan"
        window = CompetencyWindow(
            school_id=user.school_id,
            title=title,
            description=f"Competency scan for project: {project.title}",
            class_names=[project.class_name] if project.class_name else [],
            course_id=project.course_id,
            start_date=cs_config.start_date,
            end_date=cs_config.end_date,
            status="draft",
            settings={
                "project_id": project.id,
                "competency_ids": valid_competency_ids,
                "deadline": (cs_config.deadline or cs_config.end_date).isoformat() if (cs_config.deadline or cs_config.end_date) else None,
            }
        )
        db.add(window)
        db.flush()
        
        created_entities.append(WizardEntityOut(
            type="competency_scan",
            data={
                "id": window.id,
                "title": window.title,
                "start_date": cs_config.start_date.isoformat() if cs_config.start_date else None,
                "end_date": cs_config.end_date.isoformat() if cs_config.end_date else None,
                "deadline": (cs_config.deadline or cs_config.end_date).isoformat() if (cs_config.deadline or cs_config.end_date) else None,
                "status": window.status,
                "competency_ids": valid_competency_ids,
            }
        ))

    # 5. Create project notes context if requested
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

    # 6. Link clients if provided
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
            "entities_count": len(created_entities),
            "clients_count": len(linked_clients),
            "has_note": note_context is not None,
            "warnings": warnings,
        },
        request=request,
    )

    # Prepare note output
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
        entities=created_entities,
        note=note_output,
        linked_clients=linked_clients,
        warnings=warnings,
    )
