from __future__ import annotations
from typing import Optional
from sqlalchemy import (
    String,
    Integer,
    ForeignKey,
    Boolean,
    JSON,
    Index,
    SmallInteger,
    Float,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, id_pk, tenant_fk

__all__ = ["Rubric", "RubricCriterion"]


class Rubric(Base):
    __tablename__ = "rubrics"
    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    scale_min: Mapped[int] = mapped_column(SmallInteger, default=1)
    scale_max: Mapped[int] = mapped_column(SmallInteger, default=5)
    scope: Mapped[str] = mapped_column(
        String(20), default="peer", nullable=False
    )  # "peer" | "project"
    target_level: Mapped[Optional[str]] = mapped_column(
        String(20)
    )  # "onderbouw" | "bovenbouw"
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)

    __table_args__ = (Index("ix_rubric_school_scope", "school_id", "scope"),)


class RubricCriterion(Base):
    __tablename__ = "rubric_criteria"
    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    rubric_id: Mapped[int] = mapped_column(ForeignKey("rubrics.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    # descriptors per level, bijv. {"1": "…", "2": "…", …}
    descriptors: Mapped[dict] = mapped_column(JSON, default=dict)
    category: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, index=True
    )
    order: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, index=True
    )  # Display order for criteria within a rubric
    visible_to_external: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )  # Whether this criterion is visible to external evaluators

    # Optional link to a competency for competency tracking
    competency_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("competencies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationship to learning objectives
    learning_objectives: Mapped[list["LearningObjective"]] = relationship(
        secondary="rubric_criterion_learning_objectives",
        back_populates="rubric_criteria",
    )

    # Relationship to competency
    competency: Mapped[Optional["Competency"]] = relationship()

    __table_args__ = (
        Index("ix_criterion_rubric", "rubric_id"),
        Index("ix_criterion_competency", "competency_id"),
    )
