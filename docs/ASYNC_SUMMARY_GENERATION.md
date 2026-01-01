# Async AI Summary Generation with RQ (Redis Queue)

## Overview

The Team Evaluatie App now uses asynchronous task processing for AI summary generation. This prevents timeout errors when generating summaries for many students and provides a better user experience.

## Architecture

### Components

1. **Backend (FastAPI)**
   - REST API endpoints for queuing and checking job status
   - Job management and database persistence
   
2. **Redis**
   - Message broker and job queue
   - Already configured in `ops/docker/compose.dev.yml`
   
3. **RQ Worker**
   - Background worker process that generates AI summaries
   - Can be scaled horizontally for increased throughput
   
4. **Frontend (Next.js)**
   - Polls job status via REST API
   - Shows loading indicators and progress
   - Automatic retry on failure

### Data Flow

```
Student visits overview page
         ↓
Frontend requests summary (POST /queue)
         ↓
Backend creates job record & queues in Redis
         ↓
Returns job_id to frontend
         ↓
Frontend polls status (GET /jobs/{job_id}/status)
         ↓
Worker picks up job from Redis
         ↓
Worker generates AI summary with Ollama
         ↓
Worker updates job status → "completed"
         ↓
Frontend receives completed status
         ↓
Display summary to student
```

## Configuration

### Environment Variables

Add to your `.env` file in the backend directory:

```bash
# Redis connection (default works with docker-compose)
REDIS_URL=redis://localhost:6379/0

# Ollama settings (if not already set)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
OLLAMA_TIMEOUT=60.0
```

### Database Migration

Apply the new migration to create the job tracking table:

```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
alembic upgrade head
```

## Running the System

### Development Setup

1. **Start Infrastructure (Redis + PostgreSQL)**
   ```bash
   make up
   # or: docker compose -f ops/docker/compose.dev.yml up -d
   ```

2. **Start Backend API**
   ```bash
   make be
   # or: cd backend && uvicorn app.main:app --reload
   ```

3. **Start RQ Worker** (NEW - required for async processing)
   ```bash
   make worker
   # or: cd backend && python worker.py
   ```

4. **Start Frontend**
   ```bash
   make fe
   # or: cd frontend && pnpm dev
   ```

### Production Setup

For production, you should run multiple workers for redundancy:

```bash
# Terminal 1: Worker 1
cd backend
source venv/bin/activate
python worker.py

# Terminal 2: Worker 2
cd backend
source venv/bin/activate
python worker.py

# etc...
```

Or use a process manager like systemd, supervisor, or Docker:

#### Docker Compose (Production)

Add to your production `docker-compose.yml`:

```yaml
services:
  backend:
    # ... existing backend config ...

  worker:
    build: ./backend
    command: python worker.py
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - OLLAMA_BASE_URL=${OLLAMA_BASE_URL}
    depends_on:
      - redis
      - db
    restart: unless-stopped
    deploy:
      replicas: 3  # Run 3 workers for redundancy

  redis:
    image: redis:7-alpine
    restart: unless-stopped
```

#### Systemd Service (Linux)

Create `/etc/systemd/system/tea-worker@.service`:

```ini
[Unit]
Description=Team Evaluatie App RQ Worker %i
After=network.target redis.service postgresql.service

[Service]
Type=simple
User=tea
WorkingDirectory=/opt/team-evaluatie-app/backend
Environment="PATH=/opt/team-evaluatie-app/backend/venv/bin"
ExecStart=/opt/team-evaluatie-app/backend/venv/bin/python worker.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start multiple workers:
```bash
sudo systemctl enable tea-worker@{1..3}.service
sudo systemctl start tea-worker@{1..3}.service
```

## API Endpoints

### Queue Summary Generation

```http
POST /api/v1/feedback-summaries/evaluation/{evaluation_id}/student/{student_id}/queue
```

**Response:**
```json
{
  "job_id": "summary-123-456-1234567890",
  "status": "queued",
  "student_id": 456,
  "evaluation_id": 123,
  "created_at": "2026-01-01T10:00:00"
}
```

### Check Job Status

```http
GET /api/v1/feedback-summaries/jobs/{job_id}/status
```

**Response (Processing):**
```json
{
  "job_id": "summary-123-456-1234567890",
  "status": "processing",
  "student_id": 456,
  "evaluation_id": 123,
  "created_at": "2026-01-01T10:00:00",
  "started_at": "2026-01-01T10:00:05"
}
```

**Response (Completed):**
```json
{
  "job_id": "summary-123-456-1234567890",
  "status": "completed",
  "student_id": 456,
  "evaluation_id": 123,
  "created_at": "2026-01-01T10:00:00",
  "started_at": "2026-01-01T10:00:05",
  "completed_at": "2026-01-01T10:00:35",
  "result": {
    "summary_text": "Je hebt goede samenwerking getoond...",
    "generation_method": "ai",
    "feedback_count": 5
  }
}
```

### Batch Queue (Teacher/Admin)

```http
POST /api/v1/feedback-summaries/evaluation/{evaluation_id}/batch-queue
Content-Type: application/json

{
  "student_ids": [456, 457, 458]
}
```

**Response:**
```json
{
  "evaluation_id": 123,
  "total_students": 3,
  "queued": 3,
  "already_queued": 0,
  "failed": 0,
  "results": [
    {"student_id": 456, "job_id": "summary-123-456-...", "status": "queued"},
    {"student_id": 457, "job_id": "summary-123-457-...", "status": "queued"},
    {"student_id": 458, "job_id": "summary-123-458-...", "status": "queued"}
  ]
}
```

### List Jobs for Evaluation

```http
GET /api/v1/feedback-summaries/evaluation/{evaluation_id}/jobs?status=processing
```

## Frontend Usage

### Using the Hook

```typescript
import { useAsyncSummary } from "@/hooks/useAsyncSummary";

function MyComponent() {
  const {
    summary,
    status,
    error,
    generationMethod,
    feedbackCount,
    jobId,
    startGeneration,
    retryGeneration,
    isPolling,
  } = useAsyncSummary(evaluationId, studentId, {
    autoStart: true,
    pollingInterval: 3000,
    useSync: false, // Set to true for fallback to sync mode
  });

  if (status === "processing") {
    return <div>Generating summary...</div>;
  }

  if (error) {
    return (
      <div>
        Error: {error}
        <button onClick={retryGeneration}>Retry</button>
      </div>
    );
  }

  return <div>{summary}</div>;
}
```

### Using the Component

```typescript
import { AISummarySection } from "@/components/student/AISummarySection";

<AISummarySection
  evaluationId={123}
  studentId={456}
  fallbackSummary="Optional fallback text"
  useAsync={true}
/>
```

## Monitoring

### Check Queue Status

Connect to Redis and inspect queues:

```bash
# Using redis-cli
docker exec -it <redis_container> redis-cli

# In redis-cli:
> KEYS rq:queue:*
> LLEN rq:queue:ai-summaries
> SMEMBERS rq:workers
```

### Check Job Status in Database

```sql
-- Active jobs
SELECT job_id, status, student_id, evaluation_id, created_at
FROM summary_generation_jobs
WHERE status IN ('queued', 'processing')
ORDER BY created_at DESC;

-- Failed jobs
SELECT job_id, student_id, evaluation_id, error_message, created_at
FROM summary_generation_jobs
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;

-- Job statistics
SELECT status, COUNT(*) as count
FROM summary_generation_jobs
GROUP BY status;
```

### Worker Logs

Workers log to stdout/stderr:

```bash
# If running with make worker
# Logs appear in terminal

# If running as systemd service
sudo journalctl -u tea-worker@1.service -f

# If running in Docker
docker logs -f <worker_container_name>
```

## Troubleshooting

### Jobs Stuck in "Queued" State

**Symptom:** Jobs remain in "queued" status indefinitely.

**Cause:** Worker is not running or can't connect to Redis.

**Solution:**
1. Check if worker is running: `ps aux | grep worker.py`
2. Check Redis connection: `docker ps | grep redis`
3. Check worker logs for errors
4. Restart worker: `make worker`

### Jobs Fail with "Ollama request timed out"

**Symptom:** Jobs fail with timeout error.

**Cause:** Ollama model is slow or unavailable.

**Solution:**
1. Check if Ollama is running: `curl http://localhost:11434/api/tags`
2. Increase timeout in config: `OLLAMA_TIMEOUT=120.0`
3. Use a faster model: `OLLAMA_MODEL=llama3.2:1b`
4. Add more workers to distribute load

### High Memory Usage

**Symptom:** Workers consuming too much memory.

**Cause:** Multiple large models loaded or memory leak.

**Solution:**
1. Limit concurrent jobs per worker (RQ default is 1)
2. Restart workers periodically
3. Monitor with `htop` or similar
4. Consider using a smaller Ollama model

### Redis Out of Memory

**Symptom:** Redis errors or jobs not queuing.

**Cause:** Too many jobs in queue or results cache.

**Solution:**
1. Increase Redis memory limit in docker-compose
2. Reduce `result_ttl` in worker (default: 24h)
3. Clean old jobs from database
4. Use Redis `maxmemory-policy allkeys-lru`

## Performance Tuning

### Optimal Worker Count

**Rule of thumb:** 
- Development: 1 worker
- Production: 2-4 workers per CPU core (I/O bound)
- High load: 8-16 workers with load balancing

### Queue Configuration

In `app/infra/queue/tasks.py`, adjust timeouts:

```python
job = queue.enqueue(
    generate_ai_summary_task,
    job_timeout='10m',      # Max execution time
    result_ttl=86400,       # Keep results for 24 hours
    failure_ttl=86400,      # Keep failures for 24 hours
)
```

### Batch Processing

For teachers generating summaries for entire classes:

```python
# In backend
from app.infra.queue.connection import get_queue
from app.infra.queue.tasks import generate_ai_summary_task

queue = get_queue('ai-summaries')
for student_id in student_ids:
    queue.enqueue(generate_ai_summary_task, ...)
```

Or use the batch endpoint from frontend/API.

## Migration from Sync to Async

### Backward Compatibility

The synchronous endpoint still exists for backward compatibility:

```http
GET /api/v1/feedback-summaries/evaluation/{evaluation_id}/student/{student_id}
```

This will continue to work but may timeout with many students.

### Gradual Migration

1. Deploy backend with queue support
2. Start workers
3. Update frontend to use async mode
4. Monitor for errors
5. Eventually deprecate sync endpoint

### Feature Flag

Use environment variable to toggle async mode:

```typescript
const USE_ASYNC_SUMMARIES = process.env.NEXT_PUBLIC_USE_ASYNC_SUMMARIES === 'true';

<AISummarySection
  evaluationId={id}
  studentId={studentId}
  useAsync={USE_ASYNC_SUMMARIES}
/>
```

## Security Considerations

1. **Job Access Control:** Jobs are scoped by `school_id` to prevent cross-tenant access
2. **Rate Limiting:** Consider adding rate limiting to prevent abuse
3. **Input Validation:** All student/evaluation IDs are validated
4. **Error Messages:** Sanitized to prevent information leakage

## Future Enhancements

- [x] Add job progress tracking (0-100%)
- [x] Implement job cancellation
- [x] Add job priority queue
- [x] Webhook notifications on completion
- [x] Dashboard for queue monitoring
- [x] Automatic retry with exponential backoff
- [x] Multi-queue support for different task types
- [x] Job scheduling (cron-like)
- [x] Rate Limiting

## Recent Enhancements (2026-01-01)

### Job Progress Tracking
Jobs now report progress from 0-100% during execution. Check progress via the job status endpoint:
```json
{
  "job_id": "summary-123-456-...",
  "status": "processing",
  "progress": 60
}
```

### Job Cancellation
Cancel queued or processing jobs:
```http
POST /api/v1/feedback-summaries/jobs/{job_id}/cancel
```

### Priority Queues
Queue jobs with different priorities:
- `high`: Processed first (ai-summaries-high queue)
- `normal`: Default priority (ai-summaries queue)
- `low`: Processed last (ai-summaries-low queue)

```http
POST /api/v1/feedback-summaries/evaluation/{evaluation_id}/student/{student_id}/queue
Content-Type: application/json

{
  "priority": "high",
  "webhook_url": "https://example.com/webhook",
  "max_retries": 3
}
```

### Webhook Notifications
Get notified when jobs complete or fail:
```json
{
  "event": "job.completed",
  "timestamp": "2026-01-01T10:00:00",
  "data": {
    "job_id": "summary-123-456-...",
    "status": "completed",
    "student_id": 456,
    "evaluation_id": 123,
    "result": { ... }
  }
}
```

### Queue Monitoring Dashboard
Monitor queue health and statistics:
```http
GET /api/v1/feedback-summaries/queue/stats
GET /api/v1/feedback-summaries/queue/health
```

Response:
```json
{
  "status": "healthy",
  "redis": "connected",
  "workers": [
    {"name": "worker-1", "state": "busy", "current_job": "..."}
  ],
  "queues": [
    {"name": "ai-summaries-high", "count": 2},
    {"name": "ai-summaries", "count": 5},
    {"name": "ai-summaries-low", "count": 1}
  ]
}
```

### Automatic Retry with Exponential Backoff
Jobs automatically retry on failure with exponential backoff:
- 1st retry: 2 minutes
- 2nd retry: 4 minutes
- 3rd retry: 8 minutes

Configure max retries when queueing:
```json
{
  "max_retries": 5
}
```

### Scheduled Jobs (Cron)
Schedule recurring jobs with cron expressions:
```http
POST /api/v1/feedback-summaries/scheduled-jobs
Content-Type: application/json

{
  "name": "Daily summary generation",
  "cron_expression": "0 2 * * *",
  "task_params": {
    "evaluation_id": 123,
    "student_ids": [456, 457]
  },
  "enabled": true
}
```

Run the scheduler daemon:
```bash
python scheduler.py
```

### Rate Limiting
API endpoints are rate-limited:
- Queue endpoints: 10 requests/minute
- Batch endpoints: 5 requests/minute
- Other endpoints: 100 requests/minute

Rate limit headers in responses:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 60
```

## Support

For issues or questions:
1. Check logs: worker, backend, redis
2. Review this documentation
3. Check GitHub issues
4. Contact the development team
