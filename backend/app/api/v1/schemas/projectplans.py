from __future__ import annotations
from typing import Optional, List, Dict
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


# ---------- Enums ----------


class PlanStatus(str, Enum):
    """Status of a project plan team instance"""
    CONCEPT = "concept"
    INGEDIEND = "ingediend"
    GO = "go"
    NO_GO = "no-go"


class SectionKey(str, Enum):
    """8 sections in a project plan"""
    CLIENT = "client"
    PROBLEM = "problem"
    GOAL = "goal"
    METHOD = "method"
    PLANNING = "planning"
    TASKS = "tasks"
    MOTIVATION = "motivation"
    RISKS = "risks"


class SectionStatus(str, Enum):
    """Status of an individual section"""
    EMPTY = "empty"
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REVISION = "revision"


# ---------- Client Data ----------


class ClientData(BaseModel):
    """Client information for the client section"""
    organisation: Optional[str] = None
    contact: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    description: Optional[str] = None


# ---------- Project Plan Section ----------


class ProjectPlanSectionBase(BaseModel):
    """Base schema for project plan sections"""
    key: SectionKey
    status: SectionStatus
    text: Optional[str] = None
    client: Optional[ClientData] = None
    teacher_note: Optional[str] = None


class ProjectPlanSectionOut(ProjectPlanSectionBase):
    """Output schema for project plan sections"""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectPlanSectionUpdate(BaseModel):
    """Update schema for project plan sections"""
    text: Optional[str] = None
    client: Optional[ClientData] = None
    status: Optional[SectionStatus] = None
    teacher_note: Optional[str] = None


# ---------- Project Plan Team ----------


class ProjectPlanTeamBase(BaseModel):
    """Base schema for project plan teams"""
    title: Optional[str] = None
    status: PlanStatus
    locked: bool


class ProjectPlanTeamOut(ProjectPlanTeamBase):
    """Output schema for project plan teams"""
    id: int
    project_team_id: int
    team_number: Optional[int] = None
    team_members: List[str] = Field(default_factory=list)
    sections: List[ProjectPlanSectionOut] = Field(default_factory=list)
    global_teacher_note: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectPlanTeamUpdate(BaseModel):
    """Update schema for project plan teams"""
    title: Optional[str] = None
    status: Optional[PlanStatus] = None
    locked: Optional[bool] = None
    global_teacher_note: Optional[str] = None


# ---------- Project Plan ----------


class ProjectPlanBase(BaseModel):
    """Base schema for project plans"""
    title: Optional[str] = None
    version: Optional[str] = None


class ProjectPlanCreate(ProjectPlanBase):
    """Create schema for project plans"""
    project_id: int


class ProjectPlanUpdate(BaseModel):
    """Update schema for project plans"""
    title: Optional[str] = None
    version: Optional[str] = None


class ProjectPlanOut(ProjectPlanBase):
    """Output schema for project plans"""
    id: int
    project_id: int
    school_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectPlanDetail(ProjectPlanOut):
    """Detailed project plan with teams"""
    project_name: str
    course_id: Optional[int] = None
    course_name: Optional[str] = None
    team_count: int
    teams: List[ProjectPlanTeamOut] = Field(default_factory=list)


class ProjectPlanListItem(BaseModel):
    """List item schema for project plans"""
    id: int
    title: Optional[str] = None
    version: Optional[str] = None
    project_id: int
    project_name: str
    course_id: Optional[int] = None
    course_name: Optional[str] = None
    team_count: int
    teams_summary: Dict[str, int] = Field(default_factory=dict)  # {concept: 2, ingediend: 1, go: 0, no_go: 1}
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectPlanListResponse(BaseModel):
    """Response schema for list endpoint"""
    items: List[ProjectPlanListItem]
    page: int
    limit: int
    total: int


# ---------- Overview Schemas ----------


class ProjectPlanTeamOverviewItem(BaseModel):
    """Team overview item for the overview tab"""
    id: int
    project_team_id: int
    team_number: Optional[int] = None
    team_name: str
    team_members: List[str] = Field(default_factory=list)
    title: Optional[str] = None
    status: PlanStatus
    locked: bool
    sections_filled: int  # Number of non-empty sections
    sections_total: int = 8
    last_updated: datetime
    global_teacher_note: Optional[str] = None

    class Config:
        from_attributes = True
