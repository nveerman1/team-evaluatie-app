from __future__ import annotations
from typing import Optional
from datetime import datetime
from sqlalchemy import (
    String,
    Integer,
    ForeignKey,
    Float,
    Text,
    JSON,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from .base import Base, id_pk, tenant_fk

__all__ = ["Grade", "PublishedGrade"]


class Grade(Base):
    """
    Vastlegging van GCF/SPR en (gepubliceerde) cijfers.
    """

    __tablename__ = "grades"
    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    evaluation_id: Mapped[int] = mapped_column(
        ForeignKey("evaluations.id", ondelete="CASCADE")
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    grade = sa.Column(sa.Numeric(5, 2), nullable=True)  # 1–10, mag NULL
    meta = sa.Column(JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False)
    group_grade: Mapped[Optional[float]] = mapped_column()
    gcf: Mapped[Optional[float]] = mapped_column()
    spr: Mapped[Optional[float]] = mapped_column()
    suggested_grade: Mapped[Optional[float]] = mapped_column()
    published_grade: Mapped[Optional[float]] = mapped_column()
    override_reason: Mapped[Optional[str]] = mapped_column(Text)
    published_at: Mapped[Optional[datetime]] = mapped_column()

    __table_args__ = (
        UniqueConstraint("evaluation_id", "user_id", name="uq_grade_once"),
        Index("ix_grade_eval", "evaluation_id"),
    )


class PublishedGrade(Base):
    __tablename__ = "published_grades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # scope
    school_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)

    # relaties
    evaluation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("evaluations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # data
    grade: Mapped[float] = mapped_column(Float, nullable=False)  # 1..10
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    meta: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    __table_args__ = (
        UniqueConstraint(
            "school_id", "evaluation_id", "user_id", name="uq_published_grade_once"
        ),
    )

    # relaties (optioneel, alleen als je ze gebruikt)
    evaluation = relationship("Evaluation")
    user = relationship("User")
