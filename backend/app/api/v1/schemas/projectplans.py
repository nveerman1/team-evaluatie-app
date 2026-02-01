"""
Schemas for ProjectPlan API (GO/NO-GO)
"""

from __future__ import annotations
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, field_validator


# ============ ProjectPlanSection Schemas ============


class ProjectPlanSectionBase(BaseModel):
    """Base schema for project plan section"""

    key: str = Field(..., max_length=50)
    status: str = Field(default="empty", max_length=20)
    text: Optional[str] = None

    # Client section fields
    client_organisation: Optional[str] = Field(None, max_length=200)
    client_contact: Optional[str] = Field(None, max_length=200)
    client_email: Optional[str] = Field(None, max_length=320)
    client_phone: Optional[str] = Field(None, max_length=50)
    client_description: Optional[str] = None

    # Teacher feedback
    teacher_note: Optional[str] = None


class ProjectPlanSectionUpdate(BaseModel):
    """Schema for updating a project plan section (student or teacher)"""

    text: Optional[str] = None
    status: Optional[str] = Field(None, max_length=20)

    # Client section fields
    client_organisation: Optional[str] = Field(None, max_length=200)
    client_contact: Optional[str] = Field(None, max_length=200)
    client_email: Optional[str] = Field(None, max_length=320)
    client_phone: Optional[str] = Field(None, max_length=50)
    client_description: Optional[str] = None

    # Teacher feedback
    teacher_note: Optional[str] = None


class ProjectPlanSectionOut(ProjectPlanSectionBase):
    """Schema for project plan section output"""

    id: int
    school_id: int
    project_plan_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============ ProjectPlan Schemas ============


class ProjectPlanBase(BaseModel):
    """Base schema for project plan"""

    title: Optional[str] = Field(None, max_length=200)
    status: str = Field(default="concept", max_length=20)
    locked: bool = False
    global_teacher_note: Optional[str] = None


class ProjectPlanCreate(BaseModel):
    """Schema for creating a new project plan"""

    project_id: int
    title: Optional[str] = Field(None, max_length=200)


class ProjectPlanUpdate(BaseModel):
    """Schema for updating a project plan"""

    title: Optional[str] = Field(None, max_length=200)
    status: Optional[str] = Field(None, max_length=20)
    locked: Optional[bool] = None
    global_teacher_note: Optional[str] = None


class ProjectPlanOut(ProjectPlanBase):
    """Schema for project plan output"""

    id: int
    school_id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    # Included sections
    sections: List[ProjectPlanSectionOut] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ProjectPlanListItem(BaseModel):
    """Schema for project plan in list view"""

    id: int
    project_id: int
    title: Optional[str]
    status: str
    locked: bool
    updated_at: datetime

    # Enriched fields (populated in API)
    project_title: str = ""
    team_number: Optional[int] = None
    team_members: List[str] = Field(default_factory=list)
    required_complete: int = 0
    required_total: int = 0
    total_sections: int = 0

    model_config = ConfigDict(from_attributes=True)


class ProjectPlanListOut(BaseModel):
    """Schema for paginated project plan list"""

    items: List[ProjectPlanListItem]
    total: int
    page: int
    per_page: int


# ============ Teacher Review Schemas ============


class TeacherSectionReview(BaseModel):
    """Schema for teacher section review/feedback"""

    teacher_note: str = Field(..., min_length=1)  # Required for revision
    status: str  # "approved" or "revision"

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v not in ["approved", "revision"]:
            raise ValueError("status must be 'approved' or 'revision'")
        return v


class TeacherGlobalReview(BaseModel):
    """Schema for teacher GO/NO-GO decision"""

    status: str  # "go" or "no-go"
    global_teacher_note: Optional[str] = None
    locked: Optional[bool] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v not in ["go", "no-go"]:
            raise ValueError("status must be 'go' or 'no-go'")
        return v


# ============ Student Submission Schema ============


class ProjectPlanSubmit(BaseModel):
    """Schema for student submission of plan for review"""

    pass  # No additional fields needed - submission logic handled in endpoint
