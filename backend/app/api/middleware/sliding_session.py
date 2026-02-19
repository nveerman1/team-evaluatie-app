"""Sliding session middleware for FastAPI.

On each authenticated request the current ``access_token`` cookie is
inspected.  When the remaining lifetime is below
``SESSION_RENEWAL_THRESHOLD_MINUTES`` a fresh token is issued and a new
``Set-Cookie`` header is appended to the response.

Effect: the session acts as an *inactivity* timer.  As long as the user
keeps making requests within the ``ACCESS_TOKEN_EXPIRE_MINUTES`` window the
session rolls forward and never expires.  Only when the user is idle for
longer than ``ACCESS_TOKEN_EXPIRE_MINUTES`` minutes will the token expire and
the next request return 401.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.security import create_access_token, decode_access_token

logger = logging.getLogger(__name__)


class SlidingSessionMiddleware(BaseHTTPMiddleware):
    """Renew the JWT cookie on each successful authenticated request."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Only attempt renewal for successful responses to avoid renewing on
        # 401/403 (which trigger the frontend logout flow) or 4xx/5xx errors.
        if response.status_code >= 400:
            return response

        token = request.cookies.get("access_token")
        if not token:
            return response

        payload = decode_access_token(token)
        if not payload:
            return response

        exp = payload.get("exp")
        if not exp:
            return response

        try:
            expire_time = datetime.fromtimestamp(float(exp), tz=timezone.utc)
        except (TypeError, ValueError, OSError):
            # Malformed exp claim — skip renewal
            return response

        now = datetime.now(timezone.utc)
        remaining = expire_time - now

        threshold = timedelta(minutes=settings.SESSION_RENEWAL_THRESHOLD_MINUTES)
        if remaining > threshold:
            # Token still has plenty of time left — no renewal needed.
            return response

        # Token is within the renewal window; issue a fresh one.
        sub = payload.get("sub")
        if not sub:
            return response

        role = payload.get("role")
        school_id = payload.get("school_id")

        new_token = create_access_token(sub=sub, role=role, school_id=school_id)

        # Build the Set-Cookie header value to match the cookie attributes used
        # during login (see app/api/v1/routers/auth.py).
        cookie_parts = [
            f"access_token={new_token}",
            "Path=/",
            "HttpOnly",
            f"SameSite={settings.COOKIE_SAMESITE}",
            f"Max-Age={settings.COOKIE_MAX_AGE}",
        ]
        if settings.COOKIE_SECURE:
            cookie_parts.append("Secure")
        if getattr(settings, "COOKIE_DOMAIN", None):
            cookie_parts.append(f"Domain={settings.COOKIE_DOMAIN}")

        response.headers.append("Set-Cookie", "; ".join(cookie_parts))
        logger.debug(
            f"Sliding session: renewed token "
            f"(was expiring in {int(remaining.total_seconds() // 60)} min)"
        )

        return response
