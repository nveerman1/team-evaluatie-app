from __future__ import annotations
from typing import Optional, List
from datetime import datetime
from sqlalchemy import (
    String,
    Integer,
    ForeignKey,
    Boolean,
    JSON,
    UniqueConstraint,
    Index,
    SmallInteger,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, id_pk, tenant_fk

__all__ = [
    "CompetencyCategory",
    "Competency",
    "CompetencyRubricLevel",
    "CompetencyWindow",
    "CompetencySelfScore",
    "CompetencyPeerLabel",
    "CompetencyTeacherObservation",
    "CompetencyGoal",
    "CompetencyReflection",
    "CompetencyExternalInvite",
    "CompetencyExternalScore",
]


class CompetencyCategory(Base):
    """
    Fixed categories for organizing competencies.
    Categories:
    1. Samenwerken
    2. Plannen & Organiseren
    3. Creatief denken & probleemoplossen
    4. Technische vaardigheden
    5. Communicatie & Presenteren
    6. Reflectie & Professionele houding
    """

    __tablename__ = "competency_categories"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    color: Mapped[Optional[str]] = mapped_column(String(20))  # hex color for UI
    icon: Mapped[Optional[str]] = mapped_column(String(100))  # icon name/path
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships - use save-update only to avoid orphan deletion
    # Competencies have ondelete="SET NULL" on the FK, so they won't be deleted
    competencies: Mapped[list["Competency"]] = relationship(
        back_populates="competency_category",
        cascade="save-update",
    )

    __table_args__ = (
        UniqueConstraint(
            "school_id", "name", name="uq_competency_category_name_per_school"
        ),
        Index("ix_competency_category_school", "school_id"),
    )


class Competency(Base):
    """
    Competency definition (e.g., Samenwerken, Communiceren, etc.)

    Two-tier architecture:
    1. Central (template) competencies: is_template=True, managed by admin via /admin/templates
       - subject_id IS NOT NULL (linked to subject/sectie)
       - teacher_id IS NULL
       - Can be linked to rubric criteria
       - Read-only for teachers in /teacher/competencies-beheer

    2. Teacher-specific competencies: is_template=False, managed by teacher via /teacher/competencies-beheer
       - teacher_id IS NOT NULL (owned by specific teacher)
       - course_id optional (for course-specific competencies)
       - Cannot be linked to central rubric templates
       - Visible/editable only by the owning teacher

    3. Shared competencies: Teacher-specific with course_id set
       - Visible to all teachers assigned to that course (read-only)
    """

    __tablename__ = "competencies"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    # Link to category
    category_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("competency_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Subject linkage for central/template competencies
    subject_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Teacher linkage for teacher-specific competencies
    teacher_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Course linkage for teacher-specific competencies (optional - enables sharing)
    course_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("courses.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Type indicator: True = central/template (admin managed), False = teacher-specific
    is_template: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Phase: "onderbouw" | "bovenbouw" (like learning objectives)
    phase: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    category: Mapped[Optional[str]] = mapped_column(
        String(100)
    )  # Legacy field, kept for backward compatibility
    order: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Scale settings (default 1-5 Likert)
    scale_min: Mapped[int] = mapped_column(SmallInteger, default=1)
    scale_max: Mapped[int] = mapped_column(SmallInteger, default=5)
    scale_labels: Mapped[dict] = mapped_column(
        JSON, default=dict
    )  # e.g., {"1": "Startend", "5": "Sterk"}

    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)

    # Relationships
    competency_category: Mapped[Optional["CompetencyCategory"]] = relationship(
        back_populates="competencies"
    )
    subject: Mapped[Optional["Subject"]] = relationship()
    teacher: Mapped[Optional["User"]] = relationship(foreign_keys=[teacher_id])
    course: Mapped[Optional["Course"]] = relationship()
    rubric_levels: Mapped[List["CompetencyRubricLevel"]] = relationship(
        back_populates="competency",
        order_by="CompetencyRubricLevel.level",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        # Unique per school + name + teacher (allows same name for different teachers or central vs teacher)
        UniqueConstraint(
            "school_id",
            "name",
            "teacher_id",
            name="uq_competency_name_per_school_teacher",
        ),
        Index("ix_competency_school", "school_id"),
        Index("ix_competency_category_id", "category_id"),
        Index("ix_competency_subject", "subject_id"),
        Index("ix_competency_teacher", "teacher_id"),
        Index("ix_competency_course", "course_id"),
        Index("ix_competency_is_template", "school_id", "is_template"),
    )


class CompetencyRubricLevel(Base):
    """
    Rubric level descriptions for competencies with example behaviors
    """

    __tablename__ = "competency_rubric_levels"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    competency_id: Mapped[int] = mapped_column(
        ForeignKey("competencies.id", ondelete="CASCADE"), nullable=False
    )

    level: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 1-5
    label: Mapped[Optional[str]] = mapped_column(
        String(100)
    )  # e.g., "Startend", "Basis"
    description: Mapped[str] = mapped_column(Text, nullable=False)  # Behavior examples

    # Relationship back to competency
    competency: Mapped["Competency"] = relationship(back_populates="rubric_levels")

    __table_args__ = (
        UniqueConstraint(
            "competency_id", "level", name="uq_rubric_level_per_competency"
        ),
        Index("ix_rubric_level_competency", "competency_id"),
    )


class CompetencyWindow(Base):
    """
    Measurement window/period for competency scans (e.g., Startscan, Midscan, Eindscan)
    """

    __tablename__ = "competency_windows"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    title: Mapped[str] = mapped_column(
        String(200), nullable=False
    )  # e.g., "Startscan Q1 2025"
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Scope: which classes/courses
    class_names: Mapped[list] = mapped_column(JSON, default=list)  # e.g., ["4A", "4B"]
    course_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=True
    )

    # Timing
    start_date: Mapped[Optional[datetime]] = mapped_column()
    end_date: Mapped[Optional[datetime]] = mapped_column()
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft|open|closed

    # Required fields per window type
    require_self_score: Mapped[bool] = mapped_column(Boolean, default=True)
    require_goal: Mapped[bool] = mapped_column(Boolean, default=False)
    require_reflection: Mapped[bool] = mapped_column(Boolean, default=False)

    # Settings
    settings: Mapped[dict] = mapped_column(JSON, default=dict)

    __table_args__ = (
        Index("ix_competency_window_school", "school_id"),
        Index("ix_competency_window_status", "school_id", "status"),
    )


class CompetencySelfScore(Base):
    """
    Student self-assessment score for a competency in a window
    """

    __tablename__ = "competency_self_scores"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    window_id: Mapped[int] = mapped_column(
        ForeignKey("competency_windows.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    competency_id: Mapped[int] = mapped_column(
        ForeignKey("competencies.id", ondelete="CASCADE"), nullable=False
    )

    score: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 1-5
    example: Mapped[Optional[str]] = mapped_column(
        Text
    )  # Optional: "Wanneer heb je dit laten zien?"
    submitted_at: Mapped[Optional[datetime]] = mapped_column()

    __table_args__ = (
        UniqueConstraint(
            "window_id", "user_id", "competency_id", name="uq_self_score_once"
        ),
        Index("ix_self_score_window_user", "window_id", "user_id"),
    )


class CompetencyPeerLabel(Base):
    """
    Peer labels/tags given during peer reviews (lightweight)
    """

    __tablename__ = "competency_peer_labels"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    window_id: Mapped[int] = mapped_column(
        ForeignKey("competency_windows.id", ondelete="CASCADE"), nullable=False
    )
    from_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    to_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    competency_id: Mapped[int] = mapped_column(
        ForeignKey("competencies.id", ondelete="CASCADE"), nullable=False
    )

    sentiment: Mapped[str] = mapped_column(
        String(20), default="positive"
    )  # positive|neutral|negative
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )

    __table_args__ = (
        Index("ix_peer_label_window_to", "window_id", "to_user_id"),
        Index("ix_peer_label_competency", "competency_id"),
    )


class CompetencyTeacherObservation(Base):
    """
    Teacher observation/score for a student's competency in a window
    """

    __tablename__ = "competency_teacher_observations"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    window_id: Mapped[int] = mapped_column(
        ForeignKey("competency_windows.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    competency_id: Mapped[int] = mapped_column(
        ForeignKey("competencies.id", ondelete="CASCADE"), nullable=False
    )
    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    score: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 1-5
    comment: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "window_id", "user_id", "competency_id", name="uq_teacher_obs_once"
        ),
        Index("ix_teacher_obs_window_user", "window_id", "user_id"),
    )


class CompetencyGoal(Base):
    """
    Student learning goal for a competency in a window
    """

    __tablename__ = "competency_goals"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    window_id: Mapped[int] = mapped_column(
        ForeignKey("competency_windows.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    competency_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("competencies.id", ondelete="SET NULL"), nullable=True
    )

    goal_text: Mapped[str] = mapped_column(Text, nullable=False)
    success_criteria: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(20), default="in_progress"
    )  # in_progress|achieved|not_achieved
    submitted_at: Mapped[Optional[datetime]] = mapped_column()

    __table_args__ = (Index("ix_competency_goal_window_user", "window_id", "user_id"),)


class CompetencyReflection(Base):
    """
    Student reflection on competency growth in a window
    Now supports multiple reflections per window - one per learning goal
    """

    __tablename__ = "competency_reflections"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    window_id: Mapped[int] = mapped_column(
        ForeignKey("competency_windows.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    goal_id: Mapped[int] = mapped_column(
        ForeignKey("competency_goals.id", ondelete="CASCADE"), nullable=False
    )

    text: Mapped[str] = mapped_column(Text, nullable=False)
    goal_achieved: Mapped[Optional[bool]] = mapped_column(Boolean)
    evidence: Mapped[Optional[str]] = mapped_column(Text)  # Bewijs/voorbeelden
    submitted_at: Mapped[Optional[datetime]] = mapped_column()

    __table_args__ = (
        UniqueConstraint(
            "window_id", "user_id", "goal_id", name="uq_competency_reflection_per_goal"
        ),
        Index("ix_competency_reflection_window_user", "window_id", "user_id"),
    )


class CompetencyExternalInvite(Base):
    """
    External reviewer invite for competency window
    Token-based, one-time use magic link
    """

    __tablename__ = "competency_external_invites"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    window_id: Mapped[int] = mapped_column(
        ForeignKey("competency_windows.id", ondelete="CASCADE"), nullable=False
    )
    subject_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    invited_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Invite details
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    external_name: Mapped[Optional[str]] = mapped_column(String(200))
    external_organization: Mapped[Optional[str]] = mapped_column(String(200))

    # Security
    token_hash: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True
    )

    # Status tracking
    status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending|used|revoked|expired
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    sent_at: Mapped[Optional[datetime]] = mapped_column()
    opened_at: Mapped[Optional[datetime]] = (
        mapped_column()
    )  # First time link was opened
    submitted_at: Mapped[Optional[datetime]] = mapped_column()
    revoked_at: Mapped[Optional[datetime]] = mapped_column()

    # Frozen rubric snapshot at invite creation
    rubric_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)

    __table_args__ = (
        Index("ix_external_invite_window", "window_id"),
        Index("ix_external_invite_subject", "subject_user_id"),
        Index("ix_external_invite_status", "status"),
        Index("ix_external_invite_window_subject", "window_id", "subject_user_id"),
    )


class CompetencyExternalScore(Base):
    """
    External reviewer score for a student's competency
    """

    __tablename__ = "competency_external_scores"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    invite_id: Mapped[int] = mapped_column(
        ForeignKey("competency_external_invites.id", ondelete="CASCADE"), nullable=False
    )
    window_id: Mapped[int] = mapped_column(
        ForeignKey("competency_windows.id", ondelete="CASCADE"), nullable=False
    )
    subject_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    competency_id: Mapped[int] = mapped_column(
        ForeignKey("competencies.id", ondelete="CASCADE"), nullable=False
    )

    score: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 1-5
    comment: Mapped[Optional[str]] = mapped_column(Text)

    # External reviewer details (captured at submission)
    reviewer_name: Mapped[Optional[str]] = mapped_column(String(200))
    reviewer_organization: Mapped[Optional[str]] = mapped_column(String(200))

    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "invite_id", "competency_id", name="uq_external_score_per_competency"
        ),
        Index("ix_external_score_window_subject", "window_id", "subject_user_id"),
        Index("ix_external_score_competency", "competency_id"),
    )
