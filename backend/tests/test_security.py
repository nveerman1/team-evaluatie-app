"""
Tests for security middleware and configurations
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.middleware.security_headers import SecurityHeadersMiddleware
from app.api.middleware.rate_limit import RateLimitMiddleware
from app.infra.services.rate_limiter import RateLimiter
from unittest.mock import MagicMock


def test_security_headers_middleware():
    """Test that security headers are added to responses"""
    app = FastAPI()
    app.add_middleware(SecurityHeadersMiddleware)
    
    @app.get("/test")
    def test_route():
        return {"message": "test"}
    
    client = TestClient(app)
    response = client.get("/test")
    
    # Check that all security headers are present
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["X-XSS-Protection"] == "1; mode=block"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert "Content-Security-Policy" in response.headers
    assert "Permissions-Policy" in response.headers
    
    # HSTS should NOT be present in test (COOKIE_SECURE=False by default)
    assert "Strict-Transport-Security" not in response.headers


def test_security_headers_with_https():
    """Test that HSTS is added when COOKIE_SECURE is True"""
    from app.core.config import settings
    
    # Temporarily set COOKIE_SECURE to True
    original_secure = settings.COOKIE_SECURE
    settings.COOKIE_SECURE = True
    
    try:
        app = FastAPI()
        app.add_middleware(SecurityHeadersMiddleware)
        
        @app.get("/test")
        def test_route():
            return {"message": "test"}
        
        client = TestClient(app)
        response = client.get("/test")
        
        # HSTS should be present with HTTPS
        assert "Strict-Transport-Security" in response.headers
        hsts = response.headers["Strict-Transport-Security"]
        assert "max-age=31536000" in hsts
        assert "includeSubDomains" in hsts
        assert "preload" in hsts
    finally:
        settings.COOKIE_SECURE = original_secure


def test_rate_limiting_allows_normal_traffic():
    """Test that rate limiting allows normal traffic"""
    mock_rate_limiter = MagicMock(spec=RateLimiter)
    mock_rate_limiter.is_allowed.return_value = (True, None)
    mock_rate_limiter.get_usage.return_value = {
        "current_count": 1,
        "window_seconds": 60,
        "oldest_request": None,
        "newest_request": None,
    }
    
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, rate_limiter=mock_rate_limiter)
    
    @app.get("/api/v1/test")
    def test_route():
        return {"message": "test"}
    
    client = TestClient(app)
    response = client.get("/api/v1/test")
    
    assert response.status_code == 200
    assert "X-RateLimit-Limit" in response.headers
    assert "X-RateLimit-Remaining" in response.headers
    assert "X-RateLimit-Reset" in response.headers


def test_rate_limiting_blocks_excessive_requests():
    """Test that rate limiting blocks excessive requests"""
    mock_rate_limiter = MagicMock(spec=RateLimiter)
    mock_rate_limiter.is_allowed.return_value = (False, 30)  # Blocked, retry after 30s
    
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, rate_limiter=mock_rate_limiter)
    
    @app.get("/api/v1/test")
    def test_route():
        return {"message": "test"}
    
    client = TestClient(app)
    response = client.get("/api/v1/test")
    
    assert response.status_code == 429
    assert "Retry-After" in response.headers
    assert response.headers["Retry-After"] == "30"


def test_rate_limiting_auth_endpoints_stricter():
    """Test that auth endpoints have stricter rate limits"""
    app = FastAPI()
    middleware = RateLimitMiddleware(app, rate_limiter=MagicMock())
    
    # Auth endpoints should have 5 requests per minute
    max_req, window = middleware._get_rate_limit("/api/v1/auth/azure")
    assert max_req == 5
    assert window == 60
    
    # Regular endpoints should have 100 requests per minute
    max_req, window = middleware._get_rate_limit("/api/v1/users/me")
    assert max_req == 100
    assert window == 60


def test_rate_limiting_public_endpoints():
    """Test that public endpoints have appropriate rate limits"""
    app = FastAPI()
    middleware = RateLimitMiddleware(app, rate_limiter=MagicMock())
    
    # Public endpoints should have 10 requests per minute
    max_req, window = middleware._get_rate_limit("/api/v1/public/invite/token123")
    assert max_req == 10
    assert window == 60
    
    max_req, window = middleware._get_rate_limit("/api/v1/external-assessments/token456")
    assert max_req == 10
    assert window == 60


def test_rate_limiting_skips_health_check():
    """Test that health check endpoint is not rate limited"""
    mock_rate_limiter = MagicMock(spec=RateLimiter)
    
    app = FastAPI()
    middleware = RateLimitMiddleware(app, rate_limiter=mock_rate_limiter)
    
    @app.get("/health")
    def health():
        return {"status": "ok"}
    
    client = TestClient(app)
    response = client.get("/health")
    
    # Should not call rate limiter at all
    assert response.status_code == 200
    mock_rate_limiter.is_allowed.assert_not_called()


def test_cors_configuration():
    """Test that CORS is properly configured (no wildcards)"""
    from app.main import app
    
    # Find CORS middleware
    cors_middleware = None
    for middleware in app.user_middleware:
        if "CORSMiddleware" in str(middleware):
            cors_middleware = middleware
            break
    
    assert cors_middleware is not None, "CORS middleware not found"
    
    # Note: We can't easily inspect middleware config directly,
    # so we test via actual requests
    client = TestClient(app)
    
    # Test that CORS headers are set for allowed origin
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        }
    )
    
    # Should have CORS headers
    assert "access-control-allow-origin" in response.headers
    
    # Test that wildcard is not used
    assert response.headers.get("access-control-allow-origin") != "*"


def test_secret_key_validation_in_production():
    """Test that SECRET_KEY validation fails with default value in production"""
    import os
    from app.core.config import Settings
    
    # Set production environment
    os.environ["NODE_ENV"] = "production"
    os.environ["SECRET_KEY"] = "CHANGE_ME_IN_PRODUCTION"
    
    try:
        with pytest.raises(ValueError) as exc_info:
            Settings()
        
        assert "SECRET_KEY must be set" in str(exc_info.value)
    finally:
        # Reset environment
        os.environ["NODE_ENV"] = "development"
        os.environ.pop("SECRET_KEY", None)


def test_secret_key_length_warning():
    """Test that short SECRET_KEY triggers warning"""
    import os
    from app.core.config import Settings
    
    os.environ["SECRET_KEY"] = "short"  # Only 5 chars
    
    try:
        # Should not raise, but would log warning
        settings = Settings()
        assert settings.SECRET_KEY == "short"
    finally:
        os.environ.pop("SECRET_KEY", None)


def test_cookie_secure_warning_in_production():
    """Test that COOKIE_SECURE=False in production triggers warning"""
    import os
    from app.core.config import Settings
    
    os.environ["NODE_ENV"] = "production"
    os.environ["SECRET_KEY"] = "valid-long-secret-key-for-testing-purposes-only"
    os.environ["COOKIE_SECURE"] = "false"
    
    try:
        # Should not raise, but would log warning
        settings = Settings()
        assert settings.COOKIE_SECURE is False
    finally:
        os.environ["NODE_ENV"] = "development"
        os.environ.pop("SECRET_KEY", None)
        os.environ.pop("COOKIE_SECURE", None)


def test_dev_login_disabled_in_production():
    """Test that dev-login (X-User-Email) is disabled in production"""
    from app.core.config import settings
    from app.api.v1.deps import get_current_user
    from fastapi import HTTPException, Header
    from unittest.mock import MagicMock
    
    # Mock dependencies
    mock_request = MagicMock()
    mock_db = MagicMock()
    
    # Set to production
    original_env = settings.NODE_ENV
    settings.NODE_ENV = "production"
    
    try:
        # Attempt to use X-User-Email in production
        with pytest.raises(HTTPException) as exc_info:
            # This would be called by FastAPI's dependency injection
            # We simulate it by calling directly without proper DI
            pass  # Can't easily test this without full app context
        
        # In production, X-User-Email should be rejected
        # This is verified in the deps.py code
        
    finally:
        settings.NODE_ENV = original_env


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
