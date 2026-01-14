"""
Tests for RBAC (Role-Based Access Control) module
"""

import pytest
from unittest.mock import Mock, MagicMock
from app.core.rbac import (
    require_role,
    ensure_school_access,
    can_access_course,
    RBACError,
)
from app.infra.db.models import User, Course, TeacherCourse


def test_require_role_admin():
    """Test that admin role passes require_role check"""
    user = Mock(spec=User)
    user.role = "admin"
    user.school_id = 1

    # Should not raise
    require_role(user, ["admin"])
    require_role(user, ["admin", "teacher"])


def test_require_role_teacher():
    """Test that teacher role passes require_role check"""
    user = Mock(spec=User)
    user.role = "teacher"
    user.school_id = 1

    # Should not raise
    require_role(user, ["teacher"])
    require_role(user, ["admin", "teacher"])


def test_require_role_student_denied():
    """Test that student role fails when not allowed"""
    user = Mock(spec=User)
    user.role = "student"
    user.school_id = 1

    with pytest.raises(RBACError) as exc_info:
        require_role(user, ["admin", "teacher"])

    assert "Insufficient permissions" in str(exc_info.value.detail)


def test_require_role_no_user():
    """Test that None user raises error"""
    with pytest.raises(RBACError) as exc_info:
        require_role(None, ["admin"])

    assert "Authentication required" in str(exc_info.value.detail)


def test_ensure_school_access_valid():
    """Test that user from same school can access"""
    user = Mock(spec=User)
    user.school_id = 1

    # Should not raise
    ensure_school_access(user, 1)


def test_ensure_school_access_denied():
    """Test that user from different school is denied"""
    user = Mock(spec=User)
    user.school_id = 1

    with pytest.raises(RBACError) as exc_info:
        ensure_school_access(user, 2)

    assert "school mismatch" in str(exc_info.value.detail)


def test_ensure_school_access_no_user():
    """Test that None user is denied"""
    with pytest.raises(RBACError):
        ensure_school_access(None, 1)


def test_can_access_course_admin():
    """Test that admin can access any course in their school"""
    db = MagicMock()
    user = Mock(spec=User)
    user.role = "admin"
    user.school_id = 1
    user.id = 1

    course = Mock(spec=Course)
    course.id = 1
    course.school_id = 1

    # Mock query to return course
    db.query.return_value.filter.return_value.first.return_value = course

    assert can_access_course(db, user, 1) is True


def test_can_access_course_wrong_school():
    """Test that user cannot access course from different school"""
    db = MagicMock()
    user = Mock(spec=User)
    user.role = "admin"
    user.school_id = 1
    user.id = 1

    # Mock query to return None (course not in same school)
    db.query.return_value.filter.return_value.first.return_value = None

    assert can_access_course(db, user, 99) is False


def test_can_access_course_teacher_assigned():
    """Test that teacher can access assigned course"""
    db = MagicMock()
    user = Mock(spec=User)
    user.role = "teacher"
    user.school_id = 1
    user.id = 1

    course = Mock(spec=Course)
    course.id = 1
    course.school_id = 1

    teacher_course = Mock(spec=TeacherCourse)

    # Mock queries
    db.query.return_value.filter.return_value.first.side_effect = [
        course,  # First call returns course
        teacher_course,  # Second call returns teacher_course
    ]

    assert can_access_course(db, user, 1) is True


def test_can_access_course_teacher_not_assigned():
    """Test that teacher cannot access non-assigned course"""
    db = MagicMock()
    user = Mock(spec=User)
    user.role = "teacher"
    user.school_id = 1
    user.id = 1

    course = Mock(spec=Course)
    course.id = 1
    course.school_id = 1

    # Mock queries
    db.query.return_value.filter.return_value.first.side_effect = [
        course,  # First call returns course
        None,  # Second call returns None (not assigned)
    ]

    assert can_access_course(db, user, 1) is False


def test_rbac_error_is_403():
    """Test that RBACError has 403 status code"""
    error = RBACError("Test error")
    assert error.status_code == 403
    assert error.detail == "Test error"
