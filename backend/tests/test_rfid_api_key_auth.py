"""
Tests for RFID API key authentication
"""

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    """Create a test client"""
    return TestClient(app, raise_server_exceptions=False)


class TestRFIDAPIKeyAuth:
    """Tests for RFID /scan endpoint API key authentication"""

    def test_scan_without_api_key_returns_401(self, client):
        """Test that /scan endpoint returns 401 without API key"""
        response = client.post(
            "/api/v1/attendance/scan",
            json={"uid": "1234567890"},
        )
        assert response.status_code == 401
        assert "API key required" in response.json()["detail"]

    def test_scan_with_invalid_api_key_returns_401(self, client):
        """Test that /scan endpoint returns 401 with invalid API key"""
        # Mock the settings property to return valid keys
        from app.core.config import settings
        with patch.object(type(settings), "RFID_API_KEYS", property(lambda self: ["valid-key-1", "valid-key-2"])):
            response = client.post(
                "/api/v1/attendance/scan",
                json={"uid": "1234567890"},
                headers={"X-API-Key": "invalid-key"},
            )
            assert response.status_code == 401
            assert "Invalid API key" in response.json()["detail"]

    def test_scan_with_valid_api_key_and_unknown_uid_returns_not_found(self, client):
        """Test that /scan endpoint accepts valid API key but returns not_found for unknown UID"""
        # Mock the settings property to return valid keys
        from app.core.config import settings
        with patch.object(type(settings), "RFID_API_KEYS", property(lambda self: ["test-api-key-123"])):
            response = client.post(
                "/api/v1/attendance/scan",
                json={"uid": "unknown-uid"},
                headers={"X-API-Key": "test-api-key-123"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "not_found"
            assert "Geen gebruiker gevonden" in data["message"]

    def test_scan_without_configured_keys_returns_503(self, client):
        """Test that /scan endpoint returns 503 when RFID_API_KEYS is not configured"""
        # Mock the settings property to return empty list
        from app.core.config import settings
        with patch.object(type(settings), "RFID_API_KEYS", property(lambda self: [])):
            response = client.post(
                "/api/v1/attendance/scan",
                json={"uid": "1234567890"},
                headers={"X-API-Key": "any-key"},
            )
            assert response.status_code == 503
            assert "not configured" in response.json()["detail"]

    def test_scan_with_multiple_valid_keys(self, client):
        """Test that any of multiple valid API keys work"""
        # Mock the settings property to return multiple valid keys
        from app.core.config import settings
        with patch.object(type(settings), "RFID_API_KEYS", property(lambda self: ["key1", "key2", "key3"])):
            # Test with second key
            response = client.post(
                "/api/v1/attendance/scan",
                json={"uid": "unknown-uid"},
                headers={"X-API-Key": "key2"},
            )
            assert response.status_code == 200
            
            # Test with third key
            response = client.post(
                "/api/v1/attendance/scan",
                json={"uid": "unknown-uid"},
                headers={"X-API-Key": "key3"},
            )
            assert response.status_code == 200


class TestRFIDScanCSRFExemption:
    """Tests to verify CSRF exemption for RFID scan endpoint"""

    def test_scan_without_origin_or_referer_succeeds_with_valid_api_key(self, client):
        """
        Test that scan endpoint works without Origin/Referer headers (CSRF exempt).
        This simulates the real-world scenario: Raspberry Pi RFID scanner using API key auth.
        """
        from app.core.config import settings
        with patch.object(type(settings), "RFID_API_KEYS", property(lambda self: ["test-key"])):
            # No Origin or Referer headers - should still work (CSRF exempt)
            response = client.post(
                "/api/v1/attendance/scan",
                json={"uid": "unknown-uid"},
                headers={"X-API-Key": "test-key"},
            )
            # Should succeed with 200 (returns not_found for unknown UID)
            assert response.status_code == 200
            assert response.json()["status"] == "not_found"

    def test_scan_with_evil_origin_succeeds_with_valid_api_key(self, client):
        """
        Test that scan endpoint ignores Origin header for CSRF (CSRF exempt).
        Even if an attacker somehow sends a request with an evil origin,
        they cannot exploit it without a valid API key.
        """
        from app.core.config import settings
        with patch.object(type(settings), "RFID_API_KEYS", property(lambda self: ["test-key"])):
            # Evil origin header - should still work because CSRF is exempt
            response = client.post(
                "/api/v1/attendance/scan",
                json={"uid": "unknown-uid"},
                headers={
                    "X-API-Key": "test-key",
                    "Origin": "http://evil-attacker.com",
                },
            )
            # Should succeed - API key is what matters, not origin
            assert response.status_code == 200
            assert response.json()["status"] == "not_found"

    def test_scan_without_api_key_fails_regardless_of_origin(self, client):
        """
        Test that scan endpoint still requires API key even when CSRF exempt.
        CSRF exemption does NOT bypass API key authentication.
        """
        from app.core.config import settings
        with patch.object(type(settings), "RFID_API_KEYS", property(lambda self: ["test-key"])):
            # Valid origin but no API key - should fail
            response = client.post(
                "/api/v1/attendance/scan",
                json={"uid": "test-uid"},
                headers={"Origin": "http://localhost:3000"},
            )
            assert response.status_code == 401
            assert "API key required" in response.json()["detail"]


