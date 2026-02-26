"""
Tests for rate limiting exemption on teacher scoring endpoints.

These tests verify that:
1. Authenticated teachers can make unlimited rapid requests to scoring endpoints
2. Unauthenticated requests to scoring endpoints are still rate limited
3. Auth endpoints remain rate limited (security preserved)
4. Students cannot bypass rate limits on scoring endpoints
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.middleware.rate_limit import RateLimitMiddleware
from app.infra.services.rate_limiter import RateLimiter
from unittest.mock import MagicMock


class MockUser:
    """Mock user for testing"""

    def __init__(self, id: int, role: str):
        self.id = id
        self.role = role


def test_teacher_scoring_endpoint_no_rate_limit():
    """Test that authenticated teachers are not rate limited on scoring endpoints"""
    # Create real rate limiter (will allow first few requests)
    mock_rate_limiter = MagicMock(spec=RateLimiter)
    # This would normally block after 100 requests, but should be bypassed
    mock_rate_limiter.is_allowed.return_value = (False, 30)

    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, rate_limiter=mock_rate_limiter)

    # Mock teacher user
    teacher_user = MockUser(id=1, role="teacher")

    @app.post("/api/v1/project-assessments/123/scores/batch")
    def scoring_endpoint():
        return {"message": "scores updated"}

    # Middleware dependency that sets user in request state
    @app.middleware("http")
    async def add_user_to_request(request, call_next):
        request.state.user = teacher_user
        return await call_next(request)

    client = TestClient(app)

    # Make multiple rapid requests - should NOT be rate limited
    for i in range(10):
        response = client.post("/api/v1/project-assessments/123/scores/batch")
        assert (
            response.status_code == 200
        ), f"Request {i+1} failed with status {response.status_code}"

    # Rate limiter should never be called because endpoint is exempted
    mock_rate_limiter.is_allowed.assert_not_called()


def test_admin_scoring_endpoint_no_rate_limit():
    """Test that authenticated admins are also not rate limited on scoring endpoints"""
    mock_rate_limiter = MagicMock(spec=RateLimiter)
    mock_rate_limiter.is_allowed.return_value = (False, 30)

    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, rate_limiter=mock_rate_limiter)

    admin_user = MockUser(id=2, role="admin")

    @app.post("/api/v1/project-assessments/456/scores/batch")
    def scoring_endpoint():
        return {"message": "scores updated"}

    @app.middleware("http")
    async def add_user_to_request(request, call_next):
        request.state.user = admin_user
        return await call_next(request)

    client = TestClient(app)

    # Make multiple rapid requests - should NOT be rate limited
    for i in range(10):
        response = client.post("/api/v1/project-assessments/456/scores/batch")
        assert response.status_code == 200

    # Rate limiter should never be called
    mock_rate_limiter.is_allowed.assert_not_called()


def test_student_scoring_endpoint_still_rate_limited():
    """Test that students do not get exemption on scoring endpoints"""
    mock_rate_limiter = MagicMock(spec=RateLimiter)
    # Allow first request to pass so we can verify the limiter is called
    mock_rate_limiter.is_allowed.return_value = (True, None)
    mock_rate_limiter.get_usage.return_value = {
        "current_count": 50,
        "window_seconds": 60,
    }

    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, rate_limiter=mock_rate_limiter)

    student_user = MockUser(id=3, role="student")

    @app.post("/api/v1/project-assessments/789/scores/batch")
    def scoring_endpoint():
        return {"message": "scores updated"}

    @app.middleware("http")
    async def add_user_to_request(request, call_next):
        request.state.user = student_user
        return await call_next(request)

    client = TestClient(app)

    # First request should trigger rate limiting check
    response = client.post("/api/v1/project-assessments/789/scores/batch")

    # Should call rate limiter (no exemption for students on scoring endpoints)
    assert response.status_code == 200
    mock_rate_limiter.is_allowed.assert_called()
    # Verify rate limit headers are present (proves rate limiting is active)
    assert "X-RateLimit-Limit" in response.headers


def test_unauthenticated_scoring_endpoint_rate_limited():
    """Test that unauthenticated requests to scoring endpoints are rate limited"""
    mock_rate_limiter = MagicMock(spec=RateLimiter)
    mock_rate_limiter.is_allowed.return_value = (True, None)
    mock_rate_limiter.get_usage.return_value = {
        "current_count": 50,
        "window_seconds": 60,
    }

    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, rate_limiter=mock_rate_limiter)

    @app.post("/api/v1/project-assessments/999/scores/batch")
    def scoring_endpoint():
        return {"message": "scores updated"}

    # No user middleware - simulates unauthenticated request

    client = TestClient(app)
    response = client.post("/api/v1/project-assessments/999/scores/batch")

    # Should be rate limited (limiter is called)
    assert response.status_code == 200
    mock_rate_limiter.is_allowed.assert_called()
    assert "X-RateLimit-Limit" in response.headers


def test_auth_endpoints_still_rate_limited_for_teachers():
    """Test that auth endpoints remain rate limited even for teachers"""
    mock_rate_limiter = MagicMock(spec=RateLimiter)
    mock_rate_limiter.is_allowed.return_value = (True, None)
    mock_rate_limiter.get_usage.return_value = {
        "current_count": 3,
        "window_seconds": 60,
    }

    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, rate_limiter=mock_rate_limiter)

    teacher_user = MockUser(id=1, role="teacher")

    @app.post("/api/v1/auth/login")
    def login():
        return {"message": "logged in"}

    @app.middleware("http")
    async def add_user_to_request(request, call_next):
        request.state.user = teacher_user
        return await call_next(request)

    client = TestClient(app)

    # Auth endpoints should still be rate limited
    response = client.post("/api/v1/auth/login")

    # Should call rate limiter (no exemption for auth endpoints)
    assert response.status_code == 200
    mock_rate_limiter.is_allowed.assert_called()
    assert "X-RateLimit-Limit" in response.headers


def test_evaluation_grades_endpoint_exempted():
    """Test that evaluation grades endpoints are also exempted for teachers"""
    mock_rate_limiter = MagicMock(spec=RateLimiter)
    mock_rate_limiter.is_allowed.return_value = (False, 30)

    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, rate_limiter=mock_rate_limiter)

    teacher_user = MockUser(id=1, role="teacher")

    @app.post("/api/v1/evaluations/123/grades")
    def grades_endpoint():
        return {"message": "grades updated"}

    @app.middleware("http")
    async def add_user_to_request(request, call_next):
        request.state.user = teacher_user
        return await call_next(request)

    client = TestClient(app)

    # Make multiple rapid requests - should NOT be rate limited
    for i in range(10):
        response = client.post("/api/v1/evaluations/123/grades")
        assert response.status_code == 200

    # Rate limiter should never be called
    mock_rate_limiter.is_allowed.assert_not_called()


def test_regular_endpoints_still_rate_limited():
    """Test that regular endpoints are still rate limited for teachers"""
    mock_rate_limiter = MagicMock(spec=RateLimiter)
    mock_rate_limiter.is_allowed.return_value = (True, None)
    mock_rate_limiter.get_usage.return_value = {
        "current_count": 50,
        "window_seconds": 60,
    }

    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, rate_limiter=mock_rate_limiter)

    teacher_user = MockUser(id=1, role="teacher")

    @app.get("/api/v1/users")
    def users_endpoint():
        return {"message": "users list"}

    @app.middleware("http")
    async def add_user_to_request(request, call_next):
        request.state.user = teacher_user
        return await call_next(request)

    client = TestClient(app)
    response = client.get("/api/v1/users")

    # Should be rate limited normally
    assert response.status_code == 200
    mock_rate_limiter.is_allowed.assert_called()
    assert "X-RateLimit-Limit" in response.headers


def test_omza_teacher_score_endpoint_exempted():
    """Test that OMZA teacher-score endpoints are exempted for teachers"""
    mock_rate_limiter = MagicMock(spec=RateLimiter)
    mock_rate_limiter.is_allowed.return_value = (False, 30)

    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, rate_limiter=mock_rate_limiter)

    teacher_user = MockUser(id=1, role="teacher")

    @app.post("/api/v1/omza/evaluations/1/teacher-score")
    def omza_teacher_score_endpoint():
        return {"message": "teacher score saved"}

    @app.middleware("http")
    async def add_user_to_request(request, call_next):
        request.state.user = teacher_user
        return await call_next(request)

    client = TestClient(app)

    # Make multiple rapid requests - should NOT be rate limited
    for i in range(10):
        response = client.post("/api/v1/omza/evaluations/1/teacher-score")
        assert (
            response.status_code == 200
        ), f"Request {i+1} failed with status {response.status_code}"

    # Rate limiter should never be called because endpoint is exempted
    mock_rate_limiter.is_allowed.assert_not_called()


def test_scoring_endpoint_pattern_matching():
    """Test that scoring endpoint pattern matching is precise"""
    app = FastAPI()
    middleware = RateLimitMiddleware(app, rate_limiter=MagicMock())

    teacher_user = MockUser(id=1, role="teacher")

    # Create mock requests
    def mock_request(path: str):
        request = MagicMock()
        request.url.path = path
        request.state.user = teacher_user
        return request

    # Should match - valid scoring endpoints
    assert middleware._is_authenticated_teacher_scoring(
        mock_request("/api/v1/project-assessments/123/scores/batch")
    )

    assert middleware._is_authenticated_teacher_scoring(
        mock_request("/api/v1/project-assessments/456/scores")
    )

    assert middleware._is_authenticated_teacher_scoring(
        mock_request("/api/v1/evaluations/789/grades")
    )

    assert middleware._is_authenticated_teacher_scoring(
        mock_request("/api/v1/evaluations/101/grades/summary")
    )

    assert middleware._is_authenticated_teacher_scoring(
        mock_request("/api/v1/omza/evaluations/1/teacher-score")
    )

    assert middleware._is_authenticated_teacher_scoring(
        mock_request("/api/v1/omza/evaluations/42/teacher-score")
    )

    # Should NOT match - not scoring endpoints
    assert not middleware._is_authenticated_teacher_scoring(
        mock_request("/api/v1/project-assessments/123")
    )

    assert not middleware._is_authenticated_teacher_scoring(
        mock_request("/api/v1/evaluations/456")
    )

    assert not middleware._is_authenticated_teacher_scoring(
        mock_request("/api/v1/users")
    )

    # Should NOT match - malformed paths
    assert not middleware._is_authenticated_teacher_scoring(
        mock_request("/api/v1/project-assessments/abc/scores")  # non-numeric ID
    )

    assert not middleware._is_authenticated_teacher_scoring(
        mock_request("/api/v1/project-assessments//scores")  # missing ID
    )

    assert not middleware._is_authenticated_teacher_scoring(
        mock_request("/project-assessments/123/scores")  # missing /api/v1
    )

    assert not middleware._is_authenticated_teacher_scoring(
        mock_request("/api/v1/omza/evaluations/abc/teacher-score")  # non-numeric ID
    )

    assert not middleware._is_authenticated_teacher_scoring(
        mock_request(
            "/api/v1/omza/evaluations/1/teacher-score/extra"
        )  # extra path segment
    )


def test_no_user_in_request_state():
    """Test that endpoints without user in request state are rate limited"""
    mock_rate_limiter = MagicMock(spec=RateLimiter)
    mock_rate_limiter.is_allowed.return_value = (True, None)
    mock_rate_limiter.get_usage.return_value = {
        "current_count": 1,
        "window_seconds": 60,
    }

    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, rate_limiter=mock_rate_limiter)

    @app.post("/api/v1/project-assessments/123/scores/batch")
    def scoring_endpoint():
        return {"message": "scores updated"}

    # No middleware to add user - request.state.user will not exist

    client = TestClient(app)
    response = client.post("/api/v1/project-assessments/123/scores/batch")

    # Should call rate limiter (no exemption without authenticated user)
    assert response.status_code == 200
    mock_rate_limiter.is_allowed.assert_called()


def test_azure_auth_endpoint_skips_rate_limiting():
    """Test that Azure AD auth endpoints bypass rate limiting entirely"""
    mock_rate_limiter = MagicMock(spec=RateLimiter)
    # Rate limiter would block if called
    mock_rate_limiter.is_allowed.return_value = (False, 30)

    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, rate_limiter=mock_rate_limiter)

    @app.get("/api/v1/auth/azure")
    def azure_login():
        return {"message": "redirect to azure"}

    @app.get("/api/v1/auth/azure/callback")
    def azure_callback():
        return {"message": "callback handled"}

    client = TestClient(app)

    # Azure login endpoint - should NOT be rate limited
    response = client.get("/api/v1/auth/azure")
    assert (
        response.status_code == 200
    ), f"Azure login was rate limited: {response.status_code}"

    # Azure callback endpoint - should NOT be rate limited
    response = client.get("/api/v1/auth/azure/callback")
    assert (
        response.status_code == 200
    ), f"Azure callback was rate limited: {response.status_code}"

    # Rate limiter should never be called for Azure auth endpoints
    mock_rate_limiter.is_allowed.assert_not_called()


def test_rate_limit_returns_429_not_500():
    """Test that rate limiting returns proper 429 response, not 500"""
    mock_rate_limiter = MagicMock(spec=RateLimiter)
    mock_rate_limiter.is_allowed.return_value = (False, 60)

    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, rate_limiter=mock_rate_limiter)

    @app.get("/api/v1/some-endpoint")
    def some_endpoint():
        return {"message": "ok"}

    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/api/v1/some-endpoint")

    assert response.status_code == 429
    assert "Retry-After" in response.headers
    assert response.headers["Retry-After"] == "60"


def test_rate_limit_uses_forwarded_ip():
    """Test that rate limiting uses X-Real-IP header for client identification"""
    app = FastAPI()
    middleware = RateLimitMiddleware(app, rate_limiter=MagicMock())

    # Mock request with X-Real-IP header (as forwarded by nginx)
    mock_request = MagicMock()
    mock_request.state = MagicMock(spec=[])  # No user in state
    mock_request.headers.get = lambda key, default="": {
        "x-real-ip": "203.0.113.42",
    }.get(key, default)
    mock_request.client.host = "172.19.0.5"  # Docker internal IP

    identifier = middleware._get_user_identifier(mock_request)
    assert identifier == "ip:203.0.113.42", f"Expected real IP, got: {identifier}"


def test_rate_limit_uses_forwarded_for_when_no_real_ip():
    """Test fallback to X-Forwarded-For when X-Real-IP is not set"""
    app = FastAPI()
    middleware = RateLimitMiddleware(app, rate_limiter=MagicMock())

    mock_request = MagicMock()
    mock_request.state = MagicMock(spec=[])  # No user in state
    mock_request.headers.get = lambda key, default="": {
        "x-forwarded-for": "198.51.100.5, 172.19.0.5",
    }.get(key, default)
    mock_request.client.host = "172.19.0.5"

    identifier = middleware._get_user_identifier(mock_request)
    assert (
        identifier == "ip:198.51.100.5"
    ), f"Expected first forwarded IP, got: {identifier}"
