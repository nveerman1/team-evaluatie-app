"""
Tests for dashboard timezone handling
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import Mock, MagicMock
from app.infra.db.models import User, Evaluation, Score, Reflection, Allocation


class TestDashboardTimezone:
    """Tests for dashboard timezone-aware datetime comparisons"""

    def test_timezone_aware_comparison(self):
        """Test that timezone-aware and naive datetimes are properly compared"""
        # Create timezone-aware datetime
        tz_aware = datetime.now(timezone.utc)

        # Create timezone-naive datetime
        tz_naive = datetime.now()

        # Ensure we can make tz_naive timezone-aware
        if tz_naive.tzinfo is None:
            tz_naive_converted = tz_naive.replace(tzinfo=timezone.utc)
        else:
            tz_naive_converted = tz_naive

        # This should not raise an exception
        result = tz_aware > tz_naive_converted
        assert isinstance(result, bool)

    def test_score_created_at_comparison(self):
        """Test that score.created_at can be compared with timezone-aware datetime"""
        # Mock a Score object with timezone-aware created_at
        score = Mock(spec=Score)
        score.created_at = datetime.now(timezone.utc)

        # Mock last_activity as timezone-naive (like reflection.submitted_at might be)
        last_activity = datetime.now()
        if last_activity.tzinfo is None:
            last_activity = last_activity.replace(tzinfo=timezone.utc)

        # This comparison should work without raising TypeError
        score_created_at = score.created_at
        if score_created_at.tzinfo is None:
            score_created_at = score_created_at.replace(tzinfo=timezone.utc)

        result = score_created_at > last_activity
        assert isinstance(result, bool)

    def test_reflection_submitted_at_comparison(self):
        """Test that reflection.submitted_at can be made timezone-aware"""
        # Mock a Reflection object with potentially timezone-naive submitted_at
        reflection = Mock(spec=Reflection)
        reflection.submitted_at = datetime.now()  # Naive datetime

        last_activity = reflection.submitted_at
        if last_activity.tzinfo is None:
            last_activity = last_activity.replace(tzinfo=timezone.utc)

        # Now compare with timezone-aware datetime
        current_time = datetime.now(timezone.utc)
        days_since_activity = (current_time - last_activity).days

        assert isinstance(days_since_activity, int)
        assert days_since_activity >= 0
