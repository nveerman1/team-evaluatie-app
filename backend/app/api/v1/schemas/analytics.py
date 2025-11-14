"""
Schemas for Analytics API
"""

from __future__ import annotations
from pydantic import BaseModel, Field


class CourseSummaryOut(BaseModel):
    """Schema for course summary analytics"""
    
    total_students: int
    total_evaluations: int
    completed_evaluations: int
    average_score: float
    participation_rate: float


class LearningObjectiveProgressOut(BaseModel):
    """Schema for learning objective progress"""
    
    id: int
    code: str
    description: str
    coverage: float = Field(..., description="Percentage of students assessed on this LO")
    average_score: float
    student_count: int


class EvaluationTypeStatsOut(BaseModel):
    """Schema for evaluation type statistics"""
    
    type: str = Field(..., description="peer, project, or competency")
    count: int
    avg_score: float
    completion_rate: float
