# Rate Limiting Exemptions

## Overview

This document describes rate limiting exemptions for specific API endpoints that require rapid, successive requests during normal authenticated usage.

## Background

The FastAPI backend implements rate limiting middleware to protect against abuse and DDoS attacks. By default:
- Regular API endpoints: 100 requests per minute per user
- Auth endpoints: 5 requests per minute per user (brute force prevention)
- Public/external endpoints: 10 requests per minute

## Problem

Teachers filling in scores on interactive pages (e.g., `/teacher/project-assessments/{id}/scores`) trigger many rapid API calls through autosave functionality or per-field updates. This caused legitimate teacher usage to exceed the default 100 requests/minute limit, resulting in `429 Rate limit exceeded` errors.

## Solution

The rate limiting middleware now exempts specific endpoints when accessed by authenticated teachers or admins:

### Exempted Endpoints

1. **Project Assessment Scoring**
   - Pattern: `/api/v1/project-assessments/{numeric_id}/scores[/*]`
   - Examples: `/api/v1/project-assessments/123/scores`, `/api/v1/project-assessments/456/scores/batch`
   - Methods: All (POST, PATCH, PUT, GET)
   - Users: Teacher, Admin only

2. **Evaluation Grades**
   - Pattern: `/api/v1/evaluations/{numeric_id}/grades[/*]`
   - Examples: `/api/v1/evaluations/789/grades`, `/api/v1/evaluations/101/grades/summary`
   - Methods: All (POST, PATCH, PUT, GET)
   - Users: Teacher, Admin only

**Note:** The `{numeric_id}` must be a numeric value. Non-numeric IDs or malformed paths (e.g., `/project-assessments/abc/scores` or `/api/v1/project-assessments//scores`) are NOT exempted and will be rate limited.

### Security Preserved

The following endpoints **remain rate limited** to maintain security:

1. **Authentication endpoints** (`/auth/login`, `/auth/refresh`, etc.)
   - Limit: 5 requests per minute
   - Prevents brute force attacks

2. **Public/unauthenticated endpoints**
   - Limit: 10 requests per minute
   - Prevents anonymous abuse

3. **Regular endpoints for all other users**
   - Limit: 100 requests per minute
   - Students do NOT get exemption on scoring endpoints

4. **Unauthenticated requests to scoring endpoints**
   - Limit: 100 requests per minute
   - Exemption only applies when user is authenticated as teacher/admin

## Implementation Details

### Code Location
- File: `backend/app/api/middleware/rate_limit.py`
- Class: `RateLimitMiddleware`
- Methods:
  - `_should_skip_rate_limit()`: Checks if rate limiting should be skipped
  - `_is_authenticated_teacher_scoring()`: Validates user role and endpoint pattern

### How It Works

1. For each incoming request, the middleware checks if it matches exemption criteria:
   - Is the path pattern a scoring endpoint? (Matches regex: `/api/v1/project-assessments/{numeric_id}/scores[/*]` or `/api/v1/evaluations/{numeric_id}/grades[/*]`)
   - Is the user authenticated? (Has `request.state.user`)
   - Is the user a teacher or admin? (`user.role in ["teacher", "admin"]`)

2. If all conditions are met, rate limiting is skipped entirely for that request.

3. Otherwise, normal rate limiting rules apply based on endpoint type.

### Testing

Comprehensive test coverage in `tests/test_rate_limit_teacher_scoring.py`:
- ✓ Teachers can make unlimited rapid requests to scoring endpoints
- ✓ Admins also get exemption on scoring endpoints
- ✓ Students do NOT get exemption on scoring endpoints
- ✓ Unauthenticated requests are still rate limited
- ✓ Auth endpoints remain rate limited for teachers
- ✓ Regular endpoints remain rate limited
- ✓ Pattern matching is precise

## Frontend Recommendations (Optional)

While the backend now safely handles rapid requests, consider these frontend improvements for better UX:

1. **Debounce autosave**: Wait 300-500ms after user stops typing before sending request
2. **Batch updates**: Combine multiple score changes into a single request
3. **Save on blur**: Only send request when user leaves the input field
4. **Optimistic updates**: Update UI immediately, sync with backend in background

However, these are optional - the backend is now safe even if the frontend sends many rapid calls.

## Monitoring

To monitor rate limiting behavior:

1. Check application logs for warnings:
   ```
   WARNING app.api.middleware.rate_limit:rate_limit.py:68 Rate limit exceeded for user:123:/api/v1/...
   ```

2. Monitor rate limit headers in responses:
   - `X-RateLimit-Limit`: Maximum requests allowed
   - `X-RateLimit-Remaining`: Requests remaining in window
   - `X-RateLimit-Reset`: Time window in seconds

3. For exempted endpoints, these headers won't be present as rate limiting is completely bypassed.
