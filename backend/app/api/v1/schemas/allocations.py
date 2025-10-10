from __future__ import annotations
from pydantic import BaseModel, Field


class AutoAllocateRequest(BaseModel):
    evaluation_id: int
    peers_per_student: int = Field(1, ge=0, le=10)
    include_self: bool = True


class AllocationOut(BaseModel):
    id: int
    evaluation_id: int
    reviewer_id: int
    reviewee_id: int
    is_self: bool

    class Config:
        from_attributes = True


class MyAllocationOut(BaseModel):
    allocation_id: int
    evaluation_id: int
    reviewee_id: int
    reviewee_name: str
    reviewee_email: str
    is_self: bool
    rubric_id: int
    criterion_ids: list[int]
