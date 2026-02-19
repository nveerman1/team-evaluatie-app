"""
Schemas for Tasks API
"""

from __future__ import annotations
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel, Field, ConfigDict

# ============ Task Schemas ============


class TaskBase(BaseModel):
    """Base schema for task data"""

    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    due_date: Optional[date] = None
    status: str = Field(default="open", max_length=30)  # "open" | "done" | "dismissed"
    type: str = Field(
        default="opdrachtgever", max_length=30
    )  # "opdrachtgever" | "docent" | "project"
    project_id: Optional[int] = None
    client_id: Optional[int] = None
    class_id: Optional[int] = None
    email_to: Optional[str] = Field(None, max_length=500)
    email_cc: Optional[str] = Field(None, max_length=500)


class TaskCreate(TaskBase):
    """Schema for creating a new task"""

    # Manual tasks always have auto_generated=False and source="manual"
    pass


class TaskUpdate(BaseModel):
    """Schema for updating a task (all fields optional)"""

    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    due_date: Optional[date] = None
    status: Optional[str] = Field(None, max_length=30)
    type: Optional[str] = Field(None, max_length=30)
    project_id: Optional[int] = None
    client_id: Optional[int] = None
    class_id: Optional[int] = None
    email_to: Optional[str] = Field(None, max_length=500)
    email_cc: Optional[str] = Field(None, max_length=500)


class TaskOut(TaskBase):
    """Schema for task output"""

    id: int
    school_id: int
    auto_generated: bool
    source: str
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    # Enriched context from joins
    project_name: Optional[str] = None
    class_name: Optional[str] = None
    client_name: Optional[str] = None
    client_email: Optional[str] = None
    course_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TaskListOut(BaseModel):
    """Schema for paginated task list"""

    items: List[TaskOut]
    total: int
    page: int
    per_page: int


class TaskCompleteRequest(BaseModel):
    """Schema for marking a task as complete"""

    pass  # No body needed, just POST to complete endpoint
