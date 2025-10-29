from __future__ import annotations
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class CriterionMeta(BaseModel):
    id: int
    name: str
    weight: float


class CriterionBreakdown(BaseModel):
    criterion_id: int
    peer_avg: float
    peer_count: int
    self_score: Optional[float] = None


class DashboardRow(BaseModel):
    user_id: int
    user_name: str
    peer_avg_overall: float
    self_avg_overall: Optional[float] = None
    reviewers_count: int
    gcf: float
    spr: float
    suggested_grade: float
    breakdown: List[CriterionBreakdown] = []


class DashboardResponse(BaseModel):
    evaluation_id: int
    rubric_id: int
    rubric_scale_min: int
    rubric_scale_max: int
    criteria: List[CriterionMeta]
    items: List[DashboardRow]


class StudentProgressRow(BaseModel):
    user_id: int
    user_name: str
    class_name: Optional[str] = None
    team_number: Optional[int] = None
    self_assessment_status: str  # "completed", "partial", "not_started"
    peer_reviews_given: int
    peer_reviews_received: int
    peer_reviews_expected: int
    reflection_status: str  # "completed", "not_started"
    reflection_word_count: Optional[int] = None
    total_progress_percent: float
    last_activity: Optional[datetime] = None
    flags: List[str] = []


class StudentProgressResponse(BaseModel):
    evaluation_id: int
    total_students: int
    items: List[StudentProgressRow]


class StudentProgressKPIs(BaseModel):
    evaluation_id: int
    total_students: int
    self_reviews_completed: int
    peer_reviews_total: int
    reflections_completed: int

