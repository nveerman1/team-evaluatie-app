from __future__ import annotations
from typing import Optional, List, Dict
from datetime import datetime
from pydantic import BaseModel


# ---------- Project Overview ----------

class ProjectOverviewItem(BaseModel):
    """Single project with aggregated statistics for overview"""
    project_id: Optional[int] = None
    assessment_id: int
    project_name: str
    course_name: Optional[str] = None
    client_name: Optional[str] = None
    period_label: str
    year: int
    num_teams: int
    average_score_overall: Optional[float] = None
    average_scores_by_category: Dict[str, float] = {}
    status: str  # active|completed

    class Config:
        from_attributes = True


class ProjectOverviewListResponse(BaseModel):
    """Response for list of projects with aggregated stats"""
    items: List[ProjectOverviewItem]
    total: int


class CategoryScore(BaseModel):
    """Score for a single category in a project"""
    category: str
    score: Optional[float] = None


class CategoryTrendDataPoint(BaseModel):
    """Single data point in the trend chart"""
    project_label: str
    scores: Dict[str, float]

    class Config:
        from_attributes = True


class ProjectTrendsResponse(BaseModel):
    """Response for category trends across projects"""
    trends: List[CategoryTrendDataPoint]


class AiSummary(BaseModel):
    """AI-generated summary of project feedback"""
    sterke_punten: List[str] = []
    verbeter_punten: List[str] = []
    algemene_trend: str = ""

    class Config:
        from_attributes = True


class ProjectAiSummaryResponse(BaseModel):
    """Response for AI summary"""
    summary: Optional[AiSummary] = None
