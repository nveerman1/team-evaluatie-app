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


