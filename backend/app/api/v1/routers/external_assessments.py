"""
API endpoints for External Assessments
Public endpoints that use token-based authentication
"""

from __future__ import annotations
from typing import List, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import Session, joinedload

from app.api.v1.deps import get_db
from app.infra.db.models import (
    ExternalEvaluator,
    ProjectTeamExternal,
    ProjectAssessment,
    ProjectAssessmentScore,
    Group,
    GroupMember,
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
    team_link = db.query(ProjectTeamExternal).filter(
        ProjectTeamExternal.invitation_token == token
    ).first()
    
    if not team_link:
        raise HTTPException(
            status_code=404,
            detail="Invalid or expired invitation token"
        )
    
    # Check expiration
    if team_link.token_expires_at and team_link.token_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=403,
            detail="This invitation has expired"
        )
    
    return team_link


def _get_all_team_links_for_token(db: Session, token: str) -> List[ProjectTeamExternal]:
    """
    Get all team links that share the same token.
    This handles both per-team (one link) and all-teams (multiple links with same token).
    """
    return db.query(ProjectTeamExternal).filter(
        ProjectTeamExternal.invitation_token == token
    ).all()


def _get_member_names(db: Session, group_id: int) -> str:
    """
    Get comma-separated member names for a group/team.
    """
    members = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.active == True
    ).all()
    
    member_names = []
    for member in members:
        user = db.get(User, member.user_id)
        if user:
            member_names.append(user.name)
    
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
        # Get group info
        group = db.get(Group, link.group_id)
        if not group:
            continue
        
        # Get project info if available
        project = None
        if link.project_id:
            project = db.get(Project, link.project_id)
            if project and not project_name:
                project_name = project.title
                class_name = project.class_name
        
        # Determine status based on link status
        status = "NOT_STARTED"
        if link.status == "SUBMITTED":
            status = "SUBMITTED"
        elif link.status == "IN_PROGRESS":
            status = "IN_PROGRESS"
        
        # Create proper team name from team_number
        team_name = f"Team {group.team_number}" if group.team_number else group.name
        
        # Get member names
        members = _get_member_names(db, group.id)
        
        teams.append(
            ExternalAssessmentTeamInfo(
                team_id=group.id,
                team_name=team_name,
                team_number=group.team_number,
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
    team_id: int,
    db: Session = Depends(get_db),
):
    """
    Get rubric and existing scores for a specific team.
    
    This endpoint is public (no auth required) but requires a valid token
    and validates that the team is associated with this token.
    """
    # Validate token
    _validate_token(db, token)
    
    # Get all team links for this token and verify team_id is in the list
    team_links = _get_all_team_links_for_token(db, token)
    team_link = next((link for link in team_links if link.group_id == team_id), None)
    
    if not team_link:
        raise HTTPException(
            status_code=403,
            detail="This team is not accessible with your invitation"
        )
    
    # Get group/team
    group = db.get(Group, team_id)
    if not group:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Get project if available
    project = None
    if team_link.project_id:
        project = db.get(Project, team_link.project_id)
    
    # Find existing external assessment for this evaluator + team
    existing_assessment = db.query(ProjectAssessment).filter(
        ProjectAssessment.group_id == team_id,
        ProjectAssessment.external_evaluator_id == team_link.external_evaluator_id,
        ProjectAssessment.role == "EXTERNAL",
    ).first()
    
    # Get rubric - either from existing assessment or need to determine from project
    rubric = None
    if existing_assessment:
        rubric = db.get(Rubric, existing_assessment.rubric_id)
    else:
        # For now, get any project-scope rubric
        # TODO: This should be configurable per project
        rubric = db.query(Rubric).filter(
            Rubric.school_id == group.school_id,
            Rubric.scope == "project",
        ).first()
    
    if not rubric:
        raise HTTPException(
            status_code=404,
            detail="No rubric configured for external assessment"
        )
    
    # Get criteria (only visible to externals)
    criteria = db.query(RubricCriterion).filter(
        RubricCriterion.rubric_id == rubric.id,
        RubricCriterion.visible_to_external == True,
    ).all()
    
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
        scores = db.query(ProjectAssessmentScore).filter(
            ProjectAssessmentScore.assessment_id == existing_assessment.id
        ).all()
        
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
    team_name = f"Team {group.team_number}" if group.team_number else group.name
    
    # Get member names
    members = _get_member_names(db, group.id)
    
    return ExternalAssessmentDetail(
        team_id=team_id,
        team_name=team_name,
        team_number=group.team_number,
        members=members,
        project_title=project.title if project else None,
        project_description=project.description if project else None,
        rubric=rubric_out,
        existing_scores=existing_scores,
        general_comment=general_comment,
        status=status,
    )


@router.post("/{token}/teams/{team_id}", response_model=ExternalAssessmentSubmitResponse)
def submit_team_assessment(
    token: str,
    team_id: int,
    payload: ExternalAssessmentSubmit,
    db: Session = Depends(get_db),
):
    """
    Save or submit external assessment scores for a team.
    
    If submit=True, marks the assessment as final submission.
    If submit=False, saves as draft (IN_PROGRESS status).
    """
    # Validate token
    _validate_token(db, token)
    
    # Get team link and verify access
    team_links = _get_all_team_links_for_token(db, token)
    team_link = next((link for link in team_links if link.group_id == team_id), None)
    
    if not team_link:
        raise HTTPException(
            status_code=403,
            detail="This team is not accessible with your invitation"
        )
    
    # Check if already submitted
    if team_link.status == "SUBMITTED" and payload.submit:
        raise HTTPException(
            status_code=400,
            detail="This assessment has already been submitted"
        )
    
    # Get group
    group = db.get(Group, team_id)
    if not group:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Get or create ProjectAssessment
    assessment = db.query(ProjectAssessment).filter(
        ProjectAssessment.group_id == team_id,
        ProjectAssessment.external_evaluator_id == team_link.external_evaluator_id,
        ProjectAssessment.role == "EXTERNAL",
    ).first()
    
    if not assessment:
        # Get rubric - for now use any project-scope rubric
        # TODO: Should be configurable
        rubric = db.query(Rubric).filter(
            Rubric.school_id == group.school_id,
            Rubric.scope == "project",
        ).first()
        
        if not rubric:
            raise HTTPException(
                status_code=404,
                detail="No rubric configured for external assessment"
            )
        
        # Get evaluator
        evaluator = db.get(ExternalEvaluator, team_link.external_evaluator_id)
        
        assessment = ProjectAssessment(
            school_id=group.school_id,
            group_id=team_id,
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
    
    # Update metadata with general comment
    if payload.general_comment:
        if not assessment.metadata_json:
            assessment.metadata_json = {}
        assessment.metadata_json["general_comment"] = payload.general_comment
    
    # Save/update scores
    for score_data in payload.scores:
        # Check if score already exists
        existing_score = db.query(ProjectAssessmentScore).filter(
            ProjectAssessmentScore.assessment_id == assessment.id,
            ProjectAssessmentScore.criterion_id == score_data.criterion_id,
        ).first()
        
        if existing_score:
            existing_score.score = score_data.score
            existing_score.comment = score_data.comment
        else:
            new_score = ProjectAssessmentScore(
                school_id=group.school_id,
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
    
    message = "Assessment submitted successfully" if payload.submit else "Draft saved successfully"
    
    return ExternalAssessmentSubmitResponse(
        success=True,
        message=message,
        status=new_status,
    )
