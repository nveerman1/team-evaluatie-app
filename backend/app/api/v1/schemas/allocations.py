from __future__ import annotations
from typing import Optional, List
from pydantic import BaseModel, Field


class AutoAllocateRequest(BaseModel):
    evaluation_id: int
    peers_per_student: Optional[int] = Field(default=None, ge=0, le=10)
    include_self: bool = True
    group_id: Optional[int] = None
    group_ids: Optional[List[int]] = None
    team_number: Optional[int] = None


class AllocationOut(BaseModel):
    id: int
    evaluation_id: int
    reviewer_id: int
    reviewee_id: int
    is_self: bool

    class Config:
        from_attributes = True  # pydantic v1 compat; in v2 kan model_config/ConfigDict gebruikt worden


class MyAllocationOut(BaseModel):
    allocation_id: int
    evaluation_id: int
    reviewee_id: int
    reviewee_name: str
    reviewee_email: str  # laat 'm op str zolang je elders geen EmailStr verwacht
    is_self: bool
    rubric_id: int
    criterion_ids: List[int]
    # ✅ nieuw: frontend gebruikt dit voor statusbadge/teller in stap 2
    completed: Optional[bool] = None
