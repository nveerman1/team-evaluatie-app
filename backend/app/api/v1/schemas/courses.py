"""
Schemas for Course API
"""

from __future__ import annotations
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


class CourseBase(BaseModel):
    """Base course schema"""

    name: str = Field(..., min_length=1, max_length=200)
    code: Optional[str] = Field(None, max_length=50)
    period: Optional[str] = Field(None, max_length=50)
    level: Optional[str] = Field(
        None, max_length=50, description="e.g., 'onderbouw', 'bovenbouw'"
    )
    year: Optional[int] = Field(None, ge=2020, le=2100)
    description: Optional[str] = None
    subject_id: Optional[int] = Field(None, description="Optional FK to Subject")


class CourseCreate(CourseBase):
    """Schema for creating a course"""

    pass


class CourseUpdate(BaseModel):
    """Schema for updating a course"""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    code: Optional[str] = Field(None, max_length=50)
    period: Optional[str] = Field(None, max_length=50)
    level: Optional[str] = Field(None, max_length=50)
    year: Optional[int] = Field(None, ge=2020, le=2100)
    description: Optional[str] = None
    subject_id: Optional[int] = None
    is_active: Optional[bool] = None


class CourseOut(CourseBase):
    """Schema for course output"""

    id: int
    school_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    teacher_names: Optional[List[str]] = None

    class Config:
        from_attributes = True


class CourseListOut(BaseModel):
    """Schema for course list output with pagination"""

    courses: List[CourseOut]
    total: int
    page: int
    per_page: int


class TeacherCourseCreate(BaseModel):
    """Schema for assigning teacher to course"""

    teacher_id: int
    role: str = Field(default="teacher", pattern="^(teacher|coordinator)$")


class TeacherCourseOut(BaseModel):
    """Schema for teacher-course assignment output"""

    id: int
    teacher_id: int
    course_id: int
    role: str
    is_active: bool
    teacher_name: Optional[str] = None
    teacher_email: Optional[str] = None

    class Config:
        from_attributes = True


class CourseStudentOut(BaseModel):
    """Schema for student in a course"""
    
    id: int
    name: str
    email: str
    class_name: Optional[str] = None
    team_number: Optional[int] = None
    
    class Config:
        from_attributes = True


class CourseStudentCreate(BaseModel):
    """Schema for adding a student to a course"""
    
    name: str = Field(..., min_length=1, max_length=200)
    email: str = Field(..., min_length=1, max_length=200)
    class_name: Optional[str] = Field(None, max_length=50)
    team_number: Optional[int] = None


class StudentTeamUpdate(BaseModel):
    """Schema for updating a single student's team"""
    
    student_id: int
    team_number: Optional[int] = None


class BulkStudentTeamUpdate(BaseModel):
    """Schema for bulk updating student team assignments"""
    
    updates: List[StudentTeamUpdate]
