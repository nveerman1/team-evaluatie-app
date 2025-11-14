"""
Schemas for Teachers API
"""

from __future__ import annotations
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr


class TeacherBase(BaseModel):
    """Base teacher schema"""

    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    role: str = Field("teacher", description="Role: 'teacher' or 'admin'")


class TeacherCreate(TeacherBase):
    """Schema for creating a teacher"""

    password: Optional[str] = Field(None, min_length=8)


class TeacherUpdate(BaseModel):
    """Schema for updating a teacher"""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    email: Optional[EmailStr] = None
    role: Optional[str] = Field(None, description="Role: 'teacher' or 'admin'")
    archived: Optional[bool] = None


class CourseInfo(BaseModel):
    """Minimal course info for teacher details"""

    id: int
    name: str
    code: Optional[str] = None
    level: Optional[str] = None
    year: Optional[int] = None

    class Config:
        from_attributes = True


class TeacherOut(TeacherBase):
    """Schema for teacher output"""

    id: int
    school_id: int
    archived: bool
    courses: List[CourseInfo] = []
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class TeacherListOut(BaseModel):
    """Schema for teacher list output with pagination"""

    teachers: List[TeacherOut]
    total: int
    page: int
    per_page: int


class TeacherCourseAssignment(BaseModel):
    """Schema for assigning a course to a teacher"""

    course_id: int
    role: str = Field("teacher", description="Role in course: 'teacher' or 'coordinator'")


class CSVImportResult(BaseModel):
    """Schema for CSV import result"""

    success_count: int
    error_count: int
    errors: List[str] = []
    created: List[int] = []
    updated: List[int] = []
