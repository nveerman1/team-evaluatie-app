"""
Pydantic schemas for Competency Monitor
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ============ Competency Schemas ============


class CompetencyBase(BaseModel):
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    category: Optional[str] = Field(None, max_length=100)
    order: int = 0
    active: bool = True
    scale_min: int = 1
    scale_max: int = 5
    scale_labels: Dict[str, str] = Field(default_factory=dict)
    metadata_json: Dict[str, Any] = Field(default_factory=dict)


class CompetencyCreate(CompetencyBase):
    pass


class CompetencyUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = Field(None, max_length=100)
    order: Optional[int] = None
    active: Optional[bool] = None
    scale_min: Optional[int] = None
    scale_max: Optional[int] = None
    scale_labels: Optional[Dict[str, str]] = None
    metadata_json: Optional[Dict[str, Any]] = None


class CompetencyOut(CompetencyBase):
    id: int
    school_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Competency Rubric Level Schemas ============


class CompetencyRubricLevelBase(BaseModel):
    level: int = Field(..., ge=1, le=5)
    label: Optional[str] = Field(None, max_length=100)
    description: str


class CompetencyRubricLevelCreate(CompetencyRubricLevelBase):
    competency_id: int


class CompetencyRubricLevelUpdate(BaseModel):
    label: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None


class CompetencyRubricLevelOut(CompetencyRubricLevelBase):
    id: int
    school_id: int
    competency_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Competency Window Schemas ============


class CompetencyWindowBase(BaseModel):
    title: str = Field(..., max_length=200)
    description: Optional[str] = None
    class_names: List[str] = Field(default_factory=list)
    course_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: str = "draft"  # draft|open|closed
    require_self_score: bool = True
    require_goal: bool = False
    require_reflection: bool = False
    settings: Dict[str, Any] = Field(default_factory=dict)


class CompetencyWindowCreate(CompetencyWindowBase):
    pass


class CompetencyWindowUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    class_names: Optional[List[str]] = None
    course_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[str] = None
    require_self_score: Optional[bool] = None
    require_goal: Optional[bool] = None
    require_reflection: Optional[bool] = None
    settings: Optional[Dict[str, Any]] = None


class CompetencyWindowOut(CompetencyWindowBase):
    id: int
    school_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Self Score Schemas ============


class CompetencySelfScoreBase(BaseModel):
    competency_id: int
    score: int = Field(..., ge=1, le=5)
    example: Optional[str] = None


class CompetencySelfScoreCreate(CompetencySelfScoreBase):
    window_id: int


class CompetencySelfScoreBulkCreate(BaseModel):
    window_id: int
    scores: List[CompetencySelfScoreBase]


class CompetencySelfScoreOut(CompetencySelfScoreBase):
    id: int
    school_id: int
    window_id: int
    user_id: int
    submitted_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Peer Label Schemas ============


class CompetencyPeerLabelBase(BaseModel):
    competency_id: int
    sentiment: str = "positive"  # positive|neutral|negative


class CompetencyPeerLabelCreate(CompetencyPeerLabelBase):
    window_id: int
    to_user_id: int


class CompetencyPeerLabelOut(CompetencyPeerLabelBase):
    id: int
    school_id: int
    window_id: int
    from_user_id: int
    to_user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ============ Teacher Observation Schemas ============


class CompetencyTeacherObservationBase(BaseModel):
    competency_id: int
    score: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


class CompetencyTeacherObservationCreate(CompetencyTeacherObservationBase):
    window_id: int
    user_id: int


class CompetencyTeacherObservationOut(CompetencyTeacherObservationBase):
    id: int
    school_id: int
    window_id: int
    user_id: int
    teacher_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Goal Schemas ============


class CompetencyGoalBase(BaseModel):
    goal_text: str
    success_criteria: Optional[str] = None
    competency_id: Optional[int] = None
    status: str = "in_progress"  # in_progress|achieved|not_achieved


class CompetencyGoalCreate(CompetencyGoalBase):
    window_id: int


class CompetencyGoalUpdate(BaseModel):
    goal_text: Optional[str] = None
    success_criteria: Optional[str] = None
    competency_id: Optional[int] = None
    status: Optional[str] = None


class CompetencyGoalOut(CompetencyGoalBase):
    id: int
    school_id: int
    window_id: int
    user_id: int
    submitted_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Reflection Schemas ============


class CompetencyReflectionBase(BaseModel):
    text: str
    goal_id: Optional[int] = None
    goal_achieved: Optional[bool] = None
    evidence: Optional[str] = None


class CompetencyReflectionCreate(CompetencyReflectionBase):
    window_id: int


class CompetencyReflectionUpdate(BaseModel):
    text: Optional[str] = None
    goal_id: Optional[int] = None
    goal_achieved: Optional[bool] = None
    evidence: Optional[str] = None


class CompetencyReflectionOut(CompetencyReflectionBase):
    id: int
    school_id: int
    window_id: int
    user_id: int
    submitted_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Aggregate/Overview Schemas ============


class CompetencyScore(BaseModel):
    """Aggregated score for one competency in one window"""
    competency_id: int
    competency_name: str
    self_score: Optional[float] = None
    peer_score: Optional[float] = None
    teacher_score: Optional[float] = None
    external_score: Optional[float] = None
    external_count: int = 0
    final_score: Optional[float] = None
    delta: Optional[float] = None  # compared to previous window


class StudentCompetencyOverview(BaseModel):
    """Overview for one student in one window"""
    window_id: int
    user_id: int
    user_name: str
    scores: List[CompetencyScore]
    goals: List[CompetencyGoalOut]
    reflection: Optional[CompetencyReflectionOut] = None


class ClassHeatmapRow(BaseModel):
    """One row in the class heatmap (one student)"""
    user_id: int
    user_name: str
    scores: Dict[int, float]  # competency_id -> final_score
    deltas: Dict[int, float]  # competency_id -> delta


class ClassHeatmap(BaseModel):
    """Full class heatmap for a window"""
    window_id: int
    window_title: str
    competencies: List[CompetencyOut]
    rows: List[ClassHeatmapRow]


class StudentGrowthCard(BaseModel):
    """Student's growth card across multiple windows"""
    user_id: int
    user_name: str
    windows: List[StudentCompetencyOverview]
    trends: Dict[int, List[float]]  # competency_id -> [scores over time]


# ============ External Invite Schemas ============


class ExternalInviteCreate(BaseModel):
    """Create external invite(s)"""
    window_id: int
    subject_user_id: int
    emails: List[str] = Field(..., min_length=1, max_length=10)
    external_name: Optional[str] = Field(None, max_length=200)
    external_organization: Optional[str] = Field(None, max_length=200)


class ExternalInviteOut(BaseModel):
    """External invite details"""
    id: int
    school_id: int
    window_id: int
    subject_user_id: int
    invited_by_user_id: int
    email: str
    external_name: Optional[str]
    external_organization: Optional[str]
    status: str
    created_at: datetime
    expires_at: datetime
    sent_at: Optional[datetime]
    opened_at: Optional[datetime]
    submitted_at: Optional[datetime]
    revoked_at: Optional[datetime]

    class Config:
        from_attributes = True


class ExternalInvitePublicInfo(BaseModel):
    """Public info shown to external reviewer (minimal context)"""
    window_title: str
    subject_name: str  # Full, partial or masked based on settings
    competencies: List[CompetencyOut]
    scale_min: int
    scale_max: int
    instructions: Optional[str] = None


class ExternalScoreSubmit(BaseModel):
    """External score submission"""
    token: str
    scores: List[Dict[str, Any]]  # List of {competency_id, score, comment}
    reviewer_name: Optional[str] = Field(None, max_length=200)
    reviewer_organization: Optional[str] = Field(None, max_length=200)
    general_comment: Optional[str] = None


class ExternalScoreOut(BaseModel):
    """External score details"""
    id: int
    school_id: int
    invite_id: int
    window_id: int
    subject_user_id: int
    competency_id: int
    score: int
    comment: Optional[str]
    reviewer_name: Optional[str]
    reviewer_organization: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
