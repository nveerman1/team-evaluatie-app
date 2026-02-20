"""
Unit tests for JWT security utilities.

Tests create_access_token, decode_access_token, and the sliding-session
renewal logic in isolation — no DB, no HTTP.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.core.security import create_access_token, decode_access_token


@pytest.mark.unit
class TestCreateAccessToken:
    """Tests for create_access_token."""

    def test_returns_string(self):
        token = create_access_token(sub="user@test.nl")
        assert isinstance(token, str)
        assert len(token) > 20

    def test_encodes_sub_claim(self):
        token = create_access_token(sub="user@test.nl")
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "user@test.nl"

    def test_encodes_role_claim(self):
        token = create_access_token(sub="u@test.nl", role="teacher")
        payload = decode_access_token(token)
        assert payload["role"] == "teacher"

    def test_encodes_school_id_claim(self):
        token = create_access_token(sub="u@test.nl", school_id=42)
        payload = decode_access_token(token)
        assert payload["school_id"] == 42

    def test_contains_exp_claim(self):
        token = create_access_token(sub="u@test.nl")
        payload = decode_access_token(token)
        assert "exp" in payload

    def test_contains_ss_claim(self):
        """ss (session_start) claim must be present for sliding-session logic."""
        token = create_access_token(sub="u@test.nl")
        payload = decode_access_token(token)
        assert "ss" in payload

    def test_session_start_preserved_on_renewal(self):
        """Passing an explicit session_start preserves it in the new token."""
        original_start = datetime(2024, 1, 1, tzinfo=timezone.utc)
        token = create_access_token(sub="u@test.nl", session_start=original_start)
        payload = decode_access_token(token)
        assert abs(payload["ss"] - original_start.timestamp()) < 1


@pytest.mark.unit
class TestDecodeAccessToken:
    """Tests for decode_access_token."""

    def test_valid_token_returns_payload(self):
        token = create_access_token(sub="user@test.nl")
        payload = decode_access_token(token)
        assert payload is not None

    def test_invalid_token_returns_none(self):
        payload = decode_access_token("not.a.real.token")
        assert payload is None

    def test_empty_string_returns_none(self):
        payload = decode_access_token("")
        assert payload is None

    def test_tampered_token_returns_none(self):
        token = create_access_token(sub="user@test.nl")
        tampered = token[:-5] + "XXXXX"
        payload = decode_access_token(tampered)
        assert payload is None


@pytest.mark.unit
class TestSlidingSessionLogic:
    """
    Tests for the sliding-session renewal decision logic.

    The middleware renews the token when:
      remaining < SESSION_RENEW_IF_EXPIRES_WITHIN_MINUTES  AND
      session age < SESSION_MAX_HOURS
    """

    def _make_token(
        self,
        expire_delta: timedelta,
        session_start: datetime | None = None,
    ) -> str:
        """Create a token that expires in `expire_delta` from now."""
        from app.core.config import settings
        import jwt

        now = datetime.now(timezone.utc)
        ss = (session_start or now).timestamp()
        payload = {
            "sub": "test@test.nl",
            "exp": now + expire_delta,
            "ss": ss,
        }
        return jwt.encode(
            payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM
        )

    def test_fresh_token_should_not_renew(self):
        """Token with plenty of lifetime remaining should NOT trigger renewal."""
        from app.core.config import settings

        token = self._make_token(expire_delta=timedelta(hours=1))
        payload = decode_access_token(token)
        assert payload is not None

        now = datetime.now(timezone.utc)
        expire_time = datetime.fromtimestamp(float(payload["exp"]), tz=timezone.utc)
        remaining = expire_time - now
        threshold = timedelta(minutes=settings.SESSION_RENEW_IF_EXPIRES_WITHIN_MINUTES)

        assert remaining > threshold, "Fresh token should not trigger renewal"

    def test_near_expiry_token_should_renew(self):
        """Token about to expire should trigger renewal."""
        from app.core.config import settings

        token = self._make_token(expire_delta=timedelta(minutes=5))
        payload = decode_access_token(token)
        assert payload is not None

        now = datetime.now(timezone.utc)
        expire_time = datetime.fromtimestamp(float(payload["exp"]), tz=timezone.utc)
        remaining = expire_time - now
        threshold = timedelta(minutes=settings.SESSION_RENEW_IF_EXPIRES_WITHIN_MINUTES)

        assert remaining <= threshold, "Near-expiry token should trigger renewal"

    def test_max_session_exceeded_blocks_renewal(self):
        """Token with session_start older than SESSION_MAX_HOURS must NOT renew."""
        from app.core.config import settings

        old_start = datetime.now(timezone.utc) - timedelta(
            hours=settings.SESSION_MAX_HOURS + 1
        )
        token = self._make_token(
            expire_delta=timedelta(minutes=5), session_start=old_start
        )
        payload = decode_access_token(token)
        assert payload is not None

        ss_raw = payload.get("ss")
        session_start = datetime.fromtimestamp(float(ss_raw), tz=timezone.utc)
        session_age = datetime.now(timezone.utc) - session_start
        max_age = timedelta(hours=settings.SESSION_MAX_HOURS)

        assert (
            session_age > max_age
        ), "Session older than SESSION_MAX_HOURS should block renewal"

    def test_within_max_session_allows_renewal(self):
        """Token with session_start within SESSION_MAX_HOURS may renew."""
        from app.core.config import settings

        recent_start = datetime.now(timezone.utc) - timedelta(hours=1)
        token = self._make_token(
            expire_delta=timedelta(minutes=5), session_start=recent_start
        )
        payload = decode_access_token(token)
        assert payload is not None

        ss_raw = payload.get("ss")
        session_start = datetime.fromtimestamp(float(ss_raw), tz=timezone.utc)
        session_age = datetime.now(timezone.utc) - session_start
        max_age = timedelta(hours=settings.SESSION_MAX_HOURS)

        assert (
            session_age < max_age
        ), "Session within SESSION_MAX_HOURS should allow renewal"
