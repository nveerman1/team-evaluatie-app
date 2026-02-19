from __future__ import annotations
from typing import Optional
from datetime import datetime
from sqlalchemy import (
    String,
    Integer,
    ForeignKey,
    Boolean,
    JSON,
    UniqueConstraint,
    Index,
    Float,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, id_pk, tenant_fk

__all__ = [
    "PeerEvaluationCriterionTemplate",
    "ProjectAssessmentCriterionTemplate",
    "ProjectRubricTemplate",
    "ProjectRubricCriterionTemplate",
    "CompetencyTemplate",
    "CompetencyLevelDescriptorTemplate",
    "CompetencyReflectionQuestionTemplate",
    "MailTemplate",
    "StandardRemark",
    "TemplateTag",
    "TemplateTagLink",
]


class PeerEvaluationCriterionTemplate(Base):
    """
    Template for peer evaluation criteria (OMZA: Organiseren, Meedoen, Zelfvertrouwen, Autonomie)
    """

    __tablename__ = "peer_evaluation_criterion_templates"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # OMZA Category
    omza_category: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "Organiseren" | "Meedoen" | "Zelfvertrouwen" | "Autonomie"

    # Content
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Target level: onderbouw or bovenbouw
    target_level: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, index=True
    )  # "onderbouw" | "bovenbouw" | null

    # Level descriptors (5 levels: 1-5)
    level_descriptors: Mapped[dict] = mapped_column(
        JSON, default=dict
    )  # {"1": "description", "2": "description", ...}

    # Learning objectives - stored as JSON array of IDs
    learning_objective_ids: Mapped[list] = mapped_column(JSON, default=list)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    subject: Mapped["Subject"] = relationship()

    __table_args__ = (
        Index("ix_peer_criterion_template_school", "school_id"),
        Index("ix_peer_criterion_template_subject", "subject_id"),
        Index("ix_peer_criterion_template_category", "omza_category"),
        Index("ix_peer_criterion_template_target_level", "target_level"),
    )


class ProjectAssessmentCriterionTemplate(Base):
    """
    Template for project assessment criteria (Projectbeoordeling: Projectproces, Eindresultaat, Communicatie)
    """

    __tablename__ = "project_assessment_criterion_templates"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Category: projectproces, eindresultaat, communicatie
    category: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "projectproces" | "eindresultaat" | "communicatie"

    # Content
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Target level: onderbouw or bovenbouw
    target_level: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, index=True
    )  # "onderbouw" | "bovenbouw" | null

    # Level descriptors (5 levels: 1-5)
    level_descriptors: Mapped[dict] = mapped_column(
        JSON, default=dict
    )  # {"1": "description", "2": "description", ...}

    # Learning objectives - stored as JSON array of IDs
    learning_objective_ids: Mapped[list] = mapped_column(JSON, default=list)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    subject: Mapped["Subject"] = relationship()

    __table_args__ = (
        Index("ix_project_assessment_criterion_template_school", "school_id"),
        Index("ix_project_assessment_criterion_template_subject", "subject_id"),
        Index("ix_project_assessment_criterion_template_category", "category"),
        Index("ix_project_assessment_criterion_template_target_level", "target_level"),
    )


class ProjectRubricTemplate(Base):
    """
    Template for project rubrics
    """

    __tablename__ = "project_rubric_templates"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Content
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    level: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "onderbouw" | "havo_bovenbouw" | "vwo_bovenbouw" | "speciaal"

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    subject: Mapped["Subject"] = relationship()
    criteria: Mapped[list["ProjectRubricCriterionTemplate"]] = relationship(
        back_populates="rubric_template", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_project_rubric_template_school", "school_id"),
        Index("ix_project_rubric_template_subject", "subject_id"),
        Index("ix_project_rubric_template_level", "level"),
    )


class ProjectRubricCriterionTemplate(Base):
    """
    Criteria template for project rubrics
    """

    __tablename__ = "project_rubric_criterion_templates"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    rubric_template_id: Mapped[int] = mapped_column(
        ForeignKey("project_rubric_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Category
    category: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # "projectproces" | "eindresultaat" | "communicatie"

    # Content
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    weight: Mapped[float] = mapped_column(Float, default=1.0)

    # Level descriptors (5 levels)
    level_descriptors: Mapped[dict] = mapped_column(JSON, default=dict)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    rubric_template: Mapped["ProjectRubricTemplate"] = relationship(
        back_populates="criteria"
    )

    __table_args__ = (
        Index("ix_project_criterion_template_rubric", "rubric_template_id"),
        Index("ix_project_criterion_template_category", "category"),
    )


class CompetencyTemplate(Base):
    """
    Template for competencies (competentiemonitor)
    """

    __tablename__ = "competency_templates"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    subject_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True
    )  # Optional - can be generic

    # Content
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    subject: Mapped[Optional["Subject"]] = relationship()
    level_descriptors: Mapped[list["CompetencyLevelDescriptorTemplate"]] = relationship(
        back_populates="competency_template", cascade="all, delete-orphan"
    )
    reflection_questions: Mapped[list["CompetencyReflectionQuestionTemplate"]] = (
        relationship(back_populates="competency_template", cascade="all, delete-orphan")
    )

    __table_args__ = (
        Index("ix_competency_template_school", "school_id"),
        Index("ix_competency_template_subject", "subject_id"),
    )


class CompetencyLevelDescriptorTemplate(Base):
    """
    Level descriptors for competency templates
    """

    __tablename__ = "competency_level_descriptor_templates"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    competency_template_id: Mapped[int] = mapped_column(
        ForeignKey("competency_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Level
    level: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "startend" | "basis" | "competent" | "gevorderd" | "excellent"

    # Description
    behavior_description: Mapped[str] = mapped_column(Text, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    competency_template: Mapped["CompetencyTemplate"] = relationship(
        back_populates="level_descriptors"
    )

    __table_args__ = (
        UniqueConstraint(
            "competency_template_id", "level", name="uq_competency_level_per_template"
        ),
        Index("ix_competency_level_template_competency", "competency_template_id"),
    )


class CompetencyReflectionQuestionTemplate(Base):
    """
    Reflection questions for competency templates
    """

    __tablename__ = "competency_reflection_question_templates"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    competency_template_id: Mapped[int] = mapped_column(
        ForeignKey("competency_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Question
    question_text: Mapped[str] = mapped_column(Text, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    competency_template: Mapped["CompetencyTemplate"] = relationship(
        back_populates="reflection_questions"
    )

    __table_args__ = (
        Index("ix_competency_reflection_template_competency", "competency_template_id"),
    )


class MailTemplate(Base):
    """
    Email templates with variable substitution
    """

    __tablename__ = "mail_templates"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    subject_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True
    )  # Optional

    # Content
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # "start_opdrachtgever" | "tussenpresentatie" | "eindpresentatie" | "bedankmail" | "herinnering"
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)  # Text/Markdown

    # Variables allowed in this template
    variables_allowed: Mapped[dict] = mapped_column(
        JSON, default=dict
    )  # e.g., {"contactpersoon": true, "datum": true}

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    subject_rel: Mapped[Optional["Subject"]] = relationship(foreign_keys=[subject_id])

    __table_args__ = (
        Index("ix_mail_template_school", "school_id"),
        Index("ix_mail_template_subject", "subject_id"),
        Index("ix_mail_template_type", "type"),
        Index("ix_mail_template_active", "is_active"),
    )


class StandardRemark(Base):
    """
    Standard remarks library for quick feedback
    """

    __tablename__ = "standard_remarks"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    subject_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True
    )  # Optional

    # Type and category
    type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "peer" | "project" | "competency" | "project_feedback" | "omza"
    category: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "positief" | "aandachtspunt" | "aanbeveling"

    # Content
    text: Mapped[str] = mapped_column(Text, nullable=False)

    # Order for drag & drop
    order: Mapped[int] = mapped_column(Integer, default=0)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    subject: Mapped[Optional["Subject"]] = relationship()

    __table_args__ = (
        Index("ix_standard_remark_school", "school_id"),
        Index("ix_standard_remark_subject", "subject_id"),
        Index("ix_standard_remark_type", "type"),
        Index("ix_standard_remark_category", "category"),
    )


class TemplateTag(Base):
    """
    Tags for categorizing templates
    """

    __tablename__ = "template_tags"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    subject_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True
    )  # Optional

    # Content
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    color: Mapped[Optional[str]] = mapped_column(String(20))  # Hex color

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    subject: Mapped[Optional["Subject"]] = relationship()

    __table_args__ = (
        UniqueConstraint("school_id", "name", name="uq_template_tag_name_per_school"),
        Index("ix_template_tag_school", "school_id"),
        Index("ix_template_tag_subject", "subject_id"),
    )


class TemplateTagLink(Base):
    """
    Many-to-many link between tags and templates
    """

    __tablename__ = "template_tag_links"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    tag_id: Mapped[int] = mapped_column(
        ForeignKey("template_tags.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Target (polymorphic)
    target_type: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # "peer_criterion" | "project_criterion" | "competency" | "learning_objective"
    target_id: Mapped[int] = mapped_column(Integer, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    tag: Mapped["TemplateTag"] = relationship()

    __table_args__ = (
        UniqueConstraint(
            "tag_id", "target_type", "target_id", name="uq_template_tag_link_once"
        ),
        Index("ix_template_tag_link_tag", "tag_id"),
        Index("ix_template_tag_link_target", "target_type", "target_id"),
    )
