"""
Tests for cookie-based authentication.
"""

from __future__ import annotations
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from app.main import app
from app.core.security import create_access_token
from app.core.config import settings


@pytest.fixture
def client():
    """Create a test client"""
    return TestClient(app)


@pytest.fixture
def mock_db():
    """Mock database session"""
    return MagicMock()


@pytest.fixture
def test_user():
    """Create a test user object"""
    from app.infra.db.models import User

    user = User(
        id=1,
        email="test@example.com",
        name="Test User",
        role="teacher",
        school_id=1,
        archived=False,
        auth_provider="azure_ad",
    )
    return user


class TestCookieAuthentication:
    """Test cookie-based authentication flow."""

    def test_auth_me_with_valid_cookie(self, client, test_user, monkeypatch):
        """Test /auth/me endpoint with valid cookie"""
        # Set NODE_ENV to production to test cookie auth
        monkeypatch.setattr(settings, "NODE_ENV", "production")

        # Create a valid JWT token
        token = create_access_token(
            sub=test_user.email,
            role=test_user.role,
            school_id=test_user.school_id,
        )

        # Mock database to return the test user
        with patch("app.api.v1.deps.SessionLocal") as mock_session:
            mock_db = MagicMock()
            mock_session.return_value = mock_db
            mock_db.query.return_value.filter.return_value.first.return_value = (
                test_user
            )

            # Make request with cookie
            response = client.get("/api/v1/auth/me", cookies={"access_token": token})

            assert response.status_code == 200
            data = response.json()
            assert data["email"] == test_user.email
            assert data["role"] == test_user.role

    def test_auth_me_with_bearer_token(self, client, test_user, monkeypatch):
        """Test /auth/me endpoint with bearer token (fallback)"""
        # Set NODE_ENV to production
        monkeypatch.setattr(settings, "NODE_ENV", "production")

        # Create a valid JWT token
        token = create_access_token(
            sub=test_user.email,
            role=test_user.role,
            school_id=test_user.school_id,
        )

        # Mock database to return the test user
        with patch("app.api.v1.deps.SessionLocal") as mock_session:
            mock_db = MagicMock()
            mock_session.return_value = mock_db
            mock_db.query.return_value.filter.return_value.first.return_value = (
                test_user
            )

            # Make request with Authorization header
            response = client.get(
                "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["email"] == test_user.email

    def test_auth_me_without_authentication(self, client, monkeypatch):
        """Test /auth/me endpoint without any authentication"""
        # Set NODE_ENV to production
        monkeypatch.setattr(settings, "NODE_ENV", "production")

        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401
        assert "not authenticated" in response.json()["detail"].lower()

    def test_auth_me_with_invalid_token(self, client, monkeypatch):
        """Test /auth/me endpoint with invalid token"""
        # Set NODE_ENV to production
        monkeypatch.setattr(settings, "NODE_ENV", "production")

        response = client.get(
            "/api/v1/auth/me", cookies={"access_token": "invalid-token"}
        )
        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()

    def test_auth_me_with_expired_token_returns_401_session_expired(
        self, client, test_user, monkeypatch
    ):
        """Expired JWT token returns HTTP 401 with 'Session expired' detail."""
        import jwt
        from datetime import datetime, timedelta, timezone

        # Production mode is required to use cookie/bearer-only auth.
        # In development mode the X-User-Email header could bypass token validation.
        monkeypatch.setattr(settings, "NODE_ENV", "production")

        # Create a token that is already expired (exp in the past)
        expired_payload = {
            "sub": test_user.email,
            "role": test_user.role,
            "school_id": test_user.school_id,
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
        }
        expired_token = jwt.encode(
            expired_payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM
        )

        response = client.get(
            "/api/v1/auth/me", cookies={"access_token": expired_token}
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Session expired"

    def test_auth_me_with_inactive_user(self, client, test_user, monkeypatch):
        """Test /auth/me endpoint with archived user"""
        # Set NODE_ENV to production
        monkeypatch.setattr(settings, "NODE_ENV", "production")

        # Make user archived
        test_user.archived = True

        # Create a valid JWT token
        token = create_access_token(
            sub=test_user.email,
            role=test_user.role,
            school_id=test_user.school_id,
        )

        # Mock database to return the archived user
        with patch("app.api.v1.deps.SessionLocal") as mock_session:
            mock_db = MagicMock()
            mock_session.return_value = mock_db
            mock_db.query.return_value.filter.return_value.first.return_value = (
                test_user
            )

            # Make request with cookie
            response = client.get("/api/v1/auth/me", cookies={"access_token": token})

            assert response.status_code == 403
            assert "archived" in response.json()["detail"].lower()


class TestLogoutEndpoint:
    """Test logout endpoint."""

    def test_logout_clears_cookie(self, client):
        """Test that logout endpoint clears the cookie"""
        response = client.post("/api/v1/auth/logout")

        assert response.status_code == 200
        assert response.json()["message"] == "Successfully logged out"

        # Check that Set-Cookie header is present
        set_cookie_header = response.headers.get("set-cookie")
        assert set_cookie_header is not None
        assert "access_token=" in set_cookie_header
        assert "Max-Age=0" in set_cookie_header or "max-age=0" in set_cookie_header


class TestAzureCallbackCookie:
    """Test Azure AD callback with cookie setting."""

    @pytest.mark.skip(reason="Requires database setup - integration test")
    @patch("app.infra.db.session.SessionLocal")
    @patch("app.api.v1.routers.auth.azure_ad_authenticator")
    def test_azure_callback_sets_cookie(
        self, mock_authenticator, mock_session_local, client, test_user
    ):
        """Test that Azure callback sets HttpOnly cookie and redirects"""
        # Mock Azure AD authenticator
        mock_authenticator.enabled = True
        mock_authenticator.acquire_token_by_auth_code.return_value = {
            "access_token": "mock-azure-token"
        }
        mock_authenticator.get_user_profile.return_value = {
            "mail": test_user.email,
            "displayName": test_user.name,
        }
        mock_authenticator.provision_or_update_user.return_value = test_user

        # Mock database session
        mock_db = MagicMock()
        mock_session_local.return_value = mock_db

        # Mock school lookup
        from app.infra.db.models import School

        mock_school = School(id=1, name="Test School")
        mock_db.query.return_value.filter.return_value.first.return_value = mock_school

        # Make callback request
        response = client.get(
            "/api/v1/auth/azure/callback?code=test-code&state=1:test-state",
            follow_redirects=False,
        )

        # Should redirect
        assert response.status_code == 302

        # Should have redirect location
        assert "location" in response.headers
        redirect_url = response.headers["location"]
        assert settings.FRONTEND_URL in redirect_url
        assert "/auth/callback" in redirect_url

        # Check that Set-Cookie header is present
        set_cookie_header = response.headers.get("set-cookie")
        assert set_cookie_header is not None
        assert "access_token=" in set_cookie_header
        assert "HttpOnly" in set_cookie_header
        assert "SameSite" in set_cookie_header or "samesite" in set_cookie_header
        assert "Path=/" in set_cookie_header or "path=/" in set_cookie_header


class TestDevLoginProduction:
    """Test dev-login is blocked in production."""

    def test_dev_login_blocked_in_production(self, client, monkeypatch):
        """Test that X-User-Email header is ignored in production"""
        # Set NODE_ENV to production
        monkeypatch.setattr(settings, "NODE_ENV", "production")

        # Try to access with X-User-Email header
        response = client.get(
            "/api/v1/auth/me", headers={"X-User-Email": "test@example.com"}
        )

        # Should fail authentication
        assert response.status_code == 401

    def test_dev_login_works_in_development(self, client, test_user, monkeypatch):
        """Test that X-User-Email header works in development"""
        # Set NODE_ENV to development
        monkeypatch.setattr(settings, "NODE_ENV", "development")

        # Mock database to return the test user
        with patch("app.api.v1.deps.SessionLocal") as mock_session:
            mock_db = MagicMock()
            mock_session.return_value = mock_db
            mock_db.query.return_value.filter.return_value.first.return_value = (
                test_user
            )

            # Try to access with X-User-Email header
            response = client.get(
                "/api/v1/auth/me", headers={"X-User-Email": test_user.email}
            )

            # Should succeed
            assert response.status_code == 200
            data = response.json()
            assert data["email"] == test_user.email


class TestSchoolIDValidation:
    """Test school_id validation in JWT tokens."""

    def test_school_id_mismatch_rejected(self, client, test_user, monkeypatch):
        """Test that mismatched school_id is rejected"""
        # Set NODE_ENV to production
        monkeypatch.setattr(settings, "NODE_ENV", "production")

        # Create token with different school_id
        token = create_access_token(
            sub=test_user.email,
            role=test_user.role,
            school_id=999,  # Different from user's school_id (1)
        )

        # Mock database to return the test user
        with patch("app.api.v1.deps.SessionLocal") as mock_session:
            mock_db = MagicMock()
            mock_session.return_value = mock_db
            mock_db.query.return_value.filter.return_value.first.return_value = (
                test_user
            )

            # Make request with cookie
            response = client.get("/api/v1/auth/me", cookies={"access_token": token})

            assert response.status_code == 403
            assert "school" in response.json()["detail"].lower()

    def test_token_without_school_id_allowed(self, client, test_user, monkeypatch):
        """Test that tokens without school_id claim are allowed"""
        # Set NODE_ENV to production
        monkeypatch.setattr(settings, "NODE_ENV", "production")

        # Create token without school_id
        token = create_access_token(
            sub=test_user.email,
            role=test_user.role,
        )

        # Mock database to return the test user
        with patch("app.api.v1.deps.SessionLocal") as mock_session:
            mock_db = MagicMock()
            mock_session.return_value = mock_db
            mock_db.query.return_value.filter.return_value.first.return_value = (
                test_user
            )

            # Make request with cookie
            response = client.get("/api/v1/auth/me", cookies={"access_token": token})

            # Should succeed - no school_id validation if not in token
            assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])


class TestSlidingSession:
    """Test sliding session token renewal."""

    def test_token_renewed_when_near_expiry(self, client, test_user, monkeypatch):
        """When the token is within SESSION_RENEW_IF_EXPIRES_WITHIN_MINUTES, the
        middleware should set a fresh access_token cookie on the response."""
        import jwt as pyjwt
        from datetime import datetime, timedelta, timezone

        # Make threshold very short (1 min) and create a token whose remaining
        # lifetime is less than that threshold (i.e., 30 seconds).
        monkeypatch.setattr(settings, "SESSION_RENEW_IF_EXPIRES_WITHIN_MINUTES", 1)

        now = datetime.now(timezone.utc)
        near_expiry_payload = {
            "sub": test_user.email,
            "role": test_user.role,
            "school_id": test_user.school_id,
            # Expires 30 seconds from now — within the 1-minute threshold
            "exp": now + timedelta(seconds=30),
            "ss": now.timestamp(),
        }
        near_expiry_token = pyjwt.encode(
            near_expiry_payload,
            settings.SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )

        with patch("app.api.v1.deps.SessionLocal") as mock_session:
            mock_db = MagicMock()
            mock_session.return_value = mock_db
            mock_db.query.return_value.filter.return_value.first.return_value = (
                test_user
            )

            response = client.get(
                "/api/v1/auth/me",
                cookies={"access_token": near_expiry_token},
            )

        assert response.status_code == 200

        # The middleware must have set a new Set-Cookie header
        set_cookie = response.headers.get("set-cookie", "")
        assert "access_token=" in set_cookie
        assert "HttpOnly" in set_cookie

        # The new token must be different from the old (fresh expiry)
        new_token = set_cookie.split("access_token=")[1].split(";")[0].strip()
        assert new_token != near_expiry_token

        # The new token should be valid and decode correctly
        new_payload = pyjwt.decode(
            new_token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        assert new_payload["sub"] == test_user.email
        # session_start (ss) must be preserved across renewal
        assert abs(new_payload["ss"] - near_expiry_payload["ss"]) < 2

    def test_token_not_renewed_when_fresh(self, client, test_user, monkeypatch):
        """A token with plenty of lifetime left should NOT be renewed."""
        monkeypatch.setattr(settings, "SESSION_RENEW_IF_EXPIRES_WITHIN_MINUTES", 15)

        # Fresh token — has ACCESS_TOKEN_EXPIRE_MINUTES (default 60) of lifetime
        fresh_token = create_access_token(
            sub=test_user.email,
            role=test_user.role,
            school_id=test_user.school_id,
        )

        with patch("app.api.v1.deps.SessionLocal") as mock_session:
            mock_db = MagicMock()
            mock_session.return_value = mock_db
            mock_db.query.return_value.filter.return_value.first.return_value = (
                test_user
            )

            response = client.get(
                "/api/v1/auth/me",
                cookies={"access_token": fresh_token},
            )

        assert response.status_code == 200

        # No Set-Cookie renewal header expected for a fresh token
        set_cookie = response.headers.get("set-cookie", "")
        assert "access_token=" not in set_cookie

    def test_no_renewal_on_401_response(self, client, monkeypatch):
        """Error responses must not trigger token renewal."""
        monkeypatch.setattr(settings, "SESSION_RENEW_IF_EXPIRES_WITHIN_MINUTES", 1)

        # Invalid token — will produce a 401
        response = client.get(
            "/api/v1/auth/me",
            cookies={"access_token": "invalid-token"},
        )

        assert response.status_code == 401

        set_cookie = response.headers.get("set-cookie", "")
        assert "access_token=" not in set_cookie

    def test_token_not_renewed_when_max_session_exceeded(
        self, client, test_user, monkeypatch
    ):
        """Token is NOT renewed once SESSION_MAX_HOURS has elapsed since session start."""
        import jwt as pyjwt
        from datetime import datetime, timedelta, timezone

        monkeypatch.setattr(settings, "SESSION_RENEW_IF_EXPIRES_WITHIN_MINUTES", 1)
        monkeypatch.setattr(settings, "SESSION_MAX_HOURS", 1)

        now = datetime.now(timezone.utc)
        # Session started 2 hours ago — exceeds the 1-hour max
        session_start_old = now - timedelta(hours=2)

        near_expiry_old_session_payload = {
            "sub": test_user.email,
            "role": test_user.role,
            "school_id": test_user.school_id,
            "exp": now + timedelta(seconds=30),
            "ss": session_start_old.timestamp(),
        }
        old_session_token = pyjwt.encode(
            near_expiry_old_session_payload,
            settings.SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )

        with patch("app.api.v1.deps.SessionLocal") as mock_session:
            mock_db = MagicMock()
            mock_session.return_value = mock_db
            mock_db.query.return_value.filter.return_value.first.return_value = (
                test_user
            )

            response = client.get(
                "/api/v1/auth/me",
                cookies={"access_token": old_session_token},
            )

        assert response.status_code == 200

        # Middleware must NOT renew when session has exceeded max age
        set_cookie = response.headers.get("set-cookie", "")
        assert "access_token=" not in set_cookie
