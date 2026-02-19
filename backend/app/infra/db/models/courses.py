from __future__ import annotations
from typing import Optional
from datetime import datetime
from sqlalchemy import (
    String,
    ForeignKey,
    Boolean,
    Integer,
    Text,
    Date,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, id_pk, tenant_fk

__all__ = [
    "Subject",
    "AcademicYear",
    "Class",
    "StudentClassMembership",
    "Course",
    "TeacherCourse",
    "CourseEnrollment",
]


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
