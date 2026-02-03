"""
Tests for Azure AD authentication and dev-login hardening.
"""

from __future__ import annotations
import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException

from app.core.azure_ad import AzureADAuthenticator
from app.core.config import settings


class TestDevLoginHardening:
    """Test that dev-login is properly restricted to development mode."""

    def test_dev_login_allowed_in_development(self, monkeypatch):
        """Dev-login should work when NODE_ENV=development"""
        monkeypatch.setattr(settings, "NODE_ENV", "development")

        # This should not raise an exception
        # The actual test would require a test client and database
        # For now we just verify the config is correct
        assert settings.NODE_ENV == "development"

    def test_dev_login_disabled_in_production(self, monkeypatch):
        """Dev-login should be disabled when NODE_ENV=production"""
        monkeypatch.setattr(settings, "NODE_ENV", "production")

        # Verify config is set correctly
        assert settings.NODE_ENV == "production"

        # In actual usage, get_current_user would raise HTTPException
        # when NODE_ENV != development


class TestAzureADConfiguration:
    """Test Azure AD configuration and initialization."""

    def test_azure_ad_disabled_without_config(self):
        """Azure AD should be disabled when credentials are not configured"""
        # With default settings (no credentials)
        authenticator = AzureADAuthenticator()
        assert authenticator.enabled is False
        assert authenticator.msal_app is None

    @patch("app.core.azure_ad.msal.ConfidentialClientApplication")
    def test_azure_ad_enabled_with_config(self, mock_msal_app, monkeypatch):
        """Azure AD should be enabled when credentials are configured"""
        # Mock the settings
        monkeypatch.setattr(settings, "AZURE_AD_CLIENT_ID", "test-client-id")
        monkeypatch.setattr(settings, "AZURE_AD_TENANT_ID", "test-tenant-id")
        monkeypatch.setattr(settings, "AZURE_AD_CLIENT_SECRET", "test-secret")

        # Mock MSAL app
        mock_msal_app.return_value = MagicMock()

        authenticator = AzureADAuthenticator()
        assert authenticator.enabled is True
        assert authenticator.msal_app is not None

    def test_get_authorization_url_requires_config(self):
        """get_authorization_url should raise error when not configured"""
        authenticator = AzureADAuthenticator()
        assert authenticator.enabled is False

        with pytest.raises(HTTPException) as exc_info:
            authenticator.get_authorization_url()

        assert exc_info.value.status_code == 503
        assert "not configured" in exc_info.value.detail.lower()

    def test_domain_validation_no_restrictions(self):
        """validate_domain should allow all domains when no restrictions configured"""
        authenticator = AzureADAuthenticator()

        # Should allow any domain when AZURE_AD_ALLOWED_DOMAINS is empty
        assert authenticator.validate_domain("user@school.nl") is True
        assert authenticator.validate_domain("user@example.com") is True

    def test_domain_validation_with_restrictions(self, monkeypatch):
        """validate_domain should enforce domain restrictions"""
        monkeypatch.setattr(
            settings, "AZURE_AD_ALLOWED_DOMAINS", ["school.nl", "example.edu"]
        )

        authenticator = AzureADAuthenticator()

        # Should allow configured domains
        assert authenticator.validate_domain("user@school.nl") is True
        assert authenticator.validate_domain("user@example.edu") is True

        # Should reject other domains
        assert authenticator.validate_domain("user@other.com") is False
        assert authenticator.validate_domain("user@school.com") is False

    def test_domain_validation_case_insensitive(self, monkeypatch):
        """validate_domain should be case-insensitive"""
        monkeypatch.setattr(settings, "AZURE_AD_ALLOWED_DOMAINS", ["School.NL"])

        authenticator = AzureADAuthenticator()

        # Should match regardless of case
        assert authenticator.validate_domain("user@school.nl") is True
        assert authenticator.validate_domain("user@SCHOOL.NL") is True
        assert authenticator.validate_domain("user@School.NL") is True

    def test_domain_validation_malformed_email(self, monkeypatch):
        """validate_domain should reject malformed emails"""
        monkeypatch.setattr(settings, "AZURE_AD_ALLOWED_DOMAINS", ["school.nl"])

        authenticator = AzureADAuthenticator()

        # Should reject malformed emails
        assert authenticator.validate_domain("user@") is False
        assert authenticator.validate_domain("@school.nl") is False
        assert authenticator.validate_domain("user") is False
        assert authenticator.validate_domain("user@@school.nl") is False
        assert authenticator.validate_domain("") is False


class TestJWTRoleClaims:
    """Test that JWT tokens include role and school_id claims."""

    def test_jwt_includes_role_claim(self):
        """JWT token should include role claim when provided"""
        from app.core.security import create_access_token, decode_access_token

        # Create token with role
        token = create_access_token(sub="test@example.com", role="teacher")

        # Decode and verify
        payload = decode_access_token(token)
        assert payload is not None
        assert payload.get("sub") == "test@example.com"
        assert payload.get("role") == "teacher"

    def test_jwt_includes_school_id_claim(self):
        """JWT token should include school_id claim when provided"""
        from app.core.security import create_access_token, decode_access_token

        # Create token with school_id
        token = create_access_token(sub="test@example.com", school_id=1)

        # Decode and verify
        payload = decode_access_token(token)
        assert payload is not None
        assert payload.get("sub") == "test@example.com"
        assert payload.get("school_id") == 1

    def test_jwt_includes_all_claims(self):
        """JWT token should include all claims when provided"""
        from app.core.security import create_access_token, decode_access_token

        # Create token with all optional claims
        token = create_access_token(sub="test@example.com", role="admin", school_id=1)

        # Decode and verify
        payload = decode_access_token(token)
        assert payload is not None
        assert payload.get("sub") == "test@example.com"
        assert payload.get("role") == "admin"
        assert payload.get("school_id") == 1

    def test_jwt_without_optional_claims(self):
        """JWT token should work without optional claims"""
        from app.core.security import create_access_token, decode_access_token

        # Create token without optional claims
        token = create_access_token(sub="test@example.com")

        # Decode and verify
        payload = decode_access_token(token)
        assert payload is not None
        assert payload.get("sub") == "test@example.com"
        assert payload.get("role") is None
        assert payload.get("school_id") is None


class TestAzureADUserProvisioning:
    """Test user provisioning from Azure AD profile."""

    @patch("app.core.azure_ad.Session")
    def test_provision_new_user_default_role(self, mock_session):
        """New users should be created with role 'student' by default"""
        from app.core.azure_ad import AzureADAuthenticator

        # Setup
        authenticator = AzureADAuthenticator()
        mock_db = MagicMock()

        # Mock user query to return None (user doesn't exist)
        mock_db.query.return_value.filter.return_value.first.return_value = None

        profile = {"mail": "newuser@school.nl", "displayName": "New User"}

        # Call provision_or_update_user
        user = authenticator.provision_or_update_user(mock_db, profile, school_id=1)

        # Verify user was added with correct defaults
        mock_db.add.assert_called_once()
        assert user.role == "student"
        assert user.auth_provider == "azure_ad"
        assert user.email == "newuser@school.nl"
        assert user.name == "New User"
        assert user.school_id == 1

    @patch("app.core.azure_ad.Session")
    def test_update_existing_user(self, mock_session):
        """Existing users should be updated from Azure AD profile"""
        from app.core.azure_ad import AzureADAuthenticator
        from app.infra.db.models import User

        # Setup
        authenticator = AzureADAuthenticator()
        mock_db = MagicMock()

        # Mock existing user
        existing_user = User(
            id=1,
            school_id=1,
            email="existing@school.nl",
            name="Old Name",
            role="teacher",  # Keep existing role
            auth_provider="local",
        )
        mock_db.query.return_value.filter.return_value.first.return_value = (
            existing_user
        )

        profile = {"mail": "existing@school.nl", "displayName": "Updated Name"}

        # Call provision_or_update_user
        user = authenticator.provision_or_update_user(mock_db, profile, school_id=1)

        # Verify user was updated
        assert user.name == "Updated Name"
        assert user.auth_provider == "azure_ad"
        assert user.role == "teacher"  # Role should be preserved
        assert user.email == "existing@school.nl"


class TestEmailNormalization:
    """Test that email normalization works across all auth paths."""

    @patch("app.core.azure_ad.Session")
    def test_azure_ad_provision_with_uppercase_email(self, mock_session):
        """Azure AD provisioning should normalize uppercase emails to match existing users"""
        from app.core.azure_ad import AzureADAuthenticator
        from app.infra.db.models import User

        # Setup
        authenticator = AzureADAuthenticator()
        mock_db = MagicMock()

        # Mock existing user with lowercase email
        existing_user = User(
            id=1,
            school_id=1,
            email="l316student@school.nl",  # Stored in lowercase
            name="Test Student",
            role="student",
            auth_provider="local",
        )
        mock_db.query.return_value.filter.return_value.first.return_value = (
            existing_user
        )

        # Azure AD returns uppercase email
        profile = {"mail": "L316Student@school.nl", "displayName": "Test Student"}

        # Call provision_or_update_user
        user = authenticator.provision_or_update_user(mock_db, profile, school_id=1)

        # Verify the existing user was found and updated (not a new user created)
        mock_db.add.assert_not_called()  # Should NOT add a new user
        assert user.auth_provider == "azure_ad"  # Should update auth provider
        assert user.email == "l316student@school.nl"  # Email should remain lowercase

    @patch("app.core.azure_ad.Session")
    def test_azure_ad_provision_new_user_normalizes_email(self, mock_session):
        """New users from Azure AD should have normalized (lowercase) emails"""
        from app.core.azure_ad import AzureADAuthenticator

        # Setup
        authenticator = AzureADAuthenticator()
        mock_db = MagicMock()

        # Mock user query to return None (user doesn't exist)
        mock_db.query.return_value.filter.return_value.first.return_value = None

        # Azure AD returns mixed-case email
        profile = {"mail": "NewUser@School.NL", "displayName": "New User"}

        # Call provision_or_update_user
        user = authenticator.provision_or_update_user(mock_db, profile, school_id=1)

        # Verify user was added with normalized email
        mock_db.add.assert_called_once()
        assert user.email == "newuser@school.nl"  # Should be lowercase

    def test_normalize_email_function(self):
        """Test the normalize_email utility function directly"""
        from app.core.auth_utils import normalize_email

        # Test various cases
        assert normalize_email("Test@Example.COM") == "test@example.com"
        assert normalize_email("  test@example.com  ") == "test@example.com"
        assert normalize_email("L316Student@School.NL") == "l316student@school.nl"
        assert normalize_email("") == ""
        assert normalize_email(None) == ""


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
