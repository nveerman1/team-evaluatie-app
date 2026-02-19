"""
Pydantic schemas for Skill Trainings (Vaardigheidstrainingen)
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional, List, Dict, Literal
from pydantic import BaseModel, Field

# ============ Status Type ============

SkillTrainingStatus = Literal[
    "none", "planned", "in_progress", "submitted", "completed", "mastered"
]

# Statuses that students are allowed to set
STUDENT_ALLOWED_STATUSES = {"none", "planned", "in_progress", "submitted"}


# ============ Skill Training Schemas ============


class SkillTrainingBase(BaseModel):
    title: str = Field(..., max_length=200)
    url: str = Field(..., max_length=500)
    competency_category_id: int
    learning_objective_id: Optional[int] = None
    level: Optional[str] = Field(None, max_length=20)  # "basis" | "plus"
    est_minutes: Optional[str] = Field(None, max_length=30)  # "10-15 min"
    is_active: bool = True


class SkillTrainingCreate(SkillTrainingBase):
    """Schema for creating a new skill training (teacher/admin only)"""

    pass


class SkillTrainingUpdate(BaseModel):
    """Schema for updating a skill training (teacher/admin only, all fields optional)"""

    title: Optional[str] = Field(None, max_length=200)
    url: Optional[str] = Field(None, max_length=500)
    competency_category_id: Optional[int] = None
    learning_objective_id: Optional[int] = None
    level: Optional[str] = Field(None, max_length=20)
    est_minutes: Optional[str] = Field(None, max_length=30)
    is_active: Optional[bool] = None


class SkillTrainingOut(SkillTrainingBase):
    """Schema for skill training output with computed fields"""

    id: int
    school_id: int
    competency_category_name: Optional[str] = None
    learning_objective_title: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Progress Schemas ============


class SkillTrainingProgressOut(BaseModel):
    """Schema for skill training progress output"""

    id: int
    student_id: int
    training_id: int
    course_id: int
    status: SkillTrainingStatus
    note: Optional[str] = None
    updated_at: datetime
    updated_by_user_id: int

    class Config:
        from_attributes = True


class StudentProgressRow(BaseModel):
    """Schema for a single student's progress across all trainings (matrix view)"""

    student_id: int
    student_name: str
    class_name: Optional[str] = None
    progress: Dict[int, str]  # training_id -> status


class TeacherProgressMatrixResponse(BaseModel):
    """Schema for teacher progress matrix view response"""

    trainings: List[SkillTrainingOut]
    students: List[StudentProgressRow]


class BulkProgressUpdate(BaseModel):
    """Schema for bulk progress update (teacher only)"""

    student_ids: List[int] = Field(
        ..., max_items=100, description="Max 100 students per bulk update"
    )
    training_ids: List[int] = Field(
        ..., max_items=50, description="Max 50 trainings per bulk update"
    )
    status: SkillTrainingStatus


class StudentTrainingItem(BaseModel):
    """Schema for a single training item with student's progress"""

    training: SkillTrainingOut
    status: SkillTrainingStatus
    note: Optional[str] = None
    updated_at: Optional[datetime] = None


class StudentTrainingListResponse(BaseModel):
    """Schema for student's training list response"""

    items: List[StudentTrainingItem]


class StudentStatusUpdate(BaseModel):
    """Schema for student updating their own status"""

    status: SkillTrainingStatus
    note: Optional[str] = Field(None, max_length=2000)
