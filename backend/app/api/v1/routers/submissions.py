from __future__ import annotations
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    AssignmentSubmission,
    SubmissionEvent,
    ProjectAssessment,
    ProjectTeam,
    ProjectTeamMember,
    User,
    Notification,
)
from app.api.v1.schemas.submissions import (
    SubmissionCreate,
    SubmissionUpdate,
    SubmissionStatusUpdate,
    SubmissionOut,
    SubmissionWithTeamInfo,
    SubmissionListResponse,
    SubmissionEventOut,
    MyTeamSubmissionsResponse,
)
from app.api.v1.utils.url_validation import validate_sharepoint_url

router = APIRouter(prefix="/submissions", tags=["submissions"])


def log_submission_event(
    db: Session,
    submission: AssignmentSubmission,
    user_id: int,
    event_type: str,
    payload: Optional[dict] = None,
):
    """Helper function to log submission events"""
    event = SubmissionEvent(
        school_id=submission.school_id,
        submission_id=submission.id,
        actor_user_id=user_id,
        event_type=event_type,
        payload=payload or {},
    )
    db.add(event)
    db.flush()


def create_status_notification(
    db: Session,
    submission: AssignmentSubmission,
    old_status: str,
    new_status: str,
):
    """Create notification for all team members when status changes"""
    
    # Get team members
    members = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.project_team_id == submission.project_team_id
    ).all()
    
    # Map status to message
    messages = {
        "ok": ("✅ Inlevering akkoord", "De docent heeft je inlevering goedgekeurd."),
        "access_requested": ("🔒 Toegang vereist", "De docent kan je document niet openen. Pas de deelrechten aan."),
        "broken": ("🔗 Link werkt niet", "De ingeleverde link werkt niet. Lever opnieuw in."),
        "submitted": ("📄 Inlevering ontvangen", "Je inlevering is ontvangen en wordt beoordeeld."),
    }
    
    if new_status not in messages:
        return
    
    title, body = messages[new_status]
    
    # Create notification for each member
    for member in members:
        notification = Notification(
            school_id=submission.school_id,
            recipient_user_id=member.user_id,
            type="submission_status_changed",
            title=title,
            body=body,
            link=f"/student/project-assessments/{submission.project_assessment_id}/submissions"
        )
        db.add(notification)
    
    db.flush()


# ---------- Submit link for team ----------

@router.post(
    "/assessments/{assessment_id}/teams/{team_id}",
    response_model=SubmissionOut,
    status_code=status.HTTP_201_CREATED,
)
def submit_link(
    assessment_id: int,
    team_id: int,
    payload: SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit or update a link for a team's assessment.
    Only team members can submit for their team.
    """
    # Check if assessment exists and belongs to user's school
    assessment = db.query(ProjectAssessment).filter(
        ProjectAssessment.id == assessment_id,
        ProjectAssessment.school_id == current_user.school_id,
    ).first()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment niet gevonden"
        )
    
    # Permission check: is user member of this team?
    is_member = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.project_team_id == team_id,
        ProjectTeamMember.user_id == current_user.id,
    ).first()
    
    if not is_member and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Je bent geen lid van dit team"
        )
    
    # Verify team belongs to same school
    team = db.query(ProjectTeam).filter(
        ProjectTeam.id == team_id,
        ProjectTeam.school_id == current_user.school_id,
    ).first()
    
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team niet gevonden"
        )
    
    # URL validation
    is_valid, error_msg = validate_sharepoint_url(payload.url)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ongeldige URL: {error_msg}"
        )
    
    # Check for existing submission
    submission = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.project_assessment_id == assessment_id,
        AssignmentSubmission.project_team_id == team_id,
        AssignmentSubmission.doc_type == payload.doc_type,
        AssignmentSubmission.version_label == (payload.version_label or "v1"),
    ).first()
    
    if not submission:
        # Create new submission
        submission = AssignmentSubmission(
            school_id=current_user.school_id,
            project_assessment_id=assessment_id,
            project_team_id=team_id,
            doc_type=payload.doc_type,
            version_label=payload.version_label or "v1",
        )
        db.add(submission)
    
    # Update submission
    submission.url = payload.url.strip()
    submission.status = "submitted"
    submission.submitted_by_user_id = current_user.id
    submission.submitted_at = datetime.utcnow()
    submission.updated_at = datetime.utcnow()
    
    # Flush to get submission.id before logging event
    db.flush()
    
    # Log event
    log_submission_event(db, submission, current_user.id, "submitted")
    
    db.commit()
    db.refresh(submission)
    
    return submission


# ---------- Clear submission ----------

@router.delete("/{submission_id}", status_code=status.HTTP_204_NO_CONTENT)
def clear_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clear a submission (student or teacher can do this)"""
    submission = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.id == submission_id,
        AssignmentSubmission.school_id == current_user.school_id,
    ).first()
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inlevering niet gevonden"
        )
    
    # Permission: team member OR teacher of assessment OR admin
    is_team_member = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.project_team_id == submission.project_team_id,
        ProjectTeamMember.user_id == current_user.id,
    ).first()
    
    is_teacher = db.query(ProjectAssessment).filter(
        ProjectAssessment.id == submission.project_assessment_id,
        ProjectAssessment.teacher_id == current_user.id,
        ProjectAssessment.school_id == current_user.school_id,
    ).first()
    
    if not (is_team_member or is_teacher or current_user.role == "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Geen toegang om deze inlevering te verwijderen"
        )
    
    # Clear submission
    submission.url = None
    submission.status = "missing"
    submission.updated_at = datetime.utcnow()
    log_submission_event(db, submission, current_user.id, "cleared")
    
    db.commit()


# ---------- Update submission status (teacher only) ----------

@router.patch("/{submission_id}/status", response_model=SubmissionOut)
def update_submission_status(
    submission_id: int,
    payload: SubmissionStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update submission status (teacher only).
    Triggers notification to students.
    """
    submission = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.id == submission_id,
        AssignmentSubmission.school_id == current_user.school_id,
    ).first()
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inlevering niet gevonden"
        )
    
    # Permission: teacher of this assessment or admin
    assessment = db.query(ProjectAssessment).filter(
        ProjectAssessment.id == submission.project_assessment_id,
        ProjectAssessment.school_id == current_user.school_id,
    ).first()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment niet gevonden"
        )
    
    if assessment.teacher_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Alleen de docent kan de status wijzigen"
        )
    
    old_status = submission.status
    submission.status = payload.status
    submission.last_checked_by_user_id = current_user.id
    submission.last_checked_at = datetime.utcnow()
    submission.updated_at = datetime.utcnow()
    
    # Log event
    log_submission_event(
        db,
        submission,
        current_user.id,
        "status_changed",
        payload={"old_status": old_status, "new_status": payload.status},
    )
    
    # Create notification for team members
    create_status_notification(db, submission, old_status, payload.status)
    
    db.commit()
    db.refresh(submission)
    
    return submission


# ---------- List submissions for assessment (teacher view) ----------

@router.get("/assessments/{assessment_id}", response_model=SubmissionListResponse)
def list_submissions_for_assessment(
    assessment_id: int,
    doc_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    missing_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all submissions for an assessment (teacher view).
    Supports filtering by doc_type, status, and missing_only.
    Automatically generates virtual "missing" submissions for teams without submission records.
    Returns one row per team per doc_type (report, slides, attachment).
    """
    # Permission check
    assessment = db.query(ProjectAssessment).filter(
        ProjectAssessment.id == assessment_id,
        ProjectAssessment.school_id == current_user.school_id,
    ).first()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment niet gevonden"
        )
    
    # DEBUG: Log ownership check details
    print(f"[DEBUG submissions] assessment_id={assessment_id}, assessment.teacher_id={assessment.teacher_id}, current_user.id={current_user.id}, current_user.email={current_user.email}, current_user.role={current_user.role}")
    
    if assessment.teacher_id != current_user.id and current_user.role != "admin":
        print(f"[DEBUG submissions] 403: teacher_id mismatch - assessment.teacher_id={assessment.teacher_id} != current_user.id={current_user.id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Geen toegang tot deze inleveringen"
        )
    
    # Check if assessment has a project
    if not assessment.project_id:
        return SubmissionListResponse(items=[], total=0)
    
    # Get all teams for this project
    all_teams = db.query(ProjectTeam).filter(
        ProjectTeam.project_id == assessment.project_id,
        ProjectTeam.school_id == current_user.school_id,
    ).all()
    
    # Get existing submissions
    existing_submissions = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.project_assessment_id == assessment_id,
        AssignmentSubmission.school_id == current_user.school_id,
    ).all()
    
    # Create a map of (team_id, doc_type) to submission for multiple submissions per team
    submission_map = {}
    for sub in existing_submissions:
        key = (sub.project_team_id, sub.doc_type)
        submission_map[key] = sub
    
    # Build result with all teams and all doc types
    result_items = []
    doc_types = ["report", "slides", "attachment"]
    
    for team in all_teams:
        # Get team members
        members = db.query(ProjectTeamMember, User).join(
            User, ProjectTeamMember.user_id == User.id
        ).filter(
            ProjectTeamMember.project_team_id == team.id
        ).all()
        
        member_data = [
            {
                "id": user.id,
                "name": user.name,
                "email": user.email,
            }
            for _, user in members
        ]
        
        # Create a submission entry for each doc_type
        for dt in doc_types:
            key = (team.id, dt)
            
            # Get existing submission or create virtual one
            if key in submission_map:
                submission = submission_map[key]
            else:
                # Create virtual "missing" submission on-the-fly
                # Use negative ID based on team.id and doc_type to ensure uniqueness
                virtual_id = -(team.id * 1000 + doc_types.index(dt))
                submission = AssignmentSubmission(
                    id=virtual_id,  # Unique virtual ID
                    school_id=current_user.school_id,
                    project_assessment_id=assessment_id,
                    project_team_id=team.id,
                    doc_type=dt,
                    url=None,
                    status="missing",
                    submitted_at=None,
                    submitted_by_user_id=None,
                    last_checked_at=None,
                    last_checked_by_user_id=None,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
            
            # Apply filters
            if doc_type and submission.status != "missing" and submission.doc_type != doc_type:
                continue
            
            if status_filter and submission.status != status_filter:
                continue
            
            if missing_only and submission.status != "missing":
                continue
            
            result_items.append(
                SubmissionWithTeamInfo(
                    submission=SubmissionOut.model_validate(submission),
                    team_number=team.team_number,
                    team_name=team.display_name_at_time,
                    members=member_data,
                )
            )
    
    return SubmissionListResponse(
        items=result_items,
        total=len(result_items),
    )


# ---------- Get submissions for student's team ----------

@router.get(
    "/assessments/{assessment_id}/my-team",
    response_model=MyTeamSubmissionsResponse
)
def get_my_team_submissions(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get submissions for the current user's team in an assessment.
    Students can only see their own team's submissions.
    Returns team_id even when there are no submissions yet.
    """
    # Find which team the user is in for this assessment
    assessment = db.query(ProjectAssessment).filter(
        ProjectAssessment.id == assessment_id,
        ProjectAssessment.school_id == current_user.school_id,
    ).first()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment niet gevonden"
        )
    
    # Check if assessment has a project
    if not assessment.project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Deze beoordeling is niet gekoppeld aan een project"
        )
    
    # Find user's team membership - use same logic as project_assessments.py list endpoint
    team_member = db.query(ProjectTeamMember).join(
        ProjectTeam, ProjectTeam.id == ProjectTeamMember.project_team_id
    ).filter(
        ProjectTeam.project_id == assessment.project_id,
        ProjectTeamMember.user_id == current_user.id,
        ProjectTeam.school_id == current_user.school_id,
    ).first()
    
    if not team_member:
        # User is not in any team for this assessment
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Je zit niet in een team voor dit project. Neem contact op met je docent."
        )
    
    # Get submissions for this team
    submissions = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.project_assessment_id == assessment_id,
        AssignmentSubmission.project_team_id == team_member.project_team_id,
        AssignmentSubmission.school_id == current_user.school_id,
    ).all()
    
    return MyTeamSubmissionsResponse(
        team_id=team_member.project_team_id,
        submissions=[SubmissionOut.model_validate(s) for s in submissions]
    )
