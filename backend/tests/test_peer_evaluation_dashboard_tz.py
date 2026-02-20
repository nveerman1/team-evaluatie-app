"""
Tests for the peer evaluation dashboard timezone-handling fix.

Regression test for: https://github.com/nveerman1/team-evaluatie-app/issues
Bug: get_peer_evaluation_dashboard raised
     TypeError: can't compare offset-naive and offset-aware datetimes
when sorting evaluations because closed_at (timezone-naive) was mixed
with created_at (timezone-aware, from the Base model default).
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import Mock, patch, MagicMock
from collections import defaultdict

from app.infra.db.models import User


class TestPeerEvaluationDashboardTimezone:
    """Regression tests for timezone-aware vs timezone-naive datetime sorting."""

    def _make_evaluation(self, eval_id, closed_at=None, created_at=None, project_id=1):
        """Create a mock Evaluation with the specified datetime values."""
        ev = Mock()
        ev.id = eval_id
        ev.closed_at = closed_at
        ev.created_at = created_at
        ev.project_id = project_id
        ev.settings = {}
        ev.status = "closed"
        ev.rubric_id = 1
        ev.course_id = 1
        ev.school_id = 1
        return ev

    def test_sort_key_handles_naive_closed_at(self):
        """sort key .replace(tzinfo=None) works for timezone-naive closed_at."""
        naive_dt = datetime(2024, 9, 15, 10, 0, 0)  # no tzinfo → naive
        assert naive_dt.tzinfo is None
        result = naive_dt.replace(tzinfo=None)
        assert result == naive_dt

    def test_sort_key_handles_aware_created_at(self):
        """sort key .replace(tzinfo=None) works for timezone-aware created_at."""
        aware_dt = datetime(2024, 9, 15, 10, 0, 0, tzinfo=timezone.utc)
        assert aware_dt.tzinfo is not None
        result = aware_dt.replace(tzinfo=None)
        assert result.tzinfo is None
        assert result == datetime(2024, 9, 15, 10, 0, 0)

    def test_mixed_tz_sort_raises_without_fix(self):
        """
        Demonstrate that sorting naive and aware datetimes raises TypeError
        (the original bug).
        """
        naive_dt = datetime(2024, 9, 1, 10, 0, 0)
        aware_dt = datetime(2024, 10, 1, 10, 0, 0, tzinfo=timezone.utc)
        dates = [aware_dt, naive_dt]

        with pytest.raises(TypeError, match="offset-naive"):
            sorted(dates)

    def test_mixed_tz_sort_works_with_replace_fix(self):
        """
        Demonstrate that the fix (replace(tzinfo=None)) correctly sorts
        mixed naive/aware datetimes without raising TypeError.
        """
        naive_dt = datetime(2024, 9, 1, 10, 0, 0)
        aware_dt = datetime(2024, 10, 1, 10, 0, 0, tzinfo=timezone.utc)

        # Simulate what our evaluations look like:
        # e1 has closed_at (naive), e2 has only created_at (aware)
        e1 = Mock()
        e1.closed_at = naive_dt  # timezone-naive
        e1.created_at = datetime(2024, 9, 1, 8, 0, 0, tzinfo=timezone.utc)

        e2 = Mock()
        e2.closed_at = None  # not closed yet
        e2.created_at = aware_dt  # timezone-aware

        # Fixed sort key: always strip tzinfo before comparison
        sorted_evals = sorted(
            [e for e in [e1, e2] if e.closed_at or e.created_at],
            key=lambda e: (e.closed_at or e.created_at).replace(tzinfo=None),
        )

        # e1's key = naive_dt (2024-09-01) < e2's key = 2024-10-01
        assert sorted_evals[0] is e1
        assert sorted_evals[1] is e2

    def test_mixed_tz_max_works_with_replace_fix(self):
        """
        Demonstrate that the fix (replace(tzinfo=None)) correctly finds max
        from mixed naive/aware datetimes without raising TypeError.
        """
        e1 = Mock()
        e1.closed_at = datetime(2024, 9, 1, 10, 0, 0)  # naive
        e1.created_at = datetime(2024, 9, 1, 8, 0, 0, tzinfo=timezone.utc)

        e2 = Mock()
        e2.closed_at = None
        e2.created_at = datetime(2024, 10, 1, 10, 0, 0, tzinfo=timezone.utc)  # aware

        most_recent = max(
            [e1, e2],
            key=lambda e: (e.closed_at or e.created_at).replace(tzinfo=None),
        )

        # e2's effective date (2024-10-01) > e1's (2024-09-01)
        assert most_recent is e2
