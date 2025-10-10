from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Any, Dict


class EvaluationCreate(BaseModel):
    course_id: int
    rubric_id: int
    title: str
    settings: Dict[str, Any] = Field(
        default_factory=dict
    )  # min_words, min_cf, max_cf, etc.


class EvaluationOut(BaseModel):
    id: int
    course_id: int
    rubric_id: int
    title: str
    status: str
    settings: Dict[str, Any]

    class Config:
        from_attributes = True


class EvaluationUpdateStatus(BaseModel):
    status: str  # "draft" | "open" | "closed"
