"""
API endpoints for External Assessments
Public endpoints that use token-based authentication
"""

from __future__ import annotations
from typing import List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db
from app.infra.db.models import (
    ExternalEvaluator,
    ProjectTeamExternal,
    ProjectAssessment,
    ProjectAssessmentScore,
    ProjectAssessmentTeam,
    ProjectTeam,
    ProjectTeamMember,
    User,
    Project,
    Rubric,
    RubricCriterion,
)
from app.api.v1.schemas.external_assessments import (
    ExternalAssessmentTokenInfo,
    ExternalAssessmentTeamInfo,
    ExternalAssessmentDetail,
    ExternalAssessmentSubmit,
    ExternalAssessmentSubmitResponse,
    ExternalAssessmentScoreOut,
    RubricForExternal,
    RubricCriterionForExternal,
    ExternalEvaluatorOut,
)

router = APIRouter(prefix="/external-assessments", tags=["external-assessments"])


def _validate_token(db: Session, token: str) -> ProjectTeamExternal:
    """
    Validate an invitation token and return the first team link.
    Raises HTTPException if invalid or expired.
    """
    team_link = (
        db.query(ProjectTeamExternal)
        .filter(ProjectTeamExternal.invitation_token == token)
        .first()
    )

    if not team_link:
        raise HTTPException(
            status_code=404, detail="Invalid or expired invitation token"
        )

    # Check expiration
    if team_link.token_expires_at and team_link.token_expires_at < datetime.utcnow():
        raise HTTPException(status_code=403, detail="This invitation has expired")

    return team_link


def _get_all_team_links_for_token(db: Session, token: str) -> List[ProjectTeamExternal]:
    """
    Get all team links that share the same token.
    This handles both per-team (one link) and all-teams (multiple links with same token).
    """
    return (
        db.query(ProjectTeamExternal)
        .filter(ProjectTeamExternal.invitation_token == token)
        .all()
    )


def _get_member_names(db: Session, project_id: int, team_number: int) -> str:
    """
    Get comma-separated member names for a team (identified by project_id + team_number).
    """
    # Find the ProjectTeam
    team = (
        db.query(ProjectTeam)
        .filter(
            ProjectTeam.project_id == project_id,
            ProjectTeam.team_number == team_number,
        )
        .first()
    )

    if not team:
        return ""

    # Get team members
    members = (
        db.query(User)
        .join(ProjectTeamMember, ProjectTeamMember.user_id == User.id)
        .filter(
            ProjectTeamMember.team_id == team.id,
            ProjectTeamMember.active.is_(True),
            User.archived.is_(False),
        )
        .all()
    )

    member_names = [m.name for m in members if m.name]

    return ", ".join(member_names) if member_names else ""


# ============ Public External Assessment Endpoints ============


@router.get("/{token}", response_model=ExternalAssessmentTokenInfo)
def resolve_token_and_list_teams(
    token: str,
    db: Session = Depends(get_db),
):
    """
    Resolve an invitation token and return info about all teams to assess.

    This endpoint is public (no auth required) but requires a valid token.
    """
    # Validate the token
    first_link = _validate_token(db, token)

    # Get all team links for this token
    team_links = _get_all_team_links_for_token(db, token)

    if not team_links:
        raise HTTPException(status_code=404, detail="No teams found for this token")

    # Get the external evaluator
    evaluator = db.get(ExternalEvaluator, first_link.external_evaluator_id)
    if not evaluator:
        raise HTTPException(status_code=404, detail="External evaluator not found")

    # Build team info list
    teams = []
    project_name = None
    class_name = None

    for link in team_links:
        # Get the team_number from the link
        team_number = link.team_number
        if not team_number:
            continue  # Skip links without team_number

        # Get project info if available
        project = None
        if link.project_id:
            project = db.get(Project, link.project_id)
            if project and not project_name:
                project_name = project.title
                class_name = project.class_name

        # Skip if no project - we need it to find the team
        if not project:
            continue

        # Determine status based on link status
        status = "NOT_STARTED"
        if link.status == "SUBMITTED":
            status = "SUBMITTED"
        elif link.status == "IN_PROGRESS":
            status = "IN_PROGRESS"

        # Create proper team name from team_number
        team_name = f"Team {team_number}"

        # Get member names (filtered by project_id + team_number)
        members = _get_member_names(db, project.id, team_number)

        teams.append(
            ExternalAssessmentTeamInfo(
                team_id=link.id,  # Use link.id as team_id for routing
                team_name=team_name,
                team_number=team_number,
                members=members,
                project_id=project.id if project else None,
                project_title=project.title if project else None,
                class_name=project.class_name if project else None,
                description=project.description if project else None,
                status=status,
            )
        )

    return ExternalAssessmentTokenInfo(
        token=token,
        external_evaluator=ExternalEvaluatorOut.model_validate(evaluator),
        teams=teams,
        project_name=project_name,
        class_name=class_name,
        single_team=(len(teams) == 1),
    )


@router.get("/{token}/teams/{team_id}", response_model=ExternalAssessmentDetail)
def get_team_assessment_detail(
    token: str,
    team_id: int,  # This is now the ProjectTeamExternal.id
    db: Session = Depends(get_db),
):
    """
    Get rubric and existing scores for a specific team.

    This endpoint is public (no auth required) but requires a valid token
    and validates that the team is associated with this token.
    team_id is the ProjectTeamExternal.id.
    """
    # Validate token
    _validate_token(db, token)

    # Get the team link by id and verify it matches the token
    team_link = (
        db.query(ProjectTeamExternal)
        .filter(
            ProjectTeamExternal.id == team_id,
            ProjectTeamExternal.invitation_token == token,
        )
        .first()
    )

    if not team_link:
        raise HTTPException(
            status_code=403, detail="This team is not accessible with your invitation"
        )

    # Get project
    project = None
    if team_link.project_id:
        project = db.get(Project, team_link.project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    team_number = team_link.team_number
    if not team_number:
        raise HTTPException(status_code=404, detail="Team number not found")

    # Find the ProjectTeam
    project_team = (
        db.query(ProjectTeam)
        .filter(
            ProjectTeam.project_id == project.id,
            ProjectTeam.team_number == team_number,
        )
        .first()
    )

    if not project_team:
        raise HTTPException(status_code=404, detail="Team not found in project")

    # Find existing external assessment for this evaluator + team via junction table
    existing_assessment = (
        db.query(ProjectAssessment)
        .join(
            ProjectAssessmentTeam,
            ProjectAssessmentTeam.project_assessment_id == ProjectAssessment.id,
        )
        .filter(
            ProjectAssessmentTeam.project_team_id == project_team.id,
            ProjectAssessment.external_evaluator_id == team_link.external_evaluator_id,
            ProjectAssessment.role == "EXTERNAL",
        )
        .first()
    )

    # Get rubric - either from existing assessment or need to determine from project
    rubric = None
    if existing_assessment:
        rubric = db.get(Rubric, existing_assessment.rubric_id)
    else:
        # For now, get any project-scope rubric
        # TODO: This should be configurable per project
        rubric = (
            db.query(Rubric)
            .filter(
                Rubric.school_id == project.school_id,
                Rubric.scope == "project",
            )
            .first()
        )

    if not rubric:
        raise HTTPException(
            status_code=404, detail="No rubric configured for external assessment"
        )

    # Get criteria (only visible to externals)
    criteria = (
        db.query(RubricCriterion)
        .filter(
            RubricCriterion.rubric_id == rubric.id,
            RubricCriterion.visible_to_external.is_(True),
        )
        .all()
    )

    rubric_out = RubricForExternal(
        id=rubric.id,
        title=rubric.title,
        description=rubric.description,
        scale_min=rubric.scale_min,
        scale_max=rubric.scale_max,
        criteria=[
            RubricCriterionForExternal(
                id=c.id,
                name=c.name,
                weight=c.weight,
                descriptors=c.descriptors or {},
                category=c.category,
            )
            for c in criteria
        ],
    )

    # Get existing scores if any
    existing_scores = []
    general_comment = None
    if existing_assessment:
        scores = (
            db.query(ProjectAssessmentScore)
            .filter(ProjectAssessmentScore.assessment_id == existing_assessment.id)
            .all()
        )

        existing_scores = [
            ExternalAssessmentScoreOut(
                criterion_id=s.criterion_id,
                score=s.score,
                comment=s.comment,
            )
            for s in scores
        ]

        # General comment might be in metadata
        if existing_assessment.metadata_json:
            general_comment = existing_assessment.metadata_json.get("general_comment")

    # Determine status
    status = "NOT_STARTED"
    if team_link.status == "SUBMITTED":
        status = "SUBMITTED"
    elif team_link.status == "IN_PROGRESS" or existing_scores:
        status = "IN_PROGRESS"

    # Create proper team name from team_number
    team_name = f"Team {team_number}"

    # Get member names (filtered by team_number)
    members = _get_member_names(db, project.id, team_number)

    return ExternalAssessmentDetail(
        team_id=team_id,
        team_name=team_name,
        team_number=team_number,
        members=members,
        project_title=project.title if project else None,
        project_description=project.description if project else None,
        rubric=rubric_out,
        existing_scores=existing_scores,
        general_comment=general_comment,
        status=status,
    )


@router.post(
    "/{token}/teams/{team_id}", response_model=ExternalAssessmentSubmitResponse
)
def submit_team_assessment(
    token: str,
    team_id: int,  # This is now the ProjectTeamExternal.id
    payload: ExternalAssessmentSubmit,
    db: Session = Depends(get_db),
):
    """
    Save or submit external assessment scores for a team.

    If submit=True, marks the assessment as final submission.
    If submit=False, saves as draft (IN_PROGRESS status).
    team_id is the ProjectTeamExternal.id.
    """
    # Validate token
    _validate_token(db, token)

    # Get the team link by id and verify it matches the token
    team_link = (
        db.query(ProjectTeamExternal)
        .filter(
            ProjectTeamExternal.id == team_id,
            ProjectTeamExternal.invitation_token == token,
        )
        .first()
    )

    if not team_link:
        raise HTTPException(
            status_code=403, detail="This team is not accessible with your invitation"
        )

    # Check if already submitted
    if team_link.status == "SUBMITTED" and payload.submit:
        raise HTTPException(
            status_code=400, detail="This assessment has already been submitted"
        )

    # Get project
    project = None
    if team_link.project_id:
        project = db.get(Project, team_link.project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    team_number = team_link.team_number
    if not team_number:
        raise HTTPException(status_code=404, detail="Team number not found")

    # Find the ProjectTeam
    project_team = (
        db.query(ProjectTeam)
        .filter(
            ProjectTeam.project_id == project.id,
            ProjectTeam.team_number == team_number,
        )
        .first()
    )

    if not project_team:
        raise HTTPException(status_code=404, detail="Team not found in project")

    # Get or create ProjectAssessment via junction table
    assessment = (
        db.query(ProjectAssessment)
        .join(
            ProjectAssessmentTeam,
            ProjectAssessmentTeam.project_assessment_id == ProjectAssessment.id,
        )
        .filter(
            ProjectAssessmentTeam.project_team_id == project_team.id,
            ProjectAssessment.external_evaluator_id == team_link.external_evaluator_id,
            ProjectAssessment.role == "EXTERNAL",
        )
        .first()
    )

    if not assessment:
        # Get rubric - for now use any project-scope rubric
        # TODO: Should be configurable
        rubric = (
            db.query(Rubric)
            .filter(
                Rubric.school_id == project.school_id,
                Rubric.scope == "project",
            )
            .first()
        )

        if not rubric:
            raise HTTPException(
                status_code=404, detail="No rubric configured for external assessment"
            )

        # Get evaluator
        evaluator = db.get(ExternalEvaluator, team_link.external_evaluator_id)

        assessment = ProjectAssessment(
            school_id=project.school_id,
            project_id=project.id,  # Assessments now belong to projects, not individual teams. Teams are linked via ProjectAssessmentTeam junction table.
            rubric_id=rubric.id,
            external_evaluator_id=team_link.external_evaluator_id,
            title=f"External Assessment - {evaluator.name if evaluator else 'External'}",
            role="EXTERNAL",
            is_advisory=True,
            status="draft",
            metadata_json={},
        )
        db.add(assessment)
        db.flush()

        # Create junction table entry linking assessment to team
        assessment_team = ProjectAssessmentTeam(
            school_id=project.school_id,
            project_assessment_id=assessment.id,
            project_team_id=project_team.id,
            status="in_progress",
            scores_count=0,
        )
        db.add(assessment_team)
        db.flush()

    # Update metadata with general comment
    if payload.general_comment:
        if not assessment.metadata_json:
            assessment.metadata_json = {}
        assessment.metadata_json["general_comment"] = payload.general_comment

    # Save/update scores
    for score_data in payload.scores:
        # Check if score already exists
        existing_score = (
            db.query(ProjectAssessmentScore)
            .filter(
                ProjectAssessmentScore.assessment_id == assessment.id,
                ProjectAssessmentScore.criterion_id == score_data.criterion_id,
            )
            .first()
        )

        if existing_score:
            existing_score.score = score_data.score
            existing_score.comment = score_data.comment
        else:
            new_score = ProjectAssessmentScore(
                school_id=project.school_id,
                assessment_id=assessment.id,
                criterion_id=score_data.criterion_id,
                score=score_data.score,
                comment=score_data.comment,
            )
            db.add(new_score)

    # Update status
    new_status = "SUBMITTED" if payload.submit else "IN_PROGRESS"
    team_link.status = new_status

    if payload.submit:
        team_link.submitted_at = datetime.utcnow()
        assessment.status = "published"
        assessment.published_at = datetime.utcnow()

    db.commit()

    message = (
        "Assessment submitted successfully"
        if payload.submit
        else "Draft saved successfully"
    )

    return ExternalAssessmentSubmitResponse(
        success=True,
        message=message,
        status=new_status,
    )
