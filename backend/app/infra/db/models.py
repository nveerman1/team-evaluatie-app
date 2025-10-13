from __future__ import annotations
from typing import Optional
from datetime import datetime
from sqlalchemy import (
    String,
    Integer,
    ForeignKey,
    Boolean,
    Text,
    JSON,
    UniqueConstraint,
    Index,
    SmallInteger,
    Float,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


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
        String(20), nullable=False
    )  # "student" | "teacher" | "admin"
    auth_provider: Mapped[Optional[str]] = mapped_column(String(50), default="local")
    password_hash: Mapped[Optional[str]] = mapped_column(String(255))
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    class_name: Mapped[Optional[str]] = mapped_column(
        String(50), index=True, nullable=True
    )
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
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    course: Mapped["Course"] = relationship()
    members: Mapped[list["GroupMember"]] = relationship(
        back_populates="group", cascade="all,delete-orphan"
    )

    __table_args__ = (Index("ix_group_course", "course_id"),)


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
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)


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
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    rubric_id: Mapped[int] = mapped_column(
        ForeignKey("rubrics.id", ondelete="RESTRICT")
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)

    # settings: anonimiteit, deadlines, #peers, min_words, min_cf, max_cf, smoothing, reviewer_rating, etc.
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
