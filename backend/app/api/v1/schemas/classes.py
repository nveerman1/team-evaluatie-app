"""
Schemas for Class API
"""

from __future__ import annotations
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


class ClassBase(BaseModel):
    """Base class schema"""

    name: str = Field(..., min_length=1, max_length=50, description="e.g., 'G2a', 'A3b'")


class ClassCreate(ClassBase):
    """Schema for creating a class"""

    academic_year_id: int = Field(..., description="FK to AcademicYear")


class ClassUpdate(BaseModel):
    """Schema for updating a class"""

    name: Optional[str] = Field(None, min_length=1, max_length=50)
    academic_year_id: Optional[int] = None


class ClassOut(ClassBase):
    """Schema for class output"""

    id: int
    school_id: int
    academic_year_id: int
    academic_year_label: Optional[str] = None  # Populated via join
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ClassListOut(BaseModel):
    """Schema for class list output with pagination"""

    classes: List[ClassOut]
    total: int
    page: int
    per_page: int


class ClassWithStudentCount(ClassOut):
    """Class with student count"""

    student_count: int = 0


class BulkClassCreate(BaseModel):
    """Schema for bulk creating classes"""

    academic_year_id: int
    class_names: List[str] = Field(..., min_items=1, description="List of class names to create")
