from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Any, Dict, Optional


# ---------- Input ----------
class EvaluationCreate(BaseModel):
    course_id: int
    rubric_id: int
    title: str
    settings: Dict[str, Any] = Field(default_factory=dict)  # deadlines etc.


class EvaluationUpdateStatus(BaseModel):
    status: str  # "draft" | "open" | "closed"


class EvaluationUpdate(BaseModel):
    title: Optional[str] = None
    course_id: Optional[int] = None
    rubric_id: Optional[int] = None
    settings: Optional[Dict[str, Any]] = None


# ---------- Output ----------
class EvaluationOut(BaseModel):
    id: int
    course_id: int
    # compat: oude frontend-veldnaam als label (gevuld met course.name)
    cluster: str
    rubric_id: int
    title: str
    evaluation_type: str  # "peer" | "project" | "competency"
    status: str
    created_at: datetime
    settings: Dict[str, Any]
    deadlines: Optional[dict] = None  # afgeleid veld voor frontend

    class Config:
        from_attributes = True
