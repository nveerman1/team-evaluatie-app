"""
Tests for the 5-hour cap on external work registrations (ExternalWorkCreate).

Covers:
1. Registration exactly at the limit (5 h) is accepted.
2. Registration just under the limit is accepted.
3. Registration just over the limit raises ValidationError.
4. Registration far over the limit raises ValidationError.
5. The error message mentions the maximum number of hours.
6. The MAX_EXTERNAL_HOURS constant equals 5.
7. Mixed timezone-aware and naive datetimes are handled correctly.
8. The existing "end time before start time" validation still works.
9. The check_out == check_in (zero-duration) case still raises an error.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from app.api.v1.schemas.attendance import (
    MAX_EXTERNAL_HOURS,
    ExternalWorkCreate,
)

# ── Constants ──────────────────────────────────────────────────────────────────


class TestMaxExternalHoursConstant:
    """Verify the constant is set to 5 as required."""

    def test_max_external_hours_equals_5(self):
        assert MAX_EXTERNAL_HOURS == 5


# ── Duration cap validation ────────────────────────────────────────────────────

BASE_CHECKIN = datetime(2024, 3, 15, 9, 0, 0, tzinfo=timezone.utc)
VALID_KWARGS = {
    "location": "Thuis",
    "description": "Projectwerk",
}


class TestExternalWorkMaxHoursValidation:
    """Tests for the new 5-hour duration cap in ExternalWorkCreate."""

    # ── Accepted cases ─────────────────────────────────────────────────────

    def test_accepts_registration_of_exactly_5_hours(self):
        """A registration of exactly 5 hours must be accepted."""
        work = ExternalWorkCreate(
            check_in=BASE_CHECKIN,
            check_out=BASE_CHECKIN + timedelta(hours=5),
            **VALID_KWARGS,
        )
        duration = (work.check_out - work.check_in).total_seconds()
        assert duration == 5 * 3600

    def test_accepts_registration_just_under_5_hours(self):
        """A registration of 4 h 59 m 59 s must be accepted."""
        work = ExternalWorkCreate(
            check_in=BASE_CHECKIN,
            check_out=BASE_CHECKIN + timedelta(hours=4, minutes=59, seconds=59),
            **VALID_KWARGS,
        )
        assert work.check_out is not None

    def test_accepts_short_registration(self):
        """A 30-minute registration must be accepted."""
        work = ExternalWorkCreate(
            check_in=BASE_CHECKIN,
            check_out=BASE_CHECKIN + timedelta(minutes=30),
            **VALID_KWARGS,
        )
        assert work.check_out is not None

    def test_accepts_1_hour_registration(self):
        """A 1-hour registration must be accepted."""
        work = ExternalWorkCreate(
            check_in=BASE_CHECKIN,
            check_out=BASE_CHECKIN + timedelta(hours=1),
            **VALID_KWARGS,
        )
        assert work.check_out is not None

    # ── Rejected cases ─────────────────────────────────────────────────────

    def test_rejects_registration_of_5_hours_1_second(self):
        """A registration of 5 h + 1 s must be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ExternalWorkCreate(
                check_in=BASE_CHECKIN,
                check_out=BASE_CHECKIN + timedelta(hours=5, seconds=1),
                **VALID_KWARGS,
            )
        assert str(MAX_EXTERNAL_HOURS) in str(exc_info.value)

    def test_rejects_registration_of_6_hours(self):
        """A registration of 6 hours must be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ExternalWorkCreate(
                check_in=BASE_CHECKIN,
                check_out=BASE_CHECKIN + timedelta(hours=6),
                **VALID_KWARGS,
            )
        assert str(MAX_EXTERNAL_HOURS) in str(exc_info.value)

    def test_rejects_registration_of_24_hours(self):
        """A full-day registration must be rejected."""
        with pytest.raises(ValidationError):
            ExternalWorkCreate(
                check_in=BASE_CHECKIN,
                check_out=BASE_CHECKIN + timedelta(hours=24),
                **VALID_KWARGS,
            )

    def test_error_message_mentions_max_hours(self):
        """The validation error message must mention MAX_EXTERNAL_HOURS."""
        with pytest.raises(ValidationError) as exc_info:
            ExternalWorkCreate(
                check_in=BASE_CHECKIN,
                check_out=BASE_CHECKIN + timedelta(hours=6),
                **VALID_KWARGS,
            )
        error_text = str(exc_info.value)
        assert str(MAX_EXTERNAL_HOURS) in error_text

    # ── Timezone handling ───────────────────────────────────────────────────

    def test_accepts_5_hours_with_naive_datetimes(self):
        """Exactly 5 hours with naive datetimes (treated as UTC) must be accepted."""
        naive_in = datetime(2024, 3, 15, 9, 0, 0)  # naive
        work = ExternalWorkCreate(
            check_in=naive_in,
            check_out=naive_in + timedelta(hours=5),
            **VALID_KWARGS,
        )
        assert work.check_in == naive_in

    def test_rejects_6_hours_with_naive_datetimes(self):
        """6 hours with naive datetimes (treated as UTC) must be rejected."""
        naive_in = datetime(2024, 3, 15, 9, 0, 0)  # naive
        with pytest.raises(ValidationError):
            ExternalWorkCreate(
                check_in=naive_in,
                check_out=naive_in + timedelta(hours=6),
                **VALID_KWARGS,
            )

    def test_accepts_5_hours_with_mixed_timezone_awareness(self):
        """Exactly 5 h with mixed naive/aware datetimes must be accepted."""
        naive_in = datetime(2024, 3, 15, 9, 0, 0)  # naive (interpreted as UTC)
        aware_out = datetime(2024, 3, 15, 14, 0, 0, tzinfo=timezone.utc)  # 5 h later

        work = ExternalWorkCreate(
            check_in=naive_in,
            check_out=aware_out,
            **VALID_KWARGS,
        )
        assert work.check_out == aware_out

    def test_rejects_over_5_hours_with_mixed_timezone_awareness(self):
        """More than 5 h with mixed naive/aware datetimes must be rejected."""
        naive_in = datetime(2024, 3, 15, 9, 0, 0)  # naive (UTC)
        aware_out = datetime(2024, 3, 15, 15, 0, 0, tzinfo=timezone.utc)  # 6 h later

        with pytest.raises(ValidationError):
            ExternalWorkCreate(
                check_in=naive_in,
                check_out=aware_out,
                **VALID_KWARGS,
            )

    # ── Pre-existing validation still works ────────────────────────────────

    def test_still_rejects_end_time_before_start_time(self):
        """The original 'end before start' validation must still raise an error."""
        with pytest.raises(ValidationError) as exc_info:
            ExternalWorkCreate(
                check_in=BASE_CHECKIN,
                check_out=BASE_CHECKIN - timedelta(hours=1),
                **VALID_KWARGS,
            )
        assert "End time must be after start time" in str(exc_info.value)

    def test_still_rejects_equal_start_and_end_time(self):
        """The original 'same time' validation must still raise an error."""
        with pytest.raises(ValidationError) as exc_info:
            ExternalWorkCreate(
                check_in=BASE_CHECKIN,
                check_out=BASE_CHECKIN,
                **VALID_KWARGS,
            )
        assert "End time must be after start time" in str(exc_info.value)

    def test_optional_project_id_does_not_affect_duration_check(self):
        """Including a project_id must not bypass the 5-hour validation."""
        with pytest.raises(ValidationError):
            ExternalWorkCreate(
                check_in=BASE_CHECKIN,
                check_out=BASE_CHECKIN + timedelta(hours=6),
                project_id=42,
                **VALID_KWARGS,
            )
