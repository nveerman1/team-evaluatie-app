from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class OverviewItemOut(BaseModel):
    """
    Single item in the overview table combining projects, peer evaluations, and competency windows
    """
    # Core fields
    id: int
    type: str  # "project" | "peer" | "competency"
    
    # Student info
    student_id: int
    student_name: str
    student_class: Optional[str] = None
    
    # Item info
    title: str
    course_name: Optional[str] = None
    course_id: Optional[int] = None
    teacher_name: Optional[str] = None
    teacher_id: Optional[int] = None
    date: Optional[datetime] = None  # published_at for projects, end_date for competency, created_at for peer
    
    # Score (normalized representation)
    score: Optional[float] = None
    score_label: Optional[str] = None  # Human-readable score representation
    
    # Status
    status: str  # "open" | "closed" | "draft" | "published"
    
    # Navigation
    detail_url: str  # Frontend route to navigate to
    
    # Optional metadata
    team_number: Optional[int] = None
    team_name: Optional[str] = None


class OverviewListResponse(BaseModel):
    """
    Paginated list of overview items with filters applied
    """
    items: List[OverviewItemOut]
    total: int
    page: int
    limit: int
    
    # Optional summary stats
    total_projects: int = 0
    total_peers: int = 0
    total_competencies: int = 0


class OverviewFilters(BaseModel):
    """
    Filters for overview items
    """
    student_id: Optional[int] = None
    course_id: Optional[int] = None
    teacher_id: Optional[int] = None
    type: Optional[str] = None  # "project" | "peer" | "competency"
    status: Optional[str] = None
    date_from: Optional[str] = None  # ISO date
    date_to: Optional[str] = None  # ISO date
    team_number: Optional[int] = None
    search: Optional[str] = None  # Search in title or student name
    
    # Sorting
    sort_by: str = "date"  # "date" | "student" | "score"
    sort_order: str = "desc"  # "asc" | "desc"
    
    # Pagination
    page: int = 1
    limit: int = 50
