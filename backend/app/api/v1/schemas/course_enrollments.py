"""
Schemas for CourseEnrollment API
"""

from __future__ import annotations
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


class CourseEnrollmentBase(BaseModel):
    """Base course enrollment schema"""

    course_id: int = Field(..., description="FK to Course")
    student_id: int = Field(..., description="FK to User (student)")


class CourseEnrollmentCreate(CourseEnrollmentBase):
    """Schema for creating a course enrollment"""

    pass


class CourseEnrollmentOut(CourseEnrollmentBase):
    """Schema for course enrollment output"""

    id: int
    active: bool
    created_at: datetime
    updated_at: datetime
    # Optional enriched fields
    course_name: Optional[str] = None
    student_name: Optional[str] = None

    class Config:
        from_attributes = True


class CourseEnrollmentListOut(BaseModel):
    """Schema for course enrollment list output with pagination"""

    enrollments: List[CourseEnrollmentOut]
    total: int
    page: int
    per_page: int


class BulkEnrollmentCreate(BaseModel):
    """Schema for bulk enrolling students to a course"""

    course_id: int
    student_ids: List[int] = Field(..., min_items=1)


class BulkEnrollmentDelete(BaseModel):
    """Schema for bulk removing students from a course"""

    course_id: int
    student_ids: List[int] = Field(..., min_items=1)
