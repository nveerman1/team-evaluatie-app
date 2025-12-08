"""
Schemas for Project Teams API
"""

from __future__ import annotations
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


# ============ Project Team Member Schemas ============


class ProjectTeamMemberBase(BaseModel):
    """Base schema for project team member"""

    user_id: int
    role: Optional[str] = Field(None, max_length=100)


class ProjectTeamMemberCreate(ProjectTeamMemberBase):
    """Schema for creating a project team member"""

    pass


class ProjectTeamMemberOut(ProjectTeamMemberBase):
    """Schema for project team member output"""

    id: int
    project_team_id: int
    created_at: datetime

    # User details (populated from join)
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_status: Optional[str] = None  # "active" or "inactive" based on archived field

    model_config = ConfigDict(from_attributes=True)


class BulkAddMembersRequest(BaseModel):
    """Schema for bulk adding members to a project team"""

    members: List[ProjectTeamMemberCreate] = Field(..., min_length=1)


# ============ Project Team Schemas ============


class ProjectTeamBase(BaseModel):
    """Base schema for project team"""

    display_name_at_time: str = Field(..., min_length=1, max_length=200)
    version: int = Field(default=1, ge=1)


class ProjectTeamCreate(BaseModel):
    """Schema for creating a project team"""

    team_id: Optional[int] = None  # Optional link to existing group
    team_name: Optional[str] = Field(None, min_length=1, max_length=200)  # Or provide a name


class ProjectTeamOut(ProjectTeamBase):
    """Schema for project team output"""

    id: int
    school_id: int
    project_id: int
    team_id: Optional[int] = None
    backfill_source: Optional[str] = None
    created_at: datetime

    # Related data
    members: List[ProjectTeamMemberOut] = []
    member_count: int = 0
    is_locked: bool = False  # True if team has evaluations/assessments

    model_config = ConfigDict(from_attributes=True)


class ProjectTeamListOut(BaseModel):
    """Schema for list of project teams"""

    teams: List[ProjectTeamOut]
    total: int


class ProjectTeamDetailOut(ProjectTeamOut):
    """Schema for detailed project team output with all members"""

    pass


# ============ Clone Request Schema ============


class CloneProjectTeamsRequest(BaseModel):
    """Schema for cloning project teams from another project"""

    source_project_id: int = Field(..., description="Project ID to clone teams from")


class CloneProjectTeamsResponse(BaseModel):
    """Response schema for cloning project teams"""

    teams_cloned: int
    members_cloned: int
    project_team_ids: List[int]
