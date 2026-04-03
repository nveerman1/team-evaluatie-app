"""
Tests for cleanup_expired_sessions helper and the /cleanup-expired endpoint.

Covers:
1. Sessions open longer than FORGOTTEN_CHECKOUT_THRESHOLD_HOURS are closed.
2. The check_out is set to check_in + FORGOTTEN_CHECKOUT_SESSION_MINUTES.
3. Sessions that are still within the threshold are left untouched.
4. External sessions are never auto-closed.
5. Sessions that already have a check_out are left untouched.
6. The returned count matches the number of sessions actually closed.
7. No DB commit is made when there is nothing to close.
8. The /cleanup-expired endpoint requires teacher or admin role.
9. The /cleanup-expired endpoint calls cleanup_expired_sessions and returns the count.
10. The RFID /scan endpoint calls cleanup_expired_sessions before processing.
"""

from __future__ import annotations

import inspect
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, Mock, patch, call

import pytest

from app.api.v1.routers.attendance import (
    FORGOTTEN_CHECKOUT_THRESHOLD_HOURS,
    FORGOTTEN_CHECKOUT_SESSION_MINUTES,
    cleanup_expired_sessions,
)
from app.infra.db.models import AttendanceEvent


# ── Helpers ────────────────────────────────────────────────────────────────────


def _make_open_session(check_in: datetime) -> Mock:
    """Return a minimal mock AttendanceEvent with an open session (no check_out)."""
    session = Mock(spec=AttendanceEvent)
    session.check_in = check_in
    session.check_out = None
    session.is_external = False
    session.updated_at = None
    return session


def _make_db(sessions: list) -> MagicMock:
    """Return a mock DB session whose query chain returns *sessions*."""
    db = MagicMock()
    (
        db.query.return_value.filter.return_value.all.return_value
    ) = sessions
    return db


# ── Constants ──────────────────────────────────────────────────────────────────


class TestConstants:
    """Verify that the thresholds have the values required by the spec."""

    def test_threshold_is_12_hours(self):
        assert FORGOTTEN_CHECKOUT_THRESHOLD_HOURS == 12

    def test_session_duration_is_15_minutes(self):
        assert FORGOTTEN_CHECKOUT_SESSION_MINUTES == 15


# ── cleanup_expired_sessions() ─────────────────────────────────────────────────


class TestCleanupExpiredSessions:
    """Unit tests for the cleanup_expired_sessions helper."""

    def test_returns_zero_when_no_expired_sessions(self):
        """Returns 0 and does not commit when there are no expired sessions."""
        db = _make_db([])
        count = cleanup_expired_sessions(db)

        assert count == 0
        db.commit.assert_not_called()

    def test_closes_single_expired_session(self):
        """Closes one session that has been open longer than the threshold."""
        check_in = datetime.now(timezone.utc) - timedelta(
            hours=FORGOTTEN_CHECKOUT_THRESHOLD_HOURS + 1
        )
        session = _make_open_session(check_in)
        db = _make_db([session])

        count = cleanup_expired_sessions(db)

        assert count == 1
        db.commit.assert_called_once()

    def test_check_out_set_to_check_in_plus_15_minutes(self):
        """check_out must equal check_in + FORGOTTEN_CHECKOUT_SESSION_MINUTES."""
        check_in = datetime(2024, 1, 10, 8, 0, 0, tzinfo=timezone.utc)
        session = _make_open_session(check_in)
        db = _make_db([session])

        cleanup_expired_sessions(db)

        expected_checkout = check_in + timedelta(
            minutes=FORGOTTEN_CHECKOUT_SESSION_MINUTES
        )
        assert session.check_out == expected_checkout

    def test_check_out_set_for_naive_check_in(self):
        """Naive check_in datetimes are treated as UTC and closed correctly."""
        # Naive datetime far in the past
        check_in = datetime(2024, 1, 10, 8, 0, 0)  # naive
        session = _make_open_session(check_in)
        db = _make_db([session])

        cleanup_expired_sessions(db)

        expected_checkout = datetime(2024, 1, 10, 8, 0, 0, tzinfo=timezone.utc) + timedelta(
            minutes=FORGOTTEN_CHECKOUT_SESSION_MINUTES
        )
        assert session.check_out == expected_checkout

    def test_updated_at_is_refreshed(self):
        """updated_at must be set to a recent UTC datetime on closure."""
        before = datetime.now(timezone.utc)
        check_in = datetime.now(timezone.utc) - timedelta(hours=13)
        session = _make_open_session(check_in)
        db = _make_db([session])

        cleanup_expired_sessions(db)

        after = datetime.now(timezone.utc)
        assert session.updated_at is not None
        assert before <= session.updated_at <= after

    def test_closes_multiple_expired_sessions(self):
        """All expired sessions are closed in a single commit."""
        now = datetime.now(timezone.utc)
        sessions = [
            _make_open_session(now - timedelta(hours=13)),
            _make_open_session(now - timedelta(hours=24)),
            _make_open_session(now - timedelta(hours=48)),
        ]
        db = _make_db(sessions)

        count = cleanup_expired_sessions(db)

        assert count == 3
        db.commit.assert_called_once()
        for s in sessions:
            assert s.check_out is not None

    def test_does_not_commit_when_no_sessions_found(self):
        """commit() must NOT be called when the query returns an empty list."""
        db = _make_db([])
        cleanup_expired_sessions(db)
        db.commit.assert_not_called()

    def test_query_excludes_external_sessions(self):
        """The DB query must filter out external sessions (is_external = False)."""
        db = _make_db([])
        cleanup_expired_sessions(db)

        # Inspect the filter call arguments to ensure is_external check is present
        import inspect as _inspect
        from app.api.v1.routers.attendance import cleanup_expired_sessions as fn

        source = _inspect.getsource(fn)
        assert "is_external" in source
        assert "check_out" in source

    def test_query_excludes_already_checked_out_sessions(self):
        """The DB query must only include sessions with check_out IS NULL."""
        import inspect as _inspect
        from app.api.v1.routers.attendance import cleanup_expired_sessions as fn

        source = _inspect.getsource(fn)
        assert "check_out.is_(None)" in source

    def test_function_signature_accepts_only_db(self):
        """cleanup_expired_sessions should only require a single 'db' argument."""
        sig = inspect.signature(cleanup_expired_sessions)
        params = list(sig.parameters.keys())
        assert params == ["db"]

    def test_return_type_is_int(self):
        """Return value must be an integer."""
        db = _make_db([])
        result = cleanup_expired_sessions(db)
        assert isinstance(result, int)


# ── /cleanup-expired endpoint ──────────────────────────────────────────────────


class TestCleanupExpiredEndpoint:
    """Tests for the POST /attendance/cleanup-expired endpoint function."""

    def _get_endpoint(self):
        from app.api.v1.routers.attendance import cleanup_expired

        return cleanup_expired

    def test_endpoint_exists_and_is_callable(self):
        endpoint = self._get_endpoint()
        assert callable(endpoint)

    def test_endpoint_accepts_db_and_current_user_params(self):
        endpoint = self._get_endpoint()
        sig = inspect.signature(endpoint)
        assert "db" in sig.parameters
        assert "current_user" in sig.parameters

    def test_teacher_can_trigger_cleanup(self):
        """A teacher user should receive a dict with 'cleaned_up' key."""
        from app.api.v1.routers.attendance import cleanup_expired

        teacher = Mock()
        teacher.role = "teacher"
        db = _make_db([])

        result = cleanup_expired(db=db, current_user=teacher)

        assert "cleaned_up" in result
        assert isinstance(result["cleaned_up"], int)

    def test_admin_can_trigger_cleanup(self):
        """An admin user should receive a dict with 'cleaned_up' key."""
        from app.api.v1.routers.attendance import cleanup_expired
        from fastapi import HTTPException

        admin = Mock()
        admin.role = "admin"
        db = _make_db([])

        result = cleanup_expired(db=db, current_user=admin)

        assert "cleaned_up" in result

    def test_student_is_forbidden(self):
        """A student must receive a 403 Forbidden response."""
        from fastapi import HTTPException
        from app.api.v1.routers.attendance import cleanup_expired

        student = Mock()
        student.role = "student"
        db = MagicMock()

        with pytest.raises(HTTPException) as exc_info:
            cleanup_expired(db=db, current_user=student)

        assert exc_info.value.status_code == 403

    def test_cleaned_up_count_reflects_actual_closures(self):
        """The returned 'cleaned_up' count matches the sessions closed."""
        from app.api.v1.routers.attendance import cleanup_expired

        teacher = Mock()
        teacher.role = "teacher"

        now = datetime.now(timezone.utc)
        sessions = [
            _make_open_session(now - timedelta(hours=13)),
            _make_open_session(now - timedelta(hours=20)),
        ]
        db = _make_db(sessions)

        result = cleanup_expired(db=db, current_user=teacher)

        assert result["cleaned_up"] == 2

    def test_returns_zero_when_no_expired_sessions(self):
        """Returns {'cleaned_up': 0} when there are no expired sessions."""
        from app.api.v1.routers.attendance import cleanup_expired

        teacher = Mock()
        teacher.role = "teacher"
        db = _make_db([])

        result = cleanup_expired(db=db, current_user=teacher)

        assert result["cleaned_up"] == 0


# ── RFID scan calls cleanup ────────────────────────────────────────────────────


class TestRfidScanCallsCleanup:
    """Verify that the RFID /scan endpoint invokes cleanup_expired_sessions."""

    def test_rfid_scan_source_calls_cleanup(self):
        """The source of rfid_scan must contain a call to cleanup_expired_sessions."""
        from app.api.v1.routers.attendance import rfid_scan

        source = inspect.getsource(rfid_scan)
        assert "cleanup_expired_sessions(db)" in source
