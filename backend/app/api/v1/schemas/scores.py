from __future__ import annotations
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Annotated

# Mypy-vriendelijke constrained int (minimaal 1)
ScoreValue = Annotated[
    int, Field(ge=1)
]  # schaal-min/max valideren we server-side tegen de rubric


class ScoreItem(BaseModel):
    criterion_id: int
    score: ScoreValue
    comment: Optional[str] = None
    attachments: Dict[str, Any] = Field(default_factory=dict)


class SubmitScoresRequest(BaseModel):
    allocation_id: int
    items: List[ScoreItem]


class ScoreOut(BaseModel):
    id: int
    allocation_id: int
    criterion_id: int
    score: int
    comment: Optional[str]

    class Config:
        from_attributes = True
