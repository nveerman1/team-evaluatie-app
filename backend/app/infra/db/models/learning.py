from __future__ import annotations
from typing import Optional
from sqlalchemy import (
    String,
    Integer,
    ForeignKey,
    Boolean,
    JSON,
    UniqueConstraint,
    Index,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, id_pk, tenant_fk

__all__ = [
    "LearningObjective",
    "RubricCriterionLearningObjective",
]


class LearningObjective(Base):
    """
    Learning objectives / eindtermen that can be linked to rubric criteria
    to track student progress per learning goal.

    Two-tier architecture:
    1. Central (template) objectives: is_template=True, managed by admin via /admin/templates
       - subject_id IS NOT NULL (linked to subject/sectie)
       - teacher_id IS NULL
       - Can be linked to rubric criteria
       - Read-only for teachers in /teacher/learning-objectives

    2. Teacher-specific objectives: is_template=False, managed by teacher via /teacher/learning-objectives
       - teacher_id IS NOT NULL (owned by specific teacher)
       - course_id optional (for course-specific objectives)
       - Cannot be linked to central rubric templates
       - Visible/editable only by the owning teacher
    """

    __tablename__ = "learning_objectives"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    # Subject linkage for central/template learning objectives
    subject_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Teacher linkage for teacher-specific learning objectives
    teacher_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Course linkage for teacher-specific learning objectives (optional)
    course_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("courses.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Type indicator: True = central/template (admin managed), False = teacher-specific
    is_template: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Domain (e.g., "A", "B", "C", "D - Ontwerpen", "E")
    domain: Mapped[Optional[str]] = mapped_column(String(50))

    # Title/name of the learning objective
    title: Mapped[str] = mapped_column(String(200), nullable=False)

    # Detailed description
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Order/number (e.g., 9, 11, 13, 14, 16)
    order: Mapped[int] = mapped_column(Integer, default=0)

    # Phase: "onderbouw" or "bovenbouw"
    phase: Mapped[Optional[str]] = mapped_column(String(20))

    # Additional metadata
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)

    # Relationships
    subject: Mapped[Optional["Subject"]] = relationship()
    teacher: Mapped[Optional["User"]] = relationship(foreign_keys=[teacher_id])
    course: Mapped[Optional["Course"]] = relationship()
    rubric_criteria: Mapped[list["RubricCriterion"]] = relationship(
        secondary="rubric_criterion_learning_objectives",
        back_populates="learning_objectives",
    )

    __table_args__ = (
        Index("ix_learning_objective_school", "school_id"),
        Index("ix_learning_objective_subject", "subject_id"),
        Index("ix_learning_objective_teacher", "teacher_id"),
        Index("ix_learning_objective_course", "course_id"),
        Index("ix_learning_objective_is_template", "school_id", "is_template"),
        Index("ix_learning_objective_domain", "school_id", "domain"),
        Index("ix_learning_objective_phase", "school_id", "phase"),
    )


class RubricCriterionLearningObjective(Base):
    """
    Many-to-many association table linking rubric criteria to learning objectives
    """

    __tablename__ = "rubric_criterion_learning_objectives"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    criterion_id: Mapped[int] = mapped_column(
        ForeignKey("rubric_criteria.id", ondelete="CASCADE"), nullable=False
    )
    learning_objective_id: Mapped[int] = mapped_column(
        ForeignKey("learning_objectives.id", ondelete="CASCADE"), nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "criterion_id",
            "learning_objective_id",
            name="uq_criterion_learning_objective",
        ),
        Index("ix_criterion_lo_criterion", "criterion_id"),
        Index("ix_criterion_lo_objective", "learning_objective_id"),
    )
