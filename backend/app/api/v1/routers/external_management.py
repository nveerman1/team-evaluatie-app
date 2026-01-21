"""
Teacher/Admin endpoints for managing external assessments
"""

from __future__ import annotations
from typing import List, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    User,
    ExternalEvaluator,
    ProjectTeamExternal,
    Project,
    Rubric,
    ProjectTeam,
    ProjectTeamMember,
    ProjectAssessment,
)
from app.api.v1.schemas.external_assessments import (
    ExternalEvaluatorCreate,
    ExternalEvaluatorUpdate,
    ExternalEvaluatorOut,
    ProjectTeamExternalOut,
    BulkInviteRequest,
    ExternalAssessmentStatus,
)
from app.core.security import generate_external_token
from app.core.rbac import require_role

router = APIRouter(
    prefix="/projects/external-management", tags=["external-assessments-management"]
)


# ============ External Evaluator CRUD ============


@router.post(
    "/evaluators",
    response_model=ExternalEvaluatorOut,
    status_code=status.HTTP_201_CREATED,
)
def create_external_evaluator(
    payload: ExternalEvaluatorCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Create a new external evaluator (teacher/admin only).
    Checks if evaluator with same email already exists for this school.
    """
    require_role(user, ["teacher", "admin"])

    # Check if evaluator already exists for this school + email
    existing = (
        db.query(ExternalEvaluator)
        .filter(
            ExternalEvaluator.school_id == user.school_id,
            ExternalEvaluator.email == payload.email,
        )
        .first()
    )

    if existing:
        # Return existing evaluator
        return ExternalEvaluatorOut.model_validate(existing)

    evaluator = ExternalEvaluator(
        school_id=user.school_id,
        name=payload.name,
        email=payload.email,
        organisation=payload.organisation,
    )

    db.add(evaluator)
    db.commit()
    db.refresh(evaluator)

    return ExternalEvaluatorOut.model_validate(evaluator)


@router.get("/evaluators", response_model=List[ExternalEvaluatorOut])
def list_external_evaluators(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all external evaluators for the school (teacher/admin only)"""
    require_role(user, ["teacher", "admin"])

    evaluators = (
        db.query(ExternalEvaluator)
        .filter(ExternalEvaluator.school_id == user.school_id)
        .order_by(ExternalEvaluator.name)
        .all()
    )

    return [ExternalEvaluatorOut.model_validate(e) for e in evaluators]


@router.get("/evaluators/{evaluator_id}", response_model=ExternalEvaluatorOut)
def get_external_evaluator(
    evaluator_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a specific external evaluator (teacher/admin only)"""
    require_role(user, ["teacher", "admin"])

    evaluator = (
        db.query(ExternalEvaluator)
        .filter(
            ExternalEvaluator.id == evaluator_id,
            ExternalEvaluator.school_id == user.school_id,
        )
        .first()
    )

    if not evaluator:
        raise HTTPException(status_code=404, detail="External evaluator not found")

    return ExternalEvaluatorOut.model_validate(evaluator)


@router.put("/evaluators/{evaluator_id}", response_model=ExternalEvaluatorOut)
def update_external_evaluator(
    evaluator_id: int,
    payload: ExternalEvaluatorUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update an external evaluator (teacher/admin only)"""
    require_role(user, ["teacher", "admin"])

    evaluator = (
        db.query(ExternalEvaluator)
        .filter(
            ExternalEvaluator.id == evaluator_id,
            ExternalEvaluator.school_id == user.school_id,
        )
        .first()
    )

    if not evaluator:
        raise HTTPException(status_code=404, detail="External evaluator not found")

    # Update fields
    if payload.name is not None:
        evaluator.name = payload.name
    if payload.email is not None:
        evaluator.email = payload.email
    if payload.organisation is not None:
        evaluator.organisation = payload.organisation

    evaluator.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(evaluator)

    return ExternalEvaluatorOut.model_validate(evaluator)


# ============ Bulk Invitation Management ============


@router.post("/invitations/bulk")
def create_bulk_invitations(
    payload: BulkInviteRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Create external assessment invitations in bulk.
    Supports both PER_TEAM and ALL_TEAMS modes.
    """
    require_role(user, ["teacher", "admin"])

    if payload.mode == "PER_TEAM":
        if not payload.per_team_configs:
            raise HTTPException(
                status_code=400, detail="per_team_configs required for PER_TEAM mode"
            )

        created_links = []
        for config in payload.per_team_configs:
            # NOTE: config.group_id is a legacy field - ProjectTeamExternal still stores group_id
            # for backwards compatibility. This will be migrated in a future schema update.
            # For now, we trust that the client is sending valid group_id values.

            # Get or create evaluator
            evaluator = (
                db.query(ExternalEvaluator)
                .filter(
                    ExternalEvaluator.school_id == user.school_id,
                    ExternalEvaluator.email == config.evaluator_email,
                )
                .first()
            )

            if not evaluator:
                evaluator = ExternalEvaluator(
                    school_id=user.school_id,
                    name=config.evaluator_name,
                    email=config.evaluator_email,
                    organisation=config.evaluator_organisation,
                )
                db.add(evaluator)
                db.flush()

            # Check if link already exists for this assessment + group + team_number
            existing_link = (
                db.query(ProjectTeamExternal)
                .filter(
                    ProjectTeamExternal.assessment_id == payload.assessment_id,
                    ProjectTeamExternal.group_id == config.group_id,
                    ProjectTeamExternal.team_number == config.team_number,
                    ProjectTeamExternal.external_evaluator_id == evaluator.id,
                )
                .first()
            )

            if existing_link:
                # Update status if needed
                if existing_link.status == "NOT_INVITED":
                    existing_link.status = "INVITED"
                    existing_link.invited_at = datetime.utcnow()
                created_links.append(existing_link)
                continue

            # Create new link with unique token
            token = generate_external_token()
            link = ProjectTeamExternal(
                school_id=user.school_id,
                group_id=config.group_id,
                team_number=config.team_number,
                assessment_id=payload.assessment_id,  # Set assessment_id from payload
                external_evaluator_id=evaluator.id,
                invitation_token=token,
                token_expires_at=datetime.utcnow() + timedelta(days=90),
                status="INVITED",
                invited_at=datetime.utcnow(),
            )
            db.add(link)
            created_links.append(link)

        db.commit()

        return {
            "success": True,
            "message": f"Created {len(created_links)} invitation(s)",
            "invitations": [
                ProjectTeamExternalOut.model_validate(link) for link in created_links
            ],
        }

    elif payload.mode == "ALL_TEAMS":
        if not payload.all_teams_config:
            raise HTTPException(
                status_code=400, detail="all_teams_config required for ALL_TEAMS mode"
            )

        config = payload.all_teams_config

        # Get or create evaluator
        evaluator = (
            db.query(ExternalEvaluator)
            .filter(
                ExternalEvaluator.school_id == user.school_id,
                ExternalEvaluator.email == config.evaluator_email,
            )
            .first()
        )

        if not evaluator:
            evaluator = ExternalEvaluator(
                school_id=user.school_id,
                name=config.evaluator_name,
                email=config.evaluator_email,
                organisation=config.evaluator_organisation,
            )
            db.add(evaluator)
            db.flush()

        # Generate one token for all teams
        token = generate_external_token()
        created_links = []

        for team_info in config.teams:
            # NOTE: team_info.group_id is a legacy field - ProjectTeamExternal still stores group_id
            # for backwards compatibility. This will be migrated in a future schema update.

            # Check if link already exists for this assessment + group + team_number
            existing_link = (
                db.query(ProjectTeamExternal)
                .filter(
                    ProjectTeamExternal.assessment_id == payload.assessment_id,
                    ProjectTeamExternal.group_id == team_info.group_id,
                    ProjectTeamExternal.team_number == team_info.team_number,
                    ProjectTeamExternal.external_evaluator_id == evaluator.id,
                )
                .first()
            )

            if existing_link:
                # Update status if needed
                if existing_link.status == "NOT_INVITED":
                    existing_link.status = "INVITED"
                    existing_link.invited_at = datetime.utcnow()
                    # Update to use the same token for all teams
                    existing_link.invitation_token = token
                created_links.append(existing_link)
                continue

            # Create new link with shared token
            link = ProjectTeamExternal(
                school_id=user.school_id,
                group_id=team_info.group_id,
                team_number=team_info.team_number,
                assessment_id=payload.assessment_id,  # Set assessment_id from payload
                external_evaluator_id=evaluator.id,
                invitation_token=token,  # Same token for all teams
                token_expires_at=datetime.utcnow() + timedelta(days=90),
                status="INVITED",
                invited_at=datetime.utcnow(),
            )
            db.add(link)
            created_links.append(link)

        db.commit()

        return {
            "success": True,
            "message": f"Created {len(created_links)} invitation(s) with shared token",
            "token": token,
            "invitations": [
                ProjectTeamExternalOut.model_validate(link) for link in created_links
            ],
        }

    else:
        raise HTTPException(
            status_code=400, detail="Invalid mode. Must be PER_TEAM or ALL_TEAMS"
        )


@router.get(
    "/projects/{project_id}/external-status",
    response_model=List[ExternalAssessmentStatus],
)
def get_project_external_status(
    project_id: int,
    assessment_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get external assessment status for all teams in a project.
    Teams are identified by project_teams.team_number.
    External invitations are filtered by assessment_id to scope to specific assessments.

    Args:
        project_id: The project ID
        assessment_id: Optional assessment_id to filter external invitations for a specific assessment
    """
    require_role(user, ["teacher", "admin"])

    # Verify project exists and belongs to school
    project = (
        db.query(Project)
        .filter(
            Project.id == project_id,
            Project.school_id == user.school_id,
        )
        .first()
    )

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.course_id:
        return []

    # Get all project teams for this project
    project_teams = (
        db.query(ProjectTeam)
        .filter(
            ProjectTeam.project_id == project_id,
            ProjectTeam.school_id == user.school_id,
        )
        .all()
    )

    if not project_teams:
        return []

    # If assessment_id is provided, filter to only that assessment
    if assessment_id:
        # Verify assessment exists and belongs to this project/school
        assessment = (
            db.query(ProjectAssessment)
            .filter(
                ProjectAssessment.id == assessment_id,
                ProjectAssessment.project_id == project_id,
                ProjectAssessment.school_id == user.school_id,
            )
            .first()
        )

        if not assessment:
            raise HTTPException(
                status_code=400,
                detail="Assessment not found or doesn't belong to this project",
            )

    # Check if there are ANY external invitations for the specified assessment
    # If not, return empty to avoid showing invitations from other assessments
    if assessment_id:
        has_external_invitations = (
            db.query(ProjectTeamExternal)
            .filter(
                ProjectTeamExternal.assessment_id == assessment_id,
                ProjectTeamExternal.school_id == user.school_id,
            )
            .first()
            is not None
        )
    else:
        # No assessment filter, check for any invitations for this project
        has_external_invitations = (
            db.query(ProjectTeamExternal)
            .filter(
                ProjectTeamExternal.project_id == project_id,
                ProjectTeamExternal.school_id == user.school_id,
            )
            .first()
            is not None
        )

    if not has_external_invitations:
        return []

    status_list = []

    # Use project teams as the source of truth
    if project_teams:
        for project_team in project_teams:
                # Skip teams without team_number as external invitations use team_number for identification
                if project_team.team_number is None:
                    continue

                # Get team members from project_team_members
                team_members_records = (
                    db.query(User)
                    .join(ProjectTeamMember, ProjectTeamMember.user_id == User.id)
                    .filter(
                        ProjectTeamMember.project_team_id == project_team.id,
                        ProjectTeamMember.school_id == user.school_id,
                    )
                    .all()
                )

                # Build list of member names
                member_names = ", ".join([u.name or u.email for u in team_members_records])
                team_name = f"Team {project_team.team_number}"

                # Get external link if exists for this team
                # Filter by assessment_id if provided, otherwise by project_id + team_number
                if assessment_id:
                    # Filter by specific assessment and team_number
                    link = (
                        db.query(ProjectTeamExternal)
                        .filter(
                            ProjectTeamExternal.assessment_id == assessment_id,
                            ProjectTeamExternal.team_number == project_team.team_number,
                            ProjectTeamExternal.school_id == user.school_id,
                        )
                        .first()
                    )
                else:
                    # Match by project_id + team_number
                    link = (
                        db.query(ProjectTeamExternal)
                        .filter(
                            ProjectTeamExternal.project_id == project_id,
                            ProjectTeamExternal.team_number == project_team.team_number,
                            ProjectTeamExternal.school_id == user.school_id,
                        )
                        .first()
                    )

                # Use group_id from link if it exists, otherwise use team_id (legacy) from project_team
                # NOTE: ProjectTeamExternal.group_id is a legacy field that will be migrated later
                response_group_id = (
                    link.group_id
                    if link
                    else (project_team.team_id or 0)
                )

                # Include all teams that have team_number
                if link:
                    evaluator = db.get(ExternalEvaluator, link.external_evaluator_id)
                    status_list.append(
                        ExternalAssessmentStatus(
                            team_id=response_group_id,
                            team_number=project_team.team_number,
                            team_name=team_name,
                            members=member_names,
                            external_evaluator=(
                                ExternalEvaluatorOut.model_validate(evaluator)
                                if evaluator
                                else None
                            ),
                            status=link.status,
                            invitation_sent=(link.status != "NOT_INVITED"),
                            submitted_at=link.submitted_at,
                            updated_at=link.updated_at,
                        )
                    )
                else:
                    # Team exists but has no external invitation yet
                    status_list.append(
                        ExternalAssessmentStatus(
                            team_id=response_group_id,
                            team_number=project_team.team_number,
                            team_name=team_name,
                            members=member_names,
                            external_evaluator=None,
                            status="NOT_INVITED",
                            invitation_sent=False,
                            submitted_at=None,
                            updated_at=None,
                        )
                    )
    else:
        # Fallback: No project teams exist yet, get teams from external invitations
        # This ensures external invitations show up even if project teams haven't been created

        # Get all external invitations for this assessment or project
        if assessment_id:
            external_links = (
                db.query(ProjectTeamExternal)
                .filter(
                    ProjectTeamExternal.assessment_id == assessment_id,
                    ProjectTeamExternal.school_id == user.school_id,
                )
                .all()
            )
        else:
            external_links = (
                db.query(ProjectTeamExternal)
                .filter(
                    ProjectTeamExternal.project_id == project_id,
                    ProjectTeamExternal.school_id == user.school_id,
                )
                .all()
            )

        for link in external_links:
            # For each external link, try to get team member info
            team_num = link.team_number
            if team_num is None:
                continue

            # Try to find team members from project teams
            team_members_records = []

            # Check if there's a project team for this team_number
            potential_team = (
                db.query(ProjectTeam)
                .filter(
                    ProjectTeam.project_id == project_id,
                    ProjectTeam.team_number == team_num,
                    ProjectTeam.school_id == user.school_id,
                )
                .first()
            )

            if potential_team:
                team_members_records = (
                    db.query(User)
                    .join(ProjectTeamMember, ProjectTeamMember.user_id == User.id)
                    .filter(
                        ProjectTeamMember.project_team_id == potential_team.id,
                        ProjectTeamMember.school_id == user.school_id,
                    )
                    .all()
                )

            # Build member names
            member_names = (
                ", ".join([u.name or u.email for u in team_members_records])
                if team_members_records
                else ""
            )
            team_name = f"Team {team_num}"

            evaluator = db.get(ExternalEvaluator, link.external_evaluator_id)
            status_list.append(
                ExternalAssessmentStatus(
                    team_id=link.group_id,
                    team_number=team_num,
                    team_name=team_name,
                    members=member_names,
                    external_evaluator=(
                        ExternalEvaluatorOut.model_validate(evaluator)
                        if evaluator
                        else None
                    ),
                    status=link.status,
                    invitation_sent=(link.status != "NOT_INVITED"),
                    submitted_at=link.submitted_at,
                    updated_at=link.updated_at,
                )
            )

    return status_list


@router.get("/groups/{group_id}/external-advisory")
def get_external_advisory_detail(
    group_id: int,
    team_number: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get external advisory assessment detail for a specific team.
    Returns the rubric scores and general comment from the external evaluator.

    Args:
        group_id: The group/course ID
        team_number: The team number within the group (recommended for proper team identification
                     when multiple teams exist in the same group)
    """
    from app.infra.db.models import (
        ProjectAssessment,
        ProjectAssessmentScore,
        RubricCriterion,
    )
    from app.api.v1.schemas.external_assessments import (
        ExternalAdvisoryScoreOut,
        ExternalAdvisoryDetail,
    )

    require_role(user, ["teacher", "admin"])

    # NOTE: group_id is a legacy parameter - ProjectTeamExternal still uses group_id for now
    # This will be migrated to use project_id + team_number in a future API version

    # Get external link - filter by group_id and optionally team_number
    link_query = db.query(ProjectTeamExternal).filter(
        ProjectTeamExternal.group_id == group_id,
        ProjectTeamExternal.school_id == user.school_id,
    )
    if team_number is not None:
        link_query = link_query.filter(ProjectTeamExternal.team_number == team_number)
    link = link_query.first()

    if not link:
        detail_msg = (
            f"No external evaluator linked to team {team_number}"
            if team_number is not None
            else "No external evaluator linked to this group"
        )
        raise HTTPException(status_code=404, detail=detail_msg)

    # Get external evaluator
    evaluator = db.get(ExternalEvaluator, link.external_evaluator_id)
    if not evaluator:
        raise HTTPException(status_code=404, detail="External evaluator not found")

    # Get external assessment
    assessment = (
        db.query(ProjectAssessment)
        .filter(
            ProjectAssessment.group_id == group_id,
            ProjectAssessment.external_evaluator_id == link.external_evaluator_id,
            ProjectAssessment.role == "EXTERNAL",
        )
        .first()
    )

    if not assessment:
        raise HTTPException(
            status_code=404, detail="No external assessment found for this team"
        )

    # Get rubric
    rubric = db.get(Rubric, assessment.rubric_id)
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")

    # Get scores with criterion info
    # Note: Scores are associated with the assessment which is already scoped to the evaluator/team
    scores = (
        db.query(ProjectAssessmentScore)
        .filter(ProjectAssessmentScore.assessment_id == assessment.id)
        .all()
    )

    score_outputs = []
    for score in scores:
        criterion = db.get(RubricCriterion, score.criterion_id)
        score_outputs.append(
            ExternalAdvisoryScoreOut(
                criterion_id=score.criterion_id,
                criterion_name=criterion.name if criterion else "Unknown",
                category=criterion.category if criterion else None,
                score=score.score,
                comment=score.comment,
            )
        )

    # Get general comment from metadata
    general_comment = None
    if assessment.metadata_json:
        general_comment = assessment.metadata_json.get("general_comment")

    # Construct team name - use "Team X" format when team_number is provided, otherwise use group name
    team_display_name = f"Team {team_number}" if team_number is not None else group.name

    return ExternalAdvisoryDetail(
        team_id=group_id,
        team_name=team_display_name,
        external_evaluator=ExternalEvaluatorOut.model_validate(evaluator),
        rubric_title=rubric.title,
        rubric_scale_min=rubric.scale_min,
        rubric_scale_max=rubric.scale_max,
        scores=score_outputs,
        general_comment=general_comment,
        submitted_at=link.submitted_at,
        status=link.status,
    )
