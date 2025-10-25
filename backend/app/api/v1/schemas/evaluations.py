from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Any, Dict, Optional


# ---------- Input ----------
class EvaluationCreate(BaseModel):
    cluster: str
    rubric_id: int
    title: str
    settings: Dict[str, Any] = Field(default_factory=dict)  # deadlines etc.


class EvaluationUpdateStatus(BaseModel):
    status: str  # "draft" | "open" | "closed"


class EvaluationUpdate(BaseModel):
    title: Optional[str] = None
    cluster: Optional[str] = None
    rubric_id: Optional[int] = None
    settings: Optional[Dict[str, Any]] = None


# ---------- Output ----------
class EvaluationOut(BaseModel):
    id: int
    cluster: str
    rubric_id: int
    title: str
    status: str
    created_at: datetime
    settings: Dict[str, Any]
    deadlines: Optional[dict] = None  # afgeleid veld voor frontend

    class Config:
        from_attributes = True
