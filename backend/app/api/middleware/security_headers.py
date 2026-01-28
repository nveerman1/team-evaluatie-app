"""Security headers middleware for FastAPI."""

from __future__ import annotations

import logging
import re
from typing import Callable
from urllib.parse import urlparse
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.config import settings

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all responses and perform CSRF validation.

    In production, this middleware is disabled by default (ENABLE_BACKEND_SECURITY_HEADERS=false)
    because Nginx handles all security headers at the edge to avoid duplicates.

    In development, this middleware can be enabled for testing without nginx.

    Security features:
    1. CSRF Protection via Origin/Referer validation (always enabled)
       - Validates state-changing requests (POST, PUT, PATCH, DELETE)
       - Exempts OAuth callback routes (external redirects)
       - Exempts device-to-server API endpoints that use API key auth instead of cookies
         * /api/v1/attendance/scan - RFID scanner (Raspberry Pi) uses X-API-Key header
         * These endpoints are NOT vulnerable to CSRF because:
           - They don't use session cookies for authentication
           - They use API keys which cannot be exploited via browser-based CSRF attacks
           - Attacker cannot trigger cross-origin request with valid API key from browser
       - Returns HTTP 403 on validation failure

    2. Security Headers (when ENABLE_BACKEND_SECURITY_HEADERS=true):
       - X-Content-Type-Options: Prevents MIME sniffing
       - X-Frame-Options: Prevents clickjacking
       - X-XSS-Protection: Legacy XSS protection
       - Referrer-Policy: Controls referrer information
       - Strict-Transport-Security: Forces HTTPS (production only)
       - Content-Security-Policy: Reduces XSS risk
       - Permissions-Policy: Controls browser features
    """

    # OAuth and auth-related routes that should be exempt from CSRF checks
    # These routes involve redirects from external providers
    CSRF_EXEMPT_PATHS = [
        "/api/v1/auth/azure/callback",  # Azure AD OAuth callback
        "/api/v1/auth/azure",  # Azure AD OAuth initiation
        "/api/v1/attendance/scan",  # RFID scanner endpoint (device-to-server, no cookies)
    ]

    # Regex pattern to match any future OAuth callback routes
    # Matches: /api/v1/auth/*/callback
    CSRF_EXEMPT_PATTERN = re.compile(r"^/api/v1/auth/[^/]+/callback$")

    def _is_state_changing_request(self, request: Request) -> bool:
        """Check if request method is state-changing (requires CSRF protection)."""
        return request.method in ["POST", "PUT", "PATCH", "DELETE"]

    def _is_csrf_exempt_path(self, path: str) -> bool:
        """Check if path is exempt from CSRF validation."""
        # Check exact matches
        if path in self.CSRF_EXEMPT_PATHS:
            return True

        # Check pattern matches (e.g., /api/v1/auth/*/callback)
        if self.CSRF_EXEMPT_PATTERN.match(path):
            return True

        return False

    def _get_trusted_origins(self) -> list[str]:
        """Get list of trusted origins for CSRF validation."""
        origins = []

        # Add FRONTEND_URL if configured
        if settings.FRONTEND_URL:
            origins.append(settings.FRONTEND_URL)

        # Add CORS_ORIGINS
        origins.extend(settings.CORS_ORIGINS)

        # Normalize origins: ensure no trailing slashes
        return [origin.rstrip("/") for origin in origins if origin]

    def _extract_origin_from_url(self, url: str) -> str | None:
        """Extract origin (scheme + host + port) from a full URL."""
        try:
            parsed = urlparse(url)
            if parsed.scheme and parsed.netloc:
                # Reconstruct origin without path, query, fragment
                origin = f"{parsed.scheme}://{parsed.netloc}"
                return origin.rstrip("/")
        except Exception as e:
            logger.warning(f"Failed to parse URL '{url}': {e}")
        return None

    def _validate_origin_or_referer(self, request: Request) -> bool:
        """
        Validate that the request originates from a trusted source.

        Checks Origin header first (more reliable), falls back to Referer.
        Returns True if validation passes, False otherwise.
        """
        trusted_origins = self._get_trusted_origins()

        if not trusted_origins:
            # SECURITY: Fail secure when no origins configured
            # In a properly configured system, FRONTEND_URL and/or CORS_ORIGINS should be set
            logger.error(
                "CRITICAL: No trusted origins configured for CSRF protection. "
                "CSRF validation will FAIL SECURE (block all requests). "
                "Please configure FRONTEND_URL and/or CORS_ORIGINS. "
                f"Request: {request.method} {request.url.path}"
            )
            # Fail secure: block request when origins not configured
            return False

        # Try Origin header first (preferred, more reliable)
        origin_header = request.headers.get("origin")
        if origin_header:
            origin = origin_header.rstrip("/")
            if origin in trusted_origins:
                logger.debug(f"CSRF validation passed via Origin: {origin}")
                return True
            else:
                logger.warning(
                    f"CSRF validation failed: Origin '{origin}' not in trusted origins. "
                    f"Request: {request.method} {request.url.path}"
                )
                return False

        # Fallback to Referer header
        referer_header = request.headers.get("referer")
        if referer_header:
            referer_origin = self._extract_origin_from_url(referer_header)
            if referer_origin and referer_origin in trusted_origins:
                logger.debug(f"CSRF validation passed via Referer: {referer_origin}")
                return True
            else:
                logger.warning(
                    f"CSRF validation failed: Referer origin '{referer_origin}' not in trusted origins. "
                    f"Request: {request.method} {request.url.path}"
                )
                return False

        # Neither Origin nor Referer present - reject for safety
        logger.warning(
            f"CSRF validation failed: Missing both Origin and Referer headers. "
            f"Request: {request.method} {request.url.path} from {request.client.host if request.client else 'unknown'}"
        )
        return False

    async def dispatch(
        self,
        request: Request,
        call_next: Callable,
    ) -> Response:
        """
        Process request with CSRF validation and add security headers to response.

        CSRF validation happens BEFORE request is processed.
        Security headers are added AFTER response is generated.
        """
        # CSRF Protection: Validate state-changing requests
        if self._is_state_changing_request(request):
            if not self._is_csrf_exempt_path(request.url.path):
                if not self._validate_origin_or_referer(request):
                    # CSRF validation failed - return 403
                    logger.error(
                        f"CSRF attack blocked: {request.method} {request.url.path} "
                        f"from {request.client.host if request.client else 'unknown'}"
                    )
                    return Response(
                        content="CSRF validation failed: Origin or Referer header does not match trusted origins",
                        status_code=403,
                    )
                logger.debug(
                    f"CSRF validation passed for {request.method} {request.url.path}"
                )
            else:
                logger.debug(f"CSRF check skipped for exempt path: {request.url.path}")

        # Process request
        response = await call_next(request)

        # In production, nginx handles security headers to avoid duplicates
        if not settings.ENABLE_BACKEND_SECURITY_HEADERS:
            return response

        # Development mode: Add headers for testing without nginx
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Content-Security-Policy for API
        # Note: Frontend (Next.js) should set its own CSP
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; frame-ancestors 'none'; base-uri 'self'"
        )

        # Permissions-Policy (formerly Feature-Policy)
        response.headers["Permissions-Policy"] = (
            "geolocation=(), "
            "microphone=(), "
            "camera=(), "
            "payment=(), "
            "usb=(), "
            "magnetometer=(), "
            "gyroscope=(), "
            "accelerometer=()"
        )

        # HSTS (HTTP Strict Transport Security) - only in production with HTTPS
        if settings.COOKIE_SECURE:
            # max-age=31536000 = 1 year
            # includeSubDomains: apply to all subdomains
            # preload: allow inclusion in browser HSTS preload lists
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        return response
