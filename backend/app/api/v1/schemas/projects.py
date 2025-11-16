"""
Schemas for Projects API
"""

from __future__ import annotations
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from pydantic import BaseModel, Field, ConfigDict


# ============ Project Schemas ============


class ProjectBase(BaseModel):
    """Base schema for project data"""

    title: str = Field(..., min_length=1, max_length=200)
    course_id: Optional[int] = None
    slug: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    class_name: Optional[str] = Field(None, max_length=50)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: str = Field(default="concept", max_length=30)


class ProjectCreate(ProjectBase):
    """Schema for creating a new project"""

    pass


class ProjectUpdate(BaseModel):
    """Schema for updating a project (all fields optional)"""

    title: Optional[str] = Field(None, min_length=1, max_length=200)
    course_id: Optional[int] = None
    slug: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    class_name: Optional[str] = Field(None, max_length=50)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = Field(None, max_length=30)


class ProjectOut(ProjectBase):
    """Schema for project output"""

    id: int
    school_id: int
    created_by_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectListItem(BaseModel):
    """Schema for project in list view"""

    id: int
    title: str
    course_id: Optional[int]
    class_name: Optional[str]
    start_date: Optional[date]
    end_date: Optional[date]
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectListOut(BaseModel):
    """Schema for paginated project list"""

    items: List[ProjectListItem]
    total: int
    page: int
    per_page: int


class ProjectDetailOut(ProjectOut):
    """Schema for detailed project output with aggregated info"""

    evaluation_counts: Dict[str, int] = Field(default_factory=dict)
    note_count: int = 0
    client_count: int = 0

    model_config = ConfigDict(from_attributes=True)


# ============ Project Note Schemas ============


class ProjectNoteBase(BaseModel):
    """Base schema for project note data"""

    title: str = Field(..., min_length=1, max_length=200)
    body: Optional[str] = None
    note_type: str = Field(default="general", max_length=50)


class ProjectNoteCreate(ProjectNoteBase):
    """Schema for creating a new project note"""

    pass


class ProjectNoteUpdate(BaseModel):
    """Schema for updating a project note"""

    title: Optional[str] = Field(None, min_length=1, max_length=200)
    body: Optional[str] = None
    note_type: Optional[str] = Field(None, max_length=50)


class ProjectNoteOut(ProjectNoteBase):
    """Schema for project note output"""

    id: int
    school_id: int
    project_id: int
    author_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============ Wizard Schemas ============


class EvaluationConfig(BaseModel):
    """Configuration for evaluation creation in wizard"""

    create_peer_tussen: bool = False
    create_peer_eind: bool = False
    create_project_assessment: bool = False
    create_competency_scan: bool = False


class WizardProjectCreate(BaseModel):
    """Schema for wizard project creation"""

    # Project data
    project: ProjectCreate

    # Evaluation configuration
    evaluations: EvaluationConfig = Field(default_factory=EvaluationConfig)

    # Optional client links
    client_ids: List[int] = Field(default_factory=list)

    # Optional default note
    create_default_note: bool = False


class WizardEvaluationOut(BaseModel):
    """Output schema for evaluation created by wizard"""

    id: int
    title: str
    evaluation_type: str
    status: str


class WizardProjectOut(BaseModel):
    """Schema for wizard project creation response"""

    project: ProjectOut
    evaluations: List[WizardEvaluationOut]
    note: Optional[ProjectNoteOut] = None
    linked_clients: List[int]
