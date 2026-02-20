"""
Security tests: RBAC, multi-tenant isolation, and input validation.

Tests are pure-unit (Mock-based) — no DB, no HTTP server required.
"""

from __future__ import annotations

import pytest
from unittest.mock import Mock, MagicMock

from app.core.rbac import (
    RBACError,
    can_access_course,
    ensure_school_access,
    require_role,
)
from app.infra.db.models import Course, TeacherCourse, User

# ── require_role ──────────────────────────────────────────────────────────────


@pytest.mark.security
class TestRequireRole:
    def test_admin_passes(self):
        user = Mock(spec=User)
        user.role = "admin"
        user.school_id = 1
        require_role(user, ["admin"])  # must not raise

    def test_teacher_passes_when_allowed(self):
        user = Mock(spec=User)
        user.role = "teacher"
        user.school_id = 1
        require_role(user, ["admin", "teacher"])  # must not raise

    def test_student_denied_when_not_in_list(self):
        user = Mock(spec=User)
        user.role = "student"
        user.school_id = 1
        with pytest.raises(RBACError) as exc_info:
            require_role(user, ["admin", "teacher"])
        assert "Insufficient permissions" in str(exc_info.value.detail)

    def test_none_user_raises(self):
        with pytest.raises(RBACError) as exc_info:
            require_role(None, ["admin"])
        assert "Authentication required" in str(exc_info.value.detail)

    def test_rbac_error_has_403_status(self):
        err = RBACError("blocked")
        assert err.status_code == 403


# ── ensure_school_access ──────────────────────────────────────────────────────


@pytest.mark.security
class TestEnsureSchoolAccess:
    def test_same_school_passes(self):
        user = Mock(spec=User)
        user.school_id = 5
        ensure_school_access(user, 5)  # must not raise

    def test_different_school_raises(self):
        user = Mock(spec=User)
        user.school_id = 5
        with pytest.raises(RBACError) as exc_info:
            ensure_school_access(user, 99)
        assert "school mismatch" in str(exc_info.value.detail)

    def test_none_user_raises(self):
        with pytest.raises(RBACError):
            ensure_school_access(None, 1)


# ── can_access_course ─────────────────────────────────────────────────────────


@pytest.mark.security
class TestCanAccessCourse:
    def test_admin_can_access_own_school_course(self):
        db = MagicMock()
        user = Mock(spec=User)
        user.role = "admin"
        user.school_id = 1
        user.id = 10

        course = Mock(spec=Course)
        course.id = 1
        course.school_id = 1
        db.query.return_value.filter.return_value.first.return_value = course

        assert can_access_course(db, user, 1) is True

    def test_cross_school_course_denied(self):
        db = MagicMock()
        user = Mock(spec=User)
        user.role = "admin"
        user.school_id = 1
        user.id = 10
        # Query returns None → course not in user's school
        db.query.return_value.filter.return_value.first.return_value = None

        assert can_access_course(db, user, 999) is False

    def test_teacher_with_assignment_can_access(self):
        db = MagicMock()
        user = Mock(spec=User)
        user.role = "teacher"
        user.school_id = 1
        user.id = 20

        course = Mock(spec=Course)
        course.id = 1
        course.school_id = 1

        teacher_course = Mock(spec=TeacherCourse)
        db.query.return_value.filter.return_value.first.side_effect = [
            course,
            teacher_course,
        ]

        assert can_access_course(db, user, 1) is True

    def test_teacher_without_assignment_denied(self):
        db = MagicMock()
        user = Mock(spec=User)
        user.role = "teacher"
        user.school_id = 1
        user.id = 20

        course = Mock(spec=Course)
        course.id = 1
        course.school_id = 1
        db.query.return_value.filter.return_value.first.side_effect = [
            course,
            None,  # No TeacherCourse assignment
        ]

        assert can_access_course(db, user, 1) is False


# ── Multi-tenant isolation ─────────────────────────────────────────────────────


@pytest.mark.security
class TestMultiTenantIsolation:
    def test_user_from_school1_cannot_access_school2_resource(self):
        user = Mock(spec=User)
        user.school_id = 1

        with pytest.raises(RBACError) as exc_info:
            ensure_school_access(user, 2)

        assert "school mismatch" in exc_info.value.detail

    def test_can_access_evaluation_wrong_school(self):
        from app.core.rbac import can_access_evaluation

        db = MagicMock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "student"
        user.id = 100

        db.query.return_value.filter.return_value.first.return_value = None
        assert can_access_evaluation(db, user, 999) is False
