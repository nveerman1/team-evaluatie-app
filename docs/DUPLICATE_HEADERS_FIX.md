# Duplicate Security Headers Fix - Documentation

## Problem Statement

HTTP responses from production (`https://app.technasiummbh.nl/api/v1/auth/me`) were showing duplicate security headers. Each header appeared multiple times in the same response, including:

- `Strict-Transport-Security`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `X-XSS-Protection`
- `Referrer-Policy`
- `Permissions-Policy`
- `Content-Security-Policy`

## Root Cause Analysis

### Sources of Duplicate Headers

1. **Nginx Configuration**
   - `/ops/nginx/nginx.conf` (lines 71-74): Set 4 security headers globally
   - `/ops/nginx/site.conf` (lines 108-116): Set 7 security headers in HTTPS server block
   - **Result**: These 4 headers were duplicated in nginx configuration itself

2. **Backend Middleware**
   - `/backend/app/api/middleware/security_headers.py`: FastAPI middleware that added all 7 security headers to every response
   - **Result**: All headers from nginx were duplicated by backend

3. **Frontend Next.js** (Development only)
   - `/frontend/next.config.ts`: Sets headers for development mode
   - Not a production issue (Next.js standalone mode doesn't add headers)

### Why This Happened

- Nginx was configured to add headers at multiple levels (http block + server block)
- Backend middleware was always active, adding headers even in production behind nginx
- No coordination between the reverse proxy (nginx) and application layer (FastAPI)

## Solution Implemented

### 1. Nginx Configuration Consolidation

**File**: `/ops/nginx/nginx.conf`

**Change**: Removed duplicate security header directives from the global `http` block.

**Before** (lines 70-74):
```nginx
# Security headers (global, can be overridden)
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

**After**:
```nginx
# Security headers are now defined in site.conf (HTTPS server block only)
# to avoid duplication and ensure they're only set on secure connections
```

**Rationale**:
- Headers should only be defined once in nginx
- HTTPS-specific headers (like HSTS) should only be in the HTTPS server block
- All headers are now consolidated in `/ops/nginx/site.conf` HTTPS block

### 2. Backend Middleware Environment Flag

**Files Modified**:
- `/backend/app/core/config.py`
- `/backend/app/api/middleware/security_headers.py`
- `/backend/.env.production.example`

**Change**: Added `ENABLE_BACKEND_SECURITY_HEADERS` environment variable that:
- Defaults to `False` in production (NODE_ENV=production)
- Defaults to `True` in development (NODE_ENV=development)
- Can be explicitly overridden via environment variable

**Implementation** (`config.py`):
```python
ENABLE_BACKEND_SECURITY_HEADERS: bool = Field(default=True)

@field_validator("ENABLE_BACKEND_SECURITY_HEADERS", mode="after")
@classmethod
def default_backend_headers_by_env(cls, v, info):
    """Default to False in production (nginx handles headers), True in dev"""
    node_env = os.getenv("NODE_ENV", "development")
    # If explicitly set via env var, respect it
    if os.getenv("ENABLE_BACKEND_SECURITY_HEADERS") is not None:
        return v
    
    # Otherwise, default based on environment
    if node_env == "production":
        return False  # Nginx handles headers
    else:
        return True   # Enable for dev/test without nginx
```

**Implementation** (`security_headers.py`):
```python
async def dispatch(self, request: Request, call_next: Callable) -> Response:
    """Add security headers to response if enabled."""
    response = await call_next(request)
    
    # In production, nginx handles security headers to avoid duplicates
    if not settings.ENABLE_BACKEND_SECURITY_HEADERS:
        return response
    
    # Development mode: Add headers for testing without nginx
    # ... (rest of header logic)
```

**Rationale**:
- **Single Source of Truth**: In production, nginx at the edge is the authoritative source for security headers
- **Development Flexibility**: Developers can run the backend standalone without nginx and still get security headers
- **Explicit Control**: Can be overridden if needed for specific deployment scenarios

### 3. Test Updates

**File**: `/backend/tests/test_security.py`

**Changes**:
- Updated existing tests to explicitly enable headers during testing
- Added new tests:
  - `test_security_headers_disabled_in_production()`: Verifies headers are not added when flag is False
  - `test_backend_headers_default_to_false_in_production()`: Verifies production default
  - `test_backend_headers_default_to_true_in_development()`: Verifies development default

All tests pass ✅

### 4. Verification Script

**File**: `/scripts/check-duplicate-headers.sh`

Created a comprehensive validation script that:
- Checks nginx configuration for duplicate `add_header` directives
- Tests external HTTPS endpoints (through nginx)
- Tests internal backend endpoints (bypassing nginx)
- Validates that each security header appears exactly once
- Provides colored output with clear pass/fail indicators

**Usage**:
```bash
./scripts/check-duplicate-headers.sh
```

## Configuration Requirements

### Production Deployment

In production `.env` file:
```bash
NODE_ENV=production
ENABLE_BACKEND_SECURITY_HEADERS=false  # Optional - defaults to false in production
```

### Development

In development `.env` file (or defaults):
```bash
NODE_ENV=development
# ENABLE_BACKEND_SECURITY_HEADERS defaults to true in development
```

## Verification Commands

### Check External Responses (Through Nginx)
```bash
curl -s -D - -o /dev/null https://app.technasiummbh.nl/api/v1/auth/me | grep -i "x-frame-options"
```
Should show exactly **one** `X-Frame-Options` header.

### Check Internal Backend (Bypassing Nginx)
```bash
docker exec tea_backend sh -c 'curl -s -D - -o /dev/null http://localhost:8000/api/v1/auth/me' | grep -i "x-frame-options"
```
In production (with `NODE_ENV=production`), should show **zero** security headers (nginx handles them).

### Check Nginx Configuration
```bash
docker exec tea_nginx sh -c 'nginx -T 2>/dev/null | grep -i "add_header.*x-frame-options"'
```
Should show exactly **one** `add_header X-Frame-Options` directive.

### Run Comprehensive Check
```bash
./scripts/check-duplicate-headers.sh
```

## Security Impact

### ✅ No Security Degradation

- All security headers remain in place
- Headers are still applied to all HTTPS responses
- Same security policies enforced

### ✅ Improvements

- **Cleaner headers**: Exactly one instance of each header per response
- **Better maintainability**: Single source of truth for production headers
- **Compliance**: Avoids potential issues with duplicate CSP headers (some browsers may reject)
- **Performance**: Slightly reduced response size (no duplicate headers)

### Security Headers Still Enforced

All of these headers are still set (once) on production responses:
- ✅ `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- ✅ `X-Frame-Options: DENY`
- ✅ `X-Content-Type-Options: nosniff`
- ✅ `X-XSS-Protection: 1; mode=block`
- ✅ `Referrer-Policy: strict-origin-when-cross-origin`
- ✅ `Permissions-Policy: geolocation=(), microphone=(), camera=(), ...`
- ✅ `Content-Security-Policy: default-src 'self'; ...`

## Files Changed Summary

| File | Change | Why |
|------|--------|-----|
| `/ops/nginx/nginx.conf` | Removed 4 `add_header` directives | Eliminate nginx-level duplication |
| `/ops/nginx/site.conf` | No changes | Keeps all headers (single source) |
| `/backend/app/core/config.py` | Added `ENABLE_BACKEND_SECURITY_HEADERS` setting | Environment-based control |
| `/backend/app/api/middleware/security_headers.py` | Added flag check to skip in production | Prevent backend duplication |
| `/backend/.env.production.example` | Documented new setting | Production guidance |
| `/backend/tests/test_security.py` | Added 3 new tests, updated 2 existing | Verify new behavior |
| `/scripts/check-duplicate-headers.sh` | New validation script | Easy verification |

## Rollback Plan

If issues arise, rollback is simple:

1. **Revert nginx change**: Restore the 4 `add_header` lines in `/ops/nginx/nginx.conf`
2. **Disable the flag**: Set `ENABLE_BACKEND_SECURITY_HEADERS=true` in production
3. **Restart services**: `docker compose restart nginx backend`

This will restore the previous behavior (with duplicates, but functional).

## Related Security Fixes

This change builds on existing security measures:
- Nginx strips dangerous client headers (X-User-Email, etc.) - ✅ Still active
- Rate limiting - ✅ Still active  
- HTTPS enforcement - ✅ Still active
- All authentication/authorization - ✅ Still active

## Testing Checklist

- [x] All security tests pass
- [x] Headers default to disabled in production
- [x] Headers default to enabled in development
- [x] Middleware respects the flag
- [x] Nginx configuration simplified
- [x] Verification script created
- [ ] Validate in staging environment
- [ ] Validate in production environment

## References

- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [Nginx add_header documentation](http://nginx.org/en/docs/http/ngx_http_headers_module.html#add_header)
- [FastAPI Middleware](https://fastapi.tiangolo.com/tutorial/middleware/)
