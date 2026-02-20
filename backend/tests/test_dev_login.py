"""
Tests for dev-login endpoint and redirect validation
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.core.redirect_validator import (
    normalize_and_validate_return_to,
    validate_return_to,
    get_role_home_path,
)


@pytest.fixture
def client():
    """Create a test client"""
    return TestClient(app)


@pytest.fixture
def test_user():
    """Create a test teacher user object"""
    from app.infra.db.models import User

    user = User(
        id=1,
        email="teacher@example.com",
        name="Test Teacher",
        role="teacher",
        school_id=1,
        archived=False,
        auth_provider="azure_ad",
    )
    return user


@pytest.fixture
def test_student():
    """Create a test student user object"""
    from app.infra.db.models import User

    user = User(
        id=2,
        email="student@example.com",
        name="Test Student",
        role="student",
        school_id=1,
        archived=False,
        auth_provider="azure_ad",
    )
    return user


class TestRedirectValidator:
    """Test redirect URL validation to prevent open redirect attacks"""

    def test_normalize_and_validate_valid_paths(self):
        """Test that valid relative paths are accepted"""
        assert normalize_and_validate_return_to("/teacher") == "/teacher"
        assert (
            normalize_and_validate_return_to("/teacher/rubrics") == "/teacher/rubrics"
        )
        assert normalize_and_validate_return_to("/student") == "/student"
        assert (
            normalize_and_validate_return_to("/student/projects") == "/student/projects"
        )
        assert normalize_and_validate_return_to("/") == "/"

    def test_normalize_and_validate_url_encoded(self):
        """Test that URL-encoded paths are decoded and accepted"""
        # Single encoding
        assert normalize_and_validate_return_to("%2Fteacher") == "/teacher"
        assert normalize_and_validate_return_to("%2Fstudent") == "/student"
        assert (
            normalize_and_validate_return_to("%2Fteacher%2Frubrics")
            == "/teacher/rubrics"
        )

        # Double encoding
        assert normalize_and_validate_return_to("%252Fteacher") == "/teacher"
        assert normalize_and_validate_return_to("%252Fstudent") == "/student"

    def test_normalize_and_validate_with_query_params(self):
        """Test that paths with query params are accepted"""
        assert (
            normalize_and_validate_return_to("/teacher?tab=rubrics")
            == "/teacher?tab=rubrics"
        )
        assert (
            normalize_and_validate_return_to("/student/project/123?view=details")
            == "/student/project/123?view=details"
        )
        # URL-encoded query params
        assert (
            normalize_and_validate_return_to("%2Fteacher%3Ftab%3Drubrics")
            == "/teacher?tab=rubrics"
        )

    def test_normalize_and_validate_rejects_absolute_urls(self):
        """Test that absolute URLs are rejected"""
        assert normalize_and_validate_return_to("https://evil.com") is None
        assert normalize_and_validate_return_to("http://evil.com/phishing") is None
        assert normalize_and_validate_return_to("https://example.com/teacher") is None

    def test_normalize_and_validate_rejects_protocol_relative(self):
        """Test that protocol-relative URLs are rejected"""
        assert normalize_and_validate_return_to("//evil.com") is None
        assert normalize_and_validate_return_to("//evil.com/teacher") is None

    def test_normalize_and_validate_rejects_javascript(self):
        """Test that javascript: URLs are rejected"""
        assert normalize_and_validate_return_to("javascript:alert(1)") is None
        assert normalize_and_validate_return_to("javascript:void(0)") is None

    def test_normalize_and_validate_rejects_data_urls(self):
        """Test that data: URLs are rejected"""
        assert (
            normalize_and_validate_return_to("data:text/html,<script>alert(1)</script>")
            is None
        )

    def test_validate_return_to_valid_paths(self):
        """Test backward compatibility - validate_return_to delegates to normalize_and_validate_return_to"""
        assert validate_return_to("/teacher") == "/teacher"
        assert validate_return_to("/teacher/rubrics") == "/teacher/rubrics"
        assert validate_return_to("/student") == "/student"
        assert validate_return_to("/student/projects") == "/student/projects"
        assert validate_return_to("/") == "/"

    def test_validate_return_to_with_query_params(self):
        """Test that paths with query params are accepted"""
        assert validate_return_to("/teacher?tab=rubrics") == "/teacher?tab=rubrics"
        assert (
            validate_return_to("/student/project/123?view=details")
            == "/student/project/123?view=details"
        )

    def test_validate_return_to_rejects_absolute_urls(self):
        """Test that absolute URLs are rejected"""
        assert validate_return_to("https://evil.com") is None
        assert validate_return_to("http://evil.com/phishing") is None
        assert validate_return_to("https://example.com/teacher") is None

    def test_validate_return_to_rejects_protocol_relative(self):
        """Test that protocol-relative URLs are rejected"""
        assert validate_return_to("//evil.com") is None
        assert validate_return_to("//evil.com/teacher") is None

    def test_validate_return_to_rejects_javascript(self):
        """Test that javascript: URLs are rejected (contain ://)"""
        assert validate_return_to("javascript:alert(1)") is None

    def test_validate_return_to_none_and_empty(self):
        """Test that None and empty strings are handled"""
        assert validate_return_to(None) is None
        assert validate_return_to("") is None
        assert validate_return_to("   ") is None

    def test_validate_return_to_invalid_types(self):
        """Test that non-string types are rejected"""
        assert validate_return_to(123) is None
        assert validate_return_to(["/teacher"]) is None
        assert validate_return_to({"path": "/teacher"}) is None


class TestRoleHomePath:
    """Test role-based home path determination"""

    def test_get_role_home_path_admin(self):
        """Test admin role returns teacher home"""
        assert get_role_home_path("admin") == "/teacher"

    def test_get_role_home_path_teacher(self):
        """Test teacher role returns teacher home"""
        assert get_role_home_path("teacher") == "/teacher"

    def test_get_role_home_path_student(self):
        """Test student role returns student home"""
        assert get_role_home_path("student") == "/student"

    def test_get_role_home_path_unknown(self):
        """Test unknown role returns root"""
        assert get_role_home_path("unknown") == "/"
        assert get_role_home_path("") == "/"
        assert get_role_home_path(None) == "/"


@pytest.mark.usefixtures("client", "test_user", "test_student")
class TestDevLoginEndpoint:
    """Test dev-login endpoint behavior"""

    def test_dev_login_disabled_returns_404(self, client, test_user, monkeypatch):
        """Test that dev-login returns 404 when ENABLE_DEV_LOGIN=false"""
        from app.core.config import settings

        # Set ENABLE_DEV_LOGIN to False
        monkeypatch.setattr(settings, "ENABLE_DEV_LOGIN", False)

        # Mock database
        with patch("app.api.v1.routers.auth.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db
            mock_db.query.return_value.filter.return_value.first.return_value = (
                test_user
            )

            response = client.post(
                f"/api/v1/auth/dev-login?email={test_user.email}",
                follow_redirects=False,
            )

            # Should return 404, not 403 (don't leak endpoint existence)
            assert response.status_code == 404

    def test_dev_login_enabled_redirects(self, client, test_user, monkeypatch):
        """Test that dev-login redirects when enabled"""
        from app.core.config import settings

        # Set ENABLE_DEV_LOGIN to True
        monkeypatch.setattr(settings, "ENABLE_DEV_LOGIN", True)

        # Mock database
        with patch("app.api.v1.routers.auth.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db
            mock_db.query.return_value.filter.return_value.first.return_value = (
                test_user
            )

            response = client.post(
                f"/api/v1/auth/dev-login?email={test_user.email}",
                follow_redirects=False,
            )

            # Should redirect
            assert response.status_code in [302, 303, 307]

            # Should have set cookie
            assert "access_token" in response.cookies

    def test_dev_login_redirects_to_role_home(
        self, client, test_user, test_student, monkeypatch
    ):
        """Test that dev-login redirects to correct role home"""
        from app.core.config import settings

        monkeypatch.setattr(settings, "ENABLE_DEV_LOGIN", True)

        # Mock database
        with patch("app.api.v1.routers.auth.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db

            # Test teacher redirect
            mock_db.query.return_value.filter.return_value.first.return_value = (
                test_user
            )
            response = client.post(
                f"/api/v1/auth/dev-login?email={test_user.email}",
                follow_redirects=False,
            )
            assert "/teacher" in response.headers["location"]

            # Test student redirect
            mock_db.query.return_value.filter.return_value.first.return_value = (
                test_student
            )
            response = client.post(
                f"/api/v1/auth/dev-login?email={test_student.email}",
                follow_redirects=False,
            )
            assert "/student" in response.headers["location"]

    def test_dev_login_with_return_to(self, client, test_user, monkeypatch):
        """Test that dev-login respects returnTo parameter"""
        from app.core.config import settings

        monkeypatch.setattr(settings, "ENABLE_DEV_LOGIN", True)

        with patch("app.api.v1.routers.auth.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db
            mock_db.query.return_value.filter.return_value.first.return_value = (
                test_user
            )

            response = client.post(
                f"/api/v1/auth/dev-login?email={test_user.email}&return_to=/teacher/rubrics",
                follow_redirects=False,
            )

            # Should redirect to returnTo
            assert "/teacher/rubrics" in response.headers["location"]

    def test_dev_login_rejects_malicious_return_to(
        self, client, test_user, monkeypatch
    ):
        """Test that dev-login rejects malicious returnTo"""
        from app.core.config import settings

        monkeypatch.setattr(settings, "ENABLE_DEV_LOGIN", True)

        with patch("app.api.v1.routers.auth.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db
            mock_db.query.return_value.filter.return_value.first.return_value = (
                test_user
            )

            # Try with absolute URL
            response = client.post(
                f"/api/v1/auth/dev-login?email={test_user.email}&return_to=https://evil.com",
                follow_redirects=False,
            )

            # Should redirect to role home, not the malicious URL
            location = response.headers["location"]
            assert "evil.com" not in location
            assert "/teacher" in location

    def test_dev_login_nonexistent_user(self, client, monkeypatch):
        """Test dev-login with non-existent user"""
        from app.core.config import settings

        monkeypatch.setattr(settings, "ENABLE_DEV_LOGIN", True)

        with patch("app.api.v1.routers.auth.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db
            mock_db.query.return_value.filter.return_value.first.return_value = None

            response = client.post(
                "/api/v1/auth/dev-login?email=nonexistent@example.com",
                follow_redirects=False,
            )

            # Should return 401
            assert response.status_code == 401

    def test_dev_login_with_uppercase_email(self, client, test_user, monkeypatch):
        """Test that dev-login normalizes email case"""
        from app.core.config import settings

        monkeypatch.setattr(settings, "ENABLE_DEV_LOGIN", True)

        with patch("app.api.v1.routers.auth.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db

            # User stored with lowercase email
            test_user.email = "teacher@example.com"
            mock_db.query.return_value.filter.return_value.first.return_value = (
                test_user
            )

            # Login with uppercase email
            response = client.post(
                "/api/v1/auth/dev-login?email=TEACHER@EXAMPLE.COM",
                follow_redirects=False,
            )

            # Should succeed (find user with normalized email)
            assert response.status_code in [302, 303, 307]
            assert "access_token" in response.cookies

    def test_dev_login_with_mixed_case_email(self, client, test_user, monkeypatch):
        """Test that dev-login normalizes mixed-case email"""
        from app.core.config import settings

        monkeypatch.setattr(settings, "ENABLE_DEV_LOGIN", True)

        with patch("app.api.v1.routers.auth.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = mock_db

            # User stored with lowercase email
            test_user.email = "l316student@school.nl"
            mock_db.query.return_value.filter.return_value.first.return_value = (
                test_user
            )

            # Login with mixed-case email
            response = client.post(
                "/api/v1/auth/dev-login?email=L316Student@School.NL",
                follow_redirects=False,
            )

            # Should succeed (find user with normalized email)
            assert response.status_code in [302, 303, 307]
            assert "access_token" in response.cookies
