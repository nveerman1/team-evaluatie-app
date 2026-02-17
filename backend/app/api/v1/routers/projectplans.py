from __future__ import annotations
from typing import List, Optional
from datetime import datetime
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session, joinedload

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    ProjectPlan,
    ProjectPlanTeam,
    ProjectPlanSection,
    Project,
    ProjectTeam,
    ProjectTeamMember,
    Course,
    User,
    TeacherCourse,
)
from app.api.v1.schemas.projectplans import (
    ProjectPlanCreate,
    ProjectPlanUpdate,
    ProjectPlanOut,
    ProjectPlanDetail,
    ProjectPlanListItem,
    ProjectPlanListResponse,
    ProjectPlanTeamOut,
    ProjectPlanTeamUpdate,
    ProjectPlanTeamOverviewItem,
    ProjectPlanSectionOut,
    ProjectPlanSectionUpdate,
    ClientData,
    SectionKey,
    SectionStatus,
    PlanStatus,
    ProjectPlanStatus,
)

router = APIRouter(prefix="/projectplans", tags=["projectplans"])
student_router = APIRouter(tags=["projectplans"])  # No prefix for /me/projectplans routes
logger = logging.getLogger(__name__)

SECTION_NAMES = {
    "client": "Opdrachtgever",
    "problem": "Probleemstelling",
    "goal": "Doel",
    "method": "Methode",
    "planning": "Planning",
    "tasks": "Taken",
    "motivation": "Motivatie",
    "risks": "Risico's",
}


def _get_teacher_course_ids(db: Session, user: User) -> list[int]:
    """Get all course IDs that a teacher is assigned to via teacher_courses"""
    if user.role == "admin":
        return []
    if user.role != "teacher":
        return []
    
    course_ids_query = select(TeacherCourse.course_id).where(
        TeacherCourse.school_id == user.school_id,
        TeacherCourse.teacher_id == user.id,
        TeacherCourse.is_active.is_(True),
    )
    result = db.execute(course_ids_query).scalars().all()
    return list(result)


def _get_projectplan_with_access_check(
    db: Session, projectplan_id: int, user: User
) -> ProjectPlan:
    """
    Get a project plan and verify the user has access to it.
    
    - Admins: can access any projectplan in their school
    - Teachers: can access projectplans for courses they're assigned to
    - Others: raises 404
    
    Raises HTTPException(404) if not found or no access.
    """
    pp = db.query(ProjectPlan).filter(
        ProjectPlan.id == projectplan_id,
        ProjectPlan.school_id == user.school_id,
    ).first()
    
    if not pp:
        raise HTTPException(status_code=404, detail="ProjectPlan not found")
    
    if user.role == "teacher":
        if pp.project_id:
            project = db.query(Project).filter(Project.id == pp.project_id).first()
            if project and project.course_id:
                teacher_course_ids = _get_teacher_course_ids(db, user)
                if teacher_course_ids and project.course_id not in teacher_course_ids:
                    raise HTTPException(status_code=404, detail="ProjectPlan not found")
    
    return pp


def _section_to_out(section: ProjectPlanSection) -> ProjectPlanSectionOut:
    """Convert ProjectPlanSection model to schema"""
    client_data = None
    if section.key == "client":
        from app.api.v1.schemas.projectplans import ClientData
        client_data = ClientData(
            organisation=section.client_organisation,
            contact=section.client_contact,
            email=section.client_email,
            phone=section.client_phone,
            description=section.client_description,
        )
    
    return ProjectPlanSectionOut(
        id=section.id,
        key=section.key,
        status=section.status,
        text=section.text,
        client=client_data,
        teacher_note=section.teacher_note,
        created_at=section.created_at,
        updated_at=section.updated_at,
    )


def _team_to_out(team: ProjectPlanTeam, db: Session) -> ProjectPlanTeamOut:
    """Convert ProjectPlanTeam model to schema with members"""
    members = db.query(User.name).join(
        ProjectTeamMember, ProjectTeamMember.user_id == User.id
    ).filter(
        ProjectTeamMember.project_team_id == team.project_team_id,
        ProjectTeamMember.school_id == team.school_id,
    ).all()
    
    team_members = [m[0] for m in members]
    
    project_team = db.query(ProjectTeam).filter(
        ProjectTeam.id == team.project_team_id
    ).first()
    team_number = project_team.team_number if project_team else None
    
    sections_out = [_section_to_out(s) for s in team.sections]
    
    return ProjectPlanTeamOut(
        id=team.id,
        project_team_id=team.project_team_id,
        team_number=team_number,
        team_members=team_members,
        title=team.title,
        status=team.status,
        locked=team.locked,
        sections=sections_out,
        global_teacher_note=team.global_teacher_note,
        created_at=team.created_at,
        updated_at=team.updated_at,
    )


# ---------- Teacher Endpoints ----------

@router.post("", response_model=ProjectPlanOut, status_code=status.HTTP_201_CREATED)
def create_projectplan(
    payload: ProjectPlanCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Create a new project plan for a project (teacher/admin only)
    
    Creates ONE projectplan per project with child rows for all teams.
    Each team gets 8 empty sections initialized.
    """
    if user.role not in ("teacher", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Alleen docenten en admins kunnen projectplannen aanmaken"
        )
    
    project = db.query(Project).filter(
        Project.id == payload.project_id,
        Project.school_id == user.school_id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if user.role == "teacher":
        teacher_course_ids = _get_teacher_course_ids(db, user)
        if teacher_course_ids and project.course_id not in teacher_course_ids:
            raise HTTPException(status_code=403, detail="Access denied to this project")
    
    existing = db.query(ProjectPlan).filter(
        ProjectPlan.project_id == payload.project_id,
        ProjectPlan.school_id == user.school_id,
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="ProjectPlan already exists for this project"
        )
    
    pp = ProjectPlan(
        school_id=user.school_id,
        project_id=payload.project_id,
        title=payload.title,
        version=payload.version,
        status=payload.status.value if payload.status else "draft",
    )
    db.add(pp)
    db.flush()
    
    project_teams = db.query(ProjectTeam).filter(
        ProjectTeam.project_id == payload.project_id,
        ProjectTeam.school_id == user.school_id,
    ).all()
    
    section_keys = [
        "client", "problem", "goal", "method",
        "planning", "tasks", "motivation", "risks"
    ]
    
    for pt in project_teams:
        ppt = ProjectPlanTeam(
            school_id=user.school_id,
            project_plan_id=pp.id,
            project_team_id=pt.id,
            status="concept",
            locked=False,
        )
        db.add(ppt)
        db.flush()
        
        for key in section_keys:
            section = ProjectPlanSection(
                school_id=user.school_id,
                project_plan_team_id=ppt.id,
                key=key,
                status="empty",
            )
            db.add(section)
    
    db.commit()
    db.refresh(pp)
    
    logger.info(
        f"Created ProjectPlan {pp.id} for project {payload.project_id} "
        f"with {len(project_teams)} teams by user {user.id}"
    )
    
    return ProjectPlanOut(
        id=pp.id,
        project_id=pp.project_id,
        school_id=pp.school_id,
        title=pp.title,
        version=pp.version,
        status=pp.status,
        created_at=pp.created_at,
        updated_at=pp.updated_at,
    )


@router.get("", response_model=ProjectPlanListResponse)
def list_projectplans(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    project_id: Optional[int] = Query(None, description="Filter by project"),
    course_id: Optional[int] = Query(None, description="Filter by course"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
):
    """
    List project plans.
    
    Access control:
    - Admins: see all projectplans in their school
    - Teachers: see projectplans for courses they're assigned to
    - Students: see projectplans for projects where they belong to ANY team
    """
    stmt = select(ProjectPlan).where(ProjectPlan.school_id == user.school_id)
    
    if user.role == "admin":
        pass
    elif user.role == "teacher":
        teacher_course_ids = _get_teacher_course_ids(db, user)
        if teacher_course_ids:
            stmt = stmt.where(
                ProjectPlan.project_id.in_(
                    select(Project.id).where(
                        Project.school_id == user.school_id,
                        Project.course_id.in_(teacher_course_ids)
                    )
                )
            )
        else:
            return ProjectPlanListResponse(items=[], page=page, limit=limit, total=0)
    else:
        student_teams = db.query(ProjectTeamMember.project_team_id).filter(
            ProjectTeamMember.user_id == user.id,
            ProjectTeamMember.school_id == user.school_id,
        ).all()
        team_ids = [t[0] for t in student_teams]
        
        if team_ids:
            project_ids_subquery = select(ProjectTeam.project_id).where(
                ProjectTeam.id.in_(team_ids),
                ProjectTeam.school_id == user.school_id,
            ).distinct()
            
            stmt = stmt.where(ProjectPlan.project_id.in_(project_ids_subquery))
        else:
            return ProjectPlanListResponse(items=[], page=page, limit=limit, total=0)
    
    if project_id:
        stmt = stmt.where(ProjectPlan.project_id == project_id)
    
    if course_id:
        stmt = stmt.where(
            ProjectPlan.project_id.in_(
                select(Project.id).where(
                    Project.school_id == user.school_id,
                    Project.course_id == course_id,
                )
            )
        )
    
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    
    stmt = stmt.order_by(ProjectPlan.id.desc()).limit(limit).offset((page - 1) * limit)
    rows: List[ProjectPlan] = db.execute(stmt).scalars().all()
    
    items = []
    for pp in rows:
        project = db.query(Project).filter(Project.id == pp.project_id).first()
        project_name = project.title if project else "Unknown"
        course_id_val = project.course_id if project else None
        course_name = None
        if course_id_val:
            course = db.query(Course).filter(Course.id == course_id_val).first()
            course_name = course.name if course else None
        
        teams = db.query(ProjectPlanTeam).filter(
            ProjectPlanTeam.project_plan_id == pp.id
        ).all()
        team_count = len(teams)
        
        teams_summary = {"concept": 0, "ingediend": 0, "go": 0, "no-go": 0}
        for team in teams:
            status = team.status
            if status in teams_summary:
                teams_summary[status] += 1
        
        items.append(
            ProjectPlanListItem(
                id=pp.id,
                title=pp.title,
                version=pp.version,
                status=pp.status,
                project_id=pp.project_id,
                project_name=project_name,
                course_id=course_id_val,
                course_name=course_name,
                team_count=team_count,
                teams_summary=teams_summary,
                created_at=pp.created_at,
                updated_at=pp.updated_at,
            )
        )
        logger.info(f"List endpoint - ProjectPlan {pp.id} status from DB: {pp.status}")
    
    return ProjectPlanListResponse(items=items, page=page, limit=limit, total=total)


@router.get("/{projectplan_id}", response_model=ProjectPlanDetail)
def get_projectplan(
    projectplan_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get projectplan with all teams and their sections (teacher/admin only)"""
    if user.role not in ("teacher", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Alleen docenten en admins hebben toegang"
        )
    
    pp = _get_projectplan_with_access_check(db, projectplan_id, user)
    
    project = db.query(Project).filter(Project.id == pp.project_id).first()
    project_name = project.title if project else "Unknown"
    course_id_val = project.course_id if project else None
    course_name = None
    if course_id_val:
        course = db.query(Course).filter(Course.id == course_id_val).first()
        course_name = course.name if course else None
    
    teams = db.query(ProjectPlanTeam).options(
        joinedload(ProjectPlanTeam.sections)
    ).filter(
        ProjectPlanTeam.project_plan_id == pp.id
    ).all()
    
    teams_out = [_team_to_out(t, db) for t in teams]
    
    return ProjectPlanDetail(
        id=pp.id,
        project_id=pp.project_id,
        school_id=pp.school_id,
        title=pp.title,
        version=pp.version,
        project_name=project_name,
        course_id=course_id_val,
        course_name=course_name,
        team_count=len(teams),
        teams=teams_out,
        created_at=pp.created_at,
        updated_at=pp.updated_at,
    )


@router.get("/{projectplan_id}/overview")
def get_projectplan_overview(
    projectplan_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    status_filter: Optional[str] = Query(None, alias="status"),
):
    """
    Get overview of all teams for this projectplan (teacher/admin only).
    Used in the "Overzicht" tab.
    """
    if user.role not in ("teacher", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Alleen docenten en admins hebben toegang"
        )
    
    pp = _get_projectplan_with_access_check(db, projectplan_id, user)
    
    teams_query = db.query(ProjectPlanTeam).options(
        joinedload(ProjectPlanTeam.sections)
    ).filter(
        ProjectPlanTeam.project_plan_id == pp.id
    )
    
    if status_filter:
        teams_query = teams_query.filter(ProjectPlanTeam.status == status_filter)
    
    teams = teams_query.all()
    
    items = []
    for team in teams:
        project_team = db.query(ProjectTeam).filter(
            ProjectTeam.id == team.project_team_id
        ).first()
        team_number = project_team.team_number if project_team else None
        team_name = project_team.display_name_at_time if project_team else f"Team {team_number}"
        
        members = db.query(User.name).join(
            ProjectTeamMember, ProjectTeamMember.user_id == User.id
        ).filter(
            ProjectTeamMember.project_team_id == team.project_team_id,
            ProjectTeamMember.school_id == team.school_id,
        ).all()
        team_members = [m[0] for m in members]
        
        sections_filled = sum(1 for s in team.sections if s.status != "empty")
        
        items.append(
            ProjectPlanTeamOverviewItem(
                id=team.id,
                project_team_id=team.project_team_id,
                team_number=team_number,
                team_name=team_name,
                team_members=team_members,
                title=team.title,
                status=team.status,
                locked=team.locked,
                sections_filled=sections_filled,
                sections_total=8,
                last_updated=team.updated_at,
                global_teacher_note=team.global_teacher_note,
            )
        )
    
    status_priority = {"ingediend": 0, "no-go": 1, "concept": 2, "go": 3}
    items.sort(key=lambda x: (status_priority.get(x.status, 4), x.team_number or 0))
    
    return items


@router.patch("/{projectplan_id}", response_model=ProjectPlanOut)
def update_projectplan(
    projectplan_id: int,
    payload: ProjectPlanUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Update projectplan metadata (title, version, status) - teacher/admin only"""
    logger.info(f"=== UPDATE ENDPOINT CALLED === ProjectPlan {projectplan_id}, payload: {payload}")
    
    if user.role not in ("teacher", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Alleen docenten en admins kunnen projectplannen bijwerken"
        )
    
    pp = _get_projectplan_with_access_check(db, projectplan_id, user)
    
    logger.info(f"Before update - ProjectPlan {pp.id} status: {pp.status}")
    
    if payload.title is not None:
        pp.title = payload.title
    if payload.version is not None:
        pp.version = payload.version
    if payload.status is not None:
        new_status = payload.status.value if hasattr(payload.status, 'value') else payload.status
        logger.info(f"Setting status from {pp.status} to {new_status}")
        pp.status = new_status
    
    db.commit()
    db.refresh(pp)
    
    logger.info(f"After update - ProjectPlan {pp.id} status: {pp.status}")
    
    return ProjectPlanOut(
        id=pp.id,
        project_id=pp.project_id,
        school_id=pp.school_id,
        title=pp.title,
        version=pp.version,
        status=pp.status,
        created_at=pp.created_at,
        updated_at=pp.updated_at,
    )


@router.patch("/{projectplan_id}/teams/{team_id}", response_model=ProjectPlanTeamOut)
def update_team_status(
    projectplan_id: int,
    team_id: int,
    payload: ProjectPlanTeamUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Update team's overall status and feedback (teacher/admin only).
    - Setting status=GO locks the plan
    - Setting status=NO-GO unlocks the plan
    """
    if user.role not in ("teacher", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Alleen docenten en admins kunnen team status bijwerken"
        )
    
    pp = _get_projectplan_with_access_check(db, projectplan_id, user)
    
    team = db.query(ProjectPlanTeam).filter(
        ProjectPlanTeam.id == team_id,
        ProjectPlanTeam.project_plan_id == pp.id,
        ProjectPlanTeam.school_id == user.school_id,
    ).first()
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    if payload.status is not None:
        team.status = payload.status
        if payload.status == "go":
            team.locked = True
            for section in team.sections:
                if section.status == "submitted":
                    section.status = "approved"
        elif payload.status == "no-go":
            team.locked = False
    
    if payload.locked is not None:
        team.locked = payload.locked
    
    if payload.global_teacher_note is not None:
        team.global_teacher_note = payload.global_teacher_note
    
    if payload.title is not None:
        team.title = payload.title
    
    db.commit()
    db.refresh(team)
    
    logger.info(
        f"Updated ProjectPlanTeam {team.id} status to {team.status} by user {user.id}"
    )
    
    return _team_to_out(team, db)


@router.patch(
    "/{projectplan_id}/teams/{team_id}/sections/{section_key}",
    response_model=ProjectPlanSectionOut
)
def update_section_feedback(
    projectplan_id: int,
    team_id: int,
    section_key: SectionKey,
    payload: ProjectPlanSectionUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Teacher provides feedback on a specific section.
    - Can set status to 'approved' or 'revision'
    - If setting to 'revision', teacher_note must be non-empty
    """
    if user.role not in ("teacher", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Alleen docenten en admins kunnen feedback geven"
        )
    
    pp = _get_projectplan_with_access_check(db, projectplan_id, user)
    
    team = db.query(ProjectPlanTeam).filter(
        ProjectPlanTeam.id == team_id,
        ProjectPlanTeam.project_plan_id == pp.id,
        ProjectPlanTeam.school_id == user.school_id,
    ).first()
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    section = db.query(ProjectPlanSection).filter(
        ProjectPlanSection.project_plan_team_id == team.id,
        ProjectPlanSection.key == section_key,
        ProjectPlanSection.school_id == user.school_id,
    ).first()
    
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    if payload.status is not None:
        if payload.status == "revision" and not payload.teacher_note:
            raise HTTPException(
                status_code=400,
                detail="teacher_note is verplicht bij status 'revision'"
            )
        section.status = payload.status
    
    if payload.teacher_note is not None:
        section.teacher_note = payload.teacher_note
    
    db.commit()
    db.refresh(section)
    
    logger.info(
        f"Updated section {section_key} feedback for team {team_id} by user {user.id}"
    )
    
    return _section_to_out(section)


@router.delete("/{projectplan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_projectplan(
    projectplan_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Delete projectplan component (cascades to all teams and sections) - teacher/admin only"""
    if user.role not in ("teacher", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Alleen docenten en admins kunnen projectplannen verwijderen"
        )
    
    pp = _get_projectplan_with_access_check(db, projectplan_id, user)
    
    db.delete(pp)
    db.commit()
    
    logger.info(f"Deleted ProjectPlan {projectplan_id} by user {user.id}")
    
    return None


# ---------- Student Endpoints ----------

@student_router.get("/me/projectplans")
def list_my_projectplans(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """List all projectplans for projects where student is a team member"""
    if user.role not in ("student",):
        raise HTTPException(
            status_code=403,
            detail="Dit endpoint is alleen voor studenten"
        )
    
    try:
        logger.info(f"Student {user.id} ({user.email}) requesting projectplans")
        
        student_teams = db.query(ProjectTeamMember.project_team_id).filter(
            ProjectTeamMember.user_id == user.id,
            ProjectTeamMember.school_id == user.school_id,
        ).all()
        team_ids = [t[0] for t in student_teams]
        
        logger.info(f"Student {user.id} is member of teams: {team_ids}")
        
        if not team_ids:
            logger.info(f"Student {user.id} has no team memberships")
            return []
        
        project_ids = db.query(ProjectTeam.project_id).filter(
            ProjectTeam.id.in_(team_ids),
            ProjectTeam.school_id == user.school_id,
        ).distinct().all()
        project_ids = [p[0] for p in project_ids]
        
        logger.info(f"Student {user.id} teams are in projects: {project_ids}")
        
        if not project_ids:
            logger.info(f"Student {user.id} teams have no associated projects")
            return []
        
        # Only show projectplans with status open, published, or closed (not draft)
        projectplans = db.query(ProjectPlan).filter(
            ProjectPlan.project_id.in_(project_ids),
            ProjectPlan.school_id == user.school_id,
            ProjectPlan.status.in_(["open", "published", "closed"]),
        ).all()
        
        logger.info(f"Found {len(projectplans)} projectplans with visible status for student {user.id}")
        for pp in projectplans:
            logger.info(f"  - ProjectPlan {pp.id} (project {pp.project_id}): status={pp.status}")
        
        items = []
        for pp in projectplans:
            try:
                project = db.query(Project).filter(Project.id == pp.project_id).first()
                project_name = project.title if project else "Unknown"
                course_id_val = project.course_id if project else None
                course_name = None
                if course_id_val:
                    course = db.query(Course).filter(Course.id == course_id_val).first()
                    course_name = course.name if course else None
                
                # Get only the student's team(s) for this projectplan
                student_project_teams = db.query(ProjectTeam).filter(
                    ProjectTeam.id.in_(team_ids),
                    ProjectTeam.project_id == pp.project_id,
                    ProjectTeam.school_id == user.school_id,
                ).all()
                
                teams_data = []
                for project_team in student_project_teams:
                    try:
                        # Get the ProjectPlanTeam record
                        ppt = db.query(ProjectPlanTeam).filter(
                            ProjectPlanTeam.project_plan_id == pp.id,
                            ProjectPlanTeam.project_team_id == project_team.id,
                            ProjectPlanTeam.school_id == user.school_id,
                        ).first()
                        
                        if not ppt:
                            logger.info(f"No ProjectPlanTeam found for projectplan {pp.id} team {project_team.id}")
                            continue  # Skip if no ProjectPlanTeam record exists
                        
                        # Get team members
                        members = db.query(User).join(
                            ProjectTeamMember,
                            ProjectTeamMember.user_id == User.id
                        ).filter(
                            ProjectTeamMember.project_team_id == project_team.id,
                            ProjectTeamMember.school_id == user.school_id,
                        ).all()
                        member_names = [m.name for m in members]
                        
                        # Get sections
                        sections = db.query(ProjectPlanSection).filter(
                            ProjectPlanSection.project_plan_team_id == ppt.id,
                            ProjectPlanSection.school_id == user.school_id,
                        ).all()
                        
                        sections_data = []
                        for s in sections:
                            # Build client data if this is the client section
                            client_data = None
                            if s.key == "client":
                                client_data = ClientData(
                                    organisation=s.client_organisation,
                                    contact=s.client_contact,
                                    email=s.client_email,
                                    phone=s.client_phone,
                                    description=s.client_description,
                                )
                            
                            sections_data.append(
                                ProjectPlanSectionOut(
                                    id=s.id,
                                    project_plan_team_id=s.project_plan_team_id,
                                    key=s.key,
                                    status=s.status,
                                    text=s.text,
                                    client=client_data,
                                    teacher_note=s.teacher_note,
                                    created_at=s.created_at,
                                    updated_at=s.updated_at,
                                )
                            )
                        
                        teams_data.append(
                            ProjectPlanTeamOut(
                                id=ppt.id,
                                project_plan_id=ppt.project_plan_id,
                                project_team_id=ppt.project_team_id,
                                status=ppt.status,
                                title=ppt.title,
                                global_teacher_note=ppt.global_teacher_note,
                                locked=ppt.locked,
                                team_number=project_team.team_number,
                                team_members=member_names,
                                sections=sections_data,
                                created_at=ppt.created_at,
                                updated_at=ppt.updated_at,
                            )
                        )
                    except Exception as e:
                        logger.error(f"Error processing team {project_team.id} for projectplan {pp.id}: {e}", exc_info=True)
                        continue
                
                items.append(
                    ProjectPlanDetail(
                        id=pp.id,
                        project_id=pp.project_id,
                        school_id=pp.school_id,
                        title=pp.title,
                        version=pp.version,
                        status=pp.status,
                        created_at=pp.created_at,
                        updated_at=pp.updated_at,
                        project_name=project_name,
                        course_id=course_id_val,
                        course_name=course_name,
                        team_count=len(teams_data),
                        teams=teams_data,
                    )
                )
            except Exception as e:
                logger.error(f"Error processing projectplan {pp.id}: {e}", exc_info=True)
                continue
        
        logger.info(f"Returning {len(items)} projectplans to student {user.id}")
        return items
        
    except Exception as e:
        logger.error(f"Error in list_my_projectplans for student {user.id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error loading projectplans: {str(e)}"
        )


@student_router.get("/me/projectplans/{projectplan_id}", response_model=ProjectPlanTeamOut)
def get_my_projectplan(
    projectplan_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get student's team projectplan with sections"""
    if user.role not in ("student",):
        raise HTTPException(
            status_code=403,
            detail="Dit endpoint is alleen voor studenten"
        )
    
    pp = db.query(ProjectPlan).filter(
        ProjectPlan.id == projectplan_id,
        ProjectPlan.school_id == user.school_id,
        ProjectPlan.status.in_(["open", "published", "closed"]),
    ).first()
    
    if not pp:
        raise HTTPException(status_code=404, detail="ProjectPlan not found or not published")
    
    student_teams = db.query(ProjectTeamMember.project_team_id).filter(
        ProjectTeamMember.user_id == user.id,
        ProjectTeamMember.school_id == user.school_id,
    ).all()
    team_ids = [t[0] for t in student_teams]
    
    if not team_ids:
        raise HTTPException(status_code=404, detail="Je bent geen lid van een team")
    
    team = db.query(ProjectPlanTeam).options(
        joinedload(ProjectPlanTeam.sections)
    ).filter(
        ProjectPlanTeam.project_plan_id == pp.id,
        ProjectPlanTeam.project_team_id.in_(team_ids),
        ProjectPlanTeam.school_id == user.school_id,
    ).first()
    
    if not team:
        raise HTTPException(
            status_code=404,
            detail="Je team heeft geen projectplan voor dit project"
        )
    
    return _team_to_out(team, db)


@student_router.patch("/me/projectplans/{projectplan_team_id}", response_model=ProjectPlanTeamOut)
def update_my_projectplan_title(
    projectplan_team_id: int,
    payload: ProjectPlanTeamUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Student updates their team's projectplan title"""
    if user.role not in ("student",):
        raise HTTPException(
            status_code=403,
            detail="Dit endpoint is alleen voor studenten"
        )
    
    team = db.query(ProjectPlanTeam).filter(
        ProjectPlanTeam.id == projectplan_team_id,
        ProjectPlanTeam.school_id == user.school_id,
    ).first()
    
    if not team:
        raise HTTPException(status_code=404, detail="ProjectPlan team not found")
    
    is_member = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.project_team_id == team.project_team_id,
        ProjectTeamMember.user_id == user.id,
        ProjectTeamMember.school_id == user.school_id,
    ).first()
    
    if not is_member:
        raise HTTPException(
            status_code=403,
            detail="Je bent geen lid van dit team"
        )
    
    if team.locked:
        raise HTTPException(
            status_code=400,
            detail="Projectplan is vergrendeld en kan niet worden bewerkt"
        )
    
    if payload.title is not None:
        team.title = payload.title
    
    db.commit()
    db.refresh(team)
    
    logger.info(f"Student {user.id} updated team {team.id} title")
    
    return _team_to_out(team, db)


@student_router.patch(
    "/me/projectplans/{projectplan_team_id}/sections/{section_key}",
    response_model=ProjectPlanSectionOut
)
def update_my_section(
    projectplan_team_id: int,
    section_key: SectionKey,
    payload: ProjectPlanSectionUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Student updates section content"""
    if user.role not in ("student",):
        raise HTTPException(
            status_code=403,
            detail="Dit endpoint is alleen voor studenten"
        )
    
    team = db.query(ProjectPlanTeam).filter(
        ProjectPlanTeam.id == projectplan_team_id,
        ProjectPlanTeam.school_id == user.school_id,
    ).first()
    
    if not team:
        raise HTTPException(status_code=404, detail="ProjectPlan team not found")
    
    is_member = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.project_team_id == team.project_team_id,
        ProjectTeamMember.user_id == user.id,
        ProjectTeamMember.school_id == user.school_id,
    ).first()
    
    if not is_member:
        raise HTTPException(
            status_code=403,
            detail="Je bent geen lid van dit team"
        )
    
    if team.locked:
        raise HTTPException(
            status_code=400,
            detail="Projectplan is vergrendeld en kan niet worden bewerkt"
        )
    
    section = db.query(ProjectPlanSection).filter(
        ProjectPlanSection.project_plan_team_id == team.id,
        ProjectPlanSection.key == section_key,
        ProjectPlanSection.school_id == user.school_id,
    ).first()
    
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    has_content = False
    
    if section_key == "client" and payload.client:
        section.client_organisation = payload.client.organisation
        section.client_contact = payload.client.contact
        section.client_email = payload.client.email
        section.client_phone = payload.client.phone
        section.client_description = payload.client.description
        if payload.client.organisation or payload.client.contact or payload.client.email:
            has_content = True
    elif payload.text is not None:
        section.text = payload.text
        if payload.text.strip():
            has_content = True
    
    if has_content and section.status == "empty":
        section.status = "draft"
    
    db.commit()
    db.refresh(section)
    
    logger.info(
        f"Student {user.id} updated section {section_key} for team {team.id}"
    )
    
    return _section_to_out(section)


@student_router.post("/me/projectplans/{projectplan_team_id}/submit")
def submit_projectplan(
    projectplan_team_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Submit projectplan for teacher review.
    - Validates required sections are filled
    - Sets status to 'ingediend'
    - Marks filled required sections as 'submitted'
    """
    if user.role not in ("student",):
        raise HTTPException(
            status_code=403,
            detail="Dit endpoint is alleen voor studenten"
        )
    
    team = db.query(ProjectPlanTeam).options(
        joinedload(ProjectPlanTeam.sections)
    ).filter(
        ProjectPlanTeam.id == projectplan_team_id,
        ProjectPlanTeam.school_id == user.school_id,
    ).first()
    
    if not team:
        raise HTTPException(status_code=404, detail="ProjectPlan team not found")
    
    is_member = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.project_team_id == team.project_team_id,
        ProjectTeamMember.user_id == user.id,
        ProjectTeamMember.school_id == user.school_id,
    ).first()
    
    if not is_member:
        raise HTTPException(
            status_code=403,
            detail="Je bent geen lid van dit team"
        )
    
    if team.locked:
        raise HTTPException(
            status_code=400,
            detail="Projectplan is vergrendeld en kan niet worden ingediend"
        )
    
    sections_by_key = {s.key: s for s in team.sections}
    
    errors = []
    
    client_section = sections_by_key.get("client")
    if client_section:
        if not (client_section.client_organisation and 
                client_section.client_contact and 
                client_section.client_email):
            errors.append("Client sectie moet organisatie, contactpersoon en email bevatten")
    else:
        errors.append("Client sectie ontbreekt")
    
    required_text_sections = ["problem", "goal", "method", "planning"]
    for key in required_text_sections:
        section = sections_by_key.get(key)
        if not section or not section.text or not section.text.strip():
            section_name = SECTION_NAMES.get(key, key.capitalize())
            errors.append(f"{section_name} sectie moet ingevuld zijn")
    
    if errors:
        raise HTTPException(
            status_code=400,
            detail="Niet alle verplichte secties zijn ingevuld: " + ", ".join(errors)
        )
    
    team.status = "ingediend"
    
    for key in ["client", "problem", "goal", "method", "planning"]:
        section = sections_by_key.get(key)
        if section and section.status in ("empty", "draft"):
            section.status = "submitted"
    
    db.commit()
    
    logger.info(f"Student {user.id} submitted projectplan team {team.id}")
    
    return {"message": "Projectplan succesvol ingediend", "status": "ingediend"}
