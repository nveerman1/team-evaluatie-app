"""
Tests for Academic Year Transition functionality
"""

import pytest
from datetime import date
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.infra.db.models import (
    School,
    User,
    AcademicYear,
    Class,
    StudentClassMembership,
    Course,
    CourseEnrollment,
    Subject,
)
from app.infra.services.academic_year_transition import AcademicYearTransitionService


@pytest.fixture
def mock_db(mocker):
    """Create a mock database session"""
    return mocker.Mock(spec=Session)


@pytest.fixture
def school():
    """Create a test school"""
    return School(id=1, name="Test School")


@pytest.fixture
def source_year(school):
    """Create source academic year"""
    return AcademicYear(
        id=1,
        school_id=school.id,
        label="2024-2025",
        start_date=date(2024, 9, 1),
        end_date=date(2025, 8, 31),
    )


@pytest.fixture
def target_year(school):
    """Create target academic year"""
    return AcademicYear(
        id=2,
        school_id=school.id,
        label="2025-2026",
        start_date=date(2025, 9, 1),
        end_date=date(2026, 8, 31),
    )


@pytest.fixture
def source_classes(school, source_year):
    """Create source classes"""
    return [
        Class(id=10, school_id=school.id, academic_year_id=source_year.id, name="G2a"),
        Class(id=11, school_id=school.id, academic_year_id=source_year.id, name="G2b"),
        Class(id=12, school_id=school.id, academic_year_id=source_year.id, name="A2a"),
    ]


@pytest.fixture
def students(school):
    """Create test students"""
    return [
        User(
            id=100,
            school_id=school.id,
            email="s1@test.com",
            name="Student 1",
            role="student",
        ),
        User(
            id=101,
            school_id=school.id,
            email="s2@test.com",
            name="Student 2",
            role="student",
        ),
        User(
            id=102,
            school_id=school.id,
            email="s3@test.com",
            name="Student 3",
            role="student",
        ),
        User(
            id=103,
            school_id=school.id,
            email="s4@test.com",
            name="Student 4",
            role="student",
        ),
    ]


class TestValidateTransition:
    """Tests for transition validation"""

    def test_validate_source_year_not_found(self, mock_db, school):
        """Test validation fails when source year not found"""
        mock_db.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(HTTPException) as exc:
            AcademicYearTransitionService.validate_transition(
                db=mock_db,
                school_id=school.id,
                source_year_id=999,
                target_year_id=2,
                class_mapping={"G2a": "G3a"},
            )

        assert exc.value.status_code == 404
        assert "Source academic year" in exc.value.detail

    def test_validate_target_year_not_found(self, mock_db, school, source_year):
        """Test validation fails when target year not found"""
        # First query returns source year, second returns None for target
        mock_db.query.return_value.filter.return_value.first.side_effect = [
            source_year,
            None,
        ]

        with pytest.raises(HTTPException) as exc:
            AcademicYearTransitionService.validate_transition(
                db=mock_db,
                school_id=school.id,
                source_year_id=1,
                target_year_id=999,
                class_mapping={"G2a": "G3a"},
            )

        assert exc.value.status_code == 404
        assert "Target academic year" in exc.value.detail

    def test_validate_same_source_and_target(self, mock_db, school, source_year):
        """Test validation fails when source and target are the same"""
        mock_db.query.return_value.filter.return_value.first.side_effect = [
            source_year,
            source_year,
        ]

        with pytest.raises(HTTPException) as exc:
            AcademicYearTransitionService.validate_transition(
                db=mock_db,
                school_id=school.id,
                source_year_id=1,
                target_year_id=1,
                class_mapping={"G2a": "G3a"},
            )

        assert exc.value.status_code == 400
        assert "must be different" in exc.value.detail

    def test_validate_source_class_not_found(
        self, mock_db, school, source_year, target_year, source_classes
    ):
        """Test validation fails when source class in mapping doesn't exist"""
        # Return years, then source classes, then empty list for target classes
        mock_db.query.return_value.filter.return_value.first.side_effect = [
            source_year,
            target_year,
        ]
        mock_db.query.return_value.filter.return_value.all.side_effect = [
            source_classes,
            [],  # No existing target classes
        ]

        with pytest.raises(HTTPException) as exc:
            AcademicYearTransitionService.validate_transition(
                db=mock_db,
                school_id=school.id,
                source_year_id=1,
                target_year_id=2,
                class_mapping={"G2a": "G3a", "INVALID": "G4a"},
            )

        assert exc.value.status_code == 400
        assert "INVALID" in exc.value.detail

    def test_validate_target_class_already_exists(
        self, mock_db, school, source_year, target_year, source_classes
    ):
        """Test validation fails when target class already exists"""
        existing_target_class = Class(
            id=20,
            school_id=school.id,
            academic_year_id=target_year.id,
            name="G3a",
        )

        mock_db.query.return_value.filter.return_value.first.side_effect = [
            source_year,
            target_year,
        ]
        mock_db.query.return_value.filter.return_value.all.side_effect = [
            source_classes,
            [existing_target_class],  # Existing target class
        ]

        with pytest.raises(HTTPException) as exc:
            AcademicYearTransitionService.validate_transition(
                db=mock_db,
                school_id=school.id,
                source_year_id=1,
                target_year_id=2,
                class_mapping={"G2a": "G3a"},
            )

        assert exc.value.status_code == 400
        assert "already exist" in exc.value.detail
        assert "G3a" in exc.value.detail

    def test_validate_success(
        self, mock_db, school, source_year, target_year, source_classes
    ):
        """Test successful validation"""
        mock_db.query.return_value.filter.return_value.first.side_effect = [
            source_year,
            target_year,
        ]
        mock_db.query.return_value.filter.return_value.all.side_effect = [
            source_classes,
            [],  # No existing target classes
        ]

        result_source, result_target, result_classes = (
            AcademicYearTransitionService.validate_transition(
                db=mock_db,
                school_id=school.id,
                source_year_id=1,
                target_year_id=2,
                class_mapping={"G2a": "G3a", "G2b": "G3b"},
            )
        )

        assert result_source == source_year
        assert result_target == target_year
        assert result_classes == source_classes


class TestCloneClasses:
    """Tests for class cloning"""

    def test_clone_all_mapped_classes(
        self, mock_db, school, target_year, source_classes
    ):
        """Test cloning all classes in the mapping"""
        created_classes = []

        def mock_add(obj):
            if isinstance(obj, Class):
                obj.id = 20 + len(created_classes)
                created_classes.append(obj)

        mock_db.add.side_effect = mock_add

        class_mapping = {"G2a": "G3a", "G2b": "G3b", "A2a": "A3a"}

        result = AcademicYearTransitionService.clone_classes(
            db=mock_db,
            school_id=school.id,
            target_year_id=target_year.id,
            source_classes=source_classes,
            class_mapping=class_mapping,
        )

        assert len(result) == 3
        assert result[10] == 20  # G2a -> G3a
        assert result[11] == 21  # G2b -> G3b
        assert result[12] == 22  # A2a -> A3a

        # Verify created classes
        assert len(created_classes) == 3
        assert created_classes[0].name == "G3a"
        assert created_classes[1].name == "G3b"
        assert created_classes[2].name == "A3a"

        # All should have target academic year
        for cls in created_classes:
            assert cls.academic_year_id == target_year.id
            assert cls.school_id == school.id

    def test_clone_partial_mapping(self, mock_db, school, target_year, source_classes):
        """Test cloning only classes in the mapping"""
        created_classes = []

        def mock_add(obj):
            if isinstance(obj, Class):
                obj.id = 20 + len(created_classes)
                created_classes.append(obj)

        mock_db.add.side_effect = mock_add

        # Only map 2 out of 3 classes
        class_mapping = {"G2a": "G3a", "G2b": "G3b"}

        result = AcademicYearTransitionService.clone_classes(
            db=mock_db,
            school_id=school.id,
            target_year_id=target_year.id,
            source_classes=source_classes,
            class_mapping=class_mapping,
        )

        assert len(result) == 2
        assert 10 in result  # G2a mapped
        assert 11 in result  # G2b mapped
        assert 12 not in result  # A2a not mapped

        assert len(created_classes) == 2


class TestCopyStudentMemberships:
    """Tests for copying student memberships"""

    def test_copy_all_students(self, mock_db, source_year, target_year):
        """Test copying all student memberships"""
        class_id_map = {10: 20, 11: 21}

        source_memberships = [
            StudentClassMembership(
                id=1, student_id=100, class_id=10, academic_year_id=source_year.id
            ),
            StudentClassMembership(
                id=2, student_id=101, class_id=10, academic_year_id=source_year.id
            ),
            StudentClassMembership(
                id=3, student_id=102, class_id=11, academic_year_id=source_year.id
            ),
        ]

        mock_db.query.return_value.filter.return_value.all.return_value = (
            source_memberships
        )
        mock_db.query.return_value.filter.return_value.first.return_value = (
            None  # No existing
        )

        created_memberships = []

        def mock_add(obj):
            if isinstance(obj, StudentClassMembership):
                created_memberships.append(obj)

        mock_db.add.side_effect = mock_add

        students_moved, skipped = (
            AcademicYearTransitionService.copy_student_memberships(
                db=mock_db,
                source_year_id=source_year.id,
                target_year_id=target_year.id,
                class_id_map=class_id_map,
            )
        )

        assert students_moved == 3
        assert skipped == 0
        assert len(created_memberships) == 3

        # Verify correct mappings
        assert created_memberships[0].student_id == 100
        assert created_memberships[0].class_id == 20  # Mapped from 10
        assert created_memberships[0].academic_year_id == target_year.id

        assert created_memberships[1].student_id == 101
        assert created_memberships[1].class_id == 20

        assert created_memberships[2].student_id == 102
        assert created_memberships[2].class_id == 21  # Mapped from 11

    def test_skip_duplicate_student(self, mock_db, source_year, target_year):
        """Test skipping students who already have membership in target year"""
        class_id_map = {10: 20}

        source_memberships = [
            StudentClassMembership(
                id=1, student_id=100, class_id=10, academic_year_id=source_year.id
            ),
            StudentClassMembership(
                id=2, student_id=101, class_id=10, academic_year_id=source_year.id
            ),
        ]

        existing_membership = StudentClassMembership(
            id=99, student_id=100, class_id=20, academic_year_id=target_year.id
        )

        mock_db.query.return_value.filter.return_value.all.return_value = (
            source_memberships
        )
        # First student already exists, second doesn't
        mock_db.query.return_value.filter.return_value.first.side_effect = [
            existing_membership,
            None,
        ]

        created_memberships = []

        def mock_add(obj):
            if isinstance(obj, StudentClassMembership):
                created_memberships.append(obj)

        mock_db.add.side_effect = mock_add

        students_moved, skipped = (
            AcademicYearTransitionService.copy_student_memberships(
                db=mock_db,
                source_year_id=source_year.id,
                target_year_id=target_year.id,
                class_id_map=class_id_map,
            )
        )

        assert students_moved == 1
        assert skipped == 1
        assert len(created_memberships) == 1
        assert created_memberships[0].student_id == 101  # Only second student

    def test_skip_unmapped_class(self, mock_db, source_year, target_year):
        """Test skipping students from classes not in the mapping"""
        class_id_map = {10: 20}  # Only class 10 is mapped

        source_memberships = [
            StudentClassMembership(
                id=1, student_id=100, class_id=10, academic_year_id=source_year.id
            ),
            StudentClassMembership(
                id=2,
                student_id=101,
                class_id=99,
                academic_year_id=source_year.id,  # Unmapped
            ),
        ]

        mock_db.query.return_value.filter.return_value.all.return_value = (
            source_memberships
        )
        mock_db.query.return_value.filter.return_value.first.return_value = None

        created_memberships = []

        def mock_add(obj):
            if isinstance(obj, StudentClassMembership):
                created_memberships.append(obj)

        mock_db.add.side_effect = mock_add

        students_moved, skipped = (
            AcademicYearTransitionService.copy_student_memberships(
                db=mock_db,
                source_year_id=source_year.id,
                target_year_id=target_year.id,
                class_id_map=class_id_map,
            )
        )

        assert students_moved == 1
        assert skipped == 1
        assert len(created_memberships) == 1
        assert created_memberships[0].student_id == 100  # Only mapped class


class TestCopyCoursesAndEnrollments:
    """Tests for copying courses and enrollments"""

    def test_copy_courses(self, mock_db, school, source_year, target_year):
        """Test copying courses to target year"""
        subject = Subject(id=1, school_id=school.id, name="Math", code="MATH")

        source_courses = [
            Course(
                id=1,
                school_id=school.id,
                subject_id=subject.id,
                academic_year_id=source_year.id,
                name="Algebra",
                period="Q1",
                level="onderbouw",
            ),
            Course(
                id=2,
                school_id=school.id,
                subject_id=subject.id,
                academic_year_id=source_year.id,
                name="Geometry",
                period="Q2",
            ),
        ]

        mock_db.query.return_value.filter.return_value.all.side_effect = [
            source_courses,
            [],  # No target students initially
            [],  # No enrollments
        ]
        mock_db.query.return_value.filter.return_value.distinct.return_value.all.return_value = (
            []
        )

        created_courses = []

        def mock_add(obj):
            if isinstance(obj, Course):
                obj.id = 10 + len(created_courses)
                created_courses.append(obj)

        mock_db.add.side_effect = mock_add

        courses_created, enrollments_copied = (
            AcademicYearTransitionService.copy_courses_and_enrollments(
                db=mock_db,
                school_id=school.id,
                source_year_id=source_year.id,
                target_year_id=target_year.id,
            )
        )

        assert courses_created == 2
        assert enrollments_copied == 0  # No students in target
        assert len(created_courses) == 2

        # Verify course properties
        assert created_courses[0].name == "Algebra"
        assert created_courses[0].subject_id == subject.id
        assert created_courses[0].academic_year_id == target_year.id
        assert created_courses[0].period == "Q1"
        assert created_courses[0].code is None  # Code not copied

        assert created_courses[1].name == "Geometry"
        assert created_courses[1].academic_year_id == target_year.id

    def test_copy_enrollments_only_for_target_students(
        self, mock_db, school, source_year, target_year
    ):
        """Test copying enrollments only for students in target year"""
        source_courses = [
            Course(
                id=1,
                school_id=school.id,
                academic_year_id=source_year.id,
                name="Math",
            ),
        ]

        source_enrollments = [
            CourseEnrollment(id=1, course_id=1, student_id=100, active=True),
            CourseEnrollment(id=2, course_id=1, student_id=101, active=True),
            CourseEnrollment(id=3, course_id=1, student_id=102, active=True),
        ]

        # Only students 100 and 101 are in target year
        target_students = [(100,), (101,)]

        mock_db.query.return_value.filter.return_value.all.side_effect = [
            source_courses,
            source_enrollments,
        ]
        mock_db.query.return_value.filter.return_value.distinct.return_value.all.return_value = (
            target_students
        )
        mock_db.query.return_value.filter.return_value.first.return_value = (
            None  # No existing
        )

        created_courses = []
        created_enrollments = []

        def mock_add(obj):
            if isinstance(obj, Course):
                obj.id = 10
                created_courses.append(obj)
            elif isinstance(obj, CourseEnrollment):
                created_enrollments.append(obj)

        mock_db.add.side_effect = mock_add

        courses_created, enrollments_copied = (
            AcademicYearTransitionService.copy_courses_and_enrollments(
                db=mock_db,
                school_id=school.id,
                source_year_id=source_year.id,
                target_year_id=target_year.id,
            )
        )

        assert courses_created == 1
        assert enrollments_copied == 2  # Only students 100 and 101
        assert len(created_enrollments) == 2

        # Student 102 should not be enrolled
        enrolled_student_ids = [e.student_id for e in created_enrollments]
        assert 100 in enrolled_student_ids
        assert 101 in enrolled_student_ids
        assert 102 not in enrolled_student_ids

    def test_skip_duplicate_enrollment(self, mock_db, school, source_year, target_year):
        """Test skipping enrollments that already exist"""
        source_courses = [
            Course(
                id=1, school_id=school.id, academic_year_id=source_year.id, name="Math"
            ),
        ]

        source_enrollments = [
            CourseEnrollment(id=1, course_id=1, student_id=100, active=True),
            CourseEnrollment(id=2, course_id=1, student_id=101, active=True),
        ]

        target_students = [(100,), (101,)]

        existing_enrollment = CourseEnrollment(
            id=99, course_id=10, student_id=100, active=True
        )

        mock_db.query.return_value.filter.return_value.all.side_effect = [
            source_courses,
            source_enrollments,
        ]
        mock_db.query.return_value.filter.return_value.distinct.return_value.all.return_value = (
            target_students
        )
        # First enrollment exists, second doesn't
        mock_db.query.return_value.filter.return_value.first.side_effect = [
            existing_enrollment,
            None,
        ]

        created_courses = []
        created_enrollments = []

        def mock_add(obj):
            if isinstance(obj, Course):
                obj.id = 10
                created_courses.append(obj)
            elif isinstance(obj, CourseEnrollment):
                created_enrollments.append(obj)

        mock_db.add.side_effect = mock_add

        courses_created, enrollments_copied = (
            AcademicYearTransitionService.copy_courses_and_enrollments(
                db=mock_db,
                school_id=school.id,
                source_year_id=source_year.id,
                target_year_id=target_year.id,
            )
        )

        assert courses_created == 1
        assert enrollments_copied == 1  # Only student 101
        assert len(created_enrollments) == 1
        assert created_enrollments[0].student_id == 101


class TestExecuteTransition:
    """Integration tests for complete transition"""

    def test_execute_transition_without_courses(
        self, mock_db, school, source_year, target_year, source_classes
    ):
        """Test complete transition without course copying"""
        source_memberships = [
            StudentClassMembership(
                id=1, student_id=100, class_id=10, academic_year_id=source_year.id
            ),
            StudentClassMembership(
                id=2, student_id=101, class_id=11, academic_year_id=source_year.id
            ),
        ]

        # Setup query chain for validation and operations
        query_chain = mock_db.query.return_value
        filter_chain = query_chain.filter.return_value

        # For .first() calls: source year, target year, then None for membership checks
        filter_chain.first.side_effect = [
            source_year,  # validate source year
            target_year,  # validate target year
            None,  # check for existing membership (student 100)
            None,  # check for existing membership (student 101)
        ]

        # For .all() calls: source classes, target classes, memberships
        filter_chain.all.side_effect = [
            source_classes,  # get source classes
            [],  # check for existing target classes
            source_memberships,  # get source memberships
        ]

        created_objects = []

        def mock_add(obj):
            if isinstance(obj, Class):
                obj.id = 20 + len([o for o in created_objects if isinstance(o, Class)])
            created_objects.append(obj)

        mock_db.add.side_effect = mock_add

        result = AcademicYearTransitionService.execute_transition(
            db=mock_db,
            school_id=school.id,
            source_year_id=1,
            target_year_id=2,
            class_mapping={"G2a": "G3a", "G2b": "G3b"},
            copy_course_enrollments=False,
        )

        assert result["classes_created"] == 2
        assert result["students_moved"] == 2
        assert result["courses_created"] == 0
        assert result["enrollments_copied"] == 0
        assert result["skipped_students"] == 0
