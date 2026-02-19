from __future__ import annotations
from typing import Optional
from datetime import datetime
from sqlalchemy import String, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, id_pk, tenant_fk

__all__ = ["ExternalEvaluator"]


class ExternalEvaluator(Base):
    """
    External evaluator/opdrachtgever for project assessments
    Can assess one or multiple teams based on configuration
    """

    __tablename__ = "external_evaluators"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )

    # Contact information
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    organisation: Mapped[Optional[str]] = mapped_column(String(200))

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    team_links: Mapped[list["ProjectTeamExternal"]] = relationship(
        back_populates="external_evaluator", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_external_evaluator_school_email", "school_id", "email"),
        Index("ix_external_evaluator_email", "email"),
    )
