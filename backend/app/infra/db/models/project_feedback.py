"""
Project feedback models — feedback given by students about the project itself.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, id_pk, tenant_fk

__all__ = [
    "ProjectFeedbackRound",
    "ProjectFeedbackQuestion",
    "ProjectFeedbackResponse",
    "ProjectFeedbackAnswer",
]


class ProjectFeedbackRound(Base):
    __tablename__ = "project_feedback_rounds"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="draft")
    deadline: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    closed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class ProjectFeedbackQuestion(Base):
    __tablename__ = "project_feedback_questions"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    round_id: Mapped[int] = mapped_column(
        ForeignKey("project_feedback_rounds.id", ondelete="CASCADE"), index=True
    )
    question_text: Mapped[str] = mapped_column(String(500), nullable=False)
    question_type: Mapped[str] = mapped_column(String(30), default="rating")
    order: Mapped[int] = mapped_column(Integer, default=0)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True)


class ProjectFeedbackResponse(Base):
    __tablename__ = "project_feedback_responses"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    round_id: Mapped[int] = mapped_column(
        ForeignKey("project_feedback_rounds.id", ondelete="CASCADE"), index=True
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    submitted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    __table_args__ = (
        UniqueConstraint("round_id", "student_id", name="uq_feedback_response_student"),
    )


class ProjectFeedbackAnswer(Base):
    __tablename__ = "project_feedback_answers"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    response_id: Mapped[int] = mapped_column(
        ForeignKey("project_feedback_responses.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[int] = mapped_column(
        ForeignKey("project_feedback_questions.id", ondelete="CASCADE")
    )
    rating_value: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    text_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
