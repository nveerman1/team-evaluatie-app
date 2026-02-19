from __future__ import annotations
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import (
    String,
    Integer,
    ForeignKey,
    Boolean,
    Text,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB, ARRAY

from .base import Base, id_pk, tenant_fk

__all__ = [
    "ProjectNotesContext",
    "ProjectNote",
]


class ProjectNotesContext(Base):
    """
    A container for all notes related to a specific project.
    Links to a course, class, and optionally an evaluation.
    """

    __tablename__ = "project_notes_contexts"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    # Basic info
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Links
    project_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    course_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("courses.id", ondelete="SET NULL"),
        index=True,
    )
    class_name: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    evaluation_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("evaluations.id", ondelete="SET NULL"),
        index=True,
    )

    # Link to frozen project team roster
    project_team_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("project_teams.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    # Metadata
    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Status and closing
    status: Mapped[str] = mapped_column(
        String(30), default="draft", nullable=False
    )  # draft|open|closed
    closed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    settings: Mapped[dict] = mapped_column(JSONB, default=dict)

    # Relationships
    notes: Mapped[list["ProjectNote"]] = relationship(
        back_populates="context",
        cascade="all, delete-orphan",
    )
    project: Mapped[Optional["Project"]] = relationship()
    course: Mapped[Optional["Course"]] = relationship()
    evaluation: Mapped[Optional["Evaluation"]] = relationship()
    project_team: Mapped[Optional["ProjectTeam"]] = relationship()
    creator: Mapped["User"] = relationship()

    __table_args__ = (
        Index("ix_project_notes_context_school_course", "school_id", "course_id"),
        Index("ix_project_notes_context_created_by", "created_by"),
        Index("ix_project_notes_context_project_team", "project_team_id"),
        Index("ix_project_notes_context_status", "status"),
    )


class ProjectNote(Base):
    """
    An individual note/observation within a project context.
    Can be project-wide, team-specific, or student-specific.
    """

    __tablename__ = "project_notes"

    id: Mapped[int] = id_pk()
    context_id: Mapped[int] = mapped_column(
        ForeignKey("project_notes_contexts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # Note type and target
    note_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )  # "project" | "team" | "student"

    team_id: Mapped[Optional[int]] = mapped_column(
        index=True,
        nullable=True,
    )  # Legacy field - no FK constraint (groups table removed)
    student_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )

    # Content
    text: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)

    # Links to competencies and learning objectives
    omza_category: Mapped[Optional[str]] = mapped_column(String(100))
    learning_objective_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("learning_objectives.id", ondelete="SET NULL"),
        index=True,
    )

    # Flags
    is_competency_evidence: Mapped[bool] = mapped_column(Boolean, default=False)
    is_portfolio_evidence: Mapped[bool] = mapped_column(Boolean, default=False)

    # Additional metadata (flexible JSON field for future extensions)
    note_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    # Audit fields
    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    context: Mapped["ProjectNotesContext"] = relationship(back_populates="notes")
    student: Mapped[Optional["User"]] = relationship(foreign_keys=[student_id])
    learning_objective: Mapped[Optional["LearningObjective"]] = relationship()
    creator: Mapped["User"] = relationship(foreign_keys=[created_by])

    __table_args__ = (
        Index("ix_project_note_context_type", "context_id", "note_type"),
        Index("ix_project_note_team", "team_id"),
        Index("ix_project_note_student", "student_id"),
        Index("ix_project_note_created_at", "created_at"),
        Index("ix_project_note_omza", "omza_category"),
    )
