from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Dict, List


class FlagDefinition(BaseModel):
    code: str
    label: str
    description: str
    typical_causes: List[str] = Field(default_factory=list)
    suggested_actions: List[str] = Field(default_factory=list)
    notes: List[str] = Field(default_factory=list)


class FlagsExplainResponse(BaseModel):
    codes: Dict[str, FlagDefinition]
