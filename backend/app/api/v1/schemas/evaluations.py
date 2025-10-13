from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Any, Dict, Optional


# ---------- Input ----------
class EvaluationCreate(BaseModel):
    course_id: int
    rubric_id: int
    title: str
    settings: Dict[str, Any] = Field(
        default_factory=dict
    )  # min_words, min_cf, max_cf, etc.


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
    rubric_id: int
    title: str
    status: str
    settings: Dict[str, Any]
    deadlines: Optional[dict] = None  # <- toegevoegd veld voor frontend (afgeleid)

    class Config:
        from_attributes = True
