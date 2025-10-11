from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Dict, Any, List


class GradePreviewItem(BaseModel):
    user_id: int
    user_name: str
    avg_score: float
    gcf: float
    spr: float
    suggested_grade: float


class GradePreviewResponse(BaseModel):
    evaluation_id: int
    items: List[GradePreviewItem]


class GradePublishRequest(BaseModel):
    evaluation_id: int
    overrides: Dict[int, Dict[str, Any]] = Field(
        default_factory=dict
    )  # {user_id: {"grade": 8.0, "reason": "participatie"}}
