# Double-Submit CSRF Token Implementation Example

## Overview

This document provides a **reference implementation** of double-submit CSRF tokens as an alternative to the Origin/Referer validation we've implemented.

⚠️ **Note**: This is NOT currently implemented in the codebase. It's provided as a reference for future consideration (Phase 2).

## How Double-Submit Tokens Work

1. **At Login**: Generate random CSRF token, store in non-HttpOnly cookie
2. **On Request**: Frontend reads token from cookie, sends via `X-CSRF-Token` header
3. **Validation**: Backend compares header value with cookie value
4. **Match = Valid**: Request proceeds
5. **Mismatch = Attack**: Request blocked with 403

## Implementation

### Step 1: Token Generation at Login

**File**: `backend/app/api/v1/routers/auth.py`

```python
import secrets

@router.get("/azure/callback")
def azure_callback(
    code: str = Query(..., description="Authorization code from Azure AD"),
    state: str = Query(..., description="State parameter for CSRF protection"),
    db: Session = Depends(get_db),
):
    # ... existing OAuth validation code ...
    
    # Create JWT token (existing)
    jwt_token = create_access_token(
        sub=user.email, role=user.role, school_id=user.school_id
    )
    
    # NEW: Generate CSRF token
    csrf_token = secrets.token_urlsafe(32)
    
    # Create response with redirect
    response = RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
    
    # Set HttpOnly cookie with JWT token (existing)
    response.set_cookie(
        key="access_token",
        value=jwt_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        max_age=604800,
        path="/",
        samesite="lax",
    )
    
    # NEW: Set CSRF token cookie (NOT HttpOnly, so JavaScript can read)
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,  # MUST be False so frontend can read
        secure=settings.COOKIE_SECURE,
        max_age=604800,
        path="/",
        samesite="lax",
    )
    
    return response
```

**Also Update**:
- `/auth/dev-login` endpoint (add CSRF token generation)
- `/auth/logout` endpoint (clear CSRF token cookie)

### Step 2: Middleware Validation

**File**: `backend/app/api/middleware/csrf_token.py` (NEW FILE)

```python
"""CSRF token validation middleware."""

from __future__ import annotations

import logging
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class CSRFTokenMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate CSRF tokens via double-submit pattern.
    
    Validates that:
    1. Cookie contains csrf_token
    2. Header contains X-CSRF-Token
    3. Values match
    
    Exempts OAuth callback routes and safe methods (GET, HEAD, OPTIONS).
    """
    
    # OAuth routes exempt from CSRF checks
    CSRF_EXEMPT_PATHS = [
        "/api/v1/auth/azure/callback",
        "/api/v1/auth/azure",
    ]
    
    def _is_state_changing_request(self, request: Request) -> bool:
        """Check if request method requires CSRF protection."""
        return request.method in ["POST", "PUT", "PATCH", "DELETE"]
    
    def _is_csrf_exempt_path(self, path: str) -> bool:
        """Check if path is exempt from CSRF validation."""
        return path in self.CSRF_EXEMPT_PATHS
    
    def _validate_csrf_token(self, request: Request) -> bool:
        """
        Validate CSRF token via double-submit pattern.
        
        Returns True if validation passes, False otherwise.
        """
        # Get token from cookie
        csrf_cookie = request.cookies.get("csrf_token")
        if not csrf_cookie:
            logger.warning(
                f"CSRF validation failed: No csrf_token cookie. "
                f"Request: {request.method} {request.url.path}"
            )
            return False
        
        # Get token from header
        csrf_header = request.headers.get("x-csrf-token")
        if not csrf_header:
            logger.warning(
                f"CSRF validation failed: No X-CSRF-Token header. "
                f"Request: {request.method} {request.url.path}"
            )
            return False
        
        # Compare tokens (constant-time comparison to prevent timing attacks)
        import hmac
        if not hmac.compare_digest(csrf_cookie, csrf_header):
            logger.warning(
                f"CSRF validation failed: Token mismatch. "
                f"Request: {request.method} {request.url.path}"
            )
            return False
        
        logger.debug(f"CSRF token validation passed for {request.method} {request.url.path}")
        return True
    
    async def dispatch(
        self,
        request: Request,
        call_next: Callable,
    ) -> Response:
        """Validate CSRF token before processing request."""
        # Check if CSRF protection is required
        if self._is_state_changing_request(request):
            if not self._is_csrf_exempt_path(request.url.path):
                if not self._validate_csrf_token(request):
                    logger.error(
                        f"CSRF attack blocked: {request.method} {request.url.path} "
                        f"from {request.client.host if request.client else 'unknown'}"
                    )
                    return Response(
                        content="CSRF validation failed: Token mismatch or missing",
                        status_code=403,
                    )
        
        # Process request
        return await call_next(request)
```

### Step 3: Register Middleware

**File**: `backend/app/main.py`

```python
from app.api.middleware.csrf_token import CSRFTokenMiddleware

app = FastAPI()

# Security headers (apply first)
app.add_middleware(SecurityHeadersMiddleware)

# CSRF token validation (NEW - apply before rate limiting)
app.add_middleware(CSRFTokenMiddleware)

# Rate limiting
app.add_middleware(RateLimitMiddleware)

# CORS configuration
app.add_middleware(CORSMiddleware, ...)
```

### Step 4: Frontend Integration

**File**: `frontend/src/lib/api.ts` (or equivalent)

```typescript
// Utility function to get CSRF token from cookie
function getCSRFToken(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrf_token') {
      return decodeURIComponent(value);
    }
  }
  return null;
}

// API client wrapper
export async function apiRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Add CSRF token to headers for state-changing requests
  const method = options.method?.toUpperCase() || 'GET';
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = getCSRFToken();
    if (csrfToken) {
      options.headers = {
        ...options.headers,
        'X-CSRF-Token': csrfToken,
      };
    } else {
      console.warn('CSRF token not found in cookies');
    }
  }
  
  return fetch(url, {
    ...options,
    credentials: 'include', // Include cookies
  });
}

// Example usage
async function createRubric(data: RubricData) {
  const response = await apiRequest('/api/v1/rubrics', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return response.json();
}
```

**Alternative**: Use Axios interceptor

```typescript
import axios from 'axios';

// Create axios instance
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true, // Include cookies
});

// Add request interceptor to inject CSRF token
apiClient.interceptors.request.use(
  (config) => {
    const method = config.method?.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method || '')) {
      const csrfToken = getCSRFToken();
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Helper to get CSRF token
function getCSRFToken(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrf_token') {
      return decodeURIComponent(value);
    }
  }
  return null;
}
```

### Step 5: Handle Token Refresh

When JWT token expires and is refreshed, CSRF token should also be refreshed:

```python
# In token refresh endpoint (if you have one)
@router.post("/refresh")
def refresh_token(request: Request, response: Response):
    # ... JWT refresh logic ...
    
    # Generate new CSRF token
    new_csrf_token = secrets.token_urlsafe(32)
    
    response.set_cookie(
        key="csrf_token",
        value=new_csrf_token,
        httponly=False,
        secure=settings.COOKIE_SECURE,
        max_age=604800,
        path="/",
        samesite="lax",
    )
    
    return {"message": "Token refreshed"}
```

## Testing

### Test Cases

**File**: `backend/tests/test_csrf_token.py` (NEW FILE)

```python
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.middleware.csrf_token import CSRFTokenMiddleware


@pytest.fixture
def app_with_csrf_token():
    """Create FastAPI app with CSRF token middleware"""
    app = FastAPI()
    app.add_middleware(CSRFTokenMiddleware)
    
    @app.post("/api/v1/test")
    def test_post():
        return {"message": "success"}
    
    @app.get("/api/v1/test")
    def test_get():
        return {"message": "success"}
    
    @app.post("/api/v1/auth/azure/callback")
    def azure_callback():
        return {"message": "oauth"}
    
    return app


class TestCSRFToken:
    def test_post_with_valid_token(self, app_with_csrf_token):
        """Test POST with matching token in cookie and header"""
        client = TestClient(app_with_csrf_token)
        token = "test-csrf-token-12345"
        
        response = client.post(
            "/api/v1/test",
            cookies={"csrf_token": token},
            headers={"X-CSRF-Token": token}
        )
        assert response.status_code == 200
    
    def test_post_with_mismatched_token(self, app_with_csrf_token):
        """Test POST with mismatched tokens is blocked"""
        client = TestClient(app_with_csrf_token)
        
        response = client.post(
            "/api/v1/test",
            cookies={"csrf_token": "cookie-token"},
            headers={"X-CSRF-Token": "header-token"}
        )
        assert response.status_code == 403
    
    def test_post_without_cookie(self, app_with_csrf_token):
        """Test POST without CSRF cookie is blocked"""
        client = TestClient(app_with_csrf_token)
        
        response = client.post(
            "/api/v1/test",
            headers={"X-CSRF-Token": "token"}
        )
        assert response.status_code == 403
    
    def test_post_without_header(self, app_with_csrf_token):
        """Test POST without CSRF header is blocked"""
        client = TestClient(app_with_csrf_token)
        
        response = client.post(
            "/api/v1/test",
            cookies={"csrf_token": "token"}
        )
        assert response.status_code == 403
    
    def test_get_without_token(self, app_with_csrf_token):
        """Test GET without token is allowed (safe method)"""
        client = TestClient(app_with_csrf_token)
        
        response = client.get("/api/v1/test")
        assert response.status_code == 200
    
    def test_oauth_callback_exempt(self, app_with_csrf_token):
        """Test OAuth callback is exempt from CSRF checks"""
        client = TestClient(app_with_csrf_token)
        
        response = client.post("/api/v1/auth/azure/callback")
        assert response.status_code == 200
```

## Comparison: Origin/Referer vs Double-Submit Tokens

| Aspect | Origin/Referer (Implemented) | Double-Submit Tokens (This Doc) |
|--------|------------------------------|----------------------------------|
| **Backend Changes** | ✅ Minimal (~150 LOC) | ❌ Significant (~300 LOC) |
| **Frontend Changes** | ✅ None required | ❌ All API calls must be updated |
| **OAuth Compatibility** | ✅ Excellent | ⚠️ Requires coordination |
| **Security Strength** | ✅ Medium-High | ✅ High |
| **XSS Resistance** | ✅ Not applicable | ❌ Vulnerable (non-HttpOnly cookie) |
| **Header Stripping** | ❌ Vulnerable | ✅ Immune |
| **Implementation Effort** | ✅ 2-3 hours | ❌ 8-12 hours |
| **Maintenance** | ✅ Low | ⚠️ Medium |

## When to Use Double-Submit Tokens

Consider implementing double-submit tokens if:

1. **Compliance Requirements**: Regulations explicitly mandate CSRF tokens
2. **Header Stripping**: Widespread issues with proxy stripping Origin/Referer
3. **Defense-in-Depth**: Want additional layer beyond Origin/Referer
4. **Explicit Token Management**: Prefer explicit token lifecycle over header validation

## Security Considerations

### XSS Vulnerability

⚠️ **Critical**: If attacker achieves XSS, they can:
1. Read CSRF token from cookie (not HttpOnly)
2. Make authenticated requests with stolen token
3. Bypass CSRF protection entirely

**Mitigation**:
- Strong CSP headers
- Input sanitization
- Output encoding
- Regular security audits

### Token Storage

**Cookie Attributes**:
- `httponly=False` - ⚠️ MUST be False for JavaScript to read
- `secure=True` - HTTPS only in production
- `samesite="lax"` - Allow OAuth redirects

### Constant-Time Comparison

Use `hmac.compare_digest()` to prevent timing attacks when comparing tokens:

```python
import hmac

# Good (constant-time)
if hmac.compare_digest(csrf_cookie, csrf_header):
    # Valid

# Bad (vulnerable to timing attacks)
if csrf_cookie == csrf_header:
    # Don't do this
```

## Migration Path

If you decide to implement this in the future:

### Phase 1: Dual Protection (Recommended)
1. Keep Origin/Referer validation active
2. Add double-submit token validation
3. Log failures from both (don't enforce tokens yet)
4. Monitor for issues

### Phase 2: Token Enforcement
1. Once confident tokens work correctly
2. Make token validation mandatory
3. Keep Origin/Referer as backup

### Phase 3: Simplification (Optional)
1. Remove Origin/Referer validation if desired
2. Keep only token validation
3. OR keep both for defense-in-depth

## References

- **OWASP CSRF Prevention**: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#double-submit-cookie
- **Django CSRF**: https://docs.djangoproject.com/en/stable/ref/csrf/
- **Express CSRF**: https://github.com/expressjs/csurf

## Conclusion

Double-submit CSRF tokens provide strong protection but require significantly more implementation effort and ongoing maintenance compared to Origin/Referer validation.

**Recommendation**: Stick with Origin/Referer validation (already implemented) unless specific requirements necessitate tokens.

This document serves as a reference implementation if you need to add tokens in the future.
