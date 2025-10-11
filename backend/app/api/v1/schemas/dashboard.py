from __future__ import annotations
from pydantic import BaseModel
from typing import List, Optional


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
