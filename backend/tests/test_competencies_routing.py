"""
Test to ensure /competencies/windows is not mistakenly matched as /{competency_id}

This test addresses a routing conflict where GET /api/v1/competencies/windows
was being matched by the dynamic route /{competency_id} instead of the static
/windows/ endpoint, causing a 422 error trying to parse "windows" as an integer.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app


class TestCompetenciesRouting:
    """Tests for competencies routing order"""

    def test_windows_endpoint_not_matched_as_competency_id(self):
        """
        Test that /competencies/windows is routed to the windows endpoint,
        not to the /{competency_id} endpoint.
        
        This is a regression test for the routing conflict where "windows"
        was being parsed as competency_id causing a 422 validation error.
        """
        client = TestClient(app)
        
        # Call the windows endpoint
        # Note: We expect a 401 (unauthorized) since we're not authenticated,
        # but we should NOT get a 422 (validation error trying to parse "windows" as int)
        response = client.get("/api/v1/competencies/windows/")
        
        # If the route is matched correctly, we get 401 (need auth)
        # If it's matched incorrectly as /{competency_id}, we'd get 422 (validation error)
        assert response.status_code != 422, (
            f"Got 422 error, indicating 'windows' is being matched as competency_id. "
            f"Response: {response.json()}"
        )
        
        # We expect 401 because we didn't provide authentication
        assert response.status_code == 401, (
            f"Expected 401 (unauthorized), got {response.status_code}. "
            f"Response: {response.json() if response.status_code != 401 else response.text}"
        )

    def test_windows_endpoint_without_trailing_slash(self):
        """
        Test that /competencies/windows (without trailing slash) is also routed correctly.
        FastAPI should redirect or handle this appropriately.
        """
        client = TestClient(app)
        
        # Call without trailing slash
        response = client.get("/api/v1/competencies/windows", allow_redirects=False)
        
        # Should either get 307 redirect to /windows/ or 401 auth error
        # Should NOT get 422 validation error
        assert response.status_code != 422, (
            f"Got 422 error, indicating 'windows' is being matched as competency_id. "
            f"Response: {response.json()}"
        )

    def test_numeric_competency_id_still_works(self):
        """
        Test that numeric competency IDs are still routed to the /{competency_id} endpoint.
        """
        client = TestClient(app)
        
        # Call with a numeric ID
        response = client.get("/api/v1/competencies/123")
        
        # We expect 401 (unauthorized) or 404 (not found), not 422
        assert response.status_code in [401, 404], (
            f"Expected 401 or 404, got {response.status_code}. "
            f"Response: {response.json() if response.status_code in [401, 404] else response.text}"
        )

    def test_windows_subpaths_routed_correctly(self):
        """
        Test that /competencies/windows/{window_id}/... paths are routed correctly.
        """
        client = TestClient(app)
        
        # Test /windows/{window_id}/heatmap
        response = client.get("/api/v1/competencies/windows/1/heatmap")
        assert response.status_code != 422, (
            f"windows subpath incorrectly routed. Response: {response.json()}"
        )
        
        # Test /windows/{window_id}/overview
        response = client.get("/api/v1/competencies/windows/1/overview")
        assert response.status_code != 422, (
            f"windows subpath incorrectly routed. Response: {response.json()}"
        )
        
        # Test /windows/{window_id}/goals
        response = client.get("/api/v1/competencies/windows/1/goals")
        assert response.status_code != 422, (
            f"windows subpath incorrectly routed. Response: {response.json()}"
        )
        
        # Test /windows/{window_id}/reflections
        response = client.get("/api/v1/competencies/windows/1/reflections")
        assert response.status_code != 422, (
            f"windows subpath incorrectly routed. Response: {response.json()}"
        )
