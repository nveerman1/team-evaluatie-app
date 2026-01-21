"""
Service layer for Project Teams
"""

from typing import Optional, List, Tuple
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.infra.db.models import (
    ProjectTeam,
    ProjectTeamMember,
    Project,
    User,
    Evaluation,
    ProjectAssessment,
    ProjectNotesContext,
)


class ProjectTeamService:
    """Service for managing project teams and their members"""

    @staticmethod
    def create_project_team(
        db: Session,
        project_id: int,
        school_id: int,
        team_id: Optional[int] = None,
        team_name: Optional[str] = None,
        version: int = 1,
    ) -> ProjectTeam:
        """
        Create a new project team

        Args:
            db: Database session
            project_id: Project ID
            school_id: School ID for multi-tenancy
            team_id: DEPRECATED - No longer used (Groups removed)
            team_name: Name for the team (required)
            version: Version number (default 1)

        Returns:
            Created ProjectTeam instance
        """
        # Validate project exists
        project = (
            db.query(Project)
            .filter(Project.id == project_id, Project.school_id == school_id)
            .first()
        )
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found",
            )

        # team_id is deprecated (Groups no longer exist)
        # Use team_name directly
        if not team_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="team_name is required (team_id is deprecated)",
            )

        # Create project team
        project_team = ProjectTeam(
            school_id=school_id,
            project_id=project_id,
            team_id=None,  # No longer links to groups
            display_name_at_time=team_name,
            version=version,
        )
        db.add(project_team)
        db.flush()

        return project_team

    @staticmethod
    def add_members(
        db: Session,
        project_team_id: int,
        school_id: int,
        member_user_ids: List[Tuple[int, Optional[str]]],
    ) -> List[ProjectTeamMember]:
        """
        Add members to a project team

        Args:
            db: Database session
            project_team_id: Project team ID
            school_id: School ID for multi-tenancy
            member_user_ids: List of tuples (user_id, role)

        Returns:
            List of created ProjectTeamMember instances

        Raises:
            HTTPException: If project team not found or already has evaluations (locked)
        """
        # Validate project team exists
        project_team = (
            db.query(ProjectTeam)
            .filter(
                ProjectTeam.id == project_team_id, ProjectTeam.school_id == school_id
            )
            .first()
        )
        if not project_team:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project team {project_team_id} not found",
            )

        # Check if project team is locked (has evaluations/assessments)
        is_locked = ProjectTeamService._is_project_team_locked(db, project_team_id)
        if is_locked:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot modify team members: team is locked due to existing evaluations or assessments",
            )

        # Validate all users exist
        user_ids = [uid for uid, _ in member_user_ids]
        existing_users = (
            db.query(User.id)
            .filter(User.id.in_(user_ids), User.school_id == school_id)
            .all()
        )
        existing_user_ids = {u.id for u in existing_users}
        missing_users = set(user_ids) - existing_user_ids
        if missing_users:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Users not found: {missing_users}",
            )

        # Create team members
        members = []
        for user_id, role in member_user_ids:
            # Check if member already exists
            existing = (
                db.query(ProjectTeamMember)
                .filter(
                    ProjectTeamMember.project_team_id == project_team_id,
                    ProjectTeamMember.user_id == user_id,
                )
                .first()
            )
            if existing:
                continue  # Skip duplicates

            member = ProjectTeamMember(
                school_id=school_id,
                project_team_id=project_team_id,
                user_id=user_id,
                role=role,
            )
            db.add(member)
            members.append(member)

        db.flush()
        return members

    @staticmethod
    def _is_project_team_locked(db: Session, project_team_id: int) -> bool:
        """
        Check if a project team is locked (has evaluations or assessments)

        Args:
            db: Database session
            project_team_id: Project team ID

        Returns:
            True if team is locked, False otherwise
        """
        # Check for evaluations
        has_evaluations = (
            db.query(Evaluation)
            .filter(Evaluation.project_team_id == project_team_id)
            .first()
            is not None
        )

        # Check for assessments
        has_assessments = (
            db.query(ProjectAssessment)
            .filter(ProjectAssessment.project_team_id == project_team_id)
            .first()
            is not None
        )

        # Check for notes
        has_notes = (
            db.query(ProjectNotesContext)
            .filter(ProjectNotesContext.project_team_id == project_team_id)
            .first()
            is not None
        )

        return has_evaluations or has_assessments or has_notes

    @staticmethod
    def get_project_teams(
        db: Session, project_id: int, school_id: int
    ) -> List[ProjectTeam]:
        """
        Get all project teams for a project

        Args:
            db: Database session
            project_id: Project ID
            school_id: School ID for multi-tenancy

        Returns:
            List of ProjectTeam instances with members loaded
        """
        teams = (
            db.query(ProjectTeam)
            .options(joinedload(ProjectTeam.members).joinedload(ProjectTeamMember.user))
            .filter(
                ProjectTeam.project_id == project_id,
                ProjectTeam.school_id == school_id,
            )
            .order_by(ProjectTeam.version.asc(), ProjectTeam.created_at.asc())
            .all()
        )
        return teams

    @staticmethod
    def get_project_team_members(
        db: Session, project_team_id: int, school_id: int
    ) -> List[ProjectTeamMember]:
        """
        Get all members of a project team

        Args:
            db: Database session
            project_team_id: Project team ID
            school_id: School ID for multi-tenancy

        Returns:
            List of ProjectTeamMember instances
        """
        members = (
            db.query(ProjectTeamMember)
            .options(joinedload(ProjectTeamMember.user))
            .filter(
                ProjectTeamMember.project_team_id == project_team_id,
                ProjectTeamMember.school_id == school_id,
            )
            .order_by(ProjectTeamMember.created_at.asc())
            .all()
        )
        return members

    @staticmethod
    def clone_project_teams(
        db: Session,
        source_project_id: int,
        target_project_id: int,
        school_id: int,
    ) -> Tuple[int, int, List[int]]:
        """
        Clone all project teams from source project to target project

        Args:
            db: Database session
            source_project_id: Source project ID
            target_project_id: Target project ID
            school_id: School ID for multi-tenancy

        Returns:
            Tuple of (teams_cloned, members_cloned, new_project_team_ids)
        """
        # Validate both projects exist
        source_project = (
            db.query(Project)
            .filter(Project.id == source_project_id, Project.school_id == school_id)
            .first()
        )
        target_project = (
            db.query(Project)
            .filter(Project.id == target_project_id, Project.school_id == school_id)
            .first()
        )

        if not source_project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Source project {source_project_id} not found",
            )
        if not target_project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Target project {target_project_id} not found",
            )

        # Get all teams from source project
        source_teams = (
            db.query(ProjectTeam)
            .options(joinedload(ProjectTeam.members))
            .filter(
                ProjectTeam.project_id == source_project_id,
                ProjectTeam.school_id == school_id,
            )
            .all()
        )

        if not source_teams:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No teams found in source project {source_project_id}",
            )

        teams_cloned = 0
        members_cloned = 0
        new_team_ids = []

        for source_team in source_teams:
            # Create new team in target project
            new_team = ProjectTeam(
                school_id=school_id,
                project_id=target_project_id,
                team_id=source_team.team_id,  # Keep reference to original group
                display_name_at_time=source_team.display_name_at_time,
                version=1,  # Reset version for new project
            )
            db.add(new_team)
            db.flush()
            teams_cloned += 1
            new_team_ids.append(new_team.id)

            # Clone members
            for source_member in source_team.members:
                new_member = ProjectTeamMember(
                    school_id=school_id,
                    project_team_id=new_team.id,
                    user_id=source_member.user_id,
                    role=source_member.role,
                )
                db.add(new_member)
                members_cloned += 1

        db.flush()
        return teams_cloned, members_cloned, new_team_ids

    @staticmethod
    def copy_members_from_group(
        db: Session,
        project_team_id: int,
        group_id: int,
        school_id: int,
    ) -> List[ProjectTeamMember]:
        """
        DEPRECATED: Groups no longer exist after migration
        
        This function is kept for backward compatibility but does nothing.
        Use add_members() directly to add members to project teams.

        Args:
            db: Database session
            project_team_id: Project team ID
            group_id: DEPRECATED - No longer used
            school_id: School ID for multi-tenancy

        Returns:
            Empty list
        """
        # Groups no longer exist - return empty list
        # Callers should use add_members() directly instead
        return []
