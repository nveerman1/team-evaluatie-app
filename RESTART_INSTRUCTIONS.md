# HOW TO APPLY THE ROUTING FIX

## Problem
You're still getting the 422 error because **your backend server is running the OLD code** before the fix was applied.

## Solution
**You MUST restart your backend server** to load the updated route order.

## Steps to Fix

### 1. Stop Your Current Backend Server
Find and stop any running backend processes:

```bash
# Find the process
ps aux | grep "uvicorn\|python.*app.main"

# Kill the process (replace <PID> with the actual process ID)
kill <PID>

# Or use pkill
pkill -f uvicorn
```

### 2. Pull the Latest Changes (if not already done)
```bash
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app
git pull origin copilot/fix-routing-issue-windows
```

### 3. Restart the Backend Server

**Option A: Using the Makefile**
```bash
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app
make be
```

**Option B: Manually**
```bash
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app/backend
source venv/bin/activate  # if using venv
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Option C: Using Docker** (if applicable)
```bash
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app
docker compose down
docker compose up --build
```

### 4. Verify the Fix

Once the server restarts, test the endpoint:

```bash
# This should return 401 (unauthorized) NOT 422
curl -i http://localhost:8000/api/v1/competencies/windows/
```

**Expected response:** 
- Status: `401 Unauthorized` (because you're not authenticated)
- NOT `422 Unprocessable Entity`

**If you still get 422**, the server hasn't restarted with the new code.

### 5. Test in the Frontend

Once the backend is restarted:
1. Refresh your browser (hard refresh: Ctrl+Shift+R or Cmd+Shift+R)
2. Navigate to the competencies/windows page
3. The 422 error should be gone

## What Was Changed

The fix reordered routes in `backend/app/api/v1/routers/competencies.py`:

**Before (WRONG):**
```python
Line 613: @router.get("/{competency_id}")  # Matches "windows" as ID → 422
...
Line 978: @router.get("/windows/")        # Never reached
```

**After (CORRECT):**
```python
Line 617: @router.get("/windows/")        # Matches first ✓
Line 694: @router.get("/windows/{window_id}")
Line 756: @router.get("/{competency_id}") # Only matches numeric IDs
```

## Why Restart is Required

FastAPI registers routes when the application starts. The route order is determined by the order of decorator definitions in the code. Simply changing the code doesn't affect a running server - **you must restart** to reload the route definitions.

## Troubleshooting

### Still getting 422 after restart?

1. **Verify the server restarted:**
   ```bash
   # Check server logs - you should see "Application startup complete"
   tail -f /var/log/backend.log  # or wherever your logs are
   ```

2. **Check which code is running:**
   ```bash
   curl http://localhost:8000/docs
   # Look at the /competencies/windows/ endpoint - it should be listed BEFORE /{competency_id}
   ```

3. **Clear browser cache:**
   - Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
   - Or clear cache entirely

4. **Check for multiple backend instances:**
   ```bash
   ps aux | grep uvicorn
   # Should only show ONE backend process
   ```

5. **Verify you're on the right branch:**
   ```bash
   cd /home/runner/work/team-evaluatie-app/team-evaluatie-app
   git branch
   # Should show: * copilot/fix-routing-issue-windows
   ```

## Need Help?

If you still get the 422 error after restarting:
1. Share your server startup logs
2. Share the output of: `curl -i http://localhost:8000/api/v1/competencies/windows/`
3. Confirm which branch/commit you're running
