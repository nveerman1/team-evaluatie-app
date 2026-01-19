from __future__ import annotations
from typing import Optional, List
from datetime import datetime, date
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
    Float,
    Text,
    Date,
    DateTime,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
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

    # 3de Blok RFID Attendance relationships
    attendance_events: Mapped[list["AttendanceEvent"]] = relationship(
        "AttendanceEvent", foreign_keys="AttendanceEvent.user_id", back_populates="user"
    )
    approved_attendance_events: Mapped[list["AttendanceEvent"]] = relationship(
        "AttendanceEvent",
        foreign_keys="AttendanceEvent.approved_by",
        back_populates="approver",
        viewonly=True,
    )
    created_attendance_events: Mapped[list["AttendanceEvent"]] = relationship(
        "AttendanceEvent",
        foreign_keys="AttendanceEvent.created_by",
        back_populates="creator",
        viewonly=True,
    )

    __table_args__ = (
        UniqueConstraint("school_id", "email", name="uq_user_email_per_school"),
        Index("ix_user_role_school", "school_id", "role"),
    )


class Subject(Base):
    """
    Subject (NL: sectie) - Organizational level between School and Course
    Groups courses by subject area (e.g., "Onderzoek & Ontwerpen", "Biologie")
    """

    __tablename__ = "subjects"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., "O&O", "BIO"
    color: Mapped[Optional[str]] = mapped_column(String(20))  # hex color for UI
    icon: Mapped[Optional[str]] = mapped_column(String(100))  # icon name/path
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    school: Mapped["School"] = relationship()
    courses: Mapped[list["Course"]] = relationship(back_populates="subject")

    __table_args__ = (
        UniqueConstraint("school_id", "code", name="uq_subject_code_per_school"),
        Index("ix_subject_school_active", "school_id", "is_active"),
    )


class AcademicYear(Base):
    """
    Academic Year (NL: Schooljaar) - Represents a school year period
    e.g., "2025-2026" with start and end dates
    """

    __tablename__ = "academic_years"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    label: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., "2025-2026"
    start_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    end_date: Mapped[datetime] = mapped_column(Date, nullable=False)

    # Archive status
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    archived_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Relationships
    school: Mapped["School"] = relationship()
    classes: Mapped[list["Class"]] = relationship(back_populates="academic_year")
    courses: Mapped[list["Course"]] = relationship(back_populates="academic_year")

    __table_args__ = (
        UniqueConstraint(
            "school_id", "label", name="uq_academic_year_label_per_school"
        ),
        Index("ix_academic_year_school", "school_id"),
    )


class Class(Base):
    """
    Class (NL: Klas) - Represents a fixed class within a school year
    e.g., "G2a" for the 2025-2026 academic year
    """

    __tablename__ = "classes"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    academic_year_id: Mapped[int] = mapped_column(
        ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., "G2a"

    # Relationships
    school: Mapped["School"] = relationship()
    academic_year: Mapped["AcademicYear"] = relationship(back_populates="classes")
    memberships: Mapped[list["StudentClassMembership"]] = relationship(
        back_populates="class_", cascade="all,delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint(
            "school_id", "academic_year_id", "name", name="uq_class_name_per_year"
        ),
        Index("ix_class_school", "school_id"),
        Index("ix_class_academic_year", "academic_year_id"),
    )


class StudentClassMembership(Base):
    """
    Student Class Membership - Links students to their class for a specific academic year
    Enforces: one student can only be in one class per academic year
    """

    __tablename__ = "student_class_memberships"

    id: Mapped[int] = id_pk()
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    class_id: Mapped[int] = mapped_column(
        ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Redundant for unique constraint and query performance
    academic_year_id: Mapped[int] = mapped_column(
        ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Relationships
    student: Mapped["User"] = relationship()
    class_: Mapped["Class"] = relationship(back_populates="memberships")
    academic_year: Mapped["AcademicYear"] = relationship()

    __table_args__ = (
        # Ensure one student per academic year in only one class
        UniqueConstraint(
            "student_id", "academic_year_id", name="uq_student_one_class_per_year"
        ),
        Index("ix_student_class_membership_student", "student_id"),
        Index("ix_student_class_membership_class", "class_id"),
        Index("ix_student_class_membership_academic_year", "academic_year_id"),
    )


class Course(Base):
    __tablename__ = "courses"
    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    # FK to Subject - nullable for backward compatibility
    subject_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # FK to AcademicYear - will be required after migration
    academic_year_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[Optional[str]] = mapped_column(
        String(50)
    )  # e.g., "O&O", "XPLR", "BIO"
    period: Mapped[Optional[str]] = mapped_column(String(50))
    level: Mapped[Optional[str]] = mapped_column(
        String(50)
    )  # e.g., "onderbouw", "bovenbouw"
    year: Mapped[Optional[int]] = mapped_column(
        Integer
    )  # e.g., 2024, 2025 - deprecated, use academic_year_id
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    subject: Mapped[Optional["Subject"]] = relationship(back_populates="courses")
    academic_year: Mapped[Optional["AcademicYear"]] = relationship(
        back_populates="courses"
    )
    enrollments: Mapped[list["CourseEnrollment"]] = relationship(
        back_populates="course", cascade="all,delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("school_id", "name", "period", name="uq_course_name_period"),
        UniqueConstraint("school_id", "code", name="uq_course_code_per_school"),
        Index("ix_course_school_active", "school_id", "is_active"),
        Index("ix_course_subject", "subject_id"),
        Index("ix_course_academic_year", "academic_year_id"),
    )


class TeacherCourse(Base):
    """
    Junction table linking teachers to courses they can manage
    """

    __tablename__ = "teacher_courses"
    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(
        String(50), default="teacher"
    )  # "teacher" | "coordinator"
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint("teacher_id", "course_id", name="uq_teacher_course_once"),
        Index("ix_teacher_course_teacher", "teacher_id"),
        Index("ix_teacher_course_course", "course_id"),
        Index("ix_teacher_course_school", "school_id"),
    )


class CourseEnrollment(Base):
    """
    Course Enrollment - Links students to courses they are enrolled in
    A student can be enrolled in multiple courses within an academic year
    """

    __tablename__ = "course_enrollments"

    id: Mapped[int] = id_pk()
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Optional: track active status
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    course: Mapped["Course"] = relationship(back_populates="enrollments")
    student: Mapped["User"] = relationship()

    __table_args__ = (
        UniqueConstraint("course_id", "student_id", name="uq_course_enrollment_once"),
        Index("ix_course_enrollment_course", "course_id"),
        Index("ix_course_enrollment_student", "student_id"),
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


class Project(Base):
    """
    Project - Container that links evaluations, assessments, notes, and clients
    """

    __tablename__ = "projects"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    course_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=True, index=True
    )

    # Basic info
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    class_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Period within academic year (P1, P2, P3, P4)
    period: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    # Dates
    start_date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)

    # Status
    status: Mapped[str] = mapped_column(
        String(30), default="concept", nullable=False
    )  # "concept" | "active" | "completed" | "archived"

    # Creator
    created_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    course: Mapped["Course"] = relationship()
    created_by: Mapped["User"] = relationship()

    __table_args__ = (
        Index("ix_project_school", "school_id"),
        Index("ix_project_course", "course_id"),
        Index("ix_project_status", "status"),
        Index("ix_project_school_course", "school_id", "course_id"),
        Index("ix_project_course_period", "course_id", "period"),
    )


class Subproject(Base):
    """
    Subproject (Deelproject) - Sub-tasks/sections within a main project
    Used for bovenbouw choice projects where a main project has multiple deelprojecten
    """

    __tablename__ = "subprojects"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    client_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Basic info
    title: Mapped[str] = mapped_column(String(200), nullable=False)

    # Team info
    team_number: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, index=True
    )

    # Relationships
    school: Mapped["School"] = relationship()
    project: Mapped["Project"] = relationship()
    client: Mapped[Optional["Client"]] = relationship()

    __table_args__ = (
        Index("ix_subproject_school", "school_id"),
        Index("ix_subproject_project", "project_id"),
        Index("ix_subproject_client", "client_id"),
        Index("ix_subproject_team", "project_id", "team_number"),
    )


class ProjectTeam(Base):
    """
    Project-specific team roster - freezes team composition at a point in time
    Tracks which groups/teams were used in a specific project
    """

    __tablename__ = "project_teams"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    # Links to project and optionally to the source group
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    team_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("groups.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Snapshot of team name at time of creation
    display_name_at_time: Mapped[str] = mapped_column(String(200), nullable=False)

    # Team number for this project (project-specific)
    team_number: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, index=True
    )

    # Version for handling team composition changes
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Metadata for backfill tracking
    backfill_source: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Relationships
    project: Mapped["Project"] = relationship()
    team: Mapped[Optional["Group"]] = relationship()
    members: Mapped[list["ProjectTeamMember"]] = relationship(
        back_populates="project_team", cascade="all,delete-orphan"
    )

    __table_args__ = (
        Index("ix_project_team_project", "project_id"),
        Index("ix_project_team_team", "team_id"),
        Index("ix_project_team_project_version", "project_id", "team_id", "version"),
        Index("ix_project_teams_project_team_number", "project_id", "team_number"),
    )


class ProjectTeamMember(Base):
    """
    Individual members of a project team at a specific point in time
    """

    __tablename__ = "project_team_members"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    project_team_id: Mapped[int] = mapped_column(
        ForeignKey("project_teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Role in the team (optional)
    role: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    project_team: Mapped["ProjectTeam"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship()

    __table_args__ = (
        UniqueConstraint(
            "project_team_id", "user_id", name="uq_project_team_member_once"
        ),
        Index("ix_project_team_member_project_team", "project_team_id"),
        Index("ix_project_team_member_user", "user_id"),
        Index("ix_project_team_member_composite", "project_team_id", "user_id"),
    )


class Rubric(Base):
    __tablename__ = "rubrics"
    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    scale_min: Mapped[int] = mapped_column(SmallInteger, default=1)
    scale_max: Mapped[int] = mapped_column(SmallInteger, default=5)
    scope: Mapped[str] = mapped_column(
        String(20), default="peer", nullable=False
    )  # "peer" | "project"
    target_level: Mapped[Optional[str]] = mapped_column(
        String(20)
    )  # "onderbouw" | "bovenbouw"
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)

    __table_args__ = (Index("ix_rubric_school_scope", "school_id", "scope"),)


class RubricCriterion(Base):
    __tablename__ = "rubric_criteria"
    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()
    rubric_id: Mapped[int] = mapped_column(ForeignKey("rubrics.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    # descriptors per level, bijv. {"1": "…", "2": "…", …}
    descriptors: Mapped[dict] = mapped_column(JSON, default=dict)
    category: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, index=True
    )
    order: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, index=True
    )  # Display order for criteria within a rubric
    visible_to_external: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )  # Whether this criterion is visible to external evaluators

    # Optional link to a competency for competency tracking
    competency_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("competencies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationship to learning objectives
    learning_objectives: Mapped[list["LearningObjective"]] = relationship(
        secondary="rubric_criterion_learning_objectives",
        back_populates="rubric_criteria",
    )

    # Relationship to competency
    competency: Mapped[Optional["Competency"]] = relationship()

    __table_args__ = (
        Index("ix_criterion_rubric", "rubric_id"),
        Index("ix_criterion_competency", "competency_id"),
    )


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
    Project assessment per team, uses rubrics with scope='project'
    
    Phase 2 Complete: Uses project_team_id (immutable team roster)
    """

    __tablename__ = "project_assessments"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    # Relationships
    project_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    
    # Team reference (immutable project team)
    project_team_id: Mapped[int] = mapped_column(
        ForeignKey("project_teams.id", ondelete="RESTRICT"),
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
    project_team: Mapped[Optional["ProjectTeam"]] = relationship()
    external_evaluator: Mapped["ExternalEvaluator"] = relationship()

    __table_args__ = (
        Index("ix_project_assessment_group", "group_id"),
        Index("ix_project_assessment_project_team", "project_team_id"),
        Index("ix_project_assessment_teacher", "teacher_id"),
        Index("ix_project_assessment_external", "external_evaluator_id"),
        Index("ix_project_assessment_role", "role"),
        Index("ix_project_assessment_status", "status"),
        Index("ix_project_assessment_project_team_status", "project_team_id", "status"),
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


# ============ Competency Monitor ============


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


# ============ Learning Objectives (Leerdoelen/Eindtermen) ============


class LearningObjective(Base):
    """
    Learning objectives / eindtermen that can be linked to rubric criteria
    to track student progress per learning goal.

    Two-tier architecture:
    1. Central (template) objectives: is_template=True, managed by admin via /admin/templates
       - subject_id IS NOT NULL (linked to subject/sectie)
       - teacher_id IS NULL
       - Can be linked to rubric criteria
       - Read-only for teachers in /teacher/learning-objectives

    2. Teacher-specific objectives: is_template=False, managed by teacher via /teacher/learning-objectives
       - teacher_id IS NOT NULL (owned by specific teacher)
       - course_id optional (for course-specific objectives)
       - Cannot be linked to central rubric templates
       - Visible/editable only by the owning teacher
    """

    __tablename__ = "learning_objectives"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    # Subject linkage for central/template learning objectives
    subject_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Teacher linkage for teacher-specific learning objectives
    teacher_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Course linkage for teacher-specific learning objectives (optional)
    course_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("courses.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Type indicator: True = central/template (admin managed), False = teacher-specific
    is_template: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Domain (e.g., "A", "B", "C", "D - Ontwerpen", "E")
    domain: Mapped[Optional[str]] = mapped_column(String(50))

    # Title/name of the learning objective
    title: Mapped[str] = mapped_column(String(200), nullable=False)

    # Detailed description
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Order/number (e.g., 9, 11, 13, 14, 16)
    order: Mapped[int] = mapped_column(Integer, default=0)

    # Phase: "onderbouw" or "bovenbouw"
    phase: Mapped[Optional[str]] = mapped_column(String(20))

    # Additional metadata
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)

    # Relationships
    subject: Mapped[Optional["Subject"]] = relationship()
    teacher: Mapped[Optional["User"]] = relationship(foreign_keys=[teacher_id])
    course: Mapped[Optional["Course"]] = relationship()
    rubric_criteria: Mapped[list["RubricCriterion"]] = relationship(
        secondary="rubric_criterion_learning_objectives",
        back_populates="learning_objectives",
    )

    __table_args__ = (
        Index("ix_learning_objective_school", "school_id"),
        Index("ix_learning_objective_subject", "subject_id"),
        Index("ix_learning_objective_teacher", "teacher_id"),
        Index("ix_learning_objective_course", "course_id"),
        Index("ix_learning_objective_is_template", "school_id", "is_template"),
        Index("ix_learning_objective_domain", "school_id", "domain"),
        Index("ix_learning_objective_phase", "school_id", "phase"),
    )


class RubricCriterionLearningObjective(Base):
    """
    Many-to-many association table linking rubric criteria to learning objectives
    """

    __tablename__ = "rubric_criterion_learning_objectives"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    criterion_id: Mapped[int] = mapped_column(
        ForeignKey("rubric_criteria.id", ondelete="CASCADE"), nullable=False
    )
    learning_objective_id: Mapped[int] = mapped_column(
        ForeignKey("learning_objectives.id", ondelete="CASCADE"), nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "criterion_id",
            "learning_objective_id",
            name="uq_criterion_learning_objective",
        ),
        Index("ix_criterion_lo_criterion", "criterion_id"),
        Index("ix_criterion_lo_objective", "learning_objective_id"),
    )


# ============ Audit Log ============


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


# ============ Project Notes ============


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
        ForeignKey("groups.id", ondelete="CASCADE"),
        index=True,
    )
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
    team: Mapped[Optional["Group"]] = relationship()
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


# ============ Clients (Opdrachtgevers) ============


class Client(Base):
    """
    Client/Opdrachtgever - External organizations providing projects to students
    """

    __tablename__ = "clients"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )

    # Organization info
    organization: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_name: Mapped[Optional[str]] = mapped_column(String(200))
    email: Mapped[Optional[str]] = mapped_column(String(320))
    phone: Mapped[Optional[str]] = mapped_column(String(50))

    # Classification
    level: Mapped[Optional[str]] = mapped_column(
        String(50)
    )  # e.g., "Bovenbouw", "Onderbouw"
    sector: Mapped[Optional[str]] = mapped_column(
        String(100)
    )  # e.g., "Vastgoed", "Zorg"
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(String), default=list
    )  # e.g., ["Duurzaamheid", "Innovatie"]

    # Status
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    school: Mapped["School"] = relationship()
    logs: Mapped[list["ClientLog"]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
    project_links: Mapped[list["ClientProjectLink"]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_client_school_active", "school_id", "active"),
        Index("ix_client_organization", "organization"),
    )


class ClientLog(Base):
    """
    Log entries for client interactions and notes
    """

    __tablename__ = "client_logs"

    id: Mapped[int] = id_pk()
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Log content
    log_type: Mapped[str] = mapped_column(
        String(50), default="Notitie"
    )  # e.g., "Notitie", "Mail (template)", "Telefoongesprek"
    text: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationships
    client: Mapped["Client"] = relationship(back_populates="logs")
    author: Mapped["User"] = relationship()

    __table_args__ = (
        Index("ix_client_log_client", "client_id"),
        Index("ix_client_log_created_at", "created_at"),
    )


class ClientProjectLink(Base):
    """
    Links clients to projects with role information
    """

    __tablename__ = "client_project_links"

    id: Mapped[int] = id_pk()
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Role and timeline
    role: Mapped[str] = mapped_column(
        String(50), default="main"
    )  # "main" (hoofdopdrachtgever) or "secondary" (nevenopdrachtgever)
    start_date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)

    # Relationships
    client: Mapped["Client"] = relationship(back_populates="project_links")
    project: Mapped["Project"] = relationship()

    __table_args__ = (
        UniqueConstraint(
            "client_id",
            "project_id",
            name="uq_client_project_once",
        ),
        Index("ix_client_project_client", "client_id"),
        Index("ix_client_project_project", "project_id"),
    )


# ============ Templates Module ============


class PeerEvaluationCriterionTemplate(Base):
    """
    Template for peer evaluation criteria (OMZA: Organiseren, Meedoen, Zelfvertrouwen, Autonomie)
    """

    __tablename__ = "peer_evaluation_criterion_templates"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # OMZA Category
    omza_category: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "Organiseren" | "Meedoen" | "Zelfvertrouwen" | "Autonomie"

    # Content
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Target level: onderbouw or bovenbouw
    target_level: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, index=True
    )  # "onderbouw" | "bovenbouw" | null

    # Level descriptors (5 levels: 1-5)
    level_descriptors: Mapped[dict] = mapped_column(
        JSON, default=dict
    )  # {"1": "description", "2": "description", ...}

    # Learning objectives - stored as JSON array of IDs
    learning_objective_ids: Mapped[list] = mapped_column(JSON, default=list)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    subject: Mapped["Subject"] = relationship()

    __table_args__ = (
        Index("ix_peer_criterion_template_school", "school_id"),
        Index("ix_peer_criterion_template_subject", "subject_id"),
        Index("ix_peer_criterion_template_category", "omza_category"),
        Index("ix_peer_criterion_template_target_level", "target_level"),
    )


class ProjectAssessmentCriterionTemplate(Base):
    """
    Template for project assessment criteria (Projectbeoordeling: Projectproces, Eindresultaat, Communicatie)
    """

    __tablename__ = "project_assessment_criterion_templates"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Category: projectproces, eindresultaat, communicatie
    category: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "projectproces" | "eindresultaat" | "communicatie"

    # Content
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Target level: onderbouw or bovenbouw
    target_level: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, index=True
    )  # "onderbouw" | "bovenbouw" | null

    # Level descriptors (5 levels: 1-5)
    level_descriptors: Mapped[dict] = mapped_column(
        JSON, default=dict
    )  # {"1": "description", "2": "description", ...}

    # Learning objectives - stored as JSON array of IDs
    learning_objective_ids: Mapped[list] = mapped_column(JSON, default=list)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    subject: Mapped["Subject"] = relationship()

    __table_args__ = (
        Index("ix_project_assessment_criterion_template_school", "school_id"),
        Index("ix_project_assessment_criterion_template_subject", "subject_id"),
        Index("ix_project_assessment_criterion_template_category", "category"),
        Index("ix_project_assessment_criterion_template_target_level", "target_level"),
    )


class ProjectRubricTemplate(Base):
    """
    Template for project rubrics
    """

    __tablename__ = "project_rubric_templates"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Content
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    level: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "onderbouw" | "havo_bovenbouw" | "vwo_bovenbouw" | "speciaal"

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    subject: Mapped["Subject"] = relationship()
    criteria: Mapped[list["ProjectRubricCriterionTemplate"]] = relationship(
        back_populates="rubric_template", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_project_rubric_template_school", "school_id"),
        Index("ix_project_rubric_template_subject", "subject_id"),
        Index("ix_project_rubric_template_level", "level"),
    )


class ProjectRubricCriterionTemplate(Base):
    """
    Criteria template for project rubrics
    """

    __tablename__ = "project_rubric_criterion_templates"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    rubric_template_id: Mapped[int] = mapped_column(
        ForeignKey("project_rubric_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Category
    category: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # "projectproces" | "eindresultaat" | "communicatie"

    # Content
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    weight: Mapped[float] = mapped_column(Float, default=1.0)

    # Level descriptors (5 levels)
    level_descriptors: Mapped[dict] = mapped_column(JSON, default=dict)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    rubric_template: Mapped["ProjectRubricTemplate"] = relationship(
        back_populates="criteria"
    )

    __table_args__ = (
        Index("ix_project_criterion_template_rubric", "rubric_template_id"),
        Index("ix_project_criterion_template_category", "category"),
    )


class CompetencyTemplate(Base):
    """
    Template for competencies (competentiemonitor)
    """

    __tablename__ = "competency_templates"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    subject_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True
    )  # Optional - can be generic

    # Content
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    subject: Mapped[Optional["Subject"]] = relationship()
    level_descriptors: Mapped[list["CompetencyLevelDescriptorTemplate"]] = relationship(
        back_populates="competency_template", cascade="all, delete-orphan"
    )
    reflection_questions: Mapped[list["CompetencyReflectionQuestionTemplate"]] = (
        relationship(back_populates="competency_template", cascade="all, delete-orphan")
    )

    __table_args__ = (
        Index("ix_competency_template_school", "school_id"),
        Index("ix_competency_template_subject", "subject_id"),
    )


class CompetencyLevelDescriptorTemplate(Base):
    """
    Level descriptors for competency templates
    """

    __tablename__ = "competency_level_descriptor_templates"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    competency_template_id: Mapped[int] = mapped_column(
        ForeignKey("competency_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Level
    level: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "startend" | "basis" | "competent" | "gevorderd" | "excellent"

    # Description
    behavior_description: Mapped[str] = mapped_column(Text, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    competency_template: Mapped["CompetencyTemplate"] = relationship(
        back_populates="level_descriptors"
    )

    __table_args__ = (
        UniqueConstraint(
            "competency_template_id", "level", name="uq_competency_level_per_template"
        ),
        Index("ix_competency_level_template_competency", "competency_template_id"),
    )


class CompetencyReflectionQuestionTemplate(Base):
    """
    Reflection questions for competency templates
    """

    __tablename__ = "competency_reflection_question_templates"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    competency_template_id: Mapped[int] = mapped_column(
        ForeignKey("competency_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Question
    question_text: Mapped[str] = mapped_column(Text, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    competency_template: Mapped["CompetencyTemplate"] = relationship(
        back_populates="reflection_questions"
    )

    __table_args__ = (
        Index("ix_competency_reflection_template_competency", "competency_template_id"),
    )


class MailTemplate(Base):
    """
    Email templates with variable substitution
    """

    __tablename__ = "mail_templates"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    subject_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True
    )  # Optional

    # Content
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # "start_opdrachtgever" | "tussenpresentatie" | "eindpresentatie" | "bedankmail" | "herinnering"
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)  # Text/Markdown

    # Variables allowed in this template
    variables_allowed: Mapped[dict] = mapped_column(
        JSON, default=dict
    )  # e.g., {"contactpersoon": true, "datum": true}

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    subject_rel: Mapped[Optional["Subject"]] = relationship(foreign_keys=[subject_id])

    __table_args__ = (
        Index("ix_mail_template_school", "school_id"),
        Index("ix_mail_template_subject", "subject_id"),
        Index("ix_mail_template_type", "type"),
        Index("ix_mail_template_active", "is_active"),
    )


class StandardRemark(Base):
    """
    Standard remarks library for quick feedback
    """

    __tablename__ = "standard_remarks"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    subject_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True
    )  # Optional

    # Type and category
    type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "peer" | "project" | "competency" | "project_feedback" | "omza"
    category: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "positief" | "aandachtspunt" | "aanbeveling"

    # Content
    text: Mapped[str] = mapped_column(Text, nullable=False)

    # Order for drag & drop
    order: Mapped[int] = mapped_column(Integer, default=0)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    subject: Mapped[Optional["Subject"]] = relationship()

    __table_args__ = (
        Index("ix_standard_remark_school", "school_id"),
        Index("ix_standard_remark_subject", "subject_id"),
        Index("ix_standard_remark_type", "type"),
        Index("ix_standard_remark_category", "category"),
    )


class TemplateTag(Base):
    """
    Tags for categorizing templates
    """

    __tablename__ = "template_tags"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    subject_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True
    )  # Optional

    # Content
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    color: Mapped[Optional[str]] = mapped_column(String(20))  # Hex color

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    subject: Mapped[Optional["Subject"]] = relationship()

    __table_args__ = (
        UniqueConstraint("school_id", "name", name="uq_template_tag_name_per_school"),
        Index("ix_template_tag_school", "school_id"),
        Index("ix_template_tag_subject", "subject_id"),
    )


class TemplateTagLink(Base):
    """
    Many-to-many link between tags and templates
    """

    __tablename__ = "template_tag_links"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    tag_id: Mapped[int] = mapped_column(
        ForeignKey("template_tags.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Target (polymorphic)
    target_type: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # "peer_criterion" | "project_criterion" | "competency" | "learning_objective"
    target_id: Mapped[int] = mapped_column(Integer, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    tag: Mapped["TemplateTag"] = relationship()

    __table_args__ = (
        UniqueConstraint(
            "tag_id", "target_type", "target_id", name="uq_template_tag_link_once"
        ),
        Index("ix_template_tag_link_tag", "tag_id"),
        Index("ix_template_tag_link_target", "target_type", "target_id"),
    )


# ============ External Project Assessment ============


class ExternalEvaluator(Base):
    """
    External evaluator/opdrachtgever for project assessments
    Can assess one or multiple teams based on configuration
    """

    __tablename__ = "external_evaluators"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )

    # Contact information
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    organisation: Mapped[Optional[str]] = mapped_column(String(200))

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    team_links: Mapped[list["ProjectTeamExternal"]] = relationship(
        back_populates="external_evaluator", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_external_evaluator_school_email", "school_id", "email"),
        Index("ix_external_evaluator_email", "email"),
    )


class ProjectTeamExternal(Base):
    """
    Links project teams (groups) to external evaluators with invitation tokens
    Supports both bovenbouw (different evaluators per team) and onderbouw (one evaluator for all teams)
    """

    __tablename__ = "project_team_externals"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = tenant_fk()

    # Relationships
    group_id: Mapped[int] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    external_evaluator_id: Mapped[int] = mapped_column(
        ForeignKey("external_evaluators.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True
    )
    assessment_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("project_assessments.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Team number within the group (identifies specific team, not just the course group)
    team_number: Mapped[Optional[int]] = mapped_column(nullable=True, index=True)

    # Token for external access
    invitation_token: Mapped[str] = mapped_column(
        String(128), nullable=False, index=True
    )
    token_expires_at: Mapped[Optional[datetime]] = mapped_column()

    # Status tracking
    status: Mapped[str] = mapped_column(
        String(30), default="NOT_INVITED", nullable=False
    )  # NOT_INVITED | INVITED | IN_PROGRESS | SUBMITTED

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    invited_at: Mapped[Optional[datetime]] = mapped_column()
    submitted_at: Mapped[Optional[datetime]] = mapped_column()

    # Relationships
    group: Mapped["Group"] = relationship()
    external_evaluator: Mapped["ExternalEvaluator"] = relationship(
        back_populates="team_links"
    )
    project: Mapped["Project"] = relationship()
    assessment: Mapped[Optional["ProjectAssessment"]] = relationship()

    __table_args__ = (
        Index("ix_project_team_external_group", "group_id"),
        Index("ix_project_team_external_evaluator", "external_evaluator_id"),
        Index("ix_project_team_external_project", "project_id"),
        Index("ix_project_team_external_assessment", "assessment_id"),
        Index("ix_project_team_external_status", "status"),
        Index("ix_project_team_external_token", "invitation_token"),
        Index("ix_project_team_external_group_team", "group_id", "team_number"),
    )


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


# ============ 3de Blok RFID Attendance Module ============


class RFIDCard(Base):
    """
    RFID cards linked to users for attendance tracking via Raspberry Pi
    """

    __tablename__ = "rfid_cards"

    id: Mapped[int] = id_pk()
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    uid: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    label: Mapped[Optional[str]] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    user: Mapped["User"] = relationship(foreign_keys=[user_id])
    creator: Mapped[Optional["User"]] = relationship(foreign_keys=[created_by])

    __table_args__ = (
        Index("ix_rfid_cards_user_id", "user_id"),
        Index(
            "ix_rfid_cards_uid_active",
            "uid",
            postgresql_where=sa.text("is_active = true"),
        ),
    )


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
    check_in: Mapped[datetime] = mapped_column(nullable=False)
    check_out: Mapped[Optional[datetime]] = mapped_column(nullable=True)

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
    approved_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Source tracking
    source: Mapped[str] = mapped_column(
        String(20), default="manual", nullable=False
    )  # rfid | manual | import | api

    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
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
