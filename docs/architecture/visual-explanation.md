# API Request Flow - Before & After Fix

## Before Fix (404 Error)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                 │
│                                                                 │
│  1. Login via: https://app.technasiummbh.nl/api/v1/auth/azure  │
│     ✅ Success - cookie set                                     │
│                                                                 │
│  2. Redirect to: /teacher                                       │
│                                                                 │
│  3. Frontend makes API call:                                    │
│     api.get("/auth/me")                                         │
│     ↓                                                           │
│     baseURL = undefined (production)                            │
│     ↓                                                           │
│     Request URL: /auth/me                                       │
│     ↓                                                           │
│     Browser resolves to:                                        │
│     https://app.technasiummbh.nl/auth/me                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP GET
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                         Nginx                                   │
│                                                                 │
│  Routes available:                                              │
│  • /api/ → backend                                              │
│  • /api/v1/auth/ → backend                                      │
│  • / → frontend                                                 │
│                                                                 │
│  ❌ NO MATCH for /auth/me                                       │
│  ❌ Returns: 404 Not Found                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ 404 Not Found
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                 │
│                                                                 │
│  ❌ Error: GET https://app.technasiummbh.nl/auth/me 404         │
│  ❌ Failed to fetch current user                                │
│  ❌ White screen on /teacher page                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## After Fix (Success)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                 │
│                                                                 │
│  1. Login via: https://app.technasiummbh.nl/api/v1/auth/azure  │
│     ✅ Success - cookie set                                     │
│                                                                 │
│  2. Redirect to: /teacher                                       │
│                                                                 │
│  3. Frontend makes API call:                                    │
│     api.get("/auth/me")                                         │
│     ↓                                                           │
│     baseURL = "/api/v1"  ✅ NOW SET!                            │
│     ↓                                                           │
│     Request URL: /api/v1/auth/me                                │
│     ↓                                                           │
│     Browser resolves to:                                        │
│     https://app.technasiummbh.nl/api/v1/auth/me                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP GET
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                         Nginx                                   │
│                                                                 │
│  Routes available:                                              │
│  • /api/ → backend                                              │
│  • /api/v1/auth/ → backend  ✅ MATCH!                           │
│  • / → frontend                                                 │
│                                                                 │
│  ✅ MATCHED: /api/v1/auth/                                      │
│  ✅ Proxy to: http://backend:8000/api/v1/auth/me                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Proxy request
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   FastAPI Backend                               │
│                                                                 │
│  Endpoint: /api/v1/auth/me                                      │
│  ✅ Validates session cookie                                    │
│  ✅ Returns user data (email, role, etc.)                       │
│  ✅ Status: 200 OK                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ 200 OK + User Data
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                 │
│                                                                 │
│  ✅ Success: GET .../api/v1/auth/me 200 OK                      │
│  ✅ User data received                                          │
│  ✅ Dashboard renders correctly                                 │
│  ✅ No more white screen!                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Key Change

### Code Change in `frontend/src/lib/api.ts`

```typescript
// BEFORE
const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
export const baseURL = 
  raw?.replace(/\/+$/, "") ?? 
  (process.env.NODE_ENV !== "production" ? "/api/v1" : undefined);
//                                                       ^^^^^^^^^ 
//                                                       PROBLEM: undefined in production!

// AFTER
const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
export const baseURL = raw?.replace(/\/+$/, "") ?? "/api/v1";
//                                                  ^^^^^^^^^
//                                                  FIXED: Always has a value!
```

### Environment Variable Change

```bash
# BEFORE (.env.production.example)
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
# ❌ Required, must be set, easy to forget

# AFTER (.env.production.example)
NEXT_PUBLIC_API_BASE_URL=/api/v1  # or leave unset
# ✅ Optional, has sensible default
```

## Development Environment

```
┌──────────────────────┐
│   localhost:3000     │
│   (Next.js)          │
│                      │
│  baseURL: /api/v1    │
└──────────┬───────────┘
           │
           │ Next.js Rewrite Rule:
           │ /api/v1/:path* → http://127.0.0.1:8000/api/v1/:path*
           │
           ↓
┌──────────────────────┐
│  127.0.0.1:8000      │
│  (FastAPI)           │
│                      │
│  Prefix: /api/v1     │
└──────────────────────┘
```

## Production Environment

```
┌──────────────────────┐
│  Browser             │
│  app.technasiummbh.nl│
└──────────┬───────────┘
           │
           │ HTTPS Request
           │ /api/v1/auth/me
           │
           ↓
┌──────────────────────┐
│  Nginx               │
│  (Reverse Proxy)     │
│                      │
│  /api/* → backend    │
└──────────┬───────────┘
           │
           │ Proxy to backend container
           │
           ↓
┌──────────────────────┐
│  Backend Container   │
│  (FastAPI)           │
│                      │
│  Prefix: /api/v1     │
└──────────────────────┘
```

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| baseURL in prod | `undefined` | `/api/v1` |
| API request | `/auth/me` | `/api/v1/auth/me` |
| Full URL | `.../auth/me` | `.../api/v1/auth/me` |
| Nginx match | ❌ No route | ✅ `/api/` route |
| Response | 404 Not Found | 200 OK |
| Page state | White screen | ✅ Loads correctly |

**Root Cause**: Missing `/api/v1` prefix in API requests
**Solution**: Set default baseURL to `/api/v1` for all environments
**Result**: Frontend correctly calls backend endpoints via nginx proxy
