"""
Schemas for Subject API
"""

from __future__ import annotations
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


class SubjectBase(BaseModel):
    """Base subject schema"""

    name: str = Field(..., min_length=1, max_length=200)
    code: str = Field(..., min_length=1, max_length=50)
    color: Optional[str] = Field(None, max_length=20)
    icon: Optional[str] = Field(None, max_length=100)


class SubjectCreate(SubjectBase):
    """Schema for creating a subject"""

    pass


class SubjectUpdate(BaseModel):
    """Schema for updating a subject"""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    color: Optional[str] = Field(None, max_length=20)
    icon: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


class SubjectOut(SubjectBase):
    """Schema for subject output"""

    id: int
    school_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SubjectListOut(BaseModel):
    """Schema for subject list output with pagination"""

    subjects: List[SubjectOut]
    total: int
    page: int
    per_page: int
