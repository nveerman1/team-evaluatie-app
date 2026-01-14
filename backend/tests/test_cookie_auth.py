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
