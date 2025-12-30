"""
Projects API endpoints
"""

from __future__ import annotations
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc, cast, Integer

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    User,
    Project,
    Subproject,
    ProjectNotesContext,
    Evaluation,
    ClientProjectLink,
    Client,
    Rubric,
    Group,
    GroupMember,
    ProjectAssessment,
    ProjectTeam,
    CompetencyWindow,
    Competency,
    Course,
)
from app.api.v1.schemas.projects import (
    ProjectCreate,
    ProjectUpdate,
    ProjectOut,
    ProjectListItem,
    ProjectListOut,
    ProjectDetailOut,
    SubprojectCreate,
    SubprojectUpdate,
    SubprojectOut,
    SubprojectListOut,
    WizardProjectCreate,
    WizardProjectOut,
    WizardEntityOut,
    ProjectNoteOut,
    RunningProjectKPIOut,
    RunningProjectItem,
    RunningProjectsListOut,
)
from app.core.rbac import (
    require_role,
    scope_query_by_school,
    can_access_course,
    get_accessible_course_ids,
)
from app.core.audit import log_action
from app.infra.services.archive_guards import require_course_year_not_archived, require_project_year_not_archived
from app.infra.services.project_team_service import ProjectTeamService

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
            period=p.period,
            start_date=p.start_date,
            end_date=p.end_date,
            status=p.status,
            created_at=p.created_at,
        )
        for p in projects
    ]

    return ProjectListOut(items=items, total=total, page=page, per_page=per_page)


@router.get("/running-overview/kpi", response_model=RunningProjectKPIOut)
def get_running_projects_kpi(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get KPI statistics for running projects overview
    """
    require_role(user, ["admin", "teacher"])
    
    # Count running projects
    query = scope_query_by_school(db.query(Project), Project, user)
    
    # Filter for running projects: 
    # - status is "active", OR
    # - current date is between start_date and end_date (if both dates are set)
    from datetime import datetime as dt
    today = dt.utcnow().date()
    query = query.filter(
        or_(
            Project.status == "active",
            (
                (Project.start_date.isnot(None)) & 
                (Project.end_date.isnot(None)) &
                (Project.start_date <= today) & 
                (Project.end_date >= today)
            )
        )
    )
    
    # Apply teacher course access restrictions
    if user.role == "teacher":
        accessible_courses = get_accessible_course_ids(db, user)
        if not accessible_courses:
            return RunningProjectKPIOut(
                running_projects=0,
                active_clients_now=0,
                upcoming_moments=0,
            )
        query = query.filter(
            (Project.course_id.in_(accessible_courses)) | (Project.course_id.is_(None))
        )
    
    running_projects = query.count()
    
    # Get unique active clients from running projects
    active_client_ids = set()
    for project in query.all():
        client_links = (
            db.query(ClientProjectLink)
            .filter(ClientProjectLink.project_id == project.id)
            .all()
        )
        for link in client_links:
            active_client_ids.add(link.client_id)
    
    active_clients_now = len(active_client_ids)
    
    # Count upcoming moments (evaluations with future deadlines in running projects)
    from datetime import datetime, timedelta
    thirty_days_ahead = datetime.utcnow() + timedelta(days=30)
    
    running_project_ids = [p.id for p in query.all()]
    
    upcoming_moments = 0
    if running_project_ids:
        # Count evaluations with upcoming deadlines
        upcoming_evals = (
            db.query(Evaluation)
            .filter(
                Evaluation.project_id.in_(running_project_ids),
                Evaluation.settings.isnot(None),
            )
            .all()
        )
        
        for ev in upcoming_evals:
            settings = ev.settings or {}
            deadline_str = settings.get("deadline")
            if deadline_str:
                try:
                    deadline = datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
                    if deadline.replace(tzinfo=None) >= datetime.utcnow() and deadline.replace(tzinfo=None) <= thirty_days_ahead:
                        upcoming_moments += 1
                except:
                    pass
    
    return RunningProjectKPIOut(
        running_projects=running_projects,
        active_clients_now=active_clients_now,
        upcoming_moments=upcoming_moments,
    )


@router.get("/running-overview", response_model=RunningProjectsListOut)
def get_running_projects_overview(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    course_id: Optional[int] = None,
    school_year: Optional[str] = None,  # e.g., "2025-2026"
    status: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = Query(None, description="Sort field: course, project, client, next_moment"),
    sort_order: Optional[str] = Query("asc", description="Sort order: asc or desc"),
):
    """
    Get running projects overview with client, team, and moment information
    """
    require_role(user, ["admin", "teacher"])
    
    # Base query - filter by school
    query = scope_query_by_school(db.query(Project), Project, user)
    
    # Filter for running projects: 
    # - status is "active", OR
    # - current date is between start_date and end_date (if both dates are set)
    from datetime import datetime as dt
    today = dt.utcnow().date()
    query = query.filter(
        or_(
            Project.status == "active",
            (
                (Project.start_date.isnot(None)) & 
                (Project.end_date.isnot(None)) &
                (Project.start_date <= today) & 
                (Project.end_date >= today)
            )
        )
    )
    
    # Apply teacher course access restrictions
    if user.role == "teacher":
        accessible_courses = get_accessible_course_ids(db, user)
        if not accessible_courses:
            return RunningProjectsListOut(
                items=[], total=0, page=page, per_page=per_page, pages=0
            )
        query = query.filter(
            (Project.course_id.in_(accessible_courses)) | (Project.course_id.is_(None))
        )
    
    # Filter by course
    if course_id:
        if not can_access_course(db, user, course_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this course",
            )
        query = query.filter(Project.course_id == course_id)
    
    # Filter by school year
    if school_year:
        # Parse school year (e.g., "2025-2026" -> year 2025)
        try:
            year_start = int(school_year.split("–")[0]) if "–" in school_year else int(school_year.split("-")[0])
            query = query.join(Project.course).filter(func.extract("year", Project.start_date) == year_start)
        except:
            pass
    
    # Filter by status (already filtered to active, but can add more granular status filtering)
    # For now, we'll keep it simple
    
    # Search filter
    if search:
        search_filter = or_(
            Project.title.ilike(f"%{search}%"),
            Project.class_name.ilike(f"%{search}%"),
        )
        query = query.filter(search_filter)
    
    # Count total before pagination
    total = query.count()
    
    # Sorting - we'll apply after fetching for complex sorts involving joins
    projects = query.all()
    
    # Build items with all required information
    items = []
    for project in projects:
        # Get course info
        course_name = None
        if project.course_id:
            course = db.query(Course).filter(Course.id == project.course_id).first()
            course_name = course.name if course else None
        
        # Get first client (main client)
        client_link = (
            db.query(ClientProjectLink)
            .filter(ClientProjectLink.project_id == project.id)
            .order_by(desc(ClientProjectLink.role == "main"))
            .first()
        )
        
        client_id = None
        client_organization = None
        client_email = None
        if client_link:
            client = db.query(Client).filter(Client.id == client_link.client_id).first()
            if client:
                client_id = client.id
                client_organization = client.organization
                client_email = client.email
        
        # Get team/group info from course
        team_number = None
        student_names = []
        if project.course_id:
            # Get groups for this course
            groups = (
                db.query(Group)
                .filter(Group.course_id == project.course_id)
                .first()
            )
            if groups:
                team_number = groups.team_number
                # Get group members
                from app.infra.db.models import GroupMember
                members = (
                    db.query(GroupMember)
                    .filter(GroupMember.group_id == groups.id, GroupMember.active.is_(True))
                    .all()
                )
                student_names = [m.user.name for m in members if m.user]
        
        # Get next moment from evaluations
        next_moment_type = None
        next_moment_date = None
        
        evaluations = (
            db.query(Evaluation)
            .filter(Evaluation.project_id == project.id)
            .all()
        )
        
        from datetime import datetime
        upcoming_evals = []
        for ev in evaluations:
            settings = ev.settings or {}
            deadline_str = settings.get("deadline")
            if deadline_str:
                try:
                    deadline = datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
                    if deadline.replace(tzinfo=None) >= datetime.utcnow():
                        upcoming_evals.append((deadline, ev))
                except:
                    pass
        
        if upcoming_evals:
            # Sort by date and get the nearest
            upcoming_evals.sort(key=lambda x: x[0])
            nearest_deadline, nearest_eval = upcoming_evals[0]
            next_moment_date = nearest_deadline.date()
            
            # Determine type based on evaluation title or type
            if "tussen" in nearest_eval.title.lower():
                next_moment_type = "Tussenpresentatie"
            elif "eind" in nearest_eval.title.lower() or "final" in nearest_eval.title.lower():
                next_moment_type = "Eindpresentatie"
            else:
                next_moment_type = "Contactmoment"
        
        items.append(
            RunningProjectItem(
                project_id=project.id,
                project_title=project.title,
                project_status=project.status,
                course_name=course_name,
                client_id=client_id,
                client_organization=client_organization,
                client_email=client_email,
                class_name=project.class_name,
                team_number=team_number,
                student_names=student_names,
                start_date=project.start_date,
                end_date=project.end_date,
                next_moment_type=next_moment_type,
                next_moment_date=next_moment_date,
            )
        )
    
    # Apply sorting
    if sort_by:
        reverse = sort_order == "desc"
        if sort_by == "course":
            items.sort(key=lambda x: x.course_name or "", reverse=reverse)
        elif sort_by == "project":
            items.sort(key=lambda x: x.project_title, reverse=reverse)
        elif sort_by == "client":
            items.sort(key=lambda x: x.client_organization or "", reverse=reverse)
        elif sort_by == "next_moment":
            items.sort(key=lambda x: x.next_moment_date or datetime.max.date(), reverse=reverse)
    
    # Apply pagination
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    paginated_items = items[start_idx:end_idx]
    
    # Calculate pages
    pages = (total + per_page - 1) // per_page if total > 0 else 0
    
    return RunningProjectsListOut(
        items=paginated_items,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


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
        # Check if course's year is archived
        require_course_year_not_archived(db, payload.course_id)

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

    # Count project assessments linked to this project (via project_id field)
    project_assessment_count = (
        db.query(func.count(ProjectAssessment.id))
        .filter(
            ProjectAssessment.school_id == user.school_id,
            ProjectAssessment.project_id == project_id,
        )
        .scalar()
        or 0
    )
    if project_assessment_count > 0:
        evaluation_counts["project_assessment"] = project_assessment_count

    # Count competency windows linked to this project (via settings['project_id'])
    competency_scan_count = (
        db.query(func.count(CompetencyWindow.id))
        .filter(
            CompetencyWindow.school_id == user.school_id,
            cast(CompetencyWindow.settings.op('->>') ('project_id'), Integer) == project_id,
        )
        .scalar()
        or 0
    )
    if competency_scan_count > 0:
        evaluation_counts["competency_scan"] = competency_scan_count

    # Get note count
    note_count = (
        db.query(func.count(ProjectNotesContext.id))
        .filter(ProjectNotesContext.project_id == project_id)
        .scalar()
        or 0
    )

    # Get client count and first client info
    client_count = (
        db.query(func.count(ClientProjectLink.id))
        .filter(ClientProjectLink.project_id == project_id)
        .scalar()
        or 0
    )

    # Get first (main) client info with a joined query
    client_id = None
    client_organization = None
    client_email = None
    first_client_data = (
        db.query(ClientProjectLink, Client)
        .join(Client, Client.id == ClientProjectLink.client_id)
        .filter(ClientProjectLink.project_id == project_id)
        .order_by(desc(ClientProjectLink.role == "main"))
        .first()
    )
    if first_client_data:
        _, client = first_client_data
        client_id = client.id
        client_organization = client.organization
        client_email = client.email

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
        client_id=client_id,
        client_organization=client_organization,
        client_email=client_email,
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

    # Check if project's year is archived
    require_project_year_not_archived(db, project_id)

    # Validate new course access if changing course
    if payload.course_id is not None and payload.course_id != project.course_id:
        if not can_access_course(db, user, payload.course_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to the new course",
            )
        # Check if new course's year is archived
        if payload.course_id:
            require_course_year_not_archived(db, payload.course_id)

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
    Delete a project and all related data (evaluations, assessments, notes, etc.)
    This is a hard delete with cascading deletion of related records.
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
    
    # Check if project's year is archived
    require_project_year_not_archived(db, project_id)

    # Audit log before deletion
    log_action(
        db=db,
        user=user,
        action="delete_project",
        entity_type="project",
        entity_id=project.id,
        details={"title": project.title},
        request=request,
    )

    # Hard delete - cascade will handle related records
    # This will delete: evaluations, project_assessments, subprojects, project_notes, etc.
    db.delete(project)
    db.commit()

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
    # Helper function to create project assessments for a given config
    def create_project_assessments(pa_config: ProjectAssessmentConfig, version_suffix: str):
        if not project.course_id:
            warnings.append(f"Project assessment ({version_suffix}) requires a course_id but none was provided")
            return
        
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
            # For each group, we create a ProjectTeam to freeze the team roster at this point in time.
            # This ensures that project assessments reference the correct team composition,
            # even if group membership changes later. The ProjectTeam preserves:
            # - Team roster (members) at the time of project creation
            # - Team number from the group for proper team identification
            # - Historical record of team composition for this specific project
            for group in groups:
                # Check if project team already exists for this group (might be created by previous assessment)
                existing_project_team = db.query(ProjectTeam).filter(
                    ProjectTeam.project_id == project.id,
                    ProjectTeam.team_id == group.id
                ).first()
                
                if existing_project_team:
                    project_team = existing_project_team
                else:
                    # Create ProjectTeam for this group to preserve team roster
                    project_team = ProjectTeamService.create_project_team(
                        db=db,
                        project_id=project.id,
                        school_id=user.school_id,
                        team_id=group.id,
                        team_name=group.name,
                    )
                    
                    # Copy group.team_number to project_team.team_number
                    if group.team_number is not None:
                        project_team.team_number = group.team_number
                    
                    # Copy members from group to project team
                    ProjectTeamService.copy_members_from_group(
                        db=db,
                        project_team_id=project_team.id,
                        group_id=group.id,
                        school_id=user.school_id,
                    )
                    db.flush()  # Flush to get project_team.id
                
                # Create ProjectAssessment linked to project and project_team
                # Include version suffix in title if provided, but not group name
                title_with_version = project.title
                if version_suffix:
                    title_with_version += f" ({version_suffix})"
                
                assessment = ProjectAssessment(
                    school_id=user.school_id,
                    project_id=project.id,  # Set project_id on the model
                    group_id=group.id,
                    project_team_id=project_team.id,  # Link to project team
                    teacher_id=user.id,
                    rubric_id=pa_config.rubric_id,
                    title=title_with_version,
                    version=pa_config.version or version_suffix,
                    status="draft",
                    metadata_json={
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
                        "project_id": assessment.project_id,
                        "group_id": assessment.group_id,
                        "group_name": group.name,
                        "project_team_id": assessment.project_team_id,
                        "rubric_id": assessment.rubric_id,
                        "version": assessment.version,
                        "status": assessment.status,
                        "deadline": pa_config.deadline.isoformat() if pa_config.deadline else None,
                    }
                ))
    
    # Process project_assessment_tussen
    if payload.evaluations.project_assessment_tussen and payload.evaluations.project_assessment_tussen.enabled:
        create_project_assessments(payload.evaluations.project_assessment_tussen, "tussentijds")
    
    # Process project_assessment_eind
    if payload.evaluations.project_assessment_eind and payload.evaluations.project_assessment_eind.enabled:
        create_project_assessments(payload.evaluations.project_assessment_eind, "eind")
    
    # Legacy support: process single project_assessment if provided
    if payload.evaluations.project_assessment and payload.evaluations.project_assessment.enabled:
        # Use explicit version from payload, or no suffix if not provided
        version_suffix = payload.evaluations.project_assessment.version or None
        create_project_assessments(payload.evaluations.project_assessment, version_suffix or "")

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


# ============ Subproject Endpoints ============


def _enrich_subproject(
    db: Session,
    subproject: Subproject,
    user: User,
) -> SubprojectOut:
    """Helper to enrich a subproject with client and team information"""
    # Get client info
    client_name = None
    client_email = None
    if subproject.client_id:
        client = db.query(Client).filter(Client.id == subproject.client_id).first()
        if client:
            client_name = client.organization
            client_email = client.email

    # Get team info from project's course
    team_name = None
    team_members = []
    if subproject.team_number is not None:
        team_name = f"Team {subproject.team_number}"
        # Get project to find course_id
        project = db.query(Project).filter(Project.id == subproject.project_id).first()
        if project and project.course_id:
            # Get students from course with this team_number
            # Note: team_number is stored on the User model, not on Group
            # Students are enrolled in course groups, but team assignment is on User
            students = (
                db.query(User)
                .join(GroupMember, GroupMember.user_id == User.id)
                .join(Group, Group.id == GroupMember.group_id)
                .filter(
                    Group.course_id == project.course_id,
                    User.team_number == subproject.team_number,
                    User.school_id == user.school_id,
                    User.role == "student",
                    User.archived.is_(False),
                    GroupMember.active.is_(True),
                )
                .all()
            )
            team_members = [s.name for s in students]

    return SubprojectOut(
        id=subproject.id,
        school_id=subproject.school_id,
        project_id=subproject.project_id,
        title=subproject.title,
        client_id=subproject.client_id,
        team_number=subproject.team_number,
        created_at=subproject.created_at,
        updated_at=subproject.updated_at,
        client_name=client_name,
        client_email=client_email,
        team_name=team_name,
        team_members=team_members,
    )


@router.get("/{project_id}/subprojects", response_model=SubprojectListOut)
def list_subprojects(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    List all subprojects for a project
    """
    require_role(user, ["admin", "teacher"])

    # Verify project exists and user has access
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

    # Get subprojects
    subprojects = (
        db.query(Subproject)
        .filter(Subproject.project_id == project_id)
        .order_by(Subproject.created_at)
        .all()
    )

    items = [_enrich_subproject(db, sp, user) for sp in subprojects]

    return SubprojectListOut(items=items, total=len(items))


@router.post(
    "/{project_id}/subprojects",
    response_model=SubprojectOut,
    status_code=status.HTTP_201_CREATED,
)
def create_subproject(
    project_id: int,
    payload: SubprojectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Create a new subproject for a project
    """
    require_role(user, ["admin", "teacher"])

    # Verify project exists and user has access
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

    # Validate client exists if provided
    if payload.client_id:
        client = (
            db.query(Client)
            .filter(Client.id == payload.client_id, Client.school_id == user.school_id)
            .first()
        )
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found",
            )

    # Create subproject
    subproject = Subproject(
        school_id=user.school_id,
        project_id=project_id,
        title=payload.title,
        client_id=payload.client_id,
        team_number=payload.team_number,
    )

    db.add(subproject)
    db.commit()
    db.refresh(subproject)

    # Audit log
    log_action(
        db=db,
        user=user,
        action="create_subproject",
        entity_type="subproject",
        entity_id=subproject.id,
        details={"title": subproject.title, "project_id": project_id},
        request=request,
    )

    return _enrich_subproject(db, subproject, user)


@router.get("/{project_id}/subprojects/{subproject_id}", response_model=SubprojectOut)
def get_subproject(
    project_id: int,
    subproject_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get a specific subproject
    """
    require_role(user, ["admin", "teacher"])

    # Verify project exists and user has access
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

    # Get subproject
    subproject = (
        db.query(Subproject)
        .filter(
            Subproject.id == subproject_id,
            Subproject.project_id == project_id,
        )
        .first()
    )

    if not subproject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subproject not found",
        )

    return _enrich_subproject(db, subproject, user)


@router.patch("/{project_id}/subprojects/{subproject_id}", response_model=SubprojectOut)
def update_subproject(
    project_id: int,
    subproject_id: int,
    payload: SubprojectUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Update a subproject
    """
    require_role(user, ["admin", "teacher"])

    # Verify project exists and user has access
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

    # Get subproject
    subproject = (
        db.query(Subproject)
        .filter(
            Subproject.id == subproject_id,
            Subproject.project_id == project_id,
        )
        .first()
    )

    if not subproject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subproject not found",
        )

    # Validate client exists if provided
    if payload.client_id is not None and payload.client_id:
        client = (
            db.query(Client)
            .filter(Client.id == payload.client_id, Client.school_id == user.school_id)
            .first()
        )
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found",
            )

    # Update fields
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(subproject, field, value)

    db.commit()
    db.refresh(subproject)

    # Audit log
    log_action(
        db=db,
        user=user,
        action="update_subproject",
        entity_type="subproject",
        entity_id=subproject.id,
        details=update_data,
        request=request,
    )

    return _enrich_subproject(db, subproject, user)


@router.delete(
    "/{project_id}/subprojects/{subproject_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_subproject(
    project_id: int,
    subproject_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Delete a subproject
    """
    require_role(user, ["admin", "teacher"])

    # Verify project exists and user has access
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

    # Get subproject
    subproject = (
        db.query(Subproject)
        .filter(
            Subproject.id == subproject_id,
            Subproject.project_id == project_id,
        )
        .first()
    )

    if not subproject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subproject not found",
        )

    # Audit log
    log_action(
        db=db,
        user=user,
        action="delete_subproject",
        entity_type="subproject",
        entity_id=subproject.id,
        details={"title": subproject.title, "project_id": project_id},
        request=request,
    )

    db.delete(subproject)
    db.commit()

    return None
