from __future__ import annotations
from typing import Optional
from datetime import datetime
from sqlalchemy import (
    String,
    ForeignKey,
    Boolean,
    Text,
    DateTime,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
import sqlalchemy as sa
from .base import Base, id_pk, tenant_fk

__all__ = ["ProjectPlan", "ProjectPlanTeam", "ProjectPlanSection"]


class ProjectPlan(Base):
    """
    ProjectPlan (GO/NO-GO) - Template/Component per project for bovenbouw projects.
    ONE projectplan component is created per project and applies to ALL teams.
    Similar pattern to ProjectAssessment.
    """

    __tablename__ = "project_plans"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    # Project relationship - primary owner
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Component metadata
    title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(
        String(30), default="draft", nullable=False
    )  # draft|open|published|closed

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sa.func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sa.func.now(),
        onupdate=sa.func.now(),
        nullable=False,
    )

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="project_plans")
    teams: Mapped[list["ProjectPlanTeam"]] = relationship(
        back_populates="project_plan", cascade="all,delete-orphan"
    )

    __table_args__ = (
        Index("ix_project_plan_project_id", "project_id"),
        Index("ix_project_plan_school", "school_id"),
        Index("ix_project_plan_status", "status"),
    )


class ProjectPlanTeam(Base):
    """
    Links a project plan to teams within that project.
    Each team has their own instance with status, sections, and progress.
    """

    __tablename__ = "project_plan_teams"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    # Foreign keys
    project_plan_id: Mapped[int] = mapped_column(
        ForeignKey("project_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_team_id: Mapped[int] = mapped_column(
        ForeignKey("project_teams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Team-specific data
    title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="concept", nullable=False, index=True
    )  # concept|ingediend|go|no-go
    locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    global_teacher_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sa.func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sa.func.now(),
        onupdate=sa.func.now(),
        nullable=False,
    )

    # Relationships
    project_plan: Mapped["ProjectPlan"] = relationship(back_populates="teams")
    project_team: Mapped["ProjectTeam"] = relationship(
        back_populates="project_plan_teams"
    )
    sections: Mapped[list["ProjectPlanSection"]] = relationship(
        back_populates="project_plan_team", cascade="all,delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint(
            "school_id",
            "project_plan_id",
            "project_team_id",
            name="uq_project_plan_team",
        ),
        Index("ix_ppt_project_plan", "project_plan_id"),
        Index("ix_ppt_project_team", "project_team_id"),
        Index("ix_ppt_status", "status"),
    )


class ProjectPlanSection(Base):
    """
    Individual sections of a project plan for a team.
    8 sections per team: client, problem, goal, method, planning, tasks, motivation, risks
    """

    __tablename__ = "project_plan_sections"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    project_plan_team_id: Mapped[int] = mapped_column(
        ForeignKey("project_plan_teams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Section identification
    key: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # client|problem|goal|method|planning|tasks|motivation|risks
    status: Mapped[str] = mapped_column(
        String(20), default="empty", nullable=False, index=True
    )  # empty|draft|submitted|approved|revision

    # Content (for non-client sections)
    text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Client section fields (only used when key="client")
    client_organisation: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True
    )
    client_contact: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    client_email: Mapped[Optional[str]] = mapped_column(String(320), nullable=True)
    client_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    client_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Teacher feedback
    teacher_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sa.func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sa.func.now(),
        onupdate=sa.func.now(),
        nullable=False,
    )

    # Relationships
    project_plan_team: Mapped["ProjectPlanTeam"] = relationship(
        back_populates="sections"
    )

    __table_args__ = (
        UniqueConstraint(
            "school_id",
            "project_plan_team_id",
            "key",
            name="uq_project_plan_team_section_key",
        ),
        Index("ix_pps_project_plan_team", "project_plan_team_id"),
        Index("ix_pps_key", "key"),
        Index("ix_pps_status", "status"),
    )
