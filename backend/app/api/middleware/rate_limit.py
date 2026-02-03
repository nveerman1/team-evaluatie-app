"""Rate limiting middleware for FastAPI."""

from __future__ import annotations

import logging
import re
from typing import Callable, Optional
from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from app.infra.services.rate_limiter import RateLimiter
from app.core.security import decode_access_token
from app.core.auth_utils import normalize_email
from app.core.config import settings
from sqlalchemy.orm import Session
from app.infra.db.session import SessionLocal
from app.infra.db.models import User

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
        if self._should_skip_rate_limit(request):
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
        response.headers["X-RateLimit-Remaining"] = str(
            max(0, max_requests - usage["current_count"])
        )
        response.headers["X-RateLimit-Reset"] = str(window_seconds)

        return response

    def _should_skip_rate_limit(self, request: Request) -> bool:
        """
        Check if request should skip rate limiting.
        
        Args:
            request: HTTP request
            
        Returns:
            True if rate limiting should be skipped
        """
        path = request.url.path
        
        # Always skip docs and health endpoints
        skip_paths = [
            "/docs",
            "/redoc",
            "/openapi.json",
            "/health",
        ]
        if any(path.startswith(skip_path) for skip_path in skip_paths):
            return True
        
        # Exempt authenticated teacher scoring endpoints from rate limiting
        # Teachers need to make many rapid updates when filling in scores
        should_exempt = self._is_authenticated_teacher_scoring(request)
        if should_exempt:
            logger.info(f"Rate limiting EXEMPTED for path: {path}")
        return should_exempt
    
    def _is_authenticated_teacher_scoring(self, request: Request) -> bool:
        """
        Check if request is from authenticated teacher accessing scoring endpoints.
        
        Args:
            request: HTTP request
            
        Returns:
            True if authenticated teacher/admin accessing scoring endpoints
        """
        path = request.url.path
        
        # Check if it's a scoring endpoint that teachers use interactively
        # Use precise regex patterns to match only intended scoring endpoints
        # Pattern 1: /api/v1/project-assessments/{id}/scores[/*]
        # Pattern 2: /api/v1/evaluations/{id}/grades[/*]
        scoring_patterns = [
            r'^/api/v1/project-assessments/\d+/scores(?:/.*)?$',
            r'^/api/v1/evaluations/\d+/grades(?:/.*)?$',
        ]
        
        is_scoring_endpoint = any(
            re.match(pattern, path) for pattern in scoring_patterns
        )
        
        if not is_scoring_endpoint:
            return False
        
        # Log that we found a scoring endpoint
        logger.info(f"Scoring endpoint detected: {path}")
        
        # Get user role from authentication token
        user_role = self._get_user_role_from_token(request)
        logger.info(f"User role extracted from token: {user_role}")
        
        if user_role in ("teacher", "admin"):
            logger.info(f"Rate limiting exempted for {user_role} on {path}")
            return True
        
        logger.warning(f"Rate limiting NOT exempted for role={user_role} on {path}")
        return False
    
    def _get_user_role_from_token(self, request: Request) -> Optional[str]:
        """
        Extract user role from authentication token in request.
        
        This method decodes the JWT token from cookies or Authorization header
        and extracts the role claim directly from the token payload.
        
        Args:
            request: HTTP request
            
        Returns:
            User role string or None if not authenticated
        """
        # Development mode: Check X-User-Email header first if enabled
        # This is the primary auth method in development
        if settings.ENABLE_DEV_LOGIN:
            x_user_email = request.headers.get("x-user-email")
            if x_user_email:
                logger.info(f"Using X-User-Email header: {x_user_email}")
                try:
                    db = SessionLocal()
                    try:
                        # Normalize email for case-insensitive lookup
                        normalized_email = normalize_email(x_user_email)
                        user = db.query(User).filter(User.email == normalized_email).first()
                        if user and not user.archived:
                            logger.info(f"User found via X-User-Email: role={user.role}")
                            return user.role
                        else:
                            logger.warning(f"User not found or archived for email: {x_user_email}")
                    finally:
                        db.close()
                except Exception as e:
                    logger.error(f"Error getting user from X-User-Email: {e}")
        
        # Try to get token from cookie (preferred method in production)
        token = request.cookies.get("access_token")
        if token:
            logger.info(f"Token found in cookie: {token[:20]}...")
        
        # Fallback to Authorization header
        if not token:
            auth_header = request.headers.get("authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]  # Remove "Bearer " prefix
                logger.info(f"Token found in Authorization header: {token[:20]}...")
        
        if not token:
            logger.warning("No authentication token found in request")
            return None
        
        # Decode JWT token and extract role claim
        try:
            payload = decode_access_token(token)
            if not payload:
                logger.warning("Failed to decode JWT token")
                return None
            
            logger.info(f"JWT token decoded successfully. Payload keys: {list(payload.keys())}")
            
            # Get role directly from token payload (no database query needed)
            role = payload.get("role")
            if role:
                logger.info(f"Role found in JWT token: {role}")
                return role
            else:
                logger.warning(f"No 'role' claim in JWT token. Available claims: {list(payload.keys())}")
                
        except Exception as e:
            logger.error(f"Error decoding token for rate limit check: {e}", exc_info=True)
            return None
        
        return None

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
        # Auth endpoints: 5 requests per minute (prevent brute force)
        if "/auth/" in path and not path.endswith("/me"):
            return 5, 60

        # Public external endpoints: 10 requests per minute
        if (
            "/public/" in path
            or "/external-assessments/" in path
            or "/external/invites" in path
        ):
            return 10, 60

        # Queue endpoints: 10 requests per minute
        if "/queue" in path or "/jobs" in path:
            return 10, 60

        # Batch endpoints: 5 requests per minute
        if "/batch" in path:
            return 5, 60

        # File upload endpoints: 5 requests per minute (DoS prevention)
        if ("/import" in path and path.endswith(".csv")) or "/upload" in path:
            return 5, 60

        # Default: 100 requests per minute
        return 100, 60
