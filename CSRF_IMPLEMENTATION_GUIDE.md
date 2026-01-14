# CSRF Protection Implementation Guide

## Overview

This guide documents the CSRF protection implementation for the Team Evaluatie App. We have implemented **Origin/Referer header validation** as the primary CSRF defense mechanism.

## What Was Implemented

### 1. Origin/Referer Validation Middleware

**Location**: `backend/app/api/middleware/security_headers.py`

The `SecurityHeadersMiddleware` now performs CSRF validation on all state-changing requests (POST, PUT, PATCH, DELETE).

**How It Works**:
1. Intercepts all incoming requests before they reach route handlers
2. Checks if the request method requires CSRF protection (POST, PUT, PATCH, DELETE)
3. Validates that the request originates from a trusted source by checking:
   - **Origin header** (preferred, more reliable)
   - **Referer header** (fallback if Origin is missing)
4. Compares headers against allowlist from configuration
5. Returns HTTP 403 if validation fails
6. Allows the request to proceed if validation passes

### 2. Configuration

**Location**: `backend/app/core/config.py`

No additional configuration settings were required. The middleware uses existing settings:

- `FRONTEND_URL`: Primary trusted origin (e.g., `http://localhost:3000`)
- `CORS_ORIGINS`: List of additional trusted origins (e.g., `http://localhost:3000,http://127.0.0.1:3000`)

**Default Values**:
```python
FRONTEND_URL = "http://localhost:3000"
CORS_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]
```

### 3. OAuth Route Exemptions

The following routes are **exempt** from CSRF checks to allow OAuth redirect flows:

**Exact Matches**:
- `/api/v1/auth/azure/callback` - Azure AD OAuth callback
- `/api/v1/auth/azure` - Azure AD OAuth initiation (GET request, already safe)

**Pattern Matches**:
- `/api/v1/auth/*/callback` - Future OAuth provider callbacks (e.g., GitHub, Google)

**Rationale**: OAuth callback routes receive requests from external identity providers (Microsoft, etc.) that won't include our Origin/Referer headers. These flows have built-in CSRF protection via the `state` parameter.

### 4. Safe Methods

The following HTTP methods are **not protected** (they are idempotent/safe):
- GET
- HEAD
- OPTIONS

These methods should not change server state, so CSRF protection is unnecessary. CORS middleware handles cross-origin access separately.

## Testing

### Test Coverage

**Location**: `backend/tests/test_csrf_protection.py`

We have comprehensive test coverage with **25 tests** covering:

1. **POST Request Protection** (8 tests)
   - Valid Origin header
   - Valid Referer header
   - Invalid Origin header
   - Invalid Referer header
   - Missing headers
   - Origin precedence over Referer
   - CORS origins
   - Trailing slash normalization

2. **Other State-Changing Methods** (6 tests)
   - PUT with valid/invalid origin
   - PATCH with valid/invalid origin
   - DELETE with valid/invalid origin

3. **Safe Methods** (2 tests)
   - GET without origin allowed
   - GET with any origin allowed

4. **OAuth Exemptions** (3 tests)
   - Azure AD callback exempt
   - Azure login endpoint
   - Future OAuth callbacks (pattern matching)

5. **Origin Extraction** (3 tests)
   - Referer with path
   - Referer with port
   - HTTPS Referer

6. **Configuration** (1 test)
   - Default localhost origins

7. **Logging** (1 test)
   - CSRF failures are logged

8. **Integration** (1 test)
   - CSRF and security headers both work

### Running Tests

```bash
cd backend
pytest tests/test_csrf_protection.py -v
```

All 25 tests pass ✅

Existing security tests also pass (15 tests) ✅

## Architecture Decisions

### Why Origin/Referer Validation?

1. **Simple Implementation**: Single middleware, ~150 lines of code
2. **No Frontend Changes**: Browsers send headers automatically
3. **OAuth Compatible**: Easy to exempt redirect routes
4. **Industry Standard**: Used by Django, Flask, and many frameworks
5. **Complements SameSite=Lax**: Defense-in-depth approach

### Why Not Double-Submit Tokens (Yet)?

1. **Complexity**: Requires changes to auth flow, middleware, and frontend
2. **OAuth Coordination**: More complex to handle with redirect flows
3. **XSS Vulnerability**: Non-HttpOnly cookie can be read if XSS exists
4. **Not Needed Now**: Origin/Referer provides strong protection

Double-submit tokens can be added later as a Phase 2 enhancement if needed.

## Security Considerations

### Attack Scenarios Protected Against

✅ **Basic CSRF Attack**
- Malicious site tricks user into submitting form
- **Defense**: Headers reveal malicious origin, request blocked

✅ **Cross-Site Form Submission**
- Attacker creates form pointing to our API
- **Defense**: Form submission includes Origin, doesn't match allowlist

✅ **Top-Level Navigation CSRF**
- SameSite=Lax has edge case with top-level navigation
- **Defense**: Origin/Referer validation blocks cross-origin requests

### Known Limitations

⚠️ **XSS Attacks**
- If attacker has XSS, they can make requests with legitimate headers
- **Mitigation**: CSP headers, input sanitization, output encoding (separate concern)

⚠️ **Header Stripping**
- Some corporate proxies may strip Origin/Referer
- **Mitigation**: Graceful degradation, monitoring, whitelist specific cases if needed

⚠️ **Missing Headers**
- Rare cases where headers aren't sent
- **Current Behavior**: Request is blocked (fail secure)
- **Future**: Could add configurable fallback behavior

### Defense-in-Depth

CSRF protection is one layer in a multi-layered security approach:

1. ✅ **SameSite=Lax Cookies** - First line of defense
2. ✅ **Origin/Referer Validation** - Additional layer (NEW)
3. ✅ **CORS Restrictions** - Explicit allowlist, no wildcards
4. ✅ **HTTPS Enforcement** - Prevents MITM (production)
5. ✅ **Security Headers** - CSP, X-Frame-Options, etc.
6. ✅ **HttpOnly Cookies** - Prevents JavaScript theft of JWT

## Logging and Monitoring

### What Gets Logged

**CSRF Validation Failures** (WARNING level):
```
CSRF validation failed: Origin 'http://evil.com' not in trusted origins.
Allowed: ['http://localhost:3000', 'http://127.0.0.1:3000'].
Request: POST /api/v1/test
```

**CSRF Attacks Blocked** (ERROR level):
```
CSRF attack blocked: POST /api/v1/test from 192.168.1.100
```

**Missing Headers** (WARNING level):
```
CSRF validation failed: Missing both Origin and Referer headers.
Request: POST /api/v1/test from 192.168.1.100
```

**Exempt Routes** (DEBUG level):
```
CSRF check skipped for exempt path: /api/v1/auth/azure/callback
```

### Monitoring Recommendations

1. **Alert on repeated CSRF failures** from same IP (potential attack)
2. **Monitor missing header warnings** (may indicate proxy issues)
3. **Track exempt route usage** (for audit trail)
4. **Review logs weekly** for suspicious patterns

## Deployment Checklist

### Development Environment

✅ No changes required - defaults work out of the box
```env
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### Production Environment

✅ Ensure proper origins are configured:
```env
FRONTEND_URL=https://app.example.com
CORS_ORIGINS=https://app.example.com
COOKIE_SECURE=true
```

### Deployment Steps

1. **Deploy Backend**
   - Middleware is automatically enabled (no feature flag)
   - Check logs for CSRF validation events

2. **Verify OAuth Flow**
   - Test Azure AD login
   - Verify callback route is exempt
   - Check user can successfully authenticate

3. **Test State-Changing Requests**
   - POST request from frontend → should work
   - POST request from Postman without Origin → should fail
   - PUT/PATCH/DELETE from frontend → should work

4. **Monitor Logs**
   - No CSRF failures for legitimate traffic
   - Missing header warnings should be minimal
   - OAuth callbacks logged as exempt

## Troubleshooting

### Issue: "CSRF validation failed" for legitimate requests

**Cause**: Origin/Referer header doesn't match allowlist

**Solution**:
1. Check `FRONTEND_URL` and `CORS_ORIGINS` settings
2. Ensure no typos in URLs (http vs https, trailing slashes)
3. Verify frontend is sending correct headers

### Issue: OAuth login broken

**Cause**: Callback route not properly exempted

**Solution**:
1. Verify route path matches exactly: `/api/v1/auth/azure/callback`
2. Check logs for "CSRF check skipped for exempt path"
3. Ensure pattern matches: `/api/v1/auth/*/callback`

### Issue: Missing Origin/Referer headers

**Cause**: Corporate proxy, privacy settings, or old browser

**Solution**:
1. Monitor frequency in logs
2. If widespread, consider fallback strategy:
   - Whitelist specific IPs/user agents
   - Add configurable fail-open mode (not recommended for production)
3. Modern browsers should send these headers reliably

### Issue: CORS errors in browser console

**Cause**: Separate from CSRF, related to CORS middleware

**Solution**:
1. Check `CORS_ORIGINS` includes frontend URL
2. Verify `allow_credentials=True` in CORS middleware
3. Ensure OPTIONS requests are handled

## Future Enhancements (Phase 2)

### Double-Submit CSRF Tokens

If additional protection is needed in the future, consider implementing double-submit tokens:

**Implementation**: See `CSRF_DOUBLE_SUBMIT_EXAMPLE.md` for code examples

**When to Consider**:
- Compliance requirements mandate explicit tokens
- Header stripping becomes widespread issue
- Need defense-in-depth beyond current layers

**Tradeoffs**:
- More complex implementation
- Requires frontend changes
- Still vulnerable to XSS (same as Origin/Referer)

### Rate Limiting on CSRF Failures

Add rate limiting specifically for CSRF validation failures:
- Block IP after N failures in M minutes
- Helps prevent brute-force attempts
- Can be added to existing rate limiting middleware

### Custom CSRF Exempt Routes

Add configuration to allow custom exempt routes:
```python
CSRF_EXEMPT_ROUTES = [
    "/api/v1/webhooks/*",  # External webhooks
    "/api/v1/public/*",    # Public APIs
]
```

## References

- **Analysis Document**: See `CSRF_PROTECTION_ANALYSIS.md` for detailed comparison
- **Code**: `backend/app/api/middleware/security_headers.py`
- **Tests**: `backend/tests/test_csrf_protection.py`
- **OWASP CSRF Prevention**: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- **MDN SameSite Cookies**: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite

## Summary

✅ **CSRF Protection Implemented**: Origin/Referer validation on all state-changing requests  
✅ **OAuth Compatible**: Callback routes properly exempted  
✅ **Well Tested**: 25 comprehensive tests, all passing  
✅ **Production Ready**: No breaking changes, backward compatible  
✅ **Minimal Maintenance**: Simple implementation, industry standard approach  

The implementation provides strong CSRF protection while maintaining compatibility with the existing OAuth-based authentication flow.
