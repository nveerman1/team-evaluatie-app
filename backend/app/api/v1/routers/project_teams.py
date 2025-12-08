"""
Project Teams API endpoints
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.api.v1.schemas.project_teams import (
    ProjectTeamCreate,
    ProjectTeamOut,
    ProjectTeamListOut,
    ProjectTeamMemberOut,
    BulkAddMembersRequest,
    CloneProjectTeamsRequest,
    CloneProjectTeamsResponse,
)
from app.infra.db.models import User, Project, ProjectTeam, ProjectTeamMember
from app.infra.services.project_team_service import ProjectTeamService
from app.core.rbac import require_role
from app.core.audit import log_create

router = APIRouter(prefix="/project-teams", tags=["project-teams"])


@router.post("/projects/{project_id}/teams", response_model=ProjectTeamOut)
def create_project_team(
    project_id: int,
    data: ProjectTeamCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Create or link a project team

    - **team_id**: Link to existing group/team
    - **team_name**: Name for the team (if not linking to existing team)

    At least one of team_id or team_name must be provided.
    """
    # Require teacher or admin role
    require_role(user, ["teacher", "admin"])

    # Validate project access
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.school_id == user.school_id)
        .first()
    )
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    # Create project team
    project_team = ProjectTeamService.create_project_team(
        db=db,
        project_id=project_id,
        school_id=user.school_id,
        team_id=data.team_id,
        team_name=data.team_name,
    )

    # If team_id provided, automatically copy members from the group
    if data.team_id:
        ProjectTeamService.copy_members_from_group(
            db=db,
            project_team_id=project_team.id,
            group_id=data.team_id,
            school_id=user.school_id,
        )

    db.commit()

    # Log action
    log_create(
        db=db,
        user=user,
        entity_type="project_team",
        entity_id=project_team.id,
        details={"project_id": project_id, "team_id": data.team_id},
    )

    # Reload with members
    db.refresh(project_team)
    return _format_project_team_output(project_team, db)


@router.post(
    "/{project_team_id}/members", response_model=List[ProjectTeamMemberOut]
)
def add_project_team_members(
    project_team_id: int,
    data: BulkAddMembersRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Bulk add members to a project team

    Returns 409 Conflict if the team is locked (has evaluations/assessments).
    """
    # Require teacher or admin role
    require_role(user, ["teacher", "admin"])

    # Validate project team access
    project_team = (
        db.query(ProjectTeam)
        .filter(
            ProjectTeam.id == project_team_id, ProjectTeam.school_id == user.school_id
        )
        .first()
    )
    if not project_team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project team not found"
        )

    # Add members
    member_data = [(m.user_id, m.role) for m in data.members]
    members = ProjectTeamService.add_members(
        db=db,
        project_team_id=project_team_id,
        school_id=user.school_id,
        member_user_ids=member_data,
    )

    db.commit()

    # Log action
    log_create(
        db=db,
        user=user,
        entity_type="project_team_members",
        entity_id=project_team_id,
        details={"members_added": len(members)},
    )

    # Reload members with user details
    db_members = ProjectTeamService.get_project_team_members(
        db=db, project_team_id=project_team_id, school_id=user.school_id
    )

    return [_format_member_output(m) for m in db_members]


@router.get("/projects/{project_id}/teams", response_model=ProjectTeamListOut)
def list_project_teams(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get all project teams for a project

    Returns teams with their members (lean representation).
    """
    # Validate project access
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.school_id == user.school_id)
        .first()
    )
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    # Get teams
    teams = ProjectTeamService.get_project_teams(
        db=db, project_id=project_id, school_id=user.school_id
    )

    return ProjectTeamListOut(
        teams=[_format_project_team_output(t, db) for t in teams],
        total=len(teams),
    )


@router.get("/{project_team_id}/members", response_model=List[ProjectTeamMemberOut])
def get_project_team_members(
    project_team_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get all members of a project team (read-only)
    """
    # Validate project team access
    project_team = (
        db.query(ProjectTeam)
        .filter(
            ProjectTeam.id == project_team_id, ProjectTeam.school_id == user.school_id
        )
        .first()
    )
    if not project_team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project team not found"
        )

    # Get members
    members = ProjectTeamService.get_project_team_members(
        db=db, project_team_id=project_team_id, school_id=user.school_id
    )

    return [_format_member_output(m) for m in members]


@router.post(
    "/projects/{project_id}/teams/clone-from/{source_project_id}",
    response_model=CloneProjectTeamsResponse,
)
def clone_project_teams(
    project_id: int,
    source_project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Clone all project teams and members from source project to target project

    Useful for creating a new project with the same team structure as a previous one.
    """
    # Require teacher or admin role
    require_role(user, ["teacher", "admin"])

    # Clone teams
    teams_cloned, members_cloned, new_team_ids = ProjectTeamService.clone_project_teams(
        db=db,
        source_project_id=source_project_id,
        target_project_id=project_id,
        school_id=user.school_id,
    )

    db.commit()

    # Log action
    log_create(
        db=db,
        user=user,
        entity_type="project_teams_clone",
        entity_id=project_id,
        details={
            "source_project_id": source_project_id,
            "teams_cloned": teams_cloned,
            "members_cloned": members_cloned,
        },
    )

    return CloneProjectTeamsResponse(
        teams_cloned=teams_cloned,
        members_cloned=members_cloned,
        project_team_ids=new_team_ids,
    )


# ========== Helper functions ==========


def _format_project_team_output(project_team: ProjectTeam, db: Session) -> ProjectTeamOut:
    """Format ProjectTeam for API output"""
    # Determine if team is locked (has evaluations/assessments)
    is_locked = ProjectTeamService._is_project_team_locked(db, project_team.id)
    
    return ProjectTeamOut(
        id=project_team.id,
        school_id=project_team.school_id,
        project_id=project_team.project_id,
        team_id=project_team.team_id,
        display_name_at_time=project_team.display_name_at_time,
        version=project_team.version,
        backfill_source=project_team.backfill_source,
        created_at=project_team.created_at,
        members=[_format_member_output(m) for m in project_team.members],
        member_count=len(project_team.members),
        is_locked=is_locked,
    )


def _format_member_output(member: ProjectTeamMember) -> ProjectTeamMemberOut:
    """Format ProjectTeamMember for API output"""
    # Determine user status based on archived field
    # If user is not available or is archived, mark as inactive
    user_status = "active"
    if not member.user or member.user.archived:
        user_status = "inactive"
    
    return ProjectTeamMemberOut(
        id=member.id,
        project_team_id=member.project_team_id,
        user_id=member.user_id,
        role=member.role,
        created_at=member.created_at,
        user_name=member.user.name if member.user else None,
        user_email=member.user.email if member.user else None,
        user_status=user_status,
    )
