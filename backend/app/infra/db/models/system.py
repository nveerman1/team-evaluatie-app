from __future__ import annotations
from typing import Optional
from datetime import datetime
from sqlalchemy import (
    String,
    Integer,
    ForeignKey,
    JSON,
    UniqueConstraint,
    Index,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB

from .base import Base, id_pk, tenant_fk

__all__ = [
    "FeedbackSummary",
    "SummaryGenerationJob",
    "ScheduledJob",
    "Notification",
    "AuditLog",
]


class FeedbackSummary(Base):
    """
    Cached AI-generated summaries of peer feedback for students.
    """

    __tablename__ = "feedback_summaries"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    evaluation_id: Mapped[int] = mapped_column(
        ForeignKey("evaluations.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # The AI-generated summary text
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)

    # Hash of the input feedback to detect changes
    feedback_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    # Metadata
    generation_method: Mapped[str] = mapped_column(
        String(20), default="ai"
    )  # "ai" | "fallback"
    generation_duration_ms: Mapped[Optional[int]] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "evaluation_id", "student_id", name="uq_summary_per_student_eval"
        ),
        Index("ix_feedback_summary_eval", "evaluation_id"),
        Index("ix_feedback_summary_hash", "feedback_hash"),
    )


class SummaryGenerationJob(Base):
    """
    Track async AI summary generation jobs.
    """

    __tablename__ = "summary_generation_jobs"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    evaluation_id: Mapped[int] = mapped_column(
        ForeignKey("evaluations.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Job tracking
    job_id: Mapped[str] = mapped_column(
        String(200), unique=True, nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default="queued", nullable=False
    )  # "queued" | "processing" | "completed" | "failed" | "cancelled"

    # Progress tracking (0-100)
    progress: Mapped[int] = mapped_column(default=0, nullable=False)

    # Priority support
    priority: Mapped[str] = mapped_column(
        String(20), default="normal", nullable=False
    )  # "high" | "normal" | "low"

    # Retry support
    retry_count: Mapped[int] = mapped_column(default=0, nullable=False)
    max_retries: Mapped[int] = mapped_column(default=3, nullable=False)
    next_retry_at: Mapped[Optional[datetime]] = mapped_column()

    # Cancellation support
    cancelled_at: Mapped[Optional[datetime]] = mapped_column()
    cancelled_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    # Webhook support
    webhook_url: Mapped[Optional[str]] = mapped_column(String(500))
    webhook_delivered: Mapped[bool] = mapped_column(default=False, nullable=False)
    webhook_attempts: Mapped[int] = mapped_column(default=0, nullable=False)

    # Multi-queue support
    queue_name: Mapped[str] = mapped_column(
        String(100), default="ai-summaries", nullable=False
    )
    task_type: Mapped[str] = mapped_column(
        String(100), default="generate_summary", nullable=False
    )

    # Result data (JSON)
    result: Mapped[Optional[dict]] = mapped_column(JSONB)
    error_message: Mapped[Optional[str]] = mapped_column(Text)

    # Timestamps (created_at and updated_at inherited from Base)
    started_at: Mapped[Optional[datetime]] = mapped_column()
    completed_at: Mapped[Optional[datetime]] = mapped_column()

    __table_args__ = (
        Index("ix_summary_job_status", "status"),
        Index("ix_summary_job_eval_student", "evaluation_id", "student_id"),
        Index("ix_summary_job_created", "created_at"),
        Index("ix_summary_job_priority", "priority", "created_at"),
        Index("ix_summary_job_queue", "queue_name"),
        Index("ix_summary_job_next_retry", "next_retry_at"),
    )


class ScheduledJob(Base):
    """
    Scheduled jobs for cron-like recurring tasks.
    """

    __tablename__ = "scheduled_jobs"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    # Job definition
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    task_type: Mapped[str] = mapped_column(String(100), nullable=False)
    queue_name: Mapped[str] = mapped_column(String(100), nullable=False)
    cron_expression: Mapped[str] = mapped_column(String(100), nullable=False)
    task_params: Mapped[Optional[dict]] = mapped_column(JSONB)

    # Status
    enabled: Mapped[bool] = mapped_column(default=True, nullable=False)
    last_run_at: Mapped[Optional[datetime]] = mapped_column()
    next_run_at: Mapped[Optional[datetime]] = mapped_column()

    # Audit fields (created_at and updated_at inherited from Base)
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    __table_args__ = (
        Index("ix_scheduled_jobs_enabled", "enabled"),
        Index("ix_scheduled_jobs_next_run", "next_run_at"),
    )


class Notification(Base):
    """
    Notifications for users about important events
    Used for submission status changes and other updates
    """

    __tablename__ = "notifications"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    recipient_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Notification type and content
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Read status
    read_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    recipient: Mapped["User"] = relationship()

    __table_args__ = (
        Index("ix_notifications_recipient", "recipient_user_id", "read_at"),
        Index("ix_notifications_school", "school_id"),
        Index("ix_notifications_created", "created_at"),
    )


class AuditLog(Base):
    """
    Audit log for tracking all mutating actions in the system
    """

    __tablename__ = "audit_logs"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    # Who performed the action
    user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    user_email: Mapped[Optional[str]] = mapped_column(String(320))  # Snapshot of email

    # What action was performed
    action: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # e.g., "create_evaluation", "update_grade"
    entity_type: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # e.g., "evaluation", "score", "user"
    entity_id: Mapped[Optional[int]] = mapped_column(Integer)  # ID of affected entity

    # Details
    details: Mapped[dict] = mapped_column(JSON, default=dict)  # Additional context
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))  # IPv4 or IPv6
    user_agent: Mapped[Optional[str]] = mapped_column(String(500))

    # Timestamp is already in Base (created_at)

    __table_args__ = (
        Index("ix_audit_log_school", "school_id"),
        Index("ix_audit_log_user", "user_id"),
        Index("ix_audit_log_entity", "entity_type", "entity_id"),
        Index("ix_audit_log_action", "action"),
        Index("ix_audit_log_created", "created_at"),
    )
