from __future__ import annotations
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


# ---------- Project Assessment ----------

class ProjectAssessmentCreate(BaseModel):
    group_id: int
    rubric_id: int
    title: str
    version: Optional[str] = None
    metadata_json: Dict[str, Any] = Field(default_factory=dict)


class ProjectAssessmentUpdate(BaseModel):
    title: Optional[str] = None
    version: Optional[str] = None
    status: Optional[str] = None  # draft|published
    metadata_json: Optional[Dict[str, Any]] = None


class ProjectAssessmentOut(BaseModel):
    id: int
    group_id: int
    rubric_id: int
    teacher_id: int
    title: str
    version: Optional[str]
    status: str
    published_at: Optional[datetime]
    metadata_json: Dict[str, Any]

    class Config:
        from_attributes = True


class ProjectAssessmentListItem(ProjectAssessmentOut):
    group_name: Optional[str] = None
    teacher_name: Optional[str] = None


class ProjectAssessmentListResponse(BaseModel):
    items: List[ProjectAssessmentListItem]
    page: int
    limit: int
    total: int


# ---------- Project Assessment Scores ----------

class ProjectAssessmentScoreCreate(BaseModel):
    criterion_id: int
    score: int
    comment: Optional[str] = None


class ProjectAssessmentScoreUpdate(BaseModel):
    score: Optional[int] = None
    comment: Optional[str] = None


class ProjectAssessmentScoreOut(BaseModel):
    id: int
    assessment_id: int
    criterion_id: int
    score: int
    comment: Optional[str]

    class Config:
        from_attributes = True


class ProjectAssessmentScoreBatchRequest(BaseModel):
    scores: List[ProjectAssessmentScoreCreate]


# ---------- Project Assessment Reflection ----------

class ProjectAssessmentReflectionCreate(BaseModel):
    text: str


class ProjectAssessmentReflectionOut(BaseModel):
    id: int
    assessment_id: int
    user_id: int
    text: str
    word_count: int
    submitted_at: Optional[datetime]

    class Config:
        from_attributes = True


# ---------- Detailed view for students ----------

class ProjectAssessmentDetailOut(BaseModel):
    """Detailed project assessment including scores and rubric info"""
    assessment: ProjectAssessmentOut
    scores: List[ProjectAssessmentScoreOut]
    rubric_title: str
    rubric_scale_min: int
    rubric_scale_max: int
    criteria: List[Dict[str, Any]]  # criterion details
    reflection: Optional[ProjectAssessmentReflectionOut]
