"""
Schemas for External Assessments API
"""

from __future__ import annotations
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr, ConfigDict


# ============ External Evaluator Schemas ============


class ExternalEvaluatorBase(BaseModel):
    """Base schema for external evaluator"""
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    organisation: Optional[str] = Field(None, max_length=200)


class ExternalEvaluatorCreate(ExternalEvaluatorBase):
    """Schema for creating an external evaluator"""
    pass


class ExternalEvaluatorUpdate(BaseModel):
    """Schema for updating an external evaluator"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    email: Optional[EmailStr] = None
    organisation: Optional[str] = Field(None, max_length=200)


class ExternalEvaluatorOut(ExternalEvaluatorBase):
    """Schema for external evaluator output"""
    id: int
    school_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============ Project Team External Schemas ============


class ProjectTeamExternalBase(BaseModel):
    """Base schema for project team external link"""
    group_id: int
    external_evaluator_id: int
    project_id: Optional[int] = None


class ProjectTeamExternalCreate(ProjectTeamExternalBase):
    """Schema for creating a project team external link"""
    pass


class ProjectTeamExternalOut(ProjectTeamExternalBase):
    """Schema for project team external output"""
    id: int
    school_id: int
    invitation_token: str
    token_expires_at: Optional[datetime]
    status: str
    created_at: datetime
    updated_at: datetime
    invited_at: Optional[datetime]
    submitted_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


# ============ External Assessment Token Resolution ============


class ExternalAssessmentTeamInfo(BaseModel):
    """Info about a team for external assessment"""
    team_id: int
    team_name: str
    project_id: Optional[int]
    project_title: Optional[str]
    class_name: Optional[str]
    description: Optional[str]
    status: str  # NOT_STARTED | IN_PROGRESS | SUBMITTED


class ExternalAssessmentTokenInfo(BaseModel):
    """Information returned when resolving an external assessment token"""
    token: str
    external_evaluator: ExternalEvaluatorOut
    teams: List[ExternalAssessmentTeamInfo]
    project_name: Optional[str]
    class_name: Optional[str]
    single_team: bool = False


# ============ External Assessment Detail ============


class RubricCriterionForExternal(BaseModel):
    """Rubric criterion for external assessment"""
    id: int
    name: str
    weight: float
    descriptors: Dict[str, str]
    category: Optional[str]


class RubricForExternal(BaseModel):
    """Rubric structure for external assessment"""
    id: int
    title: str
    description: Optional[str]
    scale_min: int
    scale_max: int
    criteria: List[RubricCriterionForExternal]


class ExternalAssessmentScoreOut(BaseModel):
    """Existing score for external assessment"""
    criterion_id: int
    score: int
    comment: Optional[str]


class ExternalAssessmentDetail(BaseModel):
    """Detail view for external assessment of a specific team"""
    team_id: int
    team_name: str
    project_title: Optional[str]
    project_description: Optional[str]
    rubric: RubricForExternal
    existing_scores: List[ExternalAssessmentScoreOut]
    general_comment: Optional[str]
    status: str  # NOT_STARTED | IN_PROGRESS | SUBMITTED


# ============ External Assessment Submission ============


class ExternalAssessmentScoreSubmit(BaseModel):
    """Score submission for one criterion"""
    criterion_id: int
    score: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


class ExternalAssessmentSubmit(BaseModel):
    """Submission for external assessment"""
    scores: List[ExternalAssessmentScoreSubmit]
    general_comment: Optional[str] = None
    submit: bool = False  # If True, marks as final submission


class ExternalAssessmentSubmitResponse(BaseModel):
    """Response after submission"""
    success: bool
    message: str
    status: str  # IN_PROGRESS | SUBMITTED


# ============ Teacher-side management schemas ============


class ExternalAssessmentConfigBase(BaseModel):
    """Base configuration for external assessment on a project"""
    mode: str  # NONE | PER_TEAM | ALL_TEAMS
    rubric_id: Optional[int] = None


class ExternalAssessmentPerTeamConfig(BaseModel):
    """Configuration for per-team external assessment"""
    group_id: int
    evaluator_name: str
    evaluator_email: EmailStr
    evaluator_organisation: Optional[str] = None


class ExternalAssessmentAllTeamsConfig(BaseModel):
    """Configuration for all-teams external assessment"""
    evaluator_name: str
    evaluator_email: EmailStr
    evaluator_organisation: Optional[str] = None
    group_ids: List[int]
    rubric_id: Optional[int] = None


class BulkInviteRequest(BaseModel):
    """Request to send invitations in bulk"""
    mode: str  # PER_TEAM | ALL_TEAMS
    per_team_configs: Optional[List[ExternalAssessmentPerTeamConfig]] = None
    all_teams_config: Optional[ExternalAssessmentAllTeamsConfig] = None


class ExternalAssessmentStatus(BaseModel):
    """Status of external assessment for a team"""
    team_id: int
    team_name: str
    members: Optional[str] = None  # Comma-separated member names
    external_evaluator: Optional[ExternalEvaluatorOut]
    status: str
    invitation_sent: bool
    submitted_at: Optional[datetime]
    updated_at: Optional[datetime] = None


class ExternalAdvisoryScoreOut(BaseModel):
    """Score from external advisory assessment"""
    criterion_id: int
    criterion_name: str
    category: Optional[str]
    score: int
    comment: Optional[str]


class ExternalAdvisoryDetail(BaseModel):
    """Full external advisory assessment detail for a team (teacher view)"""
    team_id: int
    team_name: str
    external_evaluator: ExternalEvaluatorOut
    rubric_title: str
    rubric_scale_min: int
    rubric_scale_max: int
    scores: List[ExternalAdvisoryScoreOut]
    general_comment: Optional[str]
    submitted_at: Optional[datetime]
    status: str
