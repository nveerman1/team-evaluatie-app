"""
Schemas for Templates API
"""

from __future__ import annotations
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


# ============ Peer Evaluation Criterion Template ============


class PeerEvaluationCriterionTemplateBase(BaseModel):
    """Base schema for peer evaluation criterion template"""

    omza_category: str = Field(
        ...,
        description="OMZA category: Organiseren, Meedoen, Zelfvertrouwen, Autonomie",
    )
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    target_level: Optional[str] = Field(
        None, description="Target level: onderbouw or bovenbouw"
    )
    level_descriptors: Dict[str, str] = Field(
        default_factory=dict,
        description="5-level descriptors: {'1': '...', '2': '...'}",
    )


class PeerEvaluationCriterionTemplateCreate(PeerEvaluationCriterionTemplateBase):
    """Schema for creating a peer evaluation criterion template"""

    subject_id: int


class PeerEvaluationCriterionTemplateUpdate(BaseModel):
    """Schema for updating a peer evaluation criterion template"""

    omza_category: Optional[str] = None
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    target_level: Optional[str] = None
    level_descriptors: Optional[Dict[str, str]] = None


class PeerEvaluationCriterionTemplateOut(PeerEvaluationCriterionTemplateBase):
    """Schema for peer evaluation criterion template output"""

    id: int
    school_id: int
    subject_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PeerEvaluationCriterionTemplateListOut(BaseModel):
    """Schema for peer evaluation criterion template list output"""

    templates: List[PeerEvaluationCriterionTemplateOut]
    total: int
    page: int
    per_page: int


# ============ Project Assessment Criterion Template ============


class ProjectAssessmentCriterionTemplateBase(BaseModel):
    """Base schema for project assessment criterion template"""

    category: str = Field(
        ...,
        description="Category: projectproces, eindresultaat, communicatie",
    )
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    target_level: Optional[str] = Field(
        None, description="Target level: onderbouw or bovenbouw"
    )
    level_descriptors: Dict[str, str] = Field(
        default_factory=dict,
        description="5-level descriptors: {'1': '...', '2': '...'}",
    )
    learning_objective_ids: List[int] = Field(
        default_factory=list,
        description="List of learning objective IDs to link",
    )


class ProjectAssessmentCriterionTemplateCreate(ProjectAssessmentCriterionTemplateBase):
    """Schema for creating a project assessment criterion template"""

    subject_id: int


class ProjectAssessmentCriterionTemplateUpdate(BaseModel):
    """Schema for updating a project assessment criterion template"""

    category: Optional[str] = None
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    target_level: Optional[str] = None
    level_descriptors: Optional[Dict[str, str]] = None
    learning_objective_ids: Optional[List[int]] = None


class ProjectAssessmentCriterionTemplateOut(ProjectAssessmentCriterionTemplateBase):
    """Schema for project assessment criterion template output"""

    id: int
    school_id: int
    subject_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectAssessmentCriterionTemplateListOut(BaseModel):
    """Schema for project assessment criterion template list output"""

    templates: List[ProjectAssessmentCriterionTemplateOut]
    total: int
    page: int
    per_page: int


# ============ Project Rubric Template ============


class ProjectRubricCriterionTemplateBase(BaseModel):
    """Base schema for project rubric criterion template"""

    category: str = Field(
        ..., description="Category: projectproces, eindresultaat, communicatie"
    )
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    weight: float = Field(default=1.0, ge=0)
    level_descriptors: Dict[str, str] = Field(default_factory=dict)


class ProjectRubricCriterionTemplateCreate(ProjectRubricCriterionTemplateBase):
    """Schema for creating a project rubric criterion template"""

    pass


class ProjectRubricCriterionTemplateUpdate(BaseModel):
    """Schema for updating a project rubric criterion template"""

    category: Optional[str] = None
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    weight: Optional[float] = Field(None, ge=0)
    level_descriptors: Optional[Dict[str, str]] = None


class ProjectRubricCriterionTemplateOut(ProjectRubricCriterionTemplateBase):
    """Schema for project rubric criterion template output"""

    id: int
    school_id: int
    rubric_template_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectRubricTemplateBase(BaseModel):
    """Base schema for project rubric template"""

    name: str = Field(..., min_length=1, max_length=200)
    level: str = Field(
        ...,
        description="Level: onderbouw, havo_bovenbouw, vwo_bovenbouw, speciaal",
    )


class ProjectRubricTemplateCreate(ProjectRubricTemplateBase):
    """Schema for creating a project rubric template"""

    subject_id: int
    criteria: List[ProjectRubricCriterionTemplateCreate] = Field(default_factory=list)


class ProjectRubricTemplateUpdate(BaseModel):
    """Schema for updating a project rubric template"""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    level: Optional[str] = None


class ProjectRubricTemplateOut(ProjectRubricTemplateBase):
    """Schema for project rubric template output"""

    id: int
    school_id: int
    subject_id: int
    created_at: datetime
    updated_at: datetime
    criteria: List[ProjectRubricCriterionTemplateOut] = Field(default_factory=list)

    class Config:
        from_attributes = True


class ProjectRubricTemplateListOut(BaseModel):
    """Schema for project rubric template list output"""

    templates: List[ProjectRubricTemplateOut]
    total: int
    page: int
    per_page: int


# ============ Competency Template ============


class CompetencyLevelDescriptorTemplateBase(BaseModel):
    """Base schema for competency level descriptor template"""

    level: str = Field(
        ..., description="Level: startend, basis, competent, gevorderd, excellent"
    )
    behavior_description: str = Field(..., min_length=1)


class CompetencyLevelDescriptorTemplateCreate(CompetencyLevelDescriptorTemplateBase):
    """Schema for creating a competency level descriptor template"""

    pass


class CompetencyLevelDescriptorTemplateUpdate(BaseModel):
    """Schema for updating a competency level descriptor template"""

    level: Optional[str] = None
    behavior_description: Optional[str] = Field(None, min_length=1)


class CompetencyLevelDescriptorTemplateOut(CompetencyLevelDescriptorTemplateBase):
    """Schema for competency level descriptor template output"""

    id: int
    school_id: int
    competency_template_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CompetencyReflectionQuestionTemplateBase(BaseModel):
    """Base schema for competency reflection question template"""

    question_text: str = Field(..., min_length=1)


class CompetencyReflectionQuestionTemplateCreate(
    CompetencyReflectionQuestionTemplateBase
):
    """Schema for creating a competency reflection question template"""

    pass


class CompetencyReflectionQuestionTemplateUpdate(BaseModel):
    """Schema for updating a competency reflection question template"""

    question_text: Optional[str] = Field(None, min_length=1)


class CompetencyReflectionQuestionTemplateOut(CompetencyReflectionQuestionTemplateBase):
    """Schema for competency reflection question template output"""

    id: int
    school_id: int
    competency_template_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CompetencyTemplateBase(BaseModel):
    """Base schema for competency template"""

    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None


class CompetencyTemplateCreate(CompetencyTemplateBase):
    """Schema for creating a competency template"""

    subject_id: Optional[int] = None
    level_descriptors: List[CompetencyLevelDescriptorTemplateCreate] = Field(
        default_factory=list
    )
    reflection_questions: List[CompetencyReflectionQuestionTemplateCreate] = Field(
        default_factory=list
    )


class CompetencyTemplateUpdate(BaseModel):
    """Schema for updating a competency template"""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None


class CompetencyTemplateOut(CompetencyTemplateBase):
    """Schema for competency template output"""

    id: int
    school_id: int
    subject_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    level_descriptors: List[CompetencyLevelDescriptorTemplateOut] = Field(
        default_factory=list
    )
    reflection_questions: List[CompetencyReflectionQuestionTemplateOut] = Field(
        default_factory=list
    )

    class Config:
        from_attributes = True


class CompetencyTemplateListOut(BaseModel):
    """Schema for competency template list output"""

    templates: List[CompetencyTemplateOut]
    total: int
    page: int
    per_page: int


# ============ Mail Template ============


class MailTemplateBase(BaseModel):
    """Base schema for mail template"""

    name: str = Field(..., min_length=1, max_length=200)
    type: str = Field(
        ...,
        description=(
            "Type: start_opdrachtgever, tussenpresentatie, "
            "eindpresentatie, bedankmail, herinnering"
        ),
    )
    subject: str = Field(..., min_length=1, max_length=500)
    body: str = Field(..., min_length=1)
    variables_allowed: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


class MailTemplateCreate(MailTemplateBase):
    """Schema for creating a mail template"""

    subject_id: Optional[int] = None


class MailTemplateUpdate(BaseModel):
    """Schema for updating a mail template"""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    type: Optional[str] = None
    subject: Optional[str] = Field(None, min_length=1, max_length=500)
    body: Optional[str] = Field(None, min_length=1)
    variables_allowed: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class MailTemplateOut(MailTemplateBase):
    """Schema for mail template output"""

    id: int
    school_id: int
    subject_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MailTemplateListOut(BaseModel):
    """Schema for mail template list output"""

    templates: List[MailTemplateOut]
    total: int
    page: int
    per_page: int


# ============ Standard Remark ============


class StandardRemarkBase(BaseModel):
    """Base schema for standard remark"""

    type: str = Field(
        ..., description="Type: peer, project, competency, project_feedback, omza"
    )
    category: str = Field(
        ..., description="Category: positief, aandachtspunt, aanbeveling"
    )
    text: str = Field(..., min_length=1)
    order: int = 0


class StandardRemarkCreate(StandardRemarkBase):
    """Schema for creating a standard remark"""

    subject_id: Optional[int] = None


class StandardRemarkUpdate(BaseModel):
    """Schema for updating a standard remark"""

    type: Optional[str] = None
    category: Optional[str] = None
    text: Optional[str] = Field(None, min_length=1)
    order: Optional[int] = None


class StandardRemarkOut(StandardRemarkBase):
    """Schema for standard remark output"""

    id: int
    school_id: int
    subject_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StandardRemarkListOut(BaseModel):
    """Schema for standard remark list output"""

    remarks: List[StandardRemarkOut]
    total: int
    page: int
    per_page: int


# ============ Template Tag ============


class TemplateTagBase(BaseModel):
    """Base schema for template tag"""

    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    color: Optional[str] = Field(None, max_length=20)


class TemplateTagCreate(TemplateTagBase):
    """Schema for creating a template tag"""

    subject_id: Optional[int] = None


class TemplateTagUpdate(BaseModel):
    """Schema for updating a template tag"""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    color: Optional[str] = Field(None, max_length=20)


class TemplateTagOut(TemplateTagBase):
    """Schema for template tag output"""

    id: int
    school_id: int
    subject_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TemplateTagListOut(BaseModel):
    """Schema for template tag list output"""

    tags: List[TemplateTagOut]
    total: int
    page: int
    per_page: int


# ============ Template Tag Link ============


class TemplateTagLinkBase(BaseModel):
    """Base schema for template tag link"""

    tag_id: int
    target_type: str = Field(
        ...,
        description=(
            "Target type: peer_criterion, project_criterion, "
            "competency, learning_objective"
        ),
    )
    target_id: int


class TemplateTagLinkCreate(TemplateTagLinkBase):
    """Schema for creating a template tag link"""

    pass


class TemplateTagLinkOut(TemplateTagLinkBase):
    """Schema for template tag link output"""

    id: int
    school_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TemplateTagLinkListOut(BaseModel):
    """Schema for template tag link list output"""

    links: List[TemplateTagLinkOut]
    total: int
    page: int
    per_page: int
