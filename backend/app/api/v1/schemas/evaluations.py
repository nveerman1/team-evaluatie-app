from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Any, Dict, Optional


# ---------- Input ----------
class EvaluationCreate(BaseModel):
    course_id: int
    rubric_id: int
    title: str
    project_id: Optional[int] = None
    project_team_id: Optional[int] = None  # Required when project_id is provided
    settings: Dict[str, Any] = Field(default_factory=dict)  # deadlines etc.


class EvaluationUpdateStatus(BaseModel):
    status: str  # "draft" | "open" | "closed"


class EvaluationUpdate(BaseModel):
    title: Optional[str] = None
    course_id: Optional[int] = None
    project_id: Optional[int] = None
    project_team_id: Optional[int] = None
    rubric_id: Optional[int] = None
    settings: Optional[Dict[str, Any]] = None


# ---------- Output ----------
class EvaluationOut(BaseModel):
    id: int
    school_id: int
    course_id: Optional[int] = None
    project_id: Optional[int] = None
    project_team_id: Optional[int] = None
    # compat: oude frontend-veldnaam als label (gevuld met course.name)
    cluster: Optional[str] = None
    rubric_id: int
    title: str
    evaluation_type: str  # "peer" | "project" | "competency"
    status: str
    closed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    settings: Dict[str, Any]
    deadlines: Optional[dict] = None  # afgeleid veld voor frontend

    class Config:
        from_attributes = True
