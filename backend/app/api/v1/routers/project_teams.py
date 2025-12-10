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
    ProjectStudentOut,
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


@router.get("/projects/{project_id}/students", response_model=List[ProjectStudentOut])
def get_project_students(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get all students for a project with their project-specific team information
    
    Returns students with team_number from project_teams table (project-specific).
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

    # Query all students who are members of project teams in this project
    from sqlalchemy import func
    from app.infra.db.models import GroupMember, Group
    
    # Get all unique students from project team members
    students_data = (
        db.query(
            User.id,
            User.name,
            User.email,
            User.class_name,
            User.archived,
            ProjectTeam.id.label("project_team_id"),
            ProjectTeam.display_name_at_time,
            ProjectTeam.team_number,
        )
        .join(ProjectTeamMember, ProjectTeamMember.user_id == User.id)
        .join(ProjectTeam, ProjectTeam.id == ProjectTeamMember.project_team_id)
        .filter(
            ProjectTeam.project_id == project_id,
            ProjectTeam.school_id == user.school_id,
            User.role == "student",
        )
        .order_by(User.name)
        .all()
    )
    
    # Format output
    result = []
    for row in students_data:
        result.append(
            ProjectStudentOut(
                id=row.id,
                name=row.name,
                email=row.email,
                class_name=row.class_name or "",
                status="inactive" if row.archived else "active",
                project_team_id=row.project_team_id,
                project_team_name=row.display_name_at_time,
                project_team_number=row.team_number,
            )
        )
    
    return result


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


@router.patch("/projects/{project_id}/student-teams")
def update_project_student_teams(
    project_id: int,
    updates: List[dict],
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Update team assignments for students in a project
    
    Assigns students to project teams by team number.
    Expects a list of updates: [{"student_id": int, "team_number": int | None}, ...]
    
    - If team_number is provided: Creates/updates ProjectTeam and ProjectTeamMember
    - If team_number is None: Removes student from all project teams
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
    
    # Process updates
    for update in updates:
        student_id = update.get("student_id")
        team_number = update.get("team_number")
        
        if not student_id:
            continue
        
        # Validate student exists
        student = db.query(User).filter(
            User.id == student_id,
            User.school_id == user.school_id,
            User.role == "student"
        ).first()
        
        if not student:
            continue
            
        # Find existing project team membership for this student
        existing_member = (
            db.query(ProjectTeamMember)
            .join(ProjectTeam, ProjectTeam.id == ProjectTeamMember.project_team_id)
            .filter(
                ProjectTeamMember.user_id == student_id,
                ProjectTeam.project_id == project_id,
                ProjectTeam.school_id == user.school_id,
            )
            .first()
        )
        
        if team_number is None:
            # Remove from project team
            if existing_member:
                db.delete(existing_member)
        else:
            # Assign to team with team_number
            # Find or create ProjectTeam with this team_number
            project_team = (
                db.query(ProjectTeam)
                .filter(
                    ProjectTeam.project_id == project_id,
                    ProjectTeam.team_number == team_number,
                    ProjectTeam.school_id == user.school_id,
                )
                .first()
            )
            
            if not project_team:
                # Create new project team
                project_team = ProjectTeam(
                    school_id=user.school_id,
                    project_id=project_id,
                    display_name_at_time=f"Team {team_number}",
                    team_number=team_number,
                    version=1,
                )
                db.add(project_team)
                db.flush()  # Get the ID
            
            if existing_member:
                # Move to different team
                if existing_member.project_team_id != project_team.id:
                    existing_member.project_team_id = project_team.id
            else:
                # Create new membership
                new_member = ProjectTeamMember(
                    school_id=user.school_id,
                    project_team_id=project_team.id,
                    user_id=student_id,
                )
                db.add(new_member)
    
    db.commit()
    
    return {"status": "success", "updated": len(updates)}


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
