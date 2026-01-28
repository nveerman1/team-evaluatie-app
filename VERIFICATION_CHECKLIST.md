# API BaseURL Configuration - Verification Checklist

## Pre-Deployment Verification

### 1. Code Review ✓
- [x] Review changes to `frontend/src/lib/api.ts`
- [x] Review environment variable changes
- [x] Review Dockerfile changes
- [x] Review docker-compose changes
- [x] Verify auth service uses api client correctly
- [x] Check for any hardcoded API URLs

### 2. Nginx Configuration Compatibility ✓
- [x] Verify nginx routes `/api/` to backend
- [x] Verify nginx routes `/api/v1/auth/` to backend
- [x] Confirm no conflicts with existing configuration

### 3. Environment Variables
- [x] Updated `.env.example` with new variable name
- [x] Updated `.env.production.example` with new variable name
- [x] Made `NEXT_PUBLIC_API_BASE_URL` optional (defaults to `/api/v1`)

## Development Testing

### Local Development (Before Deployment)
- [ ] Start backend: `cd backend && uvicorn app.main:app --reload`
- [ ] Start frontend: `cd frontend && npm run dev`
- [ ] Open browser console and verify log shows: `[API Client] baseURL: /api/v1`
- [ ] Try to access `/teacher` route (should redirect to login if not authenticated)
- [ ] Check network tab: API calls should go to `http://localhost:3000/api/v1/auth/me`
- [ ] Verify Next.js rewrite proxies to backend at `http://127.0.0.1:8000/api/v1/auth/me`

### Dev Login Test (if enabled)
- [ ] Use dev login form to authenticate
- [ ] Verify API call to `/api/v1/auth/dev-login` succeeds
- [ ] Verify redirect to appropriate dashboard
- [ ] Verify subsequent API calls include session cookie

## Production Deployment Testing

### After Deployment
1. **Health Check**
   - [ ] Verify backend is healthy: `curl https://app.technasiummbh.nl/api/v1/health`
   - [ ] Should return 200 OK

2. **Azure Login Flow**
   - [ ] Navigate to `https://app.technasiummbh.nl/api/v1/auth/azure?school_id=1`
   - [ ] Complete Office365 authentication
   - [ ] Should redirect to `/teacher` or appropriate dashboard
   - [ ] **CRITICAL**: Page should NOT be blank/white

3. **API Calls Verification**
   - [ ] Open browser developer tools (Network tab)
   - [ ] After login, verify API call to `https://app.technasiummbh.nl/api/v1/auth/me`
   - [ ] Should return 200 OK with user data (not 404)
   - [ ] Verify response contains user email, role, etc.

4. **Dashboard Functionality**
   - [ ] Verify dashboard loads successfully
   - [ ] Verify all API calls use `/api/v1/` prefix
   - [ ] Check for any 404 errors in console
   - [ ] Verify CSV export links use correct baseURL

5. **Logout Flow**
   - [ ] Click logout button
   - [ ] Verify API call to `/api/v1/auth/logout` succeeds
   - [ ] Should redirect to login page
   - [ ] Subsequent API calls should return 401 (unauthorized)

## Rollback Plan

If issues are found in production:

### Quick Fix (Environment Variable)
1. Set `NEXT_PUBLIC_API_BASE_URL=/api/v1` in production environment
2. Restart frontend container
3. Should work immediately without code changes

### Full Rollback
1. Revert to previous commit: `git revert HEAD`
2. Set `NEXT_PUBLIC_API_URL=https://app.technasiummbh.nl/api/v1` in `.env.prod`
3. Rebuild and redeploy: `docker-compose -f ops/docker/compose.prod.yml up -d --build frontend`

## Expected Results

### Before Fix
```
❌ GET https://app.technasiummbh.nl/auth/me 404 (Not Found)
❌ Failed to fetch current user
❌ White screen on /teacher route
```

### After Fix
```
✅ GET https://app.technasiummbh.nl/api/v1/auth/me 200 OK
✅ User data retrieved successfully
✅ Dashboard renders correctly
```

## Browser Console Verification

In development, you should see:
```
[API Client] baseURL: /api/v1
[API Client] Full API endpoint example: http://localhost:3000/api/v1/auth/me
```

In production, check the Network tab for:
```
Request URL: https://app.technasiummbh.nl/api/v1/auth/me
Status: 200 OK
```

## Common Issues and Solutions

### Issue: Still getting 404
**Solution**: Clear browser cache and cookies, then try again

### Issue: CORS errors
**Solution**: Verify nginx CORS headers are set correctly (should not be an issue with same-origin)

### Issue: Session not persisting
**Solution**: Check that `withCredentials: true` is set in axios config (already done)

### Issue: Dev mode not working
**Solution**: Verify Next.js rewrite in `next.config.ts` is correct

## Sign-off

- [ ] Development testing completed successfully
- [ ] Production deployment completed
- [ ] Production testing completed successfully
- [ ] No errors in browser console
- [ ] Azure login flow works end-to-end
- [ ] Dashboard loads correctly after login
- [ ] Documentation updated

**Tested by**: _________________  
**Date**: _________________  
**Environment**: Development / Production  
**Result**: Pass / Fail  
**Notes**: _________________
