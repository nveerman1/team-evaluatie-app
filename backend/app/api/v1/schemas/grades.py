from __future__ import annotations
from pydantic import BaseModel, Field, field_validator
from typing import Dict, Optional, Any, List


class GradePreviewItem(BaseModel):
    user_id: int
    user_name: str
    avg_score: float
    gcf: float
    spr: float
    suggested_grade: float
    team_number: Optional[int] = None
    class_name: Optional[str] = None


class GradePreviewResponse(BaseModel):
    evaluation_id: int
    items: List[GradePreviewItem]


class GradePublishRequest(BaseModel):
    evaluation_id: int
    overrides: Dict[int, Dict[str, Any]] = Field(
        default_factory=dict
    )  # {user_id: {"grade": 8.0, "reason": "participatie"}}
    group_grade: Optional[float] = None  # bv. 80.0 => % groepscijfer

    @field_validator("group_grade")
    @classmethod
    def _check_group_grade(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return v
        if not (0.0 <= v <= 100.0):
            raise ValueError("group_grade must be between 0 and 100")
        return v


class PublishedGradeOut(BaseModel):
    id: int
    evaluation_id: int
    user_id: int
    user_name: str
    grade: float
    reason: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True
