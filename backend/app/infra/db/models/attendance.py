from __future__ import annotations
from typing import Optional
from datetime import datetime
from sqlalchemy import String, ForeignKey, Boolean, Integer, Text, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
import sqlalchemy as sa
from datetime import timezone
from .base import Base, id_pk

__all__ = ["AttendanceEvent", "AttendanceAggregate"]


class AttendanceEvent(Base):
    """
    Unified attendance tracking: school check-ins and external work registrations
    """

    __tablename__ = "attendance_events"

    id: Mapped[int] = id_pk()
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Check-in/out times
    check_in: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    check_out: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # External work fields
    is_external: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Approval workflow for external work
    approval_status: Mapped[Optional[str]] = mapped_column(
        String(20)
    )  # pending | approved | rejected
    approved_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Source tracking
    source: Mapped[str] = mapped_column(
        String(20), default="manual", nullable=False
    )  # rfid | manual | import | api

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User", foreign_keys=[user_id], back_populates="attendance_events"
    )
    project: Mapped[Optional["Project"]] = relationship()
    approver: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[approved_by],
        back_populates="approved_attendance_events",
        viewonly=True,
    )
    creator: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[created_by],
        back_populates="created_attendance_events",
        viewonly=True,
    )

    __table_args__ = (
        sa.CheckConstraint(
            "check_out IS NULL OR check_out > check_in", name="check_valid_times"
        ),
        sa.CheckConstraint(
            "(is_external = false) OR (is_external = true AND location IS NOT NULL AND approval_status IS NOT NULL)",
            name="check_external_fields",
        ),
        sa.CheckConstraint(
            "approval_status IN ('pending', 'approved', 'rejected') OR approval_status IS NULL",
            name="check_approval_status_values",
        ),
        sa.CheckConstraint(
            "source IN ('rfid', 'manual', 'import', 'api')", name="check_source_values"
        ),
        Index("ix_attendance_events_user_id", "user_id"),
        Index("ix_attendance_events_project_id", "project_id"),
        Index("ix_attendance_events_check_in", "check_in"),
        Index(
            "ix_attendance_events_open_sessions",
            "user_id",
            "check_in",
            postgresql_where=sa.text("check_out IS NULL"),
        ),
        Index(
            "ix_attendance_events_external_pending",
            "user_id",
            "approval_status",
            postgresql_where=sa.text(
                "is_external = true AND approval_status = 'pending'"
            ),
        ),
    )


class AttendanceAggregate(Base):
    """
    Cached attendance totals per user for performance
    """

    __tablename__ = "attendance_aggregates"

    id: Mapped[int] = id_pk()
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    total_school_seconds: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )
    total_external_approved_seconds: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )
    lesson_blocks: Mapped[float] = mapped_column(
        sa.Numeric(precision=10, scale=1), default=0, nullable=False
    )

    last_recomputed_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship()

    __table_args__ = (Index("ix_attendance_aggregates_user_id", "user_id"),)
