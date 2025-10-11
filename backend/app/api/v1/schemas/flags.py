from __future__ import annotations
from pydantic import BaseModel, Field
from typing import List, Dict, Optional


class Flag(BaseModel):
    code: str  # bv. "HIGH_SPR", "LOW_GCF", "OUTLIER_ZSCORE", "FEW_REVIEWERS", "MISSING_SELF"
    severity: str  # "low" | "medium" | "high"
    message: str  # korte omschrijving
    meta: Dict[str, float] = Field(
        default_factory=dict
    )  # extra cijfers (spr, gcf, z, count, etc.)


class FlagRow(BaseModel):
    user_id: int
    user_name: str
    peer_avg_overall: float
    self_avg_overall: Optional[float] = None
    reviewers_count: int
    gcf: float
    spr: float
    flags: List[Flag] = Field(default_factory=list)


class FlagsResponse(BaseModel):
    evaluation_id: int
    items: List[FlagRow]
