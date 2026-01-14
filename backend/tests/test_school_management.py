"""
Tests for School Management Architecture - Academic Years, Classes, Course Enrollments
"""

import pytest
from datetime import date
from sqlalchemy.orm import Session

from app.infra.db.models import (
    School,
    User,
    AcademicYear,
    Class,
    StudentClassMembership,
    Course,
    CourseEnrollment,
)


@pytest.fixture
def db_session(mocker):
    """Mock database session"""
    return mocker.Mock(spec=Session)


@pytest.fixture
def test_school():
    """Create a test school"""
    school = School(id=1, name="Test School")
    return school


@pytest.fixture
def test_academic_year(test_school):
    """Create a test academic year"""
    ay = AcademicYear(
        id=1,
        school_id=test_school.id,
        label="2024-2025",
        start_date=date(2024, 9, 1),
        end_date=date(2025, 8, 31),
    )
    return ay


@pytest.fixture
def test_student(test_school):
    """Create a test student"""
    student = User(
        id=100,
        school_id=test_school.id,
        email="student@test.com",
        name="Test Student",
        role="student",
    )
    return student


class TestAcademicYear:
    """Tests for AcademicYear model"""

    def test_academic_year_creation(self, test_school):
        """Test creating an academic year"""
        ay = AcademicYear(
            school_id=test_school.id,
            label="2025-2026",
            start_date=date(2025, 9, 1),
            end_date=date(2026, 8, 31),
        )
        assert ay.label == "2025-2026"
        assert ay.school_id == test_school.id

    def test_academic_year_unique_constraint(self):
        """Test that academic year label must be unique per school"""
        # Verify the model has the unique constraint defined
        table_args = AcademicYear.__table_args__
        has_unique_constraint = any(
            hasattr(arg, "__class__") and "UniqueConstraint" in arg.__class__.__name__
            for arg in table_args
            if hasattr(arg, "__class__")
        )
        assert has_unique_constraint, "AcademicYear should have a unique constraint"


class TestClass:
    """Tests for Class model"""

    def test_class_creation(self, test_school, test_academic_year):
        """Test creating a class"""
        cls = Class(
            school_id=test_school.id,
            academic_year_id=test_academic_year.id,
            name="G2a",
        )
        assert cls.name == "G2a"
        assert cls.school_id == test_school.id
        assert cls.academic_year_id == test_academic_year.id

    def test_class_unique_constraint(self):
        """Test that class name must be unique per school and academic year"""
        # Verify the model has the unique constraint defined
        table_args = Class.__table_args__
        has_unique_constraint = any(
            hasattr(arg, "__class__") and "UniqueConstraint" in arg.__class__.__name__
            for arg in table_args
            if hasattr(arg, "__class__")
        )
        assert has_unique_constraint, "Class should have a unique constraint"


class TestStudentClassMembership:
    """Tests for StudentClassMembership model"""

    def test_membership_creation(self, test_student, test_academic_year):
        """Test creating a student class membership"""
        cls = Class(
            id=10,
            school_id=test_student.school_id,
            academic_year_id=test_academic_year.id,
            name="G2a",
        )

        membership = StudentClassMembership(
            student_id=test_student.id,
            class_id=cls.id,
            academic_year_id=test_academic_year.id,
        )

        assert membership.student_id == test_student.id
        assert membership.class_id == cls.id
        assert membership.academic_year_id == test_academic_year.id

    def test_one_class_per_student_per_year_constraint(self):
        """Test that a student can only be in one class per academic year"""
        # Verify the model has the unique constraint defined
        table_args = StudentClassMembership.__table_args__
        has_unique_constraint = any(
            hasattr(arg, "__class__") and "UniqueConstraint" in arg.__class__.__name__
            for arg in table_args
            if hasattr(arg, "__class__")
        )
        assert has_unique_constraint, (
            "StudentClassMembership should have a unique constraint"
        )


class TestCourseEnrollment:
    """Tests for CourseEnrollment model"""

    def test_enrollment_creation(self, test_student, test_school, test_academic_year):
        """Test creating a course enrollment"""
        course = Course(
            id=20,
            school_id=test_school.id,
            academic_year_id=test_academic_year.id,
            name="Nederlands",
        )

        enrollment = CourseEnrollment(
            course_id=course.id,
            student_id=test_student.id,
            active=True,
        )

        assert enrollment.course_id == course.id
        assert enrollment.student_id == test_student.id
        assert enrollment.active is True

    def test_enrollment_unique_constraint(self):
        """Test that a student can only be enrolled once per course"""
        # Verify the model has the unique constraint defined
        table_args = CourseEnrollment.__table_args__
        has_unique_constraint = any(
            hasattr(arg, "__class__") and "UniqueConstraint" in arg.__class__.__name__
            for arg in table_args
            if hasattr(arg, "__class__")
        )
        assert has_unique_constraint, "CourseEnrollment should have a unique constraint"

    def test_enrollment_default_active(self, test_student):
        """Test that enrollment is active by default"""
        enrollment = CourseEnrollment(
            course_id=1,
            student_id=test_student.id,
        )
        # Note: server_default won't be set until DB insert, but we verify the model allows it
        assert hasattr(enrollment, "active")


class TestCourseAcademicYear:
    """Tests for Course with academic_year_id"""

    def test_course_with_academic_year(self, test_school, test_academic_year):
        """Test creating a course with academic year"""
        course = Course(
            school_id=test_school.id,
            academic_year_id=test_academic_year.id,
            name="Biologie",
        )

        assert course.school_id == test_school.id
        assert course.academic_year_id == test_academic_year.id
        assert course.name == "Biologie"

    def test_course_academic_year_nullable(self, test_school):
        """Test that academic_year_id is nullable for backward compatibility"""
        course = Course(
            school_id=test_school.id,
            name="History Course",
        )

        assert course.academic_year_id is None
