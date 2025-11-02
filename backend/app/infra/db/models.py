from __future__ import annotations
from typing import Optional
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
    Float,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from app.infra.db.base import Base


# ============ Helpers ============
def id_pk():
    return mapped_column(Integer, primary_key=True, index=True)


def tenant_fk():
    return mapped_column(Integer, index=True)


# ============ Core entities ============


class School(Base):
    __tablename__ = "schools"
    id: Mapped[int] = id_pk()
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    # relaties
    users: Mapped[list["User"]] = relationship(
        back_populates="school", cascade="all,delete-orphan"
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, default="student"
    )  # "student" | "teacher" | "admin"
    auth_provider: Mapped[Optional[str]] = mapped_column(String(50), default="local")
    password_hash: Mapped[Optional[str]] = mapped_column(String(255))
    archived: Mapped[bool] = mapped_column(Boolean, default=False)

    # ✅ Klas
    class_name: Mapped[Optional[str]] = mapped_column(
        String(50), index=True, nullable=True
    )

    # ✅ Teamnummer
    team_number: Mapped[Optional[int]] = mapped_column(nullable=True, index=True)

    school: Mapped["School"] = relationship(back_populates="users")

    __table_args__ = (
        UniqueConstraint("school_id", "email", name="uq_user_email_per_school"),
        Index("ix_user_role_school", "school_id", "role"),
    )


class Course(Base):
    __tablename__ = "courses"
    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    period: Mapped[Optional[str]] = mapped_column(String(50))

    __table_args__ = (
        UniqueConstraint("school_id", "name", "period", name="uq_course_name_period"),
    )


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    # Elke groep hoort bij één course/vak
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Vrije groepsnaam (bijv. "Team 1", "GA2 - Team Alpha")
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # ✅ Teamnummer — zelfde type & stijl als in User
    team_number: Mapped[Optional[int]] = mapped_column(
        nullable=True,
        index=True,
    )

    # Relaties
    course: Mapped["Course"] = relationship()
    members: Mapped[list["GroupMember"]] = relationship(
        back_populates="group",
        cascade="all,delete-orphan",
    )

    __table_args__ = (
        # Indexen
        Index("ix_group_course", "course_id"),
        Index("ix_groups_course_team", "course_id", "team_number"),
    )


class GroupMember(Base):
    __tablename__ = "group_members"
    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role_in_team: Mapped[Optional[str]] = mapped_column(String(50))
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    group: Mapped["Group"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship()

    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_member_once"),
        Index("ix_member_user", "user_id"),
    )


class Rubric(Base):
    __tablename__ = "rubrics"
    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    scale_min: Mapped[int] = mapped_column(SmallInteger, default=1)
    scale_max: Mapped[int] = mapped_column(SmallInteger, default=5)
    scope: Mapped[str] = mapped_column(String(20), default="peer", nullable=False)  # "peer" | "project"
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    
    __table_args__ = (
        Index("ix_rubric_school_scope", "school_id", "scope"),
    )


class RubricCriterion(Base):
    __tablename__ = "rubric_criteria"
    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    rubric_id: Mapped[int] = mapped_column(ForeignKey("rubrics.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    # descriptors per level, bijv. {"1": "…", "2": "…", …}
    descriptors: Mapped[dict] = mapped_column(JSON, default=dict)

    __table_args__ = (Index("ix_criterion_rubric", "rubric_id"),)


class Evaluation(Base):
    __tablename__ = "evaluations"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    course_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=True,  # ← aangepast
    )

    rubric_id: Mapped[int] = mapped_column(
        ForeignKey("rubrics.id", ondelete="RESTRICT")
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)

    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(
        String(30), default="draft"
    )  # draft|open|closed

    course: Mapped["Course"] = relationship()
    rubric: Mapped["Rubric"] = relationship()

    __table_args__ = (
        Index("ix_eval_course", "course_id"),
        Index("ix_eval_rubric", "rubric_id"),
    )


class Allocation(Base):
    """
    Toewijzing van reviewer -> reviewee voor een Evaluation.
    is_self=True voor zelfbeoordeling.
    """

    __tablename__ = "allocations"
    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    evaluation_id: Mapped[int] = mapped_column(
        ForeignKey("evaluations.id", ondelete="CASCADE")
    )
    reviewer_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    reviewee_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    is_self: Mapped[bool] = mapped_column(Boolean, default=False)

    __table_args__ = (
        UniqueConstraint(
            "evaluation_id", "reviewer_id", "reviewee_id", name="uq_allocation_unique"
        ),
        Index("ix_alloc_eval_reviewer", "evaluation_id", "reviewer_id"),
        Index("ix_alloc_eval_reviewee", "evaluation_id", "reviewee_id"),
    )


class Score(Base):
    """
    Score op criterium-niveau + optionele comment/audio per allocation.
    status: draft|submitted
    """

    __tablename__ = "scores"
    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    allocation_id: Mapped[int] = mapped_column(
        ForeignKey("allocations.id", ondelete="CASCADE")
    )
    criterion_id: Mapped[int] = mapped_column(
        ForeignKey("rubric_criteria.id", ondelete="CASCADE")
    )
    score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text)
    attachments: Mapped[dict] = mapped_column(
        JSON, default=dict
    )  # bv. {"audio": "s3://..."}
    status: Mapped[str] = mapped_column(String(20), default="submitted")

    __table_args__ = (
        UniqueConstraint(
            "allocation_id", "criterion_id", name="uq_one_score_per_criterion"
        ),
        Index("ix_score_allocation", "allocation_id"),
    )


class ReviewerRating(Base):
    """
    Reviewee beoordeelt de kwaliteit van ontvangen feedback (1-5) van reviewer.
    """

    __tablename__ = "reviewer_ratings"
    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    allocation_id: Mapped[int] = mapped_column(
        ForeignKey("allocations.id", ondelete="CASCADE")
    )
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text)

    __table_args__ = (
        UniqueConstraint("allocation_id", name="uq_reviewer_rating_once"),
    )


class Reflection(Base):
    __tablename__ = "reflections"
    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    evaluation_id: Mapped[int] = mapped_column(
        ForeignKey("evaluations.id", ondelete="CASCADE")
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    text: Mapped[str] = mapped_column(Text)
    word_count: Mapped[int] = mapped_column(Integer)
    submitted_at: Mapped[Optional[datetime]] = mapped_column()

    __table_args__ = (
        UniqueConstraint("evaluation_id", "user_id", name="uq_one_reflection"),
        Index("ix_reflection_eval", "evaluation_id"),
    )


class Grade(Base):
    """
    Vastlegging van GCF/SPR en (gepubliceerde) cijfers.
    """

    __tablename__ = "grades"
    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    evaluation_id: Mapped[int] = mapped_column(
        ForeignKey("evaluations.id", ondelete="CASCADE")
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    grade = sa.Column(sa.Numeric(5, 2), nullable=True)  # 1–10, mag NULL
    meta = sa.Column(JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False)
    group_grade: Mapped[Optional[float]] = mapped_column()
    gcf: Mapped[Optional[float]] = mapped_column()
    spr: Mapped[Optional[float]] = mapped_column()
    suggested_grade: Mapped[Optional[float]] = mapped_column()
    published_grade: Mapped[Optional[float]] = mapped_column()
    override_reason: Mapped[Optional[str]] = mapped_column(Text)
    published_at: Mapped[Optional[datetime]] = mapped_column()

    __table_args__ = (
        UniqueConstraint("evaluation_id", "user_id", name="uq_grade_once"),
        Index("ix_grade_eval", "evaluation_id"),
    )


class PublishedGrade(Base):
    __tablename__ = "published_grades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # scope
    school_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)

    # relaties
    evaluation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("evaluations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # data
    grade: Mapped[float] = mapped_column(Float, nullable=False)  # 1..10
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    meta: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    __table_args__ = (
        UniqueConstraint(
            "school_id", "evaluation_id", "user_id", name="uq_published_grade_once"
        ),
    )

    # relaties (optioneel, alleen als je ze gebruikt)
    evaluation = relationship("Evaluation")
    user = relationship("User")


class ProjectAssessment(Base):
    """
    Project assessment per team/group, uses rubrics with scope='project'
    """
    __tablename__ = "project_assessments"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    
    # Relationships
    group_id: Mapped[int] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rubric_id: Mapped[int] = mapped_column(
        ForeignKey("rubrics.id", ondelete="RESTRICT"), nullable=False
    )
    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    
    # Assessment data
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    version: Mapped[Optional[str]] = mapped_column(String(50))  # e.g., "tussentijds", "eind"
    status: Mapped[str] = mapped_column(String(30), default="draft")  # draft|published
    published_at: Mapped[Optional[datetime]] = mapped_column()
    
    # Metadata
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    
    __table_args__ = (
        Index("ix_project_assessment_group", "group_id"),
        Index("ix_project_assessment_teacher", "teacher_id"),
    )


class ProjectAssessmentScore(Base):
    """
    Scores for project assessment criteria
    """
    __tablename__ = "project_assessment_scores"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    
    assessment_id: Mapped[int] = mapped_column(
        ForeignKey("project_assessments.id", ondelete="CASCADE"), nullable=False
    )
    criterion_id: Mapped[int] = mapped_column(
        ForeignKey("rubric_criteria.id", ondelete="CASCADE"), nullable=False
    )
    team_number: Mapped[Optional[int]] = mapped_column(nullable=True)
    
    score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text)
    
    __table_args__ = (
        UniqueConstraint(
            "assessment_id", "criterion_id", "team_number", name="uq_project_score_per_criterion_team"
        ),
        Index("ix_project_score_assessment", "assessment_id"),
        Index("ix_project_score_team", "assessment_id", "team_number"),
    )


class ProjectAssessmentReflection(Base):
    """
    Student reflection on project assessment
    """
    __tablename__ = "project_assessment_reflections"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    
    assessment_id: Mapped[int] = mapped_column(
        ForeignKey("project_assessments.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    
    text: Mapped[str] = mapped_column(Text)
    word_count: Mapped[int] = mapped_column(Integer)
    submitted_at: Mapped[Optional[datetime]] = mapped_column()
    
    __table_args__ = (
        UniqueConstraint(
            "assessment_id", "user_id", name="uq_project_reflection_once"
        ),
        Index("ix_project_reflection_assessment", "assessment_id"),
    )


# ============ Competency Monitor ============


class Competency(Base):
    """
    Competency definition (e.g., Samenwerken, Communiceren, etc.)
    """
    __tablename__ = "competencies"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    category: Mapped[Optional[str]] = mapped_column(String(100))  # e.g., "Domein", "Denkwijzen", "Werkwijzen"
    order: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Scale settings (default 1-5 Likert)
    scale_min: Mapped[int] = mapped_column(SmallInteger, default=1)
    scale_max: Mapped[int] = mapped_column(SmallInteger, default=5)
    scale_labels: Mapped[dict] = mapped_column(JSON, default=dict)  # e.g., {"1": "Startend", "5": "Sterk"}
    
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    
    __table_args__ = (
        UniqueConstraint("school_id", "name", name="uq_competency_name_per_school"),
        Index("ix_competency_school", "school_id"),
    )


class CompetencyWindow(Base):
    """
    Measurement window/period for competency scans (e.g., Startscan, Midscan, Eindscan)
    """
    __tablename__ = "competency_windows"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    
    title: Mapped[str] = mapped_column(String(200), nullable=False)  # e.g., "Startscan Q1 2025"
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # Scope: which classes/courses
    class_names: Mapped[list] = mapped_column(JSON, default=list)  # e.g., ["4A", "4B"]
    course_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=True
    )
    
    # Timing
    start_date: Mapped[Optional[datetime]] = mapped_column()
    end_date: Mapped[Optional[datetime]] = mapped_column()
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft|open|closed
    
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
    example: Mapped[Optional[str]] = mapped_column(Text)  # Optional: "Wanneer heb je dit laten zien?"
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
    
    sentiment: Mapped[str] = mapped_column(String(20), default="positive")  # positive|neutral|negative
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)
    
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
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)
    
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
    status: Mapped[str] = mapped_column(String(20), default="in_progress")  # in_progress|achieved|not_achieved
    submitted_at: Mapped[Optional[datetime]] = mapped_column()
    
    __table_args__ = (
        Index("ix_competency_goal_window_user", "window_id", "user_id"),
    )


class CompetencyReflection(Base):
    """
    Student reflection on competency growth in a window
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
    goal_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("competency_goals.id", ondelete="SET NULL"), nullable=True
    )
    
    text: Mapped[str] = mapped_column(Text, nullable=False)
    goal_achieved: Mapped[Optional[bool]] = mapped_column(Boolean)
    evidence: Mapped[Optional[str]] = mapped_column(Text)  # Bewijs/voorbeelden
    submitted_at: Mapped[Optional[datetime]] = mapped_column()
    
    __table_args__ = (
        UniqueConstraint(
            "window_id", "user_id", name="uq_competency_reflection_once"
        ),
        Index("ix_competency_reflection_window_user", "window_id", "user_id"),
    )
