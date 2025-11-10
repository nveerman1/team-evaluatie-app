from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---------- Learning Objective ----------


class LearningObjectiveCreate(BaseModel):
    domain: Optional[str] = None
    title: str
    description: Optional[str] = None
    order: int = 0
    phase: Optional[str] = None  # "onderbouw" | "bovenbouw"
    metadata_json: Dict[str, Any] = Field(default_factory=dict)


class LearningObjectiveUpdate(BaseModel):
    domain: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    order: Optional[int] = None
    phase: Optional[str] = None  # "onderbouw" | "bovenbouw"
    metadata_json: Optional[Dict[str, Any]] = None


class LearningObjectiveOut(BaseModel):
    id: int
    domain: Optional[str]
    title: str
    description: Optional[str]
    order: int
    phase: Optional[str]
    metadata_json: Dict[str, Any]

    class Config:
        from_attributes = True


# ---------- List response ----------


class LearningObjectiveListResponse(BaseModel):
    items: List[LearningObjectiveOut]
    page: int
    limit: int
    total: int


# ---------- Import ----------


class LearningObjectiveImportItem(BaseModel):
    """Single item for CSV import"""
    domain: Optional[str] = None
    title: str
    description: Optional[str] = None
    order: int = 0
    phase: Optional[str] = None  # "onderbouw" | "bovenbouw"


class LearningObjectiveImportRequest(BaseModel):
    items: List[LearningObjectiveImportItem]


class LearningObjectiveImportResponse(BaseModel):
    created: int
    updated: int
    errors: List[str] = Field(default_factory=list)


# ---------- Overview / Progress ----------


class StudentLearningObjectiveProgress(BaseModel):
    """Progress for a single learning objective for a student"""

    learning_objective_id: int
    learning_objective_title: str
    domain: Optional[str]
    average_score: Optional[float]  # Average from linked rubric criteria
    assessment_count: int  # Number of assessments contributing
    assessments: List[Dict[str, Any]] = Field(
        default_factory=list
    )  # Details of assessments


class StudentLearningObjectiveOverview(BaseModel):
    """Overview of all learning objectives for a student"""
    user_id: int
    user_name: str
    class_name: Optional[str]
    objectives: List[StudentLearningObjectiveProgress]


class LearningObjectiveOverviewResponse(BaseModel):
    """Overview response for teacher dashboard"""
    students: List[StudentLearningObjectiveOverview]
    filters: Dict[str, Any] = Field(default_factory=dict)
