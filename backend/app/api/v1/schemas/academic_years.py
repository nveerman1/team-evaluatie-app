"""
Schemas for AcademicYear API
"""

from __future__ import annotations
from typing import Optional, List, Dict
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


class AcademicYearTransitionRequest(BaseModel):
    """Schema for academic year transition request"""

    target_academic_year_id: int = Field(
        ..., description="Target academic year ID to transition to"
    )
    class_mapping: Dict[str, str] = Field(
        ...,
        description="Mapping of source class names to target class names (e.g., {'G2a': 'G3a'})",
    )
    copy_course_enrollments: bool = Field(
        default=False,
        description="Whether to copy course enrollments to the new academic year",
    )


class AcademicYearTransitionResult(BaseModel):
    """Schema for academic year transition result"""

    classes_created: int = Field(..., description="Number of classes created")
    students_moved: int = Field(..., description="Number of students moved")
    courses_created: int = Field(..., description="Number of courses created")
    enrollments_copied: int = Field(..., description="Number of enrollments copied")
    skipped_students: int = Field(..., description="Number of students skipped")
