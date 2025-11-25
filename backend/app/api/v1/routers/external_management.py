"""
Teacher/Admin endpoints for managing external assessments
"""

from __future__ import annotations
from typing import List, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    User,
    ExternalEvaluator,
    ProjectTeamExternal,
    Group,
    Project,
    Rubric,
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
    prefix="/projects/external-management",
    tags=["external-assessments-management"]
)


# ============ External Evaluator CRUD ============


@router.post("/evaluators", response_model=ExternalEvaluatorOut, status_code=status.HTTP_201_CREATED)
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
    existing = db.query(ExternalEvaluator).filter(
        ExternalEvaluator.school_id == user.school_id,
        ExternalEvaluator.email == payload.email,
    ).first()
    
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
    
    evaluators = db.query(ExternalEvaluator).filter(
        ExternalEvaluator.school_id == user.school_id
    ).order_by(ExternalEvaluator.name).all()
    
    return [ExternalEvaluatorOut.model_validate(e) for e in evaluators]


@router.get("/evaluators/{evaluator_id}", response_model=ExternalEvaluatorOut)
def get_external_evaluator(
    evaluator_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a specific external evaluator (teacher/admin only)"""
    require_role(user, ["teacher", "admin"])
    
    evaluator = db.query(ExternalEvaluator).filter(
        ExternalEvaluator.id == evaluator_id,
        ExternalEvaluator.school_id == user.school_id,
    ).first()
    
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
    
    evaluator = db.query(ExternalEvaluator).filter(
        ExternalEvaluator.id == evaluator_id,
        ExternalEvaluator.school_id == user.school_id,
    ).first()
    
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
                status_code=400,
                detail="per_team_configs required for PER_TEAM mode"
            )
        
        created_links = []
        for config in payload.per_team_configs:
            # Verify group exists and belongs to this school
            group = db.query(Group).filter(
                Group.id == config.group_id,
                Group.school_id == user.school_id,
            ).first()
            
            if not group:
                continue  # Skip invalid groups
            
            # Get or create evaluator
            evaluator = db.query(ExternalEvaluator).filter(
                ExternalEvaluator.school_id == user.school_id,
                ExternalEvaluator.email == config.evaluator_email,
            ).first()
            
            if not evaluator:
                evaluator = ExternalEvaluator(
                    school_id=user.school_id,
                    name=config.evaluator_name,
                    email=config.evaluator_email,
                    organisation=config.evaluator_organisation,
                )
                db.add(evaluator)
                db.flush()
            
            # Check if link already exists
            existing_link = db.query(ProjectTeamExternal).filter(
                ProjectTeamExternal.group_id == config.group_id,
                ProjectTeamExternal.external_evaluator_id == evaluator.id,
            ).first()
            
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
                status_code=400,
                detail="all_teams_config required for ALL_TEAMS mode"
            )
        
        config = payload.all_teams_config
        
        # Get or create evaluator
        evaluator = db.query(ExternalEvaluator).filter(
            ExternalEvaluator.school_id == user.school_id,
            ExternalEvaluator.email == config.evaluator_email,
        ).first()
        
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
        
        for group_id in config.group_ids:
            # Verify group exists
            group = db.query(Group).filter(
                Group.id == group_id,
                Group.school_id == user.school_id,
            ).first()
            
            if not group:
                continue
            
            # Check if link already exists
            existing_link = db.query(ProjectTeamExternal).filter(
                ProjectTeamExternal.group_id == group_id,
                ProjectTeamExternal.external_evaluator_id == evaluator.id,
            ).first()
            
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
                group_id=group_id,
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
            status_code=400,
            detail="Invalid mode. Must be PER_TEAM or ALL_TEAMS"
        )


@router.get("/projects/{project_id}/external-status", response_model=List[ExternalAssessmentStatus])
def get_project_external_status(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get external assessment status for all teams in a project.
    """
    require_role(user, ["teacher", "admin"])
    
    # Verify project exists and belongs to school
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.school_id == user.school_id,
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get all groups/teams for this project's course
    if not project.course_id:
        return []
    
    from app.infra.db.models import GroupMember, User as UserModel
    
    groups = db.query(Group).filter(
        Group.course_id == project.course_id,
        Group.school_id == user.school_id,
    ).all()
    
    status_list = []
    for group in groups:
        # Get group members
        members = db.query(UserModel).join(
            GroupMember, GroupMember.user_id == UserModel.id
        ).filter(
            GroupMember.group_id == group.id
        ).all()
        member_names = ", ".join([m.display_name or m.email for m in members])
        
        # Get external link if exists
        link = db.query(ProjectTeamExternal).filter(
            ProjectTeamExternal.group_id == group.id,
        ).first()
        
        if link:
            evaluator = db.get(ExternalEvaluator, link.external_evaluator_id)
            status_list.append(
                ExternalAssessmentStatus(
                    team_id=group.id,
                    team_name=group.name,
                    members=member_names,
                    external_evaluator=ExternalEvaluatorOut.model_validate(evaluator) if evaluator else None,
                    status=link.status,
                    invitation_sent=(link.status != "NOT_INVITED"),
                    submitted_at=link.submitted_at,
                    updated_at=link.updated_at,
                )
            )
        else:
            status_list.append(
                ExternalAssessmentStatus(
                    team_id=group.id,
                    team_name=group.name,
                    members=member_names,
                    external_evaluator=None,
                    status="NOT_INVITED",
                    invitation_sent=False,
                    submitted_at=None,
                    updated_at=None,
                )
            )
    
    return status_list


@router.get("/groups/{group_id}/external-advisory")
def get_external_advisory_detail(
    group_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get external advisory assessment detail for a specific team.
    Returns the rubric scores and general comment from the external evaluator.
    """
    from app.infra.db.models import ProjectAssessment, ProjectAssessmentScore, RubricCriterion
    from app.api.v1.schemas.external_assessments import ExternalAdvisoryScoreOut, ExternalAdvisoryDetail
    
    require_role(user, ["teacher", "admin"])
    
    # Verify group exists and belongs to school
    group = db.query(Group).filter(
        Group.id == group_id,
        Group.school_id == user.school_id,
    ).first()
    
    if not group:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Get external link
    link = db.query(ProjectTeamExternal).filter(
        ProjectTeamExternal.group_id == group_id,
    ).first()
    
    if not link:
        raise HTTPException(status_code=404, detail="No external evaluator linked to this team")
    
    # Get external evaluator
    evaluator = db.get(ExternalEvaluator, link.external_evaluator_id)
    if not evaluator:
        raise HTTPException(status_code=404, detail="External evaluator not found")
    
    # Get external assessment
    assessment = db.query(ProjectAssessment).filter(
        ProjectAssessment.group_id == group_id,
        ProjectAssessment.external_evaluator_id == link.external_evaluator_id,
        ProjectAssessment.role == "EXTERNAL",
    ).first()
    
    if not assessment:
        raise HTTPException(status_code=404, detail="No external assessment found for this team")
    
    # Get rubric
    rubric = db.get(Rubric, assessment.rubric_id)
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    
    # Get scores with criterion info
    scores = db.query(ProjectAssessmentScore).filter(
        ProjectAssessmentScore.assessment_id == assessment.id
    ).all()
    
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
    
    return ExternalAdvisoryDetail(
        team_id=group_id,
        team_name=group.name,
        external_evaluator=ExternalEvaluatorOut.model_validate(evaluator),
        rubric_title=rubric.title,
        rubric_scale_min=rubric.scale_min,
        rubric_scale_max=rubric.scale_max,
        scores=score_outputs,
        general_comment=general_comment,
        submitted_at=link.submitted_at,
        status=link.status,
    )
