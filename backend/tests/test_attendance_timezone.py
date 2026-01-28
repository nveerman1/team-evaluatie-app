"""
Tests for timezone-aware datetime handling in attendance schemas and routers.

These tests verify that:
1. Schema validators handle mixed timezone-naive and timezone-aware datetimes
2. The ensure_aware_utc helper function works correctly
3. All validators properly compare datetimes regardless of timezone awareness
4. Partial updates are validated correctly
5. Edge cases (None, invalid types) are handled properly
"""

from datetime import datetime, timezone, timedelta
import pytest
from pydantic import ValidationError

from app.api.v1.schemas.attendance import (
    AttendanceEventCreate,
    AttendanceEventUpdate,
    ExternalWorkCreate,
    ensure_aware_utc,
)


class TestEnsureAwareUtc:
    """Tests for the ensure_aware_utc helper function"""

    def test_naive_datetime_becomes_utc_aware(self):
        """Naive datetime should be interpreted as UTC and made aware"""
        naive_dt = datetime(2024, 1, 15, 10, 30, 0)
        result = ensure_aware_utc(naive_dt)
        
        assert result.tzinfo is not None
        assert result.tzinfo == timezone.utc
        assert result.year == 2024
        assert result.month == 1
        assert result.day == 15
        assert result.hour == 10
        assert result.minute == 30

    def test_aware_utc_datetime_unchanged(self):
        """UTC-aware datetime should remain unchanged"""
        aware_dt = datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
        result = ensure_aware_utc(aware_dt)
        
        assert result == aware_dt
        assert result.tzinfo == timezone.utc

    def test_aware_non_utc_datetime_converted_to_utc(self):
        """Non-UTC aware datetime should be converted to UTC"""
        # Create a datetime in UTC+2
        utc_plus_2 = timezone(timedelta(hours=2))
        aware_dt = datetime(2024, 1, 15, 12, 30, 0, tzinfo=utc_plus_2)
        result = ensure_aware_utc(aware_dt)
        
        # Should be converted to UTC (10:30)
        assert result.tzinfo == timezone.utc
        assert result.hour == 10  # 12:30 UTC+2 = 10:30 UTC
        assert result.minute == 30
    
    def test_none_input_returns_none(self):
        """None input should return None"""
        result = ensure_aware_utc(None)
        assert result is None
    
    def test_invalid_type_raises_type_error(self):
        """Invalid input type should raise TypeError"""
        with pytest.raises(TypeError) as exc_info:
            ensure_aware_utc("2024-01-15 10:30:00")
        
        assert "Expected datetime or None" in str(exc_info.value)
        assert "got str" in str(exc_info.value)
    
    def test_integer_raises_type_error(self):
        """Integer input should raise TypeError"""
        with pytest.raises(TypeError) as exc_info:
            ensure_aware_utc(123456789)
        
        assert "Expected datetime or None" in str(exc_info.value)
        assert "got int" in str(exc_info.value)


class TestAttendanceEventCreateValidator:
    """Tests for AttendanceEventCreate check_out validator"""

    def test_valid_aware_datetimes(self):
        """Both timezone-aware datetimes should validate correctly"""
        check_in = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        check_out = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        
        event = AttendanceEventCreate(
            user_id=1,
            check_in=check_in,
            check_out=check_out,
            source="manual"
        )
        
        assert event.check_in == check_in
        assert event.check_out == check_out

    def test_valid_naive_datetimes(self):
        """Both naive datetimes should validate correctly"""
        check_in = datetime(2024, 1, 15, 10, 0, 0)
        check_out = datetime(2024, 1, 15, 12, 0, 0)
        
        event = AttendanceEventCreate(
            user_id=1,
            check_in=check_in,
            check_out=check_out,
            source="manual"
        )
        
        assert event.check_in == check_in
        assert event.check_out == check_out

    def test_mixed_aware_and_naive_datetimes(self):
        """Mixed timezone-aware and naive datetimes should validate correctly"""
        check_in = datetime(2024, 1, 15, 10, 0, 0)  # Naive
        check_out = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)  # Aware
        
        # Should NOT raise TypeError - our validator handles this
        event = AttendanceEventCreate(
            user_id=1,
            check_in=check_in,
            check_out=check_out,
            source="manual"
        )
        
        assert event.check_in == check_in
        assert event.check_out == check_out

    def test_check_out_before_check_in_raises_validation_error(self):
        """check_out before check_in should raise ValidationError, not TypeError"""
        check_in = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        check_out = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        
        with pytest.raises(ValidationError) as exc_info:
            AttendanceEventCreate(
                user_id=1,
                check_in=check_in,
                check_out=check_out,
                source="manual"
            )
        
        # Should raise ValidationError with our message, not TypeError
        assert "check_out must be after check_in" in str(exc_info.value)

    def test_check_out_equals_check_in_raises_validation_error(self):
        """check_out equal to check_in should raise ValidationError"""
        same_time = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        
        with pytest.raises(ValidationError) as exc_info:
            AttendanceEventCreate(
                user_id=1,
                check_in=same_time,
                check_out=same_time,
                source="manual"
            )
        
        assert "check_out must be after check_in" in str(exc_info.value)

    def test_none_check_out_is_valid(self):
        """check_out can be None (open session)"""
        check_in = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        
        event = AttendanceEventCreate(
            user_id=1,
            check_in=check_in,
            check_out=None,
            source="rfid"
        )
        
        assert event.check_out is None


class TestAttendanceEventUpdateValidator:
    """Tests for AttendanceEventUpdate check_out validator"""

    def test_valid_update_with_both_times(self):
        """Update with both check_in and check_out should validate"""
        check_in = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        check_out = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        
        update = AttendanceEventUpdate(
            check_in=check_in,
            check_out=check_out
        )
        
        assert update.check_in == check_in
        assert update.check_out == check_out

    def test_mixed_timezone_awareness_in_update(self):
        """Update with mixed timezone awareness should work"""
        check_in = datetime(2024, 1, 15, 10, 0, 0)  # Naive
        check_out = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)  # Aware
        
        update = AttendanceEventUpdate(
            check_in=check_in,
            check_out=check_out
        )
        
        assert update.check_in == check_in
        assert update.check_out == check_out

    def test_update_only_check_out(self):
        """Update with only check_out should work (check_in comes from info.data)"""
        check_out = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        
        update = AttendanceEventUpdate(check_out=check_out)
        
        assert update.check_out == check_out
        assert update.check_in is None  # Not provided in update

    def test_invalid_check_out_before_check_in(self):
        """Update with check_out before check_in should fail"""
        check_in = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        check_out = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        
        with pytest.raises(ValidationError) as exc_info:
            AttendanceEventUpdate(
                check_in=check_in,
                check_out=check_out
            )
        
        assert "check_out must be after check_in" in str(exc_info.value)


class TestExternalWorkCreateValidator:
    """Tests for ExternalWorkCreate check_out validator"""

    def test_valid_external_work_with_aware_datetimes(self):
        """External work with valid timezone-aware datetimes"""
        check_in = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        check_out = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        
        work = ExternalWorkCreate(
            check_in=check_in,
            check_out=check_out,
            location="Home",
            description="Working on project"
        )
        
        assert work.check_in == check_in
        assert work.check_out == check_out

    def test_valid_external_work_with_naive_datetimes(self):
        """External work with naive datetimes should work"""
        check_in = datetime(2024, 1, 15, 10, 0, 0)
        check_out = datetime(2024, 1, 15, 12, 0, 0)
        
        work = ExternalWorkCreate(
            check_in=check_in,
            check_out=check_out,
            location="Home",
            description="Working on project"
        )
        
        assert work.check_in == check_in
        assert work.check_out == check_out

    def test_mixed_timezone_external_work(self):
        """External work with mixed timezone awareness"""
        check_in = datetime(2024, 1, 15, 10, 0, 0)  # Naive
        check_out = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)  # Aware
        
        work = ExternalWorkCreate(
            check_in=check_in,
            check_out=check_out,
            location="Home",
            description="Working on project"
        )
        
        assert work.check_in == check_in
        assert work.check_out == check_out

    def test_invalid_end_time_before_start_time(self):
        """End time before start time should raise ValidationError"""
        check_in = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        check_out = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        
        with pytest.raises(ValidationError) as exc_info:
            ExternalWorkCreate(
                check_in=check_in,
                check_out=check_out,
                location="Home",
                description="Working on project"
            )
        
        assert "End time must be after start time" in str(exc_info.value)

    def test_invalid_same_start_and_end_time(self):
        """Same start and end time should raise ValidationError"""
        same_time = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        
        with pytest.raises(ValidationError) as exc_info:
            ExternalWorkCreate(
                check_in=same_time,
                check_out=same_time,
                location="Home",
                description="Working on project"
            )
        
        assert "End time must be after start time" in str(exc_info.value)


class TestTimezoneEdgeCases:
    """Tests for edge cases in timezone handling"""

    def test_different_timezone_awareness_same_actual_time(self):
        """Datetimes representing the same actual time but with different awareness"""
        # 10:00 UTC (naive)
        naive_utc = datetime(2024, 1, 15, 10, 0, 0)
        # 10:00 UTC (aware)
        aware_utc = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        
        # Both should be treated as equal by ensure_aware_utc
        naive_converted = ensure_aware_utc(naive_utc)
        aware_converted = ensure_aware_utc(aware_utc)
        
        assert naive_converted == aware_converted

    def test_validator_with_microseconds(self):
        """Datetimes with microseconds should work correctly"""
        check_in = datetime(2024, 1, 15, 10, 0, 0, 123456, tzinfo=timezone.utc)
        check_out = datetime(2024, 1, 15, 12, 0, 0, 654321, tzinfo=timezone.utc)
        
        event = AttendanceEventCreate(
            user_id=1,
            check_in=check_in,
            check_out=check_out,
            source="manual"
        )
        
        assert event.check_in.microsecond == 123456
        assert event.check_out.microsecond == 654321

    def test_very_close_times_different_timezone_awareness(self):
        """Times very close together with different timezone awareness"""
        check_in = datetime(2024, 1, 15, 10, 0, 0)  # Naive
        # 1 second later, but aware
        check_out = datetime(2024, 1, 15, 10, 0, 1, tzinfo=timezone.utc)
        
        event = AttendanceEventCreate(
            user_id=1,
            check_in=check_in,
            check_out=check_out,
            source="manual"
        )
        
        # Values are stored as-is, but comparison during validation works
        # We can't compare them directly after creation without normalization
        assert event.check_in == check_in
        assert event.check_out == check_out
        # But we can verify they were validated (no ValidationError was raised)
        assert event.user_id == 1


class TestPartialUpdates:
    """Tests for partial update scenarios with AttendanceEventUpdate"""
    
    def test_update_only_check_out_with_both_fields_present(self):
        """Update with both check_in and check_out validates correctly"""
        check_in = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        check_out = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        
        update = AttendanceEventUpdate(
            check_in=check_in,
            check_out=check_out
        )
        
        assert update.check_in == check_in
        assert update.check_out == check_out
    
    def test_update_only_check_out_field(self):
        """
        Update with only check_out does not validate against missing check_in.
        Backend endpoint must validate against DB value.
        """
        check_out = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        
        # Should succeed because check_in is not present in payload
        update = AttendanceEventUpdate(check_out=check_out)
        
        assert update.check_out == check_out
        assert update.check_in is None
    
    def test_update_only_check_in_field(self):
        """Update with only check_in should succeed (no check_out to validate)"""
        check_in = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        
        update = AttendanceEventUpdate(check_in=check_in)
        
        assert update.check_in == check_in
        assert update.check_out is None
    
    def test_update_with_invalid_times_when_both_present(self):
        """Update with check_out before check_in should fail when both present"""
        check_in = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        check_out = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        
        with pytest.raises(ValidationError) as exc_info:
            AttendanceEventUpdate(
                check_in=check_in,
                check_out=check_out
            )
        
        assert "check_out must be after check_in" in str(exc_info.value)
    
    def test_update_with_only_location_no_time_validation(self):
        """Update with only location should not trigger time validation"""
        update = AttendanceEventUpdate(location="New Location")
        
        assert update.location == "New Location"
        assert update.check_in is None
        assert update.check_out is None


class TestFieldOrderIndependence:
    """Tests that validators work regardless of field order in payload"""
    
    def test_check_out_before_check_in_in_dict(self):
        """Model validation should work regardless of dict key order"""
        # In Python 3.7+, dict order is preserved, but validator should not depend on it
        data = {
            "user_id": 1,
            "check_out": datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc),
            "check_in": datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc),
            "source": "manual"
        }
        
        event = AttendanceEventCreate(**data)
        assert event.check_in < event.check_out
    
    def test_check_in_before_check_out_in_dict(self):
        """Model validation should work with check_in first in dict"""
        data = {
            "user_id": 1,
            "check_in": datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc),
            "check_out": datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc),
            "source": "manual"
        }
        
        event = AttendanceEventCreate(**data)
        assert event.check_in < event.check_out
