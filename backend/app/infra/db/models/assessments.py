from __future__ import annotations
from typing import Optional
from datetime import datetime
from datetime import timezone
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
    DateTime,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, id_pk, tenant_fk

__all__ = [
    "Evaluation",
    "Allocation",
    "Score",
    "ReviewerRating",
    "Reflection",
    "ProjectAssessment",
    "ProjectAssessmentTeam",
    "ProjectAssessmentScore",
    "ProjectAssessmentReflection",
    "ProjectAssessmentSelfAssessment",
    "ProjectAssessmentSelfAssessmentScore",
]


class Evaluation(Base):
    __tablename__ = "evaluations"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    course_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=True,  # ← aangepast
    )

    project_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Link to frozen project team roster
    project_team_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("project_teams.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    rubric_id: Mapped[int] = mapped_column(
        ForeignKey("rubrics.id", ondelete="RESTRICT")
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)

    # Evaluation type to make logic generic
    evaluation_type: Mapped[str] = mapped_column(
        String(30), default="peer", nullable=False
    )  # "peer" | "project" | "competency"

    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(
        String(30), default="draft"
    )  # draft|open|closed

    # Timestamp when evaluation was closed
    closed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    course: Mapped["Course"] = relationship()
    project: Mapped["Project"] = relationship()
    project_team: Mapped[Optional["ProjectTeam"]] = relationship()
    rubric: Mapped["Rubric"] = relationship()

    __table_args__ = (
        Index("ix_eval_course", "course_id"),
        Index("ix_eval_project", "project_id"),
        Index("ix_eval_project_team", "project_team_id"),
        Index("ix_eval_rubric", "rubric_id"),
        Index("ix_eval_type", "evaluation_type"),
        Index("ix_eval_school_type", "school_id", "evaluation_type"),
        Index("ix_eval_status", "status"),
        Index("ix_eval_project_team_status", "project_team_id", "status"),
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


class ProjectAssessment(Base):
    """
    Project assessment per project, uses rubrics with scope='project'

    Refactored: Owned by project_id, with multiple teams linked via project_assessment_teams
    """

    __tablename__ = "project_assessments"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    # Project relationship - primary owner
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    rubric_id: Mapped[int] = mapped_column(
        ForeignKey("rubrics.id", ondelete="RESTRICT"), nullable=False
    )
    teacher_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    external_evaluator_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("external_evaluators.id", ondelete="CASCADE"), nullable=True
    )

    # Assessment data
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    version: Mapped[Optional[str]] = mapped_column(
        String(50)
    )  # e.g., "tussentijds", "eind"
    status: Mapped[str] = mapped_column(
        String(30), default="draft"
    )  # draft|open|closed|published
    published_at: Mapped[Optional[datetime]] = mapped_column()

    # Timestamp when assessment was closed
    closed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Role: who is creating this assessment
    role: Mapped[str] = mapped_column(
        String(20), default="TEACHER", nullable=False
    )  # TEACHER | EXTERNAL
    is_advisory: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )  # True for external assessments

    # Metadata
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)

    # Relationships
    project: Mapped["Project"] = relationship()
    external_evaluator: Mapped["ExternalEvaluator"] = relationship()
    assessment_teams: Mapped[list["ProjectAssessmentTeam"]] = relationship(
        back_populates="project_assessment", cascade="all,delete-orphan"
    )

    __table_args__ = (
        Index("ix_project_assessment_project_id", "project_id"),
        Index("ix_project_assessment_teacher", "teacher_id"),
        Index("ix_project_assessment_external", "external_evaluator_id"),
        Index("ix_project_assessment_role", "role"),
        Index("ix_project_assessment_status", "status"),
        Index("ix_project_assessment_project_status", "project_id", "status"),
    )


class ProjectAssessmentTeam(Base):
    """
    Links a project assessment to multiple teams within that project.
    One assessment per project, with per-team scoring and status tracking.
    """

    __tablename__ = "project_assessment_teams"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    # Foreign keys
    project_assessment_id: Mapped[int] = mapped_column(
        ForeignKey("project_assessments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_team_id: Mapped[int] = mapped_column(
        ForeignKey("project_teams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Status tracking per team
    status: Mapped[str] = mapped_column(
        String(30), default="not_started", nullable=False
    )  # not_started|in_progress|completed

    # Progress tracking
    scores_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_updated_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Relationships
    project_assessment: Mapped["ProjectAssessment"] = relationship(
        back_populates="assessment_teams"
    )
    project_team: Mapped["ProjectTeam"] = relationship()

    __table_args__ = (
        UniqueConstraint(
            "project_assessment_id",
            "project_team_id",
            name="uq_project_assessment_team_once",
        ),
        Index("ix_pat_assessment", "project_assessment_id"),
        Index("ix_pat_team", "project_team_id"),
        Index("ix_pat_assessment_status", "project_assessment_id", "status"),
    )


class ProjectAssessmentScore(Base):
    """
    Scores for project assessment criteria.

    A score can be either:
    - A team score: when student_id is NULL (applies to all team members)
    - An individual student override: when student_id is set (overrides team score for that student)
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
    student_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )

    score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text)

    __table_args__ = (
        # Allow one team score per criterion (student_id NULL)
        # Allow one individual override per student per criterion (student_id set)
        UniqueConstraint(
            "assessment_id",
            "criterion_id",
            "team_number",
            "student_id",
            name="uq_project_score_per_criterion_team_student",
        ),
        Index("ix_project_score_assessment", "assessment_id"),
        Index("ix_project_score_team", "assessment_id", "team_number"),
        Index("ix_project_score_student", "assessment_id", "student_id"),
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
        UniqueConstraint("assessment_id", "user_id", name="uq_project_reflection_once"),
        Index("ix_project_reflection_assessment", "assessment_id"),
    )


class ProjectAssessmentSelfAssessment(Base):
    """
    Student self-assessment for project assessment
    Each student fills out the same rubric as the teacher
    """

    __tablename__ = "project_assessment_self_assessments"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    assessment_id: Mapped[int] = mapped_column(
        ForeignKey("project_assessments.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    team_number: Mapped[Optional[int]] = mapped_column(nullable=True)

    # Metadata
    locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint(
            "assessment_id",
            "student_id",
            name="uq_self_assessment_once_per_student",
        ),
        Index("ix_self_assessment_assessment", "assessment_id"),
        Index("ix_self_assessment_student", "student_id"),
    )


class ProjectAssessmentSelfAssessmentScore(Base):
    """
    Individual criterion scores for student self-assessment
    """

    __tablename__ = "project_assessment_self_assessment_scores"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    self_assessment_id: Mapped[int] = mapped_column(
        ForeignKey("project_assessment_self_assessments.id", ondelete="CASCADE"),
        nullable=False,
    )
    criterion_id: Mapped[int] = mapped_column(
        ForeignKey("rubric_criteria.id", ondelete="CASCADE"), nullable=False
    )

    score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text)

    __table_args__ = (
        UniqueConstraint(
            "self_assessment_id",
            "criterion_id",
            name="uq_self_score_per_criterion",
        ),
        Index("ix_self_score_self_assessment", "self_assessment_id"),
        Index("ix_self_score_criterion", "criterion_id"),
    )
