# Secure Auth UX Implementation Summary

## Overview
This implementation adds comprehensive authentication and authorization controls to the Team Evaluatie App, with environment-based dev-login toggles and role-based route protection.

## Key Features Implemented

### 1. Environment-Based Dev-Login Control

**Backend Flag: `ENABLE_DEV_LOGIN`**
- Default: `false` in production, `true` in development
- Controls whether the `/auth/dev-login` endpoint is available
- When disabled, endpoint returns 404 (not 403) to not leak existence

**Frontend Flag: `NEXT_PUBLIC_ENABLE_DEV_LOGIN`**
- Default: `false` in production, `true` in development  
- Controls whether dev-login UI is rendered on login page
- Clean separation between development and production UX

### 2. Secure Redirect Flow

**Backend Redirect Validation (`redirect_validator.py`):**
- Validates `returnTo` parameters to prevent open redirect attacks
- Blocks absolute URLs (`https://evil.com`)
- Blocks protocol-relative URLs (`//evil.com`)
- Blocks javascript: and other dangerous protocols
- Only allows relative paths starting with `/`

**Role-Based Home Paths:**
- Admin → `/teacher`
- Teacher → `/teacher`
- Student → `/student`
- Unknown → `/` (fallback)

### 3. Frontend Route Protection

**Middleware (`middleware.ts`):**
- Checks for `access_token` cookie before allowing access
- Protects `/teacher/*` and `/student/*` routes
- Redirects unauthenticated users to login with `returnTo` parameter
- Preserves intended destination for post-login navigation

**Layout-Based Role Checks:**
- `TeacherLayout`: Only allows admin/teacher roles
- `StudentLayout`: Only allows student role
- Redirects users to their correct home if accessing wrong route
- Shows loading state during authentication check

### 4. Enhanced Azure AD Flow

**State Parameter (Base64-Encoded JSON):**
```json
{
  "school_id": 1,
  "return_to": "/teacher/rubrics",
  "token": "random-csrf-token"
}
```
- Robust parsing (handles colons in URLs)
- CSRF protection maintained
- Optional returnTo preserved through OAuth flow

**Callback Behavior:**
1. Validates state and extracts parameters
2. Verifies school exists in database
3. Exchanges auth code for token (MSAL validates)
4. Gets user profile from Microsoft Graph
5. Creates/updates user in database
6. Determines role from DB (not Azure claims)
7. Sets HttpOnly JWT cookie
8. Redirects to `returnTo` OR role-specific home

### 5. Dev-Login Endpoint

**POST `/api/v1/auth/dev-login`**
- Query params: `email` (required), `return_to` (optional)
- Returns 404 when `ENABLE_DEV_LOGIN=false`
- Returns 401 for non-existent users
- Sets JWT cookie and redirects to role home or returnTo
- Validates returnTo to prevent open redirect

### 6. Updated Login Page

**Changes:**
- Title changed from "Team Evaluatie App — MVP" to "Team Evaluatie App"
- Removed Student/Teacher buttons (redirect happens post-auth)
- Dev-login section only renders when `NEXT_PUBLIC_ENABLE_DEV_LOGIN=true`
- Clear visual distinction (yellow warning style)
- Supports Enter key to submit
- Preserves returnTo from URL params

## Security Improvements

### Open Redirect Prevention
✅ All redirect URLs validated before use
✅ Only relative paths accepted
✅ Protocol-relative URLs rejected
✅ Absolute URLs rejected

### Dev-Login Protection
✅ Backend endpoint returns 404 when disabled
✅ Frontend UI hidden when disabled  
✅ Nginx X-User-Email header stripping remains intact
✅ Clear environment-based controls

### Authentication Gates
✅ Middleware protects routes before rendering
✅ Layouts perform role checks after auth
✅ Unauthenticated users redirected to login
✅ Wrong-role users redirected to correct home

### Cookie Security
✅ HttpOnly flag set
✅ Secure flag in production
✅ SameSite=Lax (allows OAuth redirects)
✅ 7-day max age

## Configuration Files

### Backend

**`.env.example` (Development):**
```bash
NODE_ENV=development
ENABLE_DEV_LOGIN=true
COOKIE_SECURE=false
```

**`.env.production.example` (Production):**
```bash
NODE_ENV=production
ENABLE_DEV_LOGIN=false
COOKIE_SECURE=true
```

### Frontend

**`.env.example` (Development):**
```bash
NEXT_PUBLIC_ENABLE_DEV_LOGIN=true
```

**`.env.production.example` (Production):**
```bash
NEXT_PUBLIC_ENABLE_DEV_LOGIN=false
```

## Testing

### Unit Tests (11 passing)
1. ✅ Redirect validator accepts valid paths
2. ✅ Redirect validator accepts query params
3. ✅ Redirect validator rejects absolute URLs
4. ✅ Redirect validator rejects protocol-relative URLs
5. ✅ Redirect validator rejects javascript: URLs
6. ✅ Redirect validator handles None/empty
7. ✅ Redirect validator rejects invalid types
8. ✅ Role home path for admin
9. ✅ Role home path for teacher
10. ✅ Role home path for student
11. ✅ Role home path for unknown role

### Integration Tests (6 tests, require Redis)
- Dev-login disabled returns 404
- Dev-login enabled redirects with cookie
- Dev-login redirects to correct role home
- Dev-login respects returnTo parameter
- Dev-login rejects malicious returnTo
- Dev-login rejects non-existent user

### Security Scan
- ✅ CodeQL: 0 alerts found
- ✅ No security vulnerabilities introduced

## Manual Testing Guide

### Local Development Setup
1. Copy backend `.env.example` to `.env`
2. Copy frontend `.env.example` to `.env.local`
3. Start backend: `cd backend && uvicorn app.main:app --reload`
4. Start frontend: `cd frontend && npm run dev`
5. Navigate to http://localhost:3000

### Test Scenarios

**1. Dev-Login as Student:**
- Enter `student1@school.nl` in dev-login
- Click "Dev Login"
- Should redirect to `/student`
- Verify student dashboard loads

**2. Dev-Login as Teacher:**
- Enter `docent@school.nl` in dev-login
- Click "Dev Login"  
- Should redirect to `/teacher`
- Verify teacher dashboard loads

**3. Unauthenticated Route Access:**
- Clear cookies
- Navigate to `/teacher/rubrics`
- Should redirect to `/?returnTo=%2Fteacher%2Frubrics`
- After login, should return to `/teacher/rubrics`

**4. Wrong Role Access:**
- Login as student
- Try to access `/teacher`
- Should redirect to `/student`

**5. Production Simulation:**
- Set `ENABLE_DEV_LOGIN=false` in backend
- Set `NEXT_PUBLIC_ENABLE_DEV_LOGIN=false` in frontend
- Restart both services
- Verify dev-login UI is hidden
- Verify POST to `/auth/dev-login` returns 404

**6. Azure AD Login:**
- Configure Azure AD credentials
- Click "Login met Office 365"
- Complete OAuth flow
- Should redirect based on DB role

**7. ReturnTo Parameter:**
- Navigate to `/?returnTo=/teacher/rubrics`
- Click "Login met Office 365"
- Complete OAuth flow
- Should land on `/teacher/rubrics`

## Files Changed

### Backend (8 files)
1. `app/core/config.py` - Added ENABLE_DEV_LOGIN setting
2. `app/core/redirect_validator.py` - NEW: Redirect validation
3. `app/api/v1/deps.py` - Updated to use ENABLE_DEV_LOGIN
4. `app/api/v1/routers/auth.py` - Added dev-login endpoint, updated Azure callback
5. `.env.example` - NEW: Development env template
6. `.env.production.example` - Updated with ENABLE_DEV_LOGIN
7. `tests/test_dev_login.py` - NEW: Comprehensive test suite
8. `README.md` - Added dev-login documentation

### Frontend (8 files)
1. `src/app/page.tsx` - Updated login page
2. `src/services/auth.service.ts` - Added devLogin method
3. `src/middleware.ts` - NEW: Route protection
4. `src/lib/role-utils.ts` - NEW: Role-to-path mapping
5. `src/app/(teacher)/layout.tsx` - Added role checking
6. `src/app/student/layout.tsx` - NEW: Student layout with role checking
7. `.env.example` - NEW: Development env template
8. `.env.production.example` - NEW: Production env template

## Deployment Checklist

### Production Environment
- [ ] Set `ENABLE_DEV_LOGIN=false` in backend environment
- [ ] Set `NEXT_PUBLIC_ENABLE_DEV_LOGIN=false` in frontend build
- [ ] Verify `COOKIE_SECURE=true` for HTTPS
- [ ] Verify nginx strips X-User-Email headers
- [ ] Configure Azure AD credentials
- [ ] Test OAuth flow end-to-end
- [ ] Verify dev-login returns 404
- [ ] Verify dev-login UI not visible

### Development Environment
- [ ] Set `ENABLE_DEV_LOGIN=true` in backend
- [ ] Set `NEXT_PUBLIC_ENABLE_DEV_LOGIN=true` in frontend
- [ ] Test dev-login for each role
- [ ] Test route protection
- [ ] Test returnTo parameter
- [ ] Verify role-based redirects

## Migration Notes

### Breaking Changes
None - This is additive functionality.

### Backward Compatibility
- Existing Azure AD login continues to work
- X-User-Email header authentication still works when `ENABLE_DEV_LOGIN=true`
- No database migrations required
- No API contract changes

### Rollback Plan
If issues arise:
1. Set `ENABLE_DEV_LOGIN=true` in production (emergency fallback)
2. Revert PR if frontend route protection causes issues
3. No database rollback needed

## Future Enhancements

### Potential Improvements
1. Add school selection UI on login page
2. Remember last selected school per user
3. Add "Remember me" option for longer sessions
4. Add session timeout warnings
5. Add audit logging for dev-login usage
6. Add rate limiting for login attempts
7. Support multiple schools per user

### Known Limitations
1. School ID is hardcoded to 1 on frontend (demo mode)
2. Azure AD login requires manual school selection
3. No multi-factor authentication yet
4. No password recovery flow (not needed with Azure AD)

## Support

### Documentation
- Main README: [README.md](../README.md)
- Azure AD Setup: [AZURE_AD_SETUP.md](../AZURE_AD_SETUP.md) (if exists)
- This summary: [SECURE_AUTH_IMPLEMENTATION.md](./SECURE_AUTH_IMPLEMENTATION.md)

### Common Issues

**Issue: Dev-login not working**
- Check `ENABLE_DEV_LOGIN=true` in backend .env
- Check `NEXT_PUBLIC_ENABLE_DEV_LOGIN=true` in frontend .env.local
- Restart both services after changing env vars

**Issue: Redirected to login repeatedly**
- Clear browser cookies
- Check cookie domain settings
- Verify CORS_ORIGINS includes frontend URL

**Issue: Wrong role redirect**
- Check user role in database
- Verify JWT token contains correct role claim
- Check layout role validation logic

## Conclusion

This implementation provides:
- ✅ Secure, environment-based authentication controls
- ✅ Protection against open redirect attacks
- ✅ Role-based access control with middleware and layouts
- ✅ Clean separation between dev and production UX
- ✅ Comprehensive test coverage
- ✅ Clear documentation and configuration

The system is production-ready with proper security controls and easy local development testing.
