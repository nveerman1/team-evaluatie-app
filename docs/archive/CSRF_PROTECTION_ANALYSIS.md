# CSRF Protection Analysis and Recommendation

## Executive Summary

**RECOMMENDATION: Implement Origin/Referer validation middleware now. Consider double-submit tokens as a future enhancement for defense-in-depth.**

## Current Authentication Architecture

- **Method**: Cookie-based authentication using HttpOnly cookies
- **Cookie Name**: `access_token`
- **Cookie Settings**: 
  - `httponly=True` (prevents JavaScript access)
  - `secure=True` (in production, requires HTTPS)
  - `samesite="lax"` (allows OAuth redirects but blocks CSRF on most state-changing requests)
- **OAuth Flow**: Azure AD authentication with callback redirects

## Approach 1: Origin/Referer Header Validation

### Overview
Validates that state-changing requests (POST, PUT, PATCH, DELETE) originate from trusted sources by checking Origin or Referer headers against an allowlist.

### Implementation Details
- **Applies to**: POST, PUT, PATCH, DELETE requests
- **Exemptions**: 
  - OAuth callback routes (`/api/v1/auth/azure/callback`, `/api/v1/auth/azure`, `/auth/*/callback`)
  - GET/HEAD/OPTIONS requests (idempotent, safe methods)
- **Validation Logic**:
  1. Check `Origin` header first (more reliable)
  2. Fallback to `Referer` header if Origin is missing
  3. Compare against allowlist: `settings.FRONTEND_URL` + `settings.CORS_ORIGINS`
  4. Return HTTP 403 if validation fails

### Pros
✅ **Simple implementation** - Single middleware, ~50 lines of code  
✅ **Low maintenance** - No token generation or storage needed  
✅ **Works seamlessly with SameSite=Lax** - Provides additional defense layer  
✅ **No frontend changes required** - Browsers send headers automatically  
✅ **Compatible with OAuth flows** - Exemptions for redirect-based auth  
✅ **Industry standard** - Used by Django, Flask, and many frameworks  

### Cons
❌ **Header spoofing risk** - Some proxies/browsers may strip headers  
❌ **Not foolproof** - Relies on browser behavior (though widely supported)  
❌ **Referer leakage concerns** - Some users/orgs disable Referer for privacy  
❌ **Missing headers** - Edge cases where headers aren't sent (rare with modern browsers)

### Security Strength
**Medium-High** - Effective against most CSRF attacks when combined with SameSite=Lax. Not 100% reliable due to potential header manipulation or missing headers, but provides strong practical protection.

### Browser Compatibility
**Excellent** - Modern browsers reliably send Origin/Referer headers for cross-origin requests. Edge cases (missing headers) can be handled gracefully.

## Approach 2: Double-Submit CSRF Tokens

### Overview
Generate a random token at login, store it in a non-HttpOnly cookie, and require the frontend to send it back via a custom header.

### Implementation Details
- **Token Generation**: At login, generate `secrets.token_urlsafe(32)`
- **Cookie Storage**: `csrf_token` cookie (NOT HttpOnly, so JavaScript can read)
- **Header Requirement**: Frontend must send `X-CSRF-Token` header with value from cookie
- **Validation**: Backend compares header value with cookie value
- **Token Lifecycle**: Generated at login, expires with session

### Pros
✅ **Cryptographically strong** - Random tokens are very difficult to guess  
✅ **Explicit validation** - Clear contract between frontend and backend  
✅ **Defense in depth** - Adds another security layer  
✅ **Fine-grained control** - Can customize token per-request if needed  

### Cons
❌ **Complex implementation** - Requires changes to auth flow, middleware, and frontend  
❌ **Frontend integration required** - Must modify all API calls to include header  
❌ **More moving parts** - Token generation, storage, validation, refresh logic  
❌ **Session coupling** - Tokens must be synchronized with JWT lifecycle  
❌ **OAuth complexity** - Additional coordination needed for redirect flows  
❌ **XSS vulnerability** - If attacker has XSS, they can read non-HttpOnly cookie and bypass protection

### Security Strength
**High** - Very strong protection when implemented correctly. However, vulnerable to XSS attacks (which would also compromise other aspects of the application).

### Implementation Complexity
**High** - Requires coordinated changes across:
- Auth router (token generation at login)
- Middleware (token validation)
- Frontend (reading cookie, setting header)
- All API client code

## OAuth Flow Compatibility Analysis

### Current Azure AD Flow
1. User clicks "Login" → Frontend sends to `/api/v1/auth/azure?school_id=X`
2. Backend redirects to Microsoft login page
3. User authenticates with Microsoft
4. Microsoft redirects back to `/api/v1/auth/azure/callback?code=...&state=...`
5. Backend validates, creates JWT, sets HttpOnly cookie
6. Backend redirects to frontend with cookie set

### Origin/Referer with OAuth
✅ **Fully Compatible** - OAuth callback routes are exempted from CSRF checks. The flow works unchanged because:
- `/auth/azure` (GET) - Not protected (safe method)
- `/auth/azure/callback` (GET) - Explicitly exempted from CSRF checks
- Cookie is set server-side without requiring CSRF token

### Double-Submit with OAuth
⚠️ **More Complex** - Requires careful coordination:
- CSRF token must be generated during callback
- Token must be set in non-HttpOnly cookie alongside JWT
- Frontend must extract token and include in subsequent requests
- Adds complexity to redirect flow

## Comparison Matrix

| Aspect | Origin/Referer | Double-Submit |
|--------|---------------|---------------|
| **Security Strength** | Medium-High | High |
| **Implementation Complexity** | Low (~50 LOC) | High (~200+ LOC) |
| **Frontend Changes** | None | Extensive |
| **OAuth Compatibility** | Excellent | Moderate |
| **Maintenance Burden** | Low | Medium |
| **Browser Compatibility** | Excellent | Excellent |
| **XSS Resistance** | N/A (headers) | Vulnerable |
| **Header Stripping Resistance** | Vulnerable | Strong |
| **Industry Adoption** | Very High | High |

## Attack Scenarios

### Scenario 1: Basic CSRF Attack
**Attack**: Malicious site tricks user into submitting form to our API  
**Origin/Referer Defense**: ✅ Blocked - Headers reveal malicious origin  
**Double-Submit Defense**: ✅ Blocked - Attacker can't read token from cookie (SOP)  

### Scenario 2: XSS Attack
**Attack**: Attacker injects JavaScript into our site  
**Origin/Referer Defense**: ⚠️ Bypassed - Headers look legitimate  
**Double-Submit Defense**: ⚠️ Bypassed - JavaScript can read non-HttpOnly cookie  
**Note**: XSS is a separate vulnerability class that requires different mitigation (CSP, input sanitization, output encoding)

### Scenario 3: Proxy Stripping Headers
**Attack**: Corporate proxy removes Origin/Referer headers  
**Origin/Referer Defense**: ⚠️ Degraded - May fail validation (can whitelist/log)  
**Double-Submit Defense**: ✅ Unaffected - Tokens travel in cookie/header  

### Scenario 4: Subdomain Attacker
**Attack**: Attacker controls subdomain, sets cookies for parent domain  
**Origin/Referer Defense**: ✅ Blocked - Origin shows subdomain  
**Double-Submit Defense**: ⚠️ Bypassed if cookies scoped to parent domain  
**Mitigation**: Properly scope cookies to specific subdomain

## Current Security Posture

We already have:
1. ✅ **SameSite=Lax** - Blocks CSRF on POST/PUT/PATCH/DELETE from cross-site context
2. ✅ **HttpOnly cookies** - Prevents JavaScript theft of JWT
3. ✅ **CORS restrictions** - Explicit allowlist, no wildcards
4. ✅ **HTTPS enforcement** (production) - Prevents man-in-the-middle
5. ✅ **Security headers** - CSP, X-Frame-Options, etc.

**Gap**: SameSite=Lax has known limitations:
- Top-level navigations (link clicks) send cookies even cross-site
- Some browsers have implementation quirks
- Defense-in-depth principle suggests additional layer

## Recommendation

### Phase 1: Implement Origin/Referer Validation (Now)
**Rationale**:
- ✅ Provides immediate, strong protection with minimal effort
- ✅ No frontend changes required
- ✅ Works seamlessly with existing OAuth flow
- ✅ Low maintenance burden
- ✅ Industry standard approach
- ✅ Complements existing SameSite=Lax protection

**Implementation Priority**: HIGH

### Phase 2: Consider Double-Submit Tokens (Future)
**Rationale**:
- Defense-in-depth: Adds another layer if needed
- May be required for specific compliance requirements
- Useful if we need to support older browsers or environments with header issues

**Implementation Priority**: LOW (only if specific need arises)

## Implementation Plan (Phase 1)

### 1. Extend SecurityHeadersMiddleware
Add CSRF validation logic to existing security middleware:
```python
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # CSRF validation BEFORE processing request
        if self._is_state_changing_request(request):
            if not self._is_csrf_exempt_path(request.url.path):
                if not self._validate_origin_or_referer(request):
                    return Response(
                        content="CSRF validation failed",
                        status_code=403
                    )
        
        # Continue with existing security headers logic
        response = await call_next(request)
        # ... add security headers ...
        return response
```

### 2. Configuration
Add to `config.py`:
```python
# CSRF Protection
CSRF_TRUSTED_ORIGINS: List[str] = property that combines FRONTEND_URL + CORS_ORIGINS
```

### 3. Exemptions
OAuth-related routes to exempt:
- `/api/v1/auth/azure/callback` (Azure AD OAuth callback)
- `/api/v1/auth/azure` (Azure AD OAuth initiation) 
- Pattern: `/api/v1/auth/*/callback` (future OAuth providers)
- `/api/v1/auth/dev-login` (dev-only, already protected by ENABLE_DEV_LOGIN flag)

### 4. Testing
- Test CSRF protection on POST/PUT/PATCH/DELETE
- Test exemptions for OAuth routes
- Test graceful handling of missing headers
- Test integration with Azure AD login flow

## Logging and Monitoring

Should log:
- CSRF validation failures (potential attacks)
- Missing Origin/Referer headers (for monitoring/debugging)
- Exempted routes accessed (for audit trail)

Example:
```python
logger.warning(
    f"CSRF validation failed: {request.method} {request.url.path} "
    f"from origin={origin} (allowed: {allowed_origins})"
)
```

## Future Considerations

1. **Rate limiting on CSRF failures** - Prevent brute force attempts
2. **Alerting on repeated failures** - Security monitoring
3. **Double-submit tokens if needed** - For specific requirements
4. **SameSite=Strict evaluation** - More restrictive, but may break OAuth

## References

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Django CSRF Protection](https://docs.djangoproject.com/en/stable/ref/csrf/)
- [Flask-WTF CSRF Protection](https://flask-wtf.readthedocs.io/en/stable/csrf.html)
- [MDN: SameSite Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
