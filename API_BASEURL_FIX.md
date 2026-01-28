# API BaseURL Configuration Fix

## Problem Statement

In production, users could login via `https://app.technasiummbh.nl/api/v1/auth/azure?school_id=1`, but after redirect to `/teacher`, the page remained white with the following error:

```
GET https://app.technasiummbh.nl/auth/me 404 (Not Found)
Failed to fetch current user
```

**Root Cause**: The frontend was making API calls to `/auth/me` while the backend expects calls at `/api/v1/auth/me`.

## Solution

### Changes Made

#### 1. Updated `frontend/src/lib/api.ts`
- Changed default `baseURL` to `/api/v1` (relative path) for all environments
- Removed production-only check that required env var
- Changed env var from `NEXT_PUBLIC_API_URL` to `NEXT_PUBLIC_API_BASE_URL` for clarity
- Added development sanity check that logs baseURL to console

**Before:**
```typescript
const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
export const baseURL =
  raw?.replace(/\/+$/, "") ??
  (process.env.NODE_ENV !== "production" ? "/api/v1" : undefined);
```

**After:**
```typescript
const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
export const baseURL = raw?.replace(/\/+$/, "") ?? "/api/v1";
```

#### 2. Updated Environment Variables
- Changed from `NEXT_PUBLIC_API_URL` to `NEXT_PUBLIC_API_BASE_URL`
- Made the env var optional with sensible defaults
- Updated `.env.example` and `.env.production.example`

#### 3. Updated Dockerfile
- Changed build arg from `NEXT_PUBLIC_API_URL` to `NEXT_PUBLIC_API_BASE_URL`
- Removed validation check since the env var is now optional

#### 4. Updated Docker Compose
- Changed from `NEXT_PUBLIC_API_URL` to `NEXT_PUBLIC_API_BASE_URL`
- Made the env var optional (defaults to `/api/v1`)

#### 5. Fixed Teacher Evaluation Page
- Changed from `process.env.NEXT_PUBLIC_API_URL` to importing `baseURL` from `@/lib/api`
- Ensures consistent API URL usage across the application

## Why This Fixes the 404

### Previous Behavior
1. Frontend `api.ts` had `baseURL` set to `undefined` in production (if env var not set)
2. Axios would make requests to relative paths like `/auth/me`
3. Browser would resolve this to `https://app.technasiummbh.nl/auth/me` (missing `/api/v1` prefix)
4. Nginx has no route for `/auth/*` → 404 error

### New Behavior
1. Frontend `api.ts` has `baseURL` set to `/api/v1` by default
2. Axios makes requests to `/api/v1/auth/me`
3. Browser resolves this to `https://app.technasiummbh.nl/api/v1/auth/me`
4. Nginx routes `/api/v1/*` to backend → 200 success

## Nginx Compatibility

The nginx configuration in `ops/nginx/site.conf` has these relevant routes:

```nginx
# Routes /api/ to backend
location /api/ {
    proxy_pass http://backend;
    # ...
}

# Specific auth endpoint handling
location /api/v1/auth/ {
    proxy_pass http://backend;
    # Strict rate limiting
    # ...
}
```

The relative path `/api/v1` is fully compatible with this nginx configuration:
- Frontend makes request to `/api/v1/auth/me` (relative to current origin)
- Nginx matches `/api/` location and proxies to backend at `http://backend:8000`
- Backend receives request at `/api/v1/auth/me` (FastAPI app with `/api/v1` prefix)

## Development vs Production

### Development (Next.js dev server)
- Frontend runs on `localhost:3000`
- `next.config.ts` has rewrite rule: `/api/v1/:path*` → `http://127.0.0.1:8000/api/v1/:path*`
- API requests to `/api/v1/auth/me` are proxied to backend
- Works seamlessly with relative path

### Production (Docker + Nginx)
- Frontend runs in Docker container
- Nginx proxies `/api/v1/*` requests to backend container
- API requests to `/api/v1/auth/me` are routed through nginx
- Works seamlessly with relative path

## Testing Recommendations

### Development Testing
1. Start dev server: `npm run dev`
2. Open browser console and check for log: `[API Client] baseURL: /api/v1`
3. Try to access protected route like `/teacher`
4. Should see API call to `http://localhost:3000/api/v1/auth/me` (proxied to backend)
5. If not logged in, should get 401 response (expected)
6. If logged in, should get 200 response with user data

### Production Testing
1. Deploy with docker-compose
2. Login via Azure: `https://app.technasiummbh.nl/api/v1/auth/azure?school_id=1`
3. After redirect to `/teacher`, page should load successfully
4. Browser console should show: `GET https://app.technasiummbh.nl/api/v1/auth/me 200 OK`
5. User data should be fetched and UI should render

## Migration Notes

### For Existing Deployments
1. **No action required** - The env var is now optional with sensible defaults
2. **Optional**: Update `.env.prod` to remove `NEXT_PUBLIC_API_URL` or rename to `NEXT_PUBLIC_API_BASE_URL`
3. **Optional**: Update docker-compose to use new env var name (already done in this PR)

### For New Deployments
1. Copy `.env.production.example` to `.env.prod`
2. **No need to set `NEXT_PUBLIC_API_BASE_URL`** - defaults to `/api/v1`
3. Only set if using external API server (not recommended for production)

## Security Considerations

1. **No security impact** - This change only affects API URL construction
2. **Maintains withCredentials: true** - Cookie-based sessions still work
3. **Compatible with nginx security headers** - All existing security measures remain
4. **No hardcoded credentials** - No sensitive data in code or env vars

## Rollback Plan

If issues arise, revert by:
1. Restoring old `api.ts` with `NEXT_PUBLIC_API_URL` env var
2. Setting `NEXT_PUBLIC_API_URL=/api/v1` in production environment
3. Rebuilding frontend container

However, this should not be necessary as the changes are backward compatible.
