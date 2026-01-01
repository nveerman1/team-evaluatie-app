# RQ Job Queue Bug Fix - Jobs Stuck in "Queued" State

**Date:** 2026-01-01  
**Status:** ✅ Fixed  
**Issue:** Jobs remained in `queued` state in the database despite RQ worker running and Redis being healthy

## Problem Summary

After implementing async AI summary generation using Python RQ and Redis, jobs were being created in the database with status `queued` but never progressed to `processing` or `completed`. The RQ worker was running and healthy, but reported 0 jobs in all queues.

### Symptoms

1. **Database state:** Jobs had status `queued` with no `started_at` or `completed_at` timestamps
2. **RQ health check:** All queues showed count=0, worker was idle
3. **Queue stats endpoint:** Showed `queued_count > 0` but jobs never processed
4. **No errors:** Worker logs showed no crashes or exceptions

### Investigation Results

**Key Discovery:** There was a mismatch in how `job_id` was being passed between the enqueue operation and the task function.

#### How RQ Handles Parameters

When calling `queue.enqueue(func, **kwargs)`, RQ's `parse_args()` method:
1. **Extracts** specific parameters like `job_id`, `job_timeout`, `result_ttl` from kwargs
2. **Uses** these to configure the RQ Job object
3. **Passes** remaining kwargs to the task function

From RQ's source code:
```python
def parse_args(cls, f: 'FunctionReferenceType', *args, **kwargs):
    timeout = kwargs.pop('job_timeout', None)
    job_id = kwargs.pop('job_id', None)  # <-- Removed from kwargs!
    result_ttl = kwargs.pop('result_ttl', None)
    # ... remaining kwargs go to the task function
```

#### The Bug

**Before the fix:**

1. **Endpoint code** (`feedback_summary.py`):
   ```python
   queue.enqueue(
       generate_ai_summary_task,
       school_id=user.school_id,
       evaluation_id=evaluation_id,
       student_id=student_id,
       job_id=job_id,  # RQ extracts this
       job_timeout='10m',
   )
   ```

2. **Task function signature** (`tasks.py`):
   ```python
   def generate_ai_summary_task(
       school_id: int,
       evaluation_id: int,
       student_id: int,
       job_id: str,  # ❌ Expects job_id but RQ removed it!
   ) -> dict:
   ```

3. **What happened:**
   - RQ's `parse_args()` extracted `job_id` to use for the RQ Job ID
   - RQ Job was created with correct custom ID in Redis
   - When worker tried to execute the task, `job_id` parameter was missing
   - Task raised `TypeError: missing required argument: 'job_id'`
   - Job failed immediately and was likely moved to failed registry
   - DB status stayed `queued` because the task never ran successfully to update it

## The Fix

### Changes Made

#### 1. Updated Task Function (`backend/app/infra/queue/tasks.py`)

**Removed** `job_id` from function parameters and **retrieve** it from RQ context instead:

```python
from rq import get_current_job

def generate_ai_summary_task(
    school_id: int,
    evaluation_id: int,
    student_id: int,  # ✅ No job_id parameter
) -> dict:
    """
    Background task to generate AI summary.
    
    Note:
        The job_id is retrieved from RQ's current job context, not passed as a parameter.
        This is because RQ's enqueue() pops job_id from kwargs to use it for the RQ Job ID.
    """
    # Get job_id from RQ job context
    current_job = get_current_job()
    job_id = current_job.id if current_job else None
    
    if not job_id:
        raise ValueError("Could not retrieve job_id from RQ context. Task must be run via RQ worker.")
    
    # Rest of task logic...
```

#### 2. Added Logging (`backend/app/api/v1/routers/feedback_summary.py`)

Enhanced logging at enqueue time for better debugging:

```python
logger.info(
    f"Enqueued job {job_id} to queue '{queue_name}' "
    f"(RQ job ID: {rq_job.id}, student: {student_id}, evaluation: {evaluation_id})"
)
```

And in the task:
```python
logger.info(f"[Job {job_id}] Starting AI summary generation for student {student_id}")
logger.info(f"[Job {job_id}] AI summary generated successfully in {duration:.2f}s")
```

#### 3. Updated Test Script (`backend/test_async_summary.py`)

Updated the task signature test to expect the new parameters (without `job_id`).

### Files Modified

1. **`backend/app/infra/queue/tasks.py`**
   - Import `get_current_job` from rq
   - Remove `job_id` from function signature
   - Add code to retrieve job_id from RQ context
   - Add validation and error message
   - Add structured logging with job_id prefix

2. **`backend/app/api/v1/routers/feedback_summary.py`**
   - Import `logging` module
   - Add logger instance
   - Add INFO logs at enqueue time
   - Add ERROR logs for enqueue failures
   - Apply to both single and batch queue endpoints

3. **`backend/test_async_summary.py`**
   - Update expected task signature test

4. **`backend/tests/test_queue_job_id_fix.py`** (NEW)
   - Comprehensive test suite for the fix
   - Tests task signature
   - Tests job_id retrieval from RQ context
   - Tests RQ parameter parsing
   - Tests error handling

## Verification

### Test Results

All tests pass:
- **31** existing tests in `test_job_enhancements.py`: ✅ PASS
- **5** new tests in `test_queue_job_id_fix.py`: ✅ PASS
- **Total: 36/36 tests passing**

### Manual Verification Steps

To verify the fix works in a local environment:

1. **Start services:**
   ```bash
   cd ops/docker
   docker compose -f compose.dev.yml up -d  # Redis + PostgreSQL
   ```

2. **Start the worker:**
   ```bash
   cd backend
   python worker.py
   ```
   
   Expected output:
   ```
   Starting RQ worker for AI summary generation...
   Worker listening on queues (priority order): ['ai-summaries-high', 'ai-summaries', 'ai-summaries-low']
   ```

3. **Start the backend:**
   ```bash
   cd backend
   uvicorn app.main:app --reload --port 8000
   ```

4. **Queue a job:**
   ```bash
   curl -X POST \
     -H "X-User-Email: docent@example.com" \
     http://localhost:8000/api/v1/feedback-summaries/evaluation/56/student/19/queue
   ```
   
   Expected response:
   ```json
   {
     "job_id": "summary-56-19-<timestamp>",
     "status": "queued",
     ...
   }
   ```

5. **Check worker logs:**
   
   You should see:
   ```
   Enqueued job summary-56-19-... to queue 'ai-summaries' (RQ job ID: summary-56-19-..., student: 19, evaluation: 56)
   [Job summary-56-19-...] Starting AI summary generation for student 19 in evaluation 56
   [Job summary-56-19-...] AI summary generated successfully in X.XXs
   ```

6. **Check queue health:**
   ```bash
   curl -H "X-User-Email: docent@example.com" \
     http://localhost:8000/api/v1/feedback-summaries/queue/health
   ```
   
   Should show:
   - `status: "healthy"`
   - Worker state: `"busy"` (while processing) or `"idle"` (after completion)
   - Queue counts should go to 0 after processing

7. **Check job status:**
   ```bash
   curl -H "X-User-Email: docent@example.com" \
     "http://localhost:8000/api/v1/feedback-summaries/jobs/summary-56-19-<timestamp>/status"
   ```
   
   Should show:
   ```json
   {
     "job_id": "summary-56-19-<timestamp>",
     "status": "completed",  // ✅ Changed from "queued"!
     "started_at": "2026-01-01T21:30:00...",
     "completed_at": "2026-01-01T21:30:05...",
     "progress": 100,
     "result": {
       "summary_text": "...",
       "generation_method": "ai",
       "feedback_count": 3
     }
   }
   ```

8. **Check queue stats:**
   ```bash
   curl -H "X-User-Email: docent@example.com" \
     http://localhost:8000/api/v1/feedback-summaries/queue/stats
   ```
   
   Should show:
   ```json
   {
     "queued_count": 0,
     "processing_count": 0,
     "completed_count": 1,  // ✅ Incremented!
     "failed_count": 0,
     ...
   }
   ```

### Expected Behavior After Fix

✅ **Jobs enqueue correctly:** RQ creates job with custom `job_id`  
✅ **Worker picks up jobs:** Jobs move from `queued` → `processing` → `completed`  
✅ **DB status updates:** Status, timestamps, progress, and result fields are updated  
✅ **Queue stats accurate:** Counts reflect actual job state in both RQ and DB  
✅ **Logging shows flow:** INFO logs track job lifecycle from enqueue to completion  

## Technical Details

### Why This Pattern Works

1. **RQ's design:** RQ expects `job_id` as a parameter to `enqueue()`, not the task function
2. **Context available:** RQ provides `get_current_job()` to retrieve job metadata within the task
3. **Single source of truth:** The RQ Job object in Redis is the authoritative source for job_id
4. **Clean separation:** Enqueue parameters (job_id, timeout, ttl) vs task parameters (business data)

### Related Information

- **RQ Documentation:** https://python-rq.org/docs/
- **Previous Fix:** `RQ_WORKER_CRASH_FIX.md` (fixed Redis decode_responses issue)
- **Implementation Docs:** `ASYNC_SUMMARY_GENERATION.md`, `JOB_QUEUE_IMPLEMENTATION_COMPLETE.md`

## Conclusion

The bug was caused by a subtle misunderstanding of how RQ separates job configuration parameters from task function parameters. The fix ensures that:

1. `job_id` is used correctly as an RQ parameter to set the Redis key
2. The task retrieves job_id from RQ's execution context
3. Comprehensive logging helps debug any future issues
4. Tests verify the correct behavior

**Status:** ✅ Fixed and verified with 36 passing tests.
