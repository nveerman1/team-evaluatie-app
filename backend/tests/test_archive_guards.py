"""
Tests for Academic Year Archive functionality
"""

import pytest
from datetime import date, datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.infra.db.models import (
    School,
    AcademicYear,
    Course,
    Project,
)
from app.infra.services.archive_guards import (
    require_year_not_archived,
    require_course_year_not_archived,
    require_project_year_not_archived,
)


@pytest.fixture
def mock_db(mocker):
    """Create a mock database session"""
    return mocker.Mock(spec=Session)


@pytest.fixture
def school():
    """Create a test school"""
    return School(id=1, name="Test School")


@pytest.fixture
def academic_year_active(school):
    """Create an active academic year"""
    return AcademicYear(
        id=1,
        school_id=school.id,
        label="2025-2026",
        start_date=date(2025, 9, 1),
        end_date=date(2026, 8, 31),
        is_archived=False,
        archived_at=None,
    )


@pytest.fixture
def academic_year_archived(school):
    """Create an archived academic year"""
    return AcademicYear(
        id=2,
        school_id=school.id,
        label="2024-2025",
        start_date=date(2024, 9, 1),
        end_date=date(2025, 8, 31),
        is_archived=True,
        archived_at=datetime(2025, 9, 1, 12, 0, 0),
    )


class TestRequireYearNotArchived:
    """Tests for require_year_not_archived guard"""

    def test_active_year_passes(self, mock_db, academic_year_active):
        """Test that active year passes the guard"""
        mock_db.query.return_value.filter.return_value.first.return_value = academic_year_active
        
        # Should not raise any exception
        require_year_not_archived(mock_db, academic_year_active.id)

    def test_archived_year_raises_403(self, mock_db, academic_year_archived):
        """Test that archived year raises 403"""
        mock_db.query.return_value.filter.return_value.first.return_value = academic_year_archived
        
        with pytest.raises(HTTPException) as exc:
            require_year_not_archived(mock_db, academic_year_archived.id)
        
        assert exc.value.status_code == 403
        assert "gearchiveerd" in exc.value.detail.lower()

    def test_nonexistent_year_passes(self, mock_db):
        """Test that nonexistent year passes (doesn't fail on None)"""
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        # Should not raise any exception
        require_year_not_archived(mock_db, 999)


class TestRequireCourseYearNotArchived:
    """Tests for require_course_year_not_archived guard"""

    def test_course_with_active_year_passes(self, mock_db, academic_year_active, school):
        """Test that course with active year passes the guard"""
        course = Course(
            id=10,
            school_id=school.id,
            name="Test Course",
            academic_year_id=academic_year_active.id,
        )
        
        # Mock chain: Course query, then AcademicYear query
        mock_db.query.return_value.filter.return_value.first.side_effect = [
            course,
            academic_year_active,
        ]
        
        # Should not raise any exception
        require_course_year_not_archived(mock_db, course.id)

    def test_course_with_archived_year_raises_403(self, mock_db, academic_year_archived, school):
        """Test that course with archived year raises 403"""
        course = Course(
            id=11,
            school_id=school.id,
            name="Test Course",
            academic_year_id=academic_year_archived.id,
        )
        
        # Mock chain: Course query, then AcademicYear query
        mock_db.query.return_value.filter.return_value.first.side_effect = [
            course,
            academic_year_archived,
        ]
        
        with pytest.raises(HTTPException) as exc:
            require_course_year_not_archived(mock_db, course.id)
        
        assert exc.value.status_code == 403
        assert "gearchiveerd" in exc.value.detail.lower()

    def test_course_without_year_passes(self, mock_db, school):
        """Test that course without academic year passes"""
        course = Course(
            id=12,
            school_id=school.id,
            name="Test Course",
            academic_year_id=None,
        )
        
        mock_db.query.return_value.filter.return_value.first.return_value = course
        
        # Should not raise any exception
        require_course_year_not_archived(mock_db, course.id)


class TestRequireProjectYearNotArchived:
    """Tests for require_project_year_not_archived guard"""

    def test_project_with_active_year_passes(self, mock_db, academic_year_active, school):
        """Test that project with active year (via course) passes"""
        course = Course(
            id=10,
            school_id=school.id,
            name="Test Course",
            academic_year_id=academic_year_active.id,
        )
        
        project = Project(
            id=100,
            school_id=school.id,
            course_id=course.id,
            title="Test Project",
            created_by_id=1,
        )
        
        # Mock chain: Project query, Course query, AcademicYear query
        mock_db.query.return_value.filter.return_value.first.side_effect = [
            project,
            course,
            academic_year_active,
        ]
        
        # Should not raise any exception
        require_project_year_not_archived(mock_db, project.id)

    def test_project_with_archived_year_raises_403(self, mock_db, academic_year_archived, school):
        """Test that project with archived year raises 403"""
        course = Course(
            id=11,
            school_id=school.id,
            name="Test Course",
            academic_year_id=academic_year_archived.id,
        )
        
        project = Project(
            id=101,
            school_id=school.id,
            course_id=course.id,
            title="Test Project",
            created_by_id=1,
        )
        
        # Mock chain: Project query, Course query, AcademicYear query
        mock_db.query.return_value.filter.return_value.first.side_effect = [
            project,
            course,
            academic_year_archived,
        ]
        
        with pytest.raises(HTTPException) as exc:
            require_project_year_not_archived(mock_db, project.id)
        
        assert exc.value.status_code == 403
        assert "gearchiveerd" in exc.value.detail.lower()

    def test_project_without_course_passes(self, mock_db, school):
        """Test that project without course passes"""
        project = Project(
            id=102,
            school_id=school.id,
            course_id=None,
            title="Test Project",
            created_by_id=1,
        )
        
        mock_db.query.return_value.filter.return_value.first.return_value = project
        
        # Should not raise any exception
        require_project_year_not_archived(mock_db, project.id)
