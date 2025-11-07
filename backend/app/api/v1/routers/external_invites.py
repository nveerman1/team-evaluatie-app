"""
API endpoints for External Invites in Competency Monitor
"""

from __future__ import annotations
from typing import List, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    User,
    Competency,
    CompetencyWindow,
    CompetencyExternalInvite,
    CompetencyExternalScore,
)
from app.api.v1.schemas.competencies import (
    ExternalInviteCreate,
    ExternalInviteOut,
    ExternalInvitePublicInfo,
    ExternalScoreSubmit,
    ExternalScoreOut,
    CompetencyOut,
)
from app.core.security import generate_external_token, hash_token

router = APIRouter(prefix="/competencies/external", tags=["competencies-external"])

# Default settings
DEFAULT_INVITE_TTL_DAYS = 14
DEFAULT_MAX_INVITES_PER_SUBJECT = 3


def get_window_setting(window: CompetencyWindow, key: str, default):
    """Helper to get setting from window settings dict"""
    if window.settings is None:
        return default
    return window.settings.get(key, default)


# ============ Invite Management (Authenticated) ============


@router.post("/invites", response_model=List[ExternalInviteOut], status_code=status.HTTP_201_CREATED)
def create_invites(
    data: ExternalInviteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create external invite(s) for a window/subject
    Students can invite for themselves, teachers can invite for any student
    """
    # Get window
    window = db.get(CompetencyWindow, data.window_id)
    if not window or window.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Window not found")

    # Check if external feedback is allowed
    allow_external = get_window_setting(window, "allow_external_feedback", False)
    if not allow_external:
        raise HTTPException(
            status_code=403, detail="External feedback is not enabled for this window"
        )

    # Check window status
    if window.status not in ["open", "draft"]:
        raise HTTPException(status_code=400, detail="Window is not open for invites")

    # Check authorization
    if current_user.role == "student":
        # Students can only invite for themselves
        if data.subject_user_id != current_user.id:
            raise HTTPException(
                status_code=403, detail="You can only invite reviewers for yourself"
            )
    elif current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=403, detail="Insufficient permissions to create invites"
        )

    # Verify subject exists and is in same school
    subject = db.get(User, data.subject_user_id)
    if not subject or subject.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Subject user not found")

    # Check invite limit
    max_invites = get_window_setting(
        window, "max_invites_per_subject", DEFAULT_MAX_INVITES_PER_SUBJECT
    )
    existing_count = db.execute(
        select(func.count(CompetencyExternalInvite.id)).where(
            CompetencyExternalInvite.window_id == data.window_id,
            CompetencyExternalInvite.subject_user_id == data.subject_user_id,
            CompetencyExternalInvite.status.in_(["pending", "used"]),
        )
    ).scalar()

    if existing_count + len(data.emails) > max_invites:
        raise HTTPException(
            status_code=400,
            detail=f"Invite limit exceeded. Maximum {max_invites} invites per subject.",
        )

    # Get rubric snapshot (competencies + levels)
    competencies_query = select(Competency).where(
        Competency.school_id == current_user.school_id,
        Competency.active == True,
    )
    
    # Filter by selected competencies if specified
    if data.competency_ids:
        competencies_query = competencies_query.where(
            Competency.id.in_(data.competency_ids)
        )
    
    competencies = db.execute(competencies_query).scalars().all()
    
    # Validate that at least one competency is selected
    if not competencies:
        raise HTTPException(
            status_code=400,
            detail="At least one competency must be selected for the invite.",
        )

    rubric_snapshot = {
        "competencies": [
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "scale_min": c.scale_min,
                "scale_max": c.scale_max,
            }
            for c in competencies
        ]
    }

    # Determine TTL
    ttl_days = get_window_setting(window, "invite_ttl_days", DEFAULT_INVITE_TTL_DAYS)
    expires_at = datetime.utcnow() + timedelta(days=ttl_days)

    # Create invites
    created_invites = []
    for email in data.emails:
        # Generate token
        token = generate_external_token()
        token_hash_value = hash_token(token)

        invite = CompetencyExternalInvite(
            school_id=current_user.school_id,
            window_id=data.window_id,
            subject_user_id=data.subject_user_id,
            invited_by_user_id=current_user.id,
            email=email.strip().lower(),
            external_name=data.external_name,
            external_organization=data.external_organization,
            token_hash=token_hash_value,
            status="pending",
            expires_at=expires_at,
            rubric_snapshot=rubric_snapshot,
        )
        db.add(invite)
        created_invites.append(invite)

    db.commit()

    # Refresh to get IDs
    for invite in created_invites:
        db.refresh(invite)

    # TODO: Send emails asynchronously
    # For now, just mark as sent
    for invite in created_invites:
        invite.sent_at = datetime.utcnow()
    db.commit()

    return created_invites


@router.get("/invites", response_model=List[ExternalInviteOut])
def list_my_invites(
    window_id: Optional[int] = Query(None),
    subject_user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List invites
    - Students: only their own invites
    - Teachers: all invites for the window or specific subject
    """
    query = select(CompetencyExternalInvite).where(
        CompetencyExternalInvite.school_id == current_user.school_id
    )

    if current_user.role == "student":
        # Students only see their own
        query = query.where(CompetencyExternalInvite.subject_user_id == current_user.id)
    elif current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    if window_id:
        query = query.where(CompetencyExternalInvite.window_id == window_id)

    if subject_user_id:
        if current_user.role == "student" and subject_user_id != current_user.id:
            raise HTTPException(
                status_code=403, detail="You can only view your own invites"
            )
        query = query.where(CompetencyExternalInvite.subject_user_id == subject_user_id)

    query = query.order_by(CompetencyExternalInvite.created_at.desc())

    invites = db.execute(query).scalars().all()
    return invites


@router.delete("/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_invite(
    invite_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Revoke an invite
    - Students: only their own invites
    - Teachers: any invite in their school
    """
    invite = db.get(CompetencyExternalInvite, invite_id)
    if not invite or invite.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Invite not found")

    # Check authorization
    if current_user.role == "student":
        if invite.subject_user_id != current_user.id:
            raise HTTPException(
                status_code=403, detail="You can only revoke your own invites"
            )
    elif current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # Check if already used or revoked
    if invite.status in ["used", "revoked"]:
        raise HTTPException(
            status_code=400, detail=f"Invite already {invite.status}"
        )

    # Revoke
    invite.status = "revoked"
    invite.revoked_at = datetime.utcnow()
    db.commit()

    return None


# ============ Public Endpoints (No Authentication) ============


@router.get("/public/invite/{token}", response_model=ExternalInvitePublicInfo)
def get_invite_info(token: str, db: Session = Depends(get_db)):
    """
    Get invite info by token (public endpoint)
    Shows minimal context for external reviewer
    """
    # Hash token to lookup
    token_hash_value = hash_token(token)

    invite = db.execute(
        select(CompetencyExternalInvite).where(
            CompetencyExternalInvite.token_hash == token_hash_value
        )
    ).scalar_one_or_none()

    if not invite:
        raise HTTPException(status_code=404, detail="Invalid invite token")

    # Check status
    if invite.status == "revoked":
        raise HTTPException(status_code=403, detail="Invite has been revoked")
    if invite.status == "used":
        raise HTTPException(status_code=403, detail="Invite has already been used")
    if invite.status == "expired" or datetime.utcnow() > invite.expires_at:
        invite.status = "expired"
        db.commit()
        raise HTTPException(status_code=403, detail="Invite has expired")

    # Mark as opened (first time)
    if not invite.opened_at:
        invite.opened_at = datetime.utcnow()
        db.commit()

    # Get window and subject
    window = db.get(CompetencyWindow, invite.window_id)
    subject = db.get(User, invite.subject_user_id)

    if not window or not subject:
        raise HTTPException(status_code=404, detail="Window or subject not found")

    # Determine subject name visibility
    show_subject_name = get_window_setting(window, "show_subject_name_to_external", "full")
    if show_subject_name == "full":
        subject_name = subject.name
    elif show_subject_name == "partial":
        # Show first name + last initial
        parts = subject.name.split()
        if len(parts) > 1:
            subject_name = f"{parts[0]} {parts[-1][0]}."
        else:
            subject_name = parts[0]
    else:  # "none"
        subject_name = "Student"

    # Get competencies from snapshot
    if not invite.rubric_snapshot or not isinstance(invite.rubric_snapshot, dict):
        raise HTTPException(
            status_code=500,
            detail="Invite data is corrupted. Please contact the person who sent you this link."
        )
    
    competencies = []
    scale_min = 1
    scale_max = 5
    snapshot_competencies = invite.rubric_snapshot.get("competencies", [])
    
    if not snapshot_competencies:
        raise HTTPException(
            status_code=500,
            detail="No competencies found in invite. Please contact the person who sent you this link."
        )
    
    for comp_data in snapshot_competencies:
        comp_scale_min = comp_data.get("scale_min", 1)
        comp_scale_max = comp_data.get("scale_max", 5)
        # Use the first competency's scale as the window scale
        if not competencies:
            scale_min = comp_scale_min
            scale_max = comp_scale_max
        
        competencies.append(
            CompetencyOut(
                id=comp_data["id"],
                name=comp_data["name"],
                description=comp_data.get("description", ""),
                category=comp_data.get("category"),
                order=0,
                active=True,
                scale_min=comp_scale_min,
                scale_max=comp_scale_max,
                scale_labels={},
                metadata_json={},
                school_id=invite.school_id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
        )

    return ExternalInvitePublicInfo(
        window_title=window.title,
        subject_name=subject_name,
        competencies=competencies,
        scale_min=scale_min,
        scale_max=scale_max,
        instructions=get_window_setting(
            window, "external_instructions", "Please assess the student on each competency."
        ),
    )


@router.post("/public/submit", response_model=dict)
def submit_external_scores(
    data: ExternalScoreSubmit,
    db: Session = Depends(get_db),
):
    """
    Submit external scores (public endpoint)
    """
    # Hash token to lookup
    token_hash_value = hash_token(data.token)

    invite = db.execute(
        select(CompetencyExternalInvite).where(
            CompetencyExternalInvite.token_hash == token_hash_value
        )
    ).scalar_one_or_none()

    if not invite:
        raise HTTPException(status_code=404, detail="Invalid invite token")

    # Check status
    if invite.status == "revoked":
        raise HTTPException(status_code=403, detail="Invite has been revoked")
    if invite.status == "used":
        raise HTTPException(status_code=403, detail="Invite has already been used")
    if invite.status == "expired" or datetime.utcnow() > invite.expires_at:
        invite.status = "expired"
        db.commit()
        raise HTTPException(status_code=403, detail="Invite has expired")

    # Validate scores
    if not data.scores or len(data.scores) == 0:
        raise HTTPException(status_code=400, detail="No scores provided")

    # Get valid competency IDs from rubric snapshot
    valid_comp_ids = {
        c["id"] for c in invite.rubric_snapshot.get("competencies", [])
    }

    # Create scores
    for score_item in data.scores:
        if score_item.competency_id not in valid_comp_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid competency ID: {score_item.competency_id}",
            )

        # Check if score already exists (shouldn't happen, but handle gracefully)
        existing = db.execute(
            select(CompetencyExternalScore).where(
                CompetencyExternalScore.invite_id == invite.id,
                CompetencyExternalScore.competency_id == score_item.competency_id,
            )
        ).scalar_one_or_none()

        if not existing:
            external_score = CompetencyExternalScore(
                school_id=invite.school_id,
                invite_id=invite.id,
                window_id=invite.window_id,
                subject_user_id=invite.subject_user_id,
                competency_id=score_item.competency_id,
                score=score_item.score,
                comment=score_item.comment,
                reviewer_name=data.reviewer_name,
                reviewer_organization=data.reviewer_organization,
            )
            db.add(external_score)

    # Mark invite as used
    invite.status = "used"
    invite.submitted_at = datetime.utcnow()
    db.commit()

    return {"message": "Scores submitted successfully", "invite_id": invite.id}
