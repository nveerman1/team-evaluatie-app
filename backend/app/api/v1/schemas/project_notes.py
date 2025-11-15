"""
PROJECT NOTES SCHEMAS
====================

Pydantic schemas for the Projectaantekeningen (Project Notes) feature.
"""

from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any


# ========== ProjectNotesContext Schemas ==========


class ProjectNotesContextCreate(BaseModel):
    """Schema for creating a new project notes context."""

    title: str = Field(..., min_length=1, max_length=200)
    course_id: Optional[int] = None
    class_name: Optional[str] = None
    description: Optional[str] = None
    evaluation_id: Optional[int] = None  # Optional link to existing evaluation
    settings: Dict[str, Any] = Field(default_factory=dict)


class ProjectNotesContextUpdate(BaseModel):
    """Schema for updating a project notes context."""

    title: Optional[str] = None
    description: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class ProjectNotesContextOut(BaseModel):
    """Basic output schema for project notes context."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    course_id: Optional[int]
    course_name: Optional[str] = None  # Joined from Course table
    class_name: Optional[str]
    description: Optional[str]
    evaluation_id: Optional[int]
    created_by: int
    created_by_name: Optional[str] = None  # Joined from User table
    created_at: datetime
    updated_at: datetime
    settings: Dict[str, Any]
    note_count: Optional[int] = 0  # Can be computed


class TeamInfo(BaseModel):
    """Information about a team in the context."""

    id: int
    name: str
    member_count: int
    members: List[str]  # List of student names
    member_ids: List[int]  # List of student IDs


class StudentInfo(BaseModel):
    """Information about a student in the context."""

    id: int
    name: str
    team_id: Optional[int]
    team_name: Optional[str]


class ProjectNotesContextDetailOut(ProjectNotesContextOut):
    """Detailed output schema including teams and students."""

    teams: List[TeamInfo] = []
    students: List[StudentInfo] = []


# ========== ProjectNote Schemas ==========


class ProjectNoteCreate(BaseModel):
    """Schema for creating a new note."""

    note_type: str = Field(..., pattern="^(project|team|student)$")
    team_id: Optional[int] = None  # Required if note_type == "team"
    student_id: Optional[int] = None  # Required if note_type == "student"
    text: str = Field(..., min_length=1)
    tags: List[str] = Field(default_factory=list)
    omza_category: Optional[str] = None  # e.g., "Organiseren", "Meedoen", etc.
    learning_objective_id: Optional[int] = None  # Link to eindterm
    is_competency_evidence: bool = False
    is_portfolio_evidence: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ProjectNoteUpdate(BaseModel):
    """Schema for updating a note."""

    text: Optional[str] = None
    tags: Optional[List[str]] = None
    omza_category: Optional[str] = None
    learning_objective_id: Optional[int] = None
    is_competency_evidence: Optional[bool] = None
    is_portfolio_evidence: Optional[bool] = None
    metadata: Optional[Dict[str, Any]] = None


class ProjectNoteOut(BaseModel):
    """Output schema for a note."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    context_id: int
    note_type: str
    team_id: Optional[int]
    team_name: Optional[str] = None  # Joined
    student_id: Optional[int]
    student_name: Optional[str] = None  # Joined
    text: str
    tags: List[str]
    omza_category: Optional[str]
    learning_objective_id: Optional[int]
    learning_objective_title: Optional[str] = None  # Joined
    is_competency_evidence: bool
    is_portfolio_evidence: bool
    metadata: Dict[str, Any]
    created_by: int
    created_by_name: Optional[str] = None  # Joined
    created_at: datetime
    updated_at: datetime
