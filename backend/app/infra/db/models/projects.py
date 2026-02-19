from __future__ import annotations
from typing import Optional
from datetime import datetime
from sqlalchemy import String, ForeignKey, Integer, Text, Date, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, id_pk, tenant_fk

__all__ = [
    "Project",
    "Subproject",
    "ProjectTeam",
    "ProjectTeamMember",
    "ProjectTeamExternal",
]


class Project(Base):
    """
    Project - Container that links evaluations, assessments, notes, and clients
    """

    __tablename__ = "projects"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    course_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=True, index=True
    )

    # Basic info
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    class_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Period within academic year (P1, P2, P3, P4)
    period: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    # Dates
    start_date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)

    # Status
    status: Mapped[str] = mapped_column(
        String(30), default="concept", nullable=False
    )  # "concept" | "active" | "completed" | "archived"

    # Creator
    created_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    course: Mapped["Course"] = relationship()
    created_by: Mapped["User"] = relationship()
    project_plans: Mapped[list["ProjectPlan"]] = relationship(
        back_populates="project", cascade="all,delete-orphan"
    )

    __table_args__ = (
        Index("ix_project_school", "school_id"),
        Index("ix_project_course", "course_id"),
        Index("ix_project_status", "status"),
        Index("ix_project_school_course", "school_id", "course_id"),
        Index("ix_project_course_period", "course_id", "period"),
    )


class Subproject(Base):
    """
    Subproject (Deelproject) - Sub-tasks/sections within a main project
    Used for bovenbouw choice projects where a main project has multiple deelprojecten
    """

    __tablename__ = "subprojects"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    client_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Basic info
    title: Mapped[str] = mapped_column(String(200), nullable=False)

    # Team info
    team_number: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, index=True
    )

    # Relationships
    school: Mapped["School"] = relationship()
    project: Mapped["Project"] = relationship()
    client: Mapped[Optional["Client"]] = relationship()

    __table_args__ = (
        Index("ix_subproject_school", "school_id"),
        Index("ix_subproject_project", "project_id"),
        Index("ix_subproject_client", "client_id"),
        Index("ix_subproject_team", "project_id", "team_number"),
    )


class ProjectTeam(Base):
    """
    Project-specific team roster - freezes team composition at a point in time
    """

    __tablename__ = "project_teams"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    # Links to project
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Snapshot of team name at time of creation
    display_name_at_time: Mapped[str] = mapped_column(String(200), nullable=False)

    # Team number for this project (project-specific)
    team_number: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, index=True
    )

    # Version for handling team composition changes
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Metadata for backfill tracking
    backfill_source: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Relationships
    project: Mapped["Project"] = relationship()
    members: Mapped[list["ProjectTeamMember"]] = relationship(
        back_populates="project_team", cascade="all,delete-orphan"
    )
    externals: Mapped[list["ProjectTeamExternal"]] = relationship(
        back_populates="project_team", cascade="all,delete-orphan"
    )
    project_plan_teams: Mapped[list["ProjectPlanTeam"]] = relationship(
        back_populates="project_team", cascade="all,delete-orphan"
    )

    __table_args__ = (
        Index("ix_project_team_project", "project_id"),
        Index("ix_project_teams_project_team_number", "project_id", "team_number"),
    )


class ProjectTeamMember(Base):
    """
    Individual members of a project team at a specific point in time
    """

    __tablename__ = "project_team_members"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    project_team_id: Mapped[int] = mapped_column(
        ForeignKey("project_teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Role in the team (optional)
    role: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    project_team: Mapped["ProjectTeam"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship()

    __table_args__ = (
        UniqueConstraint(
            "project_team_id", "user_id", name="uq_project_team_member_once"
        ),
        Index("ix_project_team_member_project_team", "project_team_id"),
        Index("ix_project_team_member_user", "user_id"),
        Index("ix_project_team_member_composite", "project_team_id", "user_id"),
    )


class ProjectTeamExternal(Base):
    """
    Links project teams to external evaluators with invitation tokens
    Supports both bovenbouw (different evaluators per team) and onderbouw (one evaluator for all teams)
    """

    __tablename__ = "project_team_externals"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    # Relationships
    project_team_id: Mapped[int] = mapped_column(
        ForeignKey("project_teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    external_evaluator_id: Mapped[int] = mapped_column(
        ForeignKey("external_evaluators.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True
    )
    assessment_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("project_assessments.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Team number within the project (identifies specific team)
    team_number: Mapped[Optional[int]] = mapped_column(nullable=True, index=True)

    # Token for external access
    invitation_token: Mapped[str] = mapped_column(
        String(128), nullable=False, index=True
    )
    token_expires_at: Mapped[Optional[datetime]] = mapped_column()

    # Status tracking
    status: Mapped[str] = mapped_column(
        String(30), default="NOT_INVITED", nullable=False
    )  # NOT_INVITED | INVITED | IN_PROGRESS | SUBMITTED

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    invited_at: Mapped[Optional[datetime]] = mapped_column()
    submitted_at: Mapped[Optional[datetime]] = mapped_column()

    # Relationships
    project_team: Mapped["ProjectTeam"] = relationship(back_populates="externals")
    external_evaluator: Mapped["ExternalEvaluator"] = relationship(
        back_populates="team_links"
    )
    project: Mapped["Project"] = relationship()
    assessment: Mapped[Optional["ProjectAssessment"]] = relationship()

    __table_args__ = (
        Index("ix_project_team_external_project_team", "project_team_id"),
        Index("ix_project_team_external_evaluator", "external_evaluator_id"),
        Index("ix_project_team_external_project", "project_id"),
        Index("ix_project_team_external_assessment", "assessment_id"),
        Index("ix_project_team_external_status", "status"),
        Index("ix_project_team_external_token", "invitation_token"),
        Index("ix_project_team_external_team", "project_team_id", "team_number"),
    )
