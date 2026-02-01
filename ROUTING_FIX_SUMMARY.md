# Competencies Routing Fix - Technical Summary

## Problem Statement

Frontend calls to `GET /api/v1/competencies/windows` were returning a 422 error:

```json
{
  "detail": [{
    "type": "int_parsing",
    "loc": ["path", "competency_id"],
    "msg": "Input should be a valid integer, unable to parse string as an integer",
    "input": "windows"
  }]
}
```

This proved that the request was being incorrectly routed to the dynamic path `/{competency_id}` instead of the static `/windows` endpoint.

## Root Cause

In FastAPI (and underlying Starlette), routes are matched in the **order they are registered**. The issue was in `backend/app/api/v1/routers/competencies.py`:

**BEFORE (Incorrect Order):**
- Line 613: `@router.get("/{competency_id}")` - Dynamic route registered first
- Line 978: `@router.get("/windows/")` - Static route registered later

When a request came in for `/competencies/windows`, FastAPI would:
1. Try to match against `/{competency_id}` first
2. Successfully match with `competency_id="windows"`
3. Attempt to parse "windows" as an integer → 422 validation error
4. Never reach the `/windows/` route

## Solution

Moved the entire Competency Window CRUD section (lines 975-1114) to appear BEFORE the `/{competency_id}` route (before line 613).

**AFTER (Correct Order):**
- Line 617: `@router.get("/windows/")` - Static route now first
- Line 694: `@router.get("/windows/{window_id}")` - More specific routes
- Line 756: `@router.get("/{competency_id}")` - Dynamic route now last

This ensures FastAPI matches static routes before attempting to match the dynamic catch-all route.

## Changes Made

### 1. Route Reordering (`backend/app/api/v1/routers/competencies.py`)

**Moved section:**
- GET `/windows/` - List all competency windows
- POST `/windows/` - Create a new competency window
- GET `/windows/{window_id}` - Get a specific window
- PATCH `/windows/{window_id}` - Update a window
- DELETE `/windows/{window_id}` - Delete a window

**Added explanatory comment:**
```python
# ============ Competency Window CRUD ============
# NOTE: These routes MUST come before /{competency_id} to avoid "windows" being matched as an ID
```

### 2. Regression Tests (`backend/tests/test_competencies_routing.py`)

Added two test cases:
- `test_route_order_windows_before_competency_id`: Verifies `/windows/` comes before `/{competency_id}`
- `test_all_windows_routes_before_competency_id`: Verifies all basic windows routes precede the dynamic route

These tests will catch any future refactoring that breaks the route order.

### 3. Verification Script (`scripts/verify_competencies_routing.py`)

A standalone script to verify route order without running the full test suite:
```bash
python3 scripts/verify_competencies_routing.py
```

## Verification

### Current Route Order (Verified)

```
 9. /competencies/windows/                             [GET]
10. /competencies/windows/                             [POST]
11. /competencies/windows/{window_id}                  [GET]
12. /competencies/windows/{window_id}                  [PATCH]
13. /competencies/windows/{window_id}                  [DELETE]
14. /competencies/{competency_id}                      [GET]  ← Now comes AFTER
15. /competencies/{competency_id}                      [PATCH]
16. /competencies/{competency_id}                      [DELETE]
```

### Test Results

```bash
cd backend
python3 -m pytest tests/test_competencies_routing.py -v
# PASSED: test_route_order_windows_before_competency_id
# PASSED: test_all_windows_routes_before_competency_id
```

### Manual Verification

To verify manually:

1. Start the backend server:
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

2. Test the windows endpoint (should return 401 unauthorized, NOT 422):
   ```bash
   curl -i http://localhost:8000/api/v1/competencies/windows/
   # Expected: 401 Unauthorized
   # NOT: 422 Unprocessable Entity
   ```

3. Test numeric competency ID (should still work):
   ```bash
   curl -i http://localhost:8000/api/v1/competencies/123
   # Expected: 401 or 404
   ```

4. Check OpenAPI docs:
   ```
   http://localhost:8000/docs
   ```
   Look for `/competencies/windows/` - it should appear BEFORE `/{competency_id}` in the documentation.

## No Frontend Changes Required

The frontend already calls the correct endpoint (`/competencies/windows/`), so no changes are needed in:
- `frontend/src/services/competency.service.ts`
- `frontend/src/services/competency-monitor.service.ts`

The fix is entirely on the backend route registration order.

## Best Practices Learned

1. **Static routes before dynamic routes**: Always register specific/static routes before catch-all/dynamic routes
2. **Document order dependencies**: Add comments explaining why route order matters
3. **Add regression tests**: Test route matching order to prevent future breaks
4. **Verification scripts**: Create simple scripts to verify complex routing logic

## Related Files

- `backend/app/api/v1/routers/competencies.py` - Main fix
- `backend/tests/test_competencies_routing.py` - Regression tests
- `scripts/verify_competencies_routing.py` - Verification script
- `backend/app/main.py` - Router inclusion (unchanged)

## Future Considerations

If more dynamic routes are added in the future, follow this pattern:

```python
# Good - specific routes first
@router.get("/windows/")
@router.get("/categories/")
@router.get("/tree")
@router.get("/{competency_id}")  # Dynamic last

# Bad - dynamic route first
@router.get("/{competency_id}")  # Will catch everything!
@router.get("/windows/")        # Never reached
```

Consider using more specific paths for dynamic routes if ambiguity is possible:
- Instead of: `/{competency_id}`
- Use: `/by-id/{competency_id}` or `/item/{competency_id}`

This makes the routing less fragile and more explicit.
