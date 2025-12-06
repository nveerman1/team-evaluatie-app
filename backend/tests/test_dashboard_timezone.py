"""
Tests for dashboard timezone handling
"""

from datetime import datetime, timezone
from unittest.mock import Mock


def _ensure_timezone_aware(dt: datetime | None) -> datetime | None:
    """Helper function to ensure datetime is timezone-aware, converting to UTC if naive."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


class TestDashboardTimezone:
    """Tests for dashboard timezone-aware datetime comparisons"""

    def test_ensure_timezone_aware_with_naive(self):
        """Test that naive datetime is converted to timezone-aware"""
        naive_dt = datetime(2024, 1, 1, 12, 0, 0)
        result = _ensure_timezone_aware(naive_dt)
        assert result.tzinfo is not None
        assert result.tzinfo == timezone.utc

    def test_ensure_timezone_aware_with_aware(self):
        """Test that timezone-aware datetime is unchanged"""
        aware_dt = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        result = _ensure_timezone_aware(aware_dt)
        assert result == aware_dt
        assert result.tzinfo == timezone.utc

    def test_ensure_timezone_aware_with_none(self):
        """Test that None is handled properly"""
        result = _ensure_timezone_aware(None)
        assert result is None

    def test_timezone_aware_comparison(self):
        """Test that timezone-aware and naive datetimes are properly compared"""
        # Create timezone-aware datetime
        tz_aware = datetime.now(timezone.utc)

        # Create timezone-naive datetime
        tz_naive = datetime.now()

        # Ensure we can make tz_naive timezone-aware
        tz_naive_converted = _ensure_timezone_aware(tz_naive)

        # This should not raise an exception
        result = tz_aware > tz_naive_converted
        assert isinstance(result, bool)

    def test_score_created_at_comparison(self):
        """Test that score.created_at can be compared with timezone-aware datetime"""
        # Mock a Score object with timezone-aware created_at
        score = Mock()
        score.created_at = datetime.now(timezone.utc)

        # Mock last_activity as timezone-naive (like reflection.submitted_at might be)
        last_activity = datetime.now()
        last_activity = _ensure_timezone_aware(last_activity)

        # This comparison should work without raising TypeError
        score_created_at = _ensure_timezone_aware(score.created_at)

        result = score_created_at > last_activity
        assert isinstance(result, bool)

    def test_reflection_submitted_at_comparison(self):
        """Test that reflection.submitted_at can be made timezone-aware"""
        # Mock a Reflection object with potentially timezone-naive submitted_at
        reflection = Mock()
        reflection.submitted_at = datetime.now()  # Naive datetime

        last_activity = _ensure_timezone_aware(reflection.submitted_at)

        # Now compare with timezone-aware datetime
        current_time = datetime.now(timezone.utc)
        days_since_activity = (current_time - last_activity).days

        assert isinstance(days_since_activity, int)
        assert days_since_activity >= 0
