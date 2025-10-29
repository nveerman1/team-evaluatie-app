from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class GradeOverrideIn(BaseModel):
    grade: Optional[float] = None  # 1–10 of null (concept zonder override)
    reason: Optional[str] = None
    rowGroupGrade: Optional[float] = None


class GradeDraftRequest(BaseModel):
    evaluation_id: int
    group_grade: Optional[float] = None  # 1–10
    overrides: Dict[int, GradeOverrideIn] = Field(default_factory=dict)

    @field_validator("group_grade")
    @classmethod
    def _check_group_grade(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return v
        if not (1.0 <= v <= 10.0):
            raise ValueError("group_grade must be between 1.0 and 10.0")
        return v


class GradePublishRequest(GradeDraftRequest):
    pass


class GradePreviewItem(BaseModel):
    user_id: int
    user_name: str
    avg_score: float
    gcf: float
    spr: float
    suggested_grade: Optional[float] = None  # 1–10 or None if no evaluations
    team_number: Optional[int] = None
    class_name: Optional[str] = None


class GradePreviewResponse(BaseModel):
    evaluation_id: int
    items: List[GradePreviewItem]


class PublishedGradeOut(BaseModel):
    evaluation_id: int
    user_id: int
    user_name: str
    grade: Optional[float] = None  # 1–10 of null (concept)
    reason: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)
