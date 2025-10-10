from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Dict, Any


class RubricCreate(BaseModel):
    title: str
    description: str | None = None
    scale_min: int = 1
    scale_max: int = 5
    metadata_json: Dict[str, Any] = Field(default_factory=dict)


class RubricOut(BaseModel):
    id: int
    title: str
    description: str | None
    scale_min: int
    scale_max: int
    metadata_json: Dict[str, Any]

    class Config:
        from_attributes = True


class CriterionCreate(BaseModel):
    name: str
    weight: float = 1.0
    descriptors: Dict[str, str] = Field(default_factory=dict)


class CriterionOut(BaseModel):
    id: int
    rubric_id: int
    name: str
    weight: float
    descriptors: Dict[str, str]

    class Config:
        from_attributes = True
