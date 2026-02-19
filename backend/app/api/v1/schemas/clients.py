"""
Schemas for Clients (Opdrachtgevers) API
"""

from __future__ import annotations
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# ============ Client Schemas ============


class ClientBase(BaseModel):
    """Base schema for client data"""

    organization: str = Field(..., min_length=1, max_length=200)
    contact_name: Optional[str] = Field(None, max_length=200)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    level: Optional[str] = Field(None, max_length=50)
    sector: Optional[str] = Field(None, max_length=100)
    tags: List[str] = Field(default_factory=list)
    active: bool = True


class ClientCreate(ClientBase):
    """Schema for creating a new client"""

    pass


class ClientUpdate(BaseModel):
    """Schema for updating a client (all fields optional)"""

    organization: Optional[str] = Field(None, min_length=1, max_length=200)
    contact_name: Optional[str] = Field(None, max_length=200)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    level: Optional[str] = Field(None, max_length=50)
    sector: Optional[str] = Field(None, max_length=100)
    tags: Optional[List[str]] = None
    active: Optional[bool] = None


class ClientOut(ClientBase):
    """Schema for client output"""

    id: int
    school_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClientListItem(BaseModel):
    """Schema for client in list view (includes computed fields)"""

    id: int
    organization: str
    contact_name: Optional[str]
    email: Optional[str]
    level: Optional[str]
    sector: Optional[str]
    tags: List[str]
    active: bool
    projects_this_year: int = 0
    last_active: Optional[str] = None
    status: str = "Actief"

    model_config = ConfigDict(from_attributes=True)


class ClientListOut(BaseModel):
    """Schema for paginated client list"""

    items: List[ClientListItem]
    total: int
    page: int
    per_page: int
    pages: int


# ============ Client Log Schemas ============


class ClientLogBase(BaseModel):
    """Base schema for client log"""

    log_type: str = Field(default="Notitie", max_length=50)
    text: str = Field(..., min_length=1)


class ClientLogCreate(ClientLogBase):
    """Schema for creating a new log entry"""

    pass


class ClientLogOut(ClientLogBase):
    """Schema for client log output"""

    id: int
    client_id: int
    author_id: int
    created_at: datetime
    author_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ClientLogListOut(BaseModel):
    """Schema for paginated client log list"""

    items: List[ClientLogOut]
    total: int


# ============ Client Project Link Schemas ============


class ClientProjectLinkBase(BaseModel):
    """Base schema for client-project link"""

    role: str = Field(default="main")
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class ClientProjectLinkCreate(ClientProjectLinkBase):
    """Schema for creating a new client-project link"""

    client_id: int
    project_assessment_id: int


class ClientProjectLinkOut(ClientProjectLinkBase):
    """Schema for client-project link output"""

    id: int
    client_id: int
    project_assessment_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============ Reminder Schemas ============


class ReminderOut(BaseModel):
    """Schema for upcoming reminder"""

    id: str
    text: str
    client_name: str
    client_email: Optional[str]
    client_id: int
    due_date: str
    template: str
    project_title: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ReminderListOut(BaseModel):
    """Schema for reminder list"""

    items: List[ReminderOut]
    total: int


# ============ Dashboard Schemas ============


class DashboardKPIOut(BaseModel):
    """Schema for dashboard KPI statistics"""

    active_clients: int
    projects_this_year: int
    at_risk_count: int
    change_from_last_year: int


class ClientInsightItem(BaseModel):
    """Schema for client insight items (new clients, top collaborations, at-risk)"""

    id: int
    organization: str
    sector: Optional[str] = None
    created_at: Optional[str] = None  # For new clients
    last_active: Optional[str] = None  # For at-risk clients
    project_count: Optional[int] = None  # For top collaborations
    years_active: Optional[int] = None  # For top collaborations


class ClientInsightListOut(BaseModel):
    """Schema for client insight list with pagination support"""

    items: List[ClientInsightItem]
    total: int
    has_more: bool


class RecentCommunicationItem(BaseModel):
    """Schema for recent communication log entries"""

    id: int
    title: str  # Based on log_type
    organization: str
    client_id: int
    date: str  # created_at formatted
    log_type: str


class RecentCommunicationListOut(BaseModel):
    """Schema for recent communication list"""

    items: List[RecentCommunicationItem]
    total: int
