# Cookie-Based Authentication Implementation

This document describes the cookie-based authentication system implemented for production-grade security.

## Overview

The authentication system now uses **HttpOnly cookies** for storing JWT tokens instead of localStorage or URL parameters. This significantly improves security by protecting against XSS attacks and token theft.

## Key Features

### 1. Security Improvements

- **HttpOnly Cookies**: JWT tokens are stored in HttpOnly cookies, inaccessible to JavaScript
- **Secure Flag**: Cookies are marked as Secure in production (HTTPS only)
- **SameSite Protection**: Set to "Lax" to prevent CSRF attacks while allowing OAuth redirects
- **No Token Exposure**: Tokens are never exposed in URLs or localStorage

### 2. Multiple Authentication Methods

The system supports three authentication methods with priority order:

1. **Development Mode** (`NODE_ENV=development`):
   - X-User-Email header for quick local testing
   - Automatically blocked in production

2. **Production Mode** (default):
   - HttpOnly cookie (`access_token`) - **preferred**
   - Bearer token in Authorization header - fallback for API clients

### 3. Azure AD OAuth Flow

The Azure AD login flow has been updated:

1. User clicks "Login with Office 365"
2. Frontend redirects to `/api/v1/auth/azure?school_id=1`
3. Backend redirects to Microsoft login
4. After successful login, user returns to `/api/v1/auth/azure/callback`
5. Backend validates, creates JWT, sets HttpOnly cookie
6. Backend redirects to frontend dashboard
7. Frontend can now access protected endpoints with cookie automatically included

## Configuration

### Backend Environment Variables

Add these to your `.env` file:

```bash
# Frontend & Backend URLs
FRONTEND_URL=http://localhost:3000  # Production: https://yourdomain.nl
BACKEND_URL=http://localhost:8000   # Production: https://api.yourdomain.nl

# Cookie Settings
COOKIE_SECURE=False     # Set to True in production (requires HTTPS)
COOKIE_DOMAIN=          # Production: .yourdomain.nl (note the leading dot)
COOKIE_SAMESITE=Lax     # Allows OAuth redirects
COOKIE_MAX_AGE=604800   # 7 days in seconds

# Node Environment
NODE_ENV=development    # Production: production
```

### Production Configuration Example

```bash
FRONTEND_URL=https://technasiummbh.nl
BACKEND_URL=https://api.technasiummbh.nl
COOKIE_SECURE=True
COOKIE_DOMAIN=.technasiummbh.nl
COOKIE_SAMESITE=Lax
NODE_ENV=production
```

## API Endpoints

### Authentication Endpoints

#### `GET /api/v1/auth/azure?school_id={id}`
Initiates Azure AD OAuth flow. Redirects to Microsoft login.

**Parameters:**
- `school_id`: School ID for multi-tenant support

**Response:**
- Redirects to Microsoft OAuth page

---

#### `GET /api/v1/auth/azure/callback?code={code}&state={state}`
Handles OAuth callback. Sets HttpOnly cookie and redirects to dashboard.

**Parameters:**
- `code`: Authorization code from Azure AD
- `state`: CSRF protection state (contains school_id)

**Response:**
- Sets `access_token` HttpOnly cookie
- Redirects to frontend dashboard (role-based)

**Cookie Details:**
```
Set-Cookie: access_token={JWT}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800
```

---

#### `GET /api/v1/auth/me`
Returns current authenticated user information.

**Authentication:** Cookie or Bearer token required

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "User Name",
  "role": "teacher",
  "class_name": "4V1"
}
```

---

#### `POST /api/v1/auth/logout`
Logs out the current user by clearing the authentication cookie.

**Response:**
```json
{
  "message": "Successfully logged out"
}
```

## Frontend Usage

### Login Flow

```typescript
import { authService } from "@/services/auth.service";

// Redirect to Azure AD login
const handleLogin = () => {
  const schoolId = 1;
  authService.redirectToAzureLogin(schoolId);
};
```

### Check Authentication Status

```typescript
import { useMe } from "@/hooks/useMe";

function ProtectedPage() {
  const { user, loading, error } = useMe();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Not authenticated</div>;

  return <div>Welcome, {user.name}!</div>;
}
```

### Logout

```typescript
import { useLogout } from "@/hooks/useLogout";

function LogoutButton() {
  const { logout, loading } = useLogout();

  return (
    <button onClick={logout} disabled={loading}>
      {loading ? "Logging out..." : "Logout"}
    </button>
  );
}
```

### Using Existing Hooks

```typescript
import { useAuth } from "@/hooks/useAuth";

function Dashboard() {
  const { user, role, isTeacher, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      {isTeacher && <TeacherPanel />}
    </div>
  );
}
```

## Security Features

### 1. Token Validation

All JWT tokens are validated for:
- Valid signature
- Not expired
- User exists in database
- User is not archived
- School ID matches (if present in token)

### 2. Dev-Login Protection

Development login (X-User-Email header) is automatically disabled in production:

```python
if settings.NODE_ENV != "development" and x_user_email:
    logger.warning("Dev-login attempted in production")
    raise HTTPException(401, "Use Azure AD authentication")
```

### 3. CORS Configuration

CORS is properly configured to allow credentials:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,  # Required for cookies
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 4. Frontend API Client

All requests automatically include cookies:

```typescript
const instance = axios.create({
  baseURL,
  withCredentials: true,  // Include cookies in all requests
});
```

## Testing

### Backend Tests

Run the cookie authentication tests:

```bash
cd backend
pytest tests/test_cookie_auth.py -v
```

**Test Coverage:**
- ✅ Cookie authentication with valid/invalid tokens
- ✅ Bearer token fallback
- ✅ /auth/me endpoint
- ✅ /auth/logout endpoint
- ✅ Dev-login in development vs production
- ✅ School ID validation
- ✅ Archived user rejection

### Manual Testing

1. **Login Flow:**
   ```bash
   # Start backend
   cd backend && uvicorn app.main:app --reload
   
   # Start frontend
   cd frontend && pnpm dev
   
   # Visit http://localhost:3000
   # Click "Login met Office 365"
   # Should redirect through Azure and back to dashboard
   ```

2. **Check Cookie:**
   - Open DevTools → Application → Cookies
   - Verify `access_token` cookie exists
   - Verify HttpOnly flag is set
   - Verify SameSite=Lax

3. **Test Protected Routes:**
   - Navigate to various pages
   - Should stay logged in
   - Check Network tab - requests should include cookie

4. **Logout:**
   - Click logout button
   - Should redirect to login page
   - Cookie should be cleared

## Migration from Old System

### What Changed

**Old System:**
- Token returned in JSON response
- Frontend stored token in localStorage
- Manually added Authorization header

**New System:**
- Token set as HttpOnly cookie
- Backend handles cookie automatically
- Frontend doesn't need to manage tokens

### Breaking Changes

- `/api/v1/auth/azure/callback` now redirects instead of returning JSON
- Tokens are no longer accessible via JavaScript
- Bearer tokens still work for API clients (backwards compatible)

### Migration Steps

1. Update backend configuration with new environment variables
2. Deploy backend with cookie support
3. Update frontend to use new hooks (`useMe`, `useLogout`)
4. Test authentication flow
5. Remove old token management code

## Troubleshooting

### Issue: Cookie not being set

**Check:**
- CORS_ORIGINS includes your frontend URL
- allow_credentials=True in CORS config
- Frontend uses withCredentials: true

### Issue: Cookie not sent with requests

**Check:**
- Frontend axios instance has withCredentials: true
- Cookie domain matches (or is not set for localhost)
- Cookie hasn't expired

### Issue: Dev-login not working

**Check:**
- NODE_ENV=development
- X-User-Email header is set
- User exists in database

### Issue: Redirect loop after login

**Check:**
- FRONTEND_URL is correct
- Dashboard route exists in frontend
- No auth guard blocking the dashboard

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Set `COOKIE_SECURE=True`
- [ ] Configure `COOKIE_DOMAIN` correctly
- [ ] Update `FRONTEND_URL` to production domain
- [ ] Update `BACKEND_URL` to production API domain
- [ ] Configure `CORS_ORIGINS` with production URLs
- [ ] Verify HTTPS is enabled
- [ ] Test login flow end-to-end
- [ ] Verify cookies are HttpOnly and Secure
- [ ] Test logout functionality
- [ ] Verify dev-login is blocked

## References

- [FastAPI Cookies](https://fastapi.tiangolo.com/advanced/response-cookies/)
- [OWASP Cookie Security](https://owasp.org/www-community/controls/SecureCookieAttribute)
- [MDN HTTP Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
- [SameSite Cookie Explained](https://web.dev/samesite-cookies-explained/)
