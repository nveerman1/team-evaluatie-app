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


class PeerEvaluationConfig(BaseModel):
    """Configuration for peer evaluation in wizard"""

    enabled: bool = False
    deadline: Optional[datetime] = None
    rubric_id: Optional[int] = None
    title_suffix: str = ""  # e.g., "tussentijds" or "eind"


class ProjectAssessmentConfig(BaseModel):
    """Configuration for project assessment in wizard"""

    enabled: bool = False
    rubric_id: int  # Required for project assessment
    deadline: Optional[datetime] = None
    version: Optional[str] = None  # e.g., "tussentijds", "eind"


class CompetencyScanConfig(BaseModel):
    """Configuration for competency scan in wizard"""

    enabled: bool = False
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None  # Can also serve as deadline
    deadline: Optional[datetime] = None  # Optional separate deadline
    competency_ids: List[int] = Field(default_factory=list)
    title: Optional[str] = None


class EvaluationConfig(BaseModel):
    """Configuration for evaluation creation in wizard"""

    # Peer evaluations (still create Evaluation records)
    peer_tussen: Optional[PeerEvaluationConfig] = None
    peer_eind: Optional[PeerEvaluationConfig] = None

    # Project assessment (creates ProjectAssessment records)
    project_assessment: Optional[ProjectAssessmentConfig] = None

    # Competency scan (creates CompetencyWindow records)
    competency_scan: Optional[CompetencyScanConfig] = None


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
    deadline: Optional[datetime] = None


class WizardProjectAssessmentOut(BaseModel):
    """Output schema for project assessment created by wizard"""

    id: int
    title: str
    group_id: int
    group_name: Optional[str] = None
    rubric_id: int
    version: Optional[str] = None
    status: str
    deadline: Optional[datetime] = None


class WizardCompetencyWindowOut(BaseModel):
    """Output schema for competency window created by wizard"""

    id: int
    title: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    deadline: Optional[datetime] = None
    status: str
    competency_ids: List[int] = Field(default_factory=list)


class WizardEntityOut(BaseModel):
    """Wrapper for mixed entity types with discriminator"""

    type: str  # "peer" | "project_assessment" | "competency_scan"
    data: Dict[str, Any]


class WizardProjectOut(BaseModel):
    """Schema for wizard project creation response"""

    project: ProjectOut
    entities: List[WizardEntityOut]
    note: Optional[ProjectNoteOut] = None
    linked_clients: List[int]
    warnings: List[str] = Field(default_factory=list)  # For edge case warnings


# ============ Running Projects Overview Schemas ============


class RunningProjectKPIOut(BaseModel):
    """Schema for running projects KPI statistics"""

    running_projects: int = Field(..., description="Total running projects count")
    active_clients_now: int = Field(..., description="Number of unique active clients in running projects")
    upcoming_moments: int = Field(..., description="Number of upcoming presentations/moments")


class RunningProjectItem(BaseModel):
    """Schema for running project in overview table"""

    # Project info
    project_id: int
    project_title: str
    project_status: str
    course_name: Optional[str] = None
    
    # Client info
    client_id: Optional[int] = None
    client_organization: Optional[str] = None
    client_email: Optional[str] = None
    
    # Team info
    class_name: Optional[str] = None
    team_number: Optional[int] = None
    student_names: List[str] = Field(default_factory=list)
    
    # Period
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    
    # Next moment
    next_moment_type: Optional[str] = None  # "Tussenpresentatie", "Eindpresentatie", "Contactmoment"
    next_moment_date: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)


class RunningProjectsListOut(BaseModel):
    """Schema for paginated running projects list"""

    items: List[RunningProjectItem]
    total: int
    page: int
    per_page: int
    pages: int
