from __future__ import annotations
from typing import Optional
from datetime import datetime, date
from sqlalchemy import (
    String,
    ForeignKey,
    Boolean,
    Text,
    Date,
    DateTime,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
import sqlalchemy as sa
from .base import Base, id_pk

__all__ = ["Task", "SkillTraining", "SkillTrainingProgress"]


class Task(Base):
    """
    Task - Teacher tasks including client-related tasks (opdrachtgeverstaken)
    Auto-generated from project milestones or manually created by teachers
    """

    __tablename__ = "tasks"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )

    # Basic info
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)

    # Status and type
    status: Mapped[str] = mapped_column(
        String(30), default="open", nullable=False, index=True
    )  # "open" | "done" | "dismissed"

    type: Mapped[str] = mapped_column(
        String(30), default="opdrachtgever", nullable=False
    )  # "opdrachtgever" | "docent" | "project"

    # Links
    project_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True
    )
    client_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True
    )
    class_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("classes.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Auto-generation tracking
    auto_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source: Mapped[str] = mapped_column(
        String(50), default="manual", nullable=False
    )  # "tussenpresentatie" | "eindpresentatie" | "manual"

    # Email integration (for mailto links)
    email_to: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    email_cc: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Completion tracking
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    school: Mapped["School"] = relationship()
    project: Mapped[Optional["Project"]] = relationship()
    client: Mapped[Optional["Client"]] = relationship()

    __table_args__ = (
        Index("ix_task_due_date", "due_date"),
        Index("ix_task_status", "status"),
        Index("ix_task_project", "project_id"),
        Index("ix_task_client", "client_id"),
        Index("ix_task_school_status", "school_id", "status"),
        Index("ix_task_auto_generated", "auto_generated"),
    )


class SkillTraining(Base):
    """
    Vaardigheidstraining — door docent aangemaakt, verwijst naar externe URL
    op technasiummbh.nl/vaardigheden/
    """

    __tablename__ = "skill_trainings"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)

    # FK to existing CompetencyCategory table (competency_categories)
    competency_category_id: Mapped[int] = mapped_column(
        ForeignKey("competency_categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # FK to existing LearningObjective table (learning_objectives) - optional
    learning_objective_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("learning_objectives.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    level: Mapped[Optional[str]] = mapped_column(String(20))  # "basis" | "plus"
    est_minutes: Mapped[Optional[str]] = mapped_column(String(30))  # "10-15 min"
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sa.func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sa.func.now(),
        onupdate=sa.func.now(),
        nullable=False,
    )

    # Relationships
    school: Mapped["School"] = relationship()
    competency_category: Mapped["CompetencyCategory"] = relationship()
    learning_objective: Mapped[Optional["LearningObjective"]] = relationship()

    __table_args__ = (
        Index("ix_skill_training_school", "school_id"),
        Index("ix_skill_training_category", "competency_category_id"),
        Index("ix_skill_training_school_active", "school_id", "is_active"),
    )


class SkillTrainingProgress(Base):
    """
    Voortgang per student per training.
    Statussen:
    - Student mag zetten: none → planned → in_progress → submitted
    - Docent mag zetten: completed, mastered (en alle andere)
    """

    __tablename__ = "skill_training_progress"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    training_id: Mapped[int] = mapped_column(
        ForeignKey("skill_trainings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default="none", nullable=False
    )  # none|planned|in_progress|submitted|completed|mastered

    updated_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sa.func.now(),
        onupdate=sa.func.now(),
        nullable=False,
    )
    note: Mapped[Optional[str]] = mapped_column(Text)

    # Relationships
    school: Mapped["School"] = relationship()
    course: Mapped["Course"] = relationship()
    student: Mapped["User"] = relationship(foreign_keys=[student_id])
    training: Mapped["SkillTraining"] = relationship()
    updated_by: Mapped["User"] = relationship(foreign_keys=[updated_by_user_id])

    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "training_id",
            "course_id",
            name="uq_skill_progress_student_training_course",
        ),
        Index("ix_skill_progress_student", "student_id"),
        Index("ix_skill_progress_training", "training_id"),
        Index("ix_skill_progress_course", "course_id"),
        Index("ix_skill_progress_course_training", "course_id", "training_id"),
    )
