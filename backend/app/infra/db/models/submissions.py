from __future__ import annotations
from typing import Optional
from datetime import datetime
from sqlalchemy import String, ForeignKey, Text, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB
from .base import Base, id_pk, tenant_fk

__all__ = ["AssignmentSubmission", "SubmissionEvent"]


class AssignmentSubmission(Base):
    """
    Assignment submissions for project teams - link-based submission system
    Students submit SharePoint/OneDrive links for their project deliverables
    """

    __tablename__ = "assignment_submissions"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    # Foreign keys
    project_assessment_id: Mapped[int] = mapped_column(
        ForeignKey("project_assessments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_team_id: Mapped[int] = mapped_column(
        ForeignKey("project_teams.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Document type (report, slides, attachment)
    doc_type: Mapped[str] = mapped_column(String(20), nullable=False)

    # Submission data
    url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="missing"
    )  # missing | submitted | ok | access_requested | broken
    version_label: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Audit fields
    submitted_by_user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    submitted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    last_checked_by_user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    last_checked_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    project_assessment: Mapped["ProjectAssessment"] = relationship()
    project_team: Mapped["ProjectTeam"] = relationship()
    submitted_by: Mapped[Optional["User"]] = relationship(
        foreign_keys=[submitted_by_user_id]
    )
    last_checked_by: Mapped[Optional["User"]] = relationship(
        foreign_keys=[last_checked_by_user_id]
    )

    __table_args__ = (
        UniqueConstraint(
            "project_assessment_id",
            "project_team_id",
            "doc_type",
            "version_label",
            name="uq_submission_per_assessment_team_doctype_version",
        ),
        Index("ix_submissions_assessment", "project_assessment_id"),
        Index("ix_submissions_team", "project_team_id"),
        Index("ix_submissions_status", "project_assessment_id", "status"),
        Index("ix_submissions_school", "school_id"),
    )


class SubmissionEvent(Base):
    """
    Audit trail for submission changes
    Logs all actions taken on submissions for compliance and debugging
    """

    __tablename__ = "submission_events"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    submission_id: Mapped[int] = mapped_column(
        ForeignKey("assignment_submissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Event type: submitted, status_changed, cleared, opened, commented
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # Flexible payload for event-specific data
    payload: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    submission: Mapped["AssignmentSubmission"] = relationship()
    actor: Mapped[Optional["User"]] = relationship()

    __table_args__ = (
        Index("ix_submission_events_submission", "submission_id"),
        Index("ix_submission_events_created", "created_at"),
        Index("ix_submission_events_school", "school_id"),
    )
