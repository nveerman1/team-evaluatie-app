from __future__ import annotations
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, field_validator


# ---------- Submission ----------

class SubmissionCreate(BaseModel):
    """Schema for creating a submission"""
    doc_type: str = Field(..., description="Document type: report, slides, or attachment")
    url: str = Field(..., description="SharePoint/OneDrive URL")
    version_label: Optional[str] = Field(default="v1", description="Version label")

    @field_validator('doc_type')
    @classmethod
    def validate_doc_type(cls, v):
        allowed = ['report', 'slides', 'attachment']
        if v not in allowed:
            raise ValueError(f'doc_type must be one of {allowed}')
        return v

    @field_validator('url')
    @classmethod
    def validate_url(cls, v):
        if not v or not v.strip():
            raise ValueError('URL cannot be empty')
        return v.strip()


class SubmissionUpdate(BaseModel):
    """Schema for updating a submission"""
    url: Optional[str] = None


class SubmissionStatusUpdate(BaseModel):
    """Schema for updating submission status (teacher only)"""
    status: str = Field(..., description="Status: missing, submitted, ok, access_requested, broken")

    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        allowed = ['missing', 'submitted', 'ok', 'access_requested', 'broken']
        if v not in allowed:
            raise ValueError(f'status must be one of {allowed}')
        return v


class SubmissionOut(BaseModel):
    """Schema for submission output"""
    id: int
    school_id: int
    project_assessment_id: int
    project_team_id: int
    doc_type: str
    url: Optional[str] = None
    status: str
    version_label: Optional[str] = None
    submitted_by_user_id: Optional[int] = None
    submitted_at: Optional[datetime] = None
    last_checked_by_user_id: Optional[int] = None
    last_checked_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SubmissionWithTeamInfo(BaseModel):
    """Schema for submission with team information"""
    submission: SubmissionOut
    team_number: Optional[int] = None
    team_name: str
    members: List[Dict[str, Any]] = Field(default_factory=list)


class SubmissionListResponse(BaseModel):
    """Schema for list of submissions"""
    items: List[SubmissionWithTeamInfo]
    total: int


# ---------- Submission Event ----------

class SubmissionEventOut(BaseModel):
    """Schema for submission event output"""
    id: int
    school_id: int
    submission_id: int
    actor_user_id: Optional[int] = None
    event_type: str
    payload: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SubmissionEventsResponse(BaseModel):
    """Schema for list of submission events"""
    items: List[SubmissionEventOut]
    total: int


class MyTeamSubmissionsResponse(BaseModel):
    """Schema for my team submissions response"""
    team_id: Optional[int] = None
    submissions: List[SubmissionOut] = Field(default_factory=list)
