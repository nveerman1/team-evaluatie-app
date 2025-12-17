"""
Schemas for StudentClassMembership API
"""

from __future__ import annotations
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


class StudentClassMembershipBase(BaseModel):
    """Base student class membership schema"""

    student_id: int = Field(..., description="FK to User (student)")
    class_id: int = Field(..., description="FK to Class")


class StudentClassMembershipCreate(StudentClassMembershipBase):
    """Schema for creating a student class membership"""

    academic_year_id: int = Field(..., description="FK to AcademicYear (redundant for constraint)")


class StudentClassMembershipUpdate(BaseModel):
    """Schema for updating a student class membership (changing class)"""

    class_id: int = Field(..., description="New class_id")


class StudentClassMembershipOut(StudentClassMembershipBase):
    """Schema for student class membership output"""

    id: int
    academic_year_id: int
    created_at: datetime
    updated_at: datetime
    # Optional enriched fields
    class_name: Optional[str] = None
    academic_year_label: Optional[str] = None
    student_name: Optional[str] = None

    class Config:
        from_attributes = True


class StudentClassMembershipListOut(BaseModel):
    """Schema for student class membership list output with pagination"""

    memberships: List[StudentClassMembershipOut]
    total: int
    page: int
    per_page: int
