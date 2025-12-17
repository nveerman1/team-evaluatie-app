"""
Schemas for AcademicYear API
"""

from __future__ import annotations
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel, Field


class AcademicYearBase(BaseModel):
    """Base academic year schema"""

    label: str = Field(..., min_length=1, max_length=50, description="e.g., '2025-2026'")
    start_date: date = Field(..., description="Start date of the academic year")
    end_date: date = Field(..., description="End date of the academic year")


class AcademicYearCreate(AcademicYearBase):
    """Schema for creating an academic year"""

    pass


class AcademicYearUpdate(BaseModel):
    """Schema for updating an academic year"""

    label: Optional[str] = Field(None, min_length=1, max_length=50)
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class AcademicYearOut(AcademicYearBase):
    """Schema for academic year output"""

    id: int
    school_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AcademicYearListOut(BaseModel):
    """Schema for academic year list output with pagination"""

    academic_years: List[AcademicYearOut]
    total: int
    page: int
    per_page: int
