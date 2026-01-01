"""Rate limiting middleware for FastAPI."""
from __future__ import annotations

import logging
from typing import Callable
from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from app.infra.services.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware for rate limiting API requests.
    
    Configuration:
    - API endpoints: 100 requests per minute per user
    - Queue endpoints: 10 requests per minute per user
    """
    
    def __init__(self, app, rate_limiter: RateLimiter = None):
        """
        Initialize middleware.
        
        Args:
            app: FastAPI application
            rate_limiter: RateLimiter instance (optional)
        """
        super().__init__(app)
        self.rate_limiter = rate_limiter or RateLimiter()
    
    async def dispatch(
        self,
        request: Request,
        call_next: Callable,
    ) -> Response:
        """
        Process request with rate limiting.
        
        Args:
            request: HTTP request
            call_next: Next middleware/handler
            
        Returns:
            HTTP response
        """
        # Skip rate limiting for certain paths
        if self._should_skip_rate_limit(request.url.path):
            return await call_next(request)
        
        # Get user identifier (use IP if no user)
        user_id = self._get_user_identifier(request)
        
        # Determine rate limit based on endpoint
        max_requests, window_seconds = self._get_rate_limit(request.url.path)
        
        # Check rate limit
        rate_key = f"{user_id}:{request.url.path}"
        is_allowed, retry_after = self.rate_limiter.is_allowed(
            rate_key,
            max_requests,
            window_seconds,
        )
        
        if not is_allowed:
            logger.warning(f"Rate limit exceeded for {rate_key}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Retry after {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)},
            )
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        usage = self.rate_limiter.get_usage(rate_key, window_seconds)
        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Remaining"] = str(max(0, max_requests - usage["current_count"]))
        response.headers["X-RateLimit-Reset"] = str(window_seconds)
        
        return response
    
    def _should_skip_rate_limit(self, path: str) -> bool:
        """Check if path should skip rate limiting."""
        skip_paths = [
            "/docs",
            "/redoc",
            "/openapi.json",
            "/health",
            "/api/v1/auth/login",
        ]
        return any(path.startswith(skip_path) for skip_path in skip_paths)
    
    def _get_user_identifier(self, request: Request) -> str:
        """Get user identifier for rate limiting."""
        # Try to get user ID from request state (set by auth middleware)
        if hasattr(request.state, "user") and request.state.user:
            user = request.state.user
            # Safely get user ID (check for None, not falsy value)
            user_id = getattr(user, "id", None)
            if user_id is not None:  # Handles user ID 0 correctly
                return f"user:{user_id}"
        
        # Fallback to IP address
        client_ip = request.client.host if request.client else "unknown"
        return f"ip:{client_ip}"
    
    def _get_rate_limit(self, path: str) -> tuple[int, int]:
        """
        Get rate limit for endpoint.
        
        Returns:
            Tuple of (max_requests, window_seconds)
        """
        # Queue endpoints: 10 requests per minute
        if "/queue" in path or "/jobs" in path:
            return 10, 60
        
        # Batch endpoints: 5 requests per minute
        if "/batch" in path:
            return 5, 60
        
        # Default: 100 requests per minute
        return 100, 60
