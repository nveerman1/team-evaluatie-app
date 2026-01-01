# Job Queue Enhancements

This document describes the comprehensive enhancements made to the async job queue system for AI summary generation.

## Features Implemented

### 1. Job Progress Tracking (0-100%)

Jobs now report progress during execution, allowing users to see real-time updates.

**API Response:**
```json
{
  "job_id": "summary-123-456-1234567890",
  "status": "processing",
  "progress": 60,
  "student_id": 456,
  "evaluation_id": 123
}
```

**Progress Stages:**
- 10%: Job started
- 20%: Evaluation verified
- 30%: Student verified
- 40%: Feedback collected
- 50%: Anonymization started
- 60%: Anonymization completed
- 80%: AI generation completed
- 90%: Summary cached
- 100%: Job completed

### 2. Job Cancellation

Cancel jobs that are queued or in progress.

**Endpoint:**
```http
POST /api/v1/feedback-summaries/jobs/{job_id}/cancel
```

**Response:**
```json
{
  "message": "Job cancelled successfully",
  "job_id": "summary-123-456-1234567890",
  "status": "cancelled"
}
```

**Notes:**
- Jobs already completed, failed, or cancelled cannot be cancelled
- Jobs in progress may complete before cancellation takes effect
- Cancellation is tracked with `cancelled_at` timestamp and `cancelled_by` user ID

### 3. Priority Queues

Queue jobs with different priorities for better resource allocation.

**Priority Levels:**
- `high`: Processed first (ai-summaries-high queue)
- `normal`: Default priority (ai-summaries queue)
- `low`: Processed last (ai-summaries-low queue)

**Queue Job with Priority:**
```http
POST /api/v1/feedback-summaries/evaluation/{evaluation_id}/student/{student_id}/queue
Content-Type: application/json

{
  "priority": "high",
  "webhook_url": "https://example.com/webhook",
  "max_retries": 5
}
```

**Worker Processing:**
Workers process queues in priority order:
1. ai-summaries-high
2. ai-summaries
3. ai-summaries-low

### 4. Webhook Notifications

Get real-time notifications when jobs complete or fail.

**Configure Webhook:**
```json
{
  "priority": "normal",
  "webhook_url": "https://example.com/webhook"
}
```

**Webhook Payload (Success):**
```json
{
  "event": "job.completed",
  "timestamp": "2026-01-01T10:00:00",
  "data": {
    "job_id": "summary-123-456-1234567890",
    "status": "completed",
    "student_id": 456,
    "evaluation_id": 123,
    "result": {
      "summary_text": "...",
      "generation_method": "ai",
      "feedback_count": 5
    }
  }
}
```

**Webhook Payload (Failure):**
```json
{
  "event": "job.failed",
  "timestamp": "2026-01-01T10:00:00",
  "data": {
    "job_id": "summary-123-456-1234567890",
    "status": "failed",
    "student_id": 456,
    "evaluation_id": 123,
    "error": "Connection timeout"
  }
}
```

**Features:**
- Automatic retry on webhook delivery failure (up to 3 attempts)
- 10-second timeout per request
- Delivery status tracked in database

### 5. Queue Monitoring Dashboard

Monitor queue health and performance in real-time.

**Queue Statistics:**
```http
GET /api/v1/feedback-summaries/queue/stats
```

**Response:**
```json
{
  "queue_name": "ai-summaries",
  "queued_count": 15,
  "processing_count": 3,
  "completed_count": 142,
  "failed_count": 8,
  "cancelled_count": 2,
  "workers_count": 3
}
```

**Health Check:**
```http
GET /api/v1/feedback-summaries/queue/health
```

**Response:**
```json
{
  "status": "healthy",
  "redis": "connected",
  "workers": [
    {
      "name": "rq:worker:hostname.1234",
      "state": "busy",
      "current_job": "summary-123-456-..."
    }
  ],
  "queues": [
    {"name": "ai-summaries-high", "count": 2},
    {"name": "ai-summaries", "count": 5},
    {"name": "ai-summaries-low", "count": 1}
  ]
}
```

### 6. Automatic Retry with Exponential Backoff

Jobs automatically retry on failure with increasing delays.

**Retry Schedule:**
- 1st retry: 2 minutes
- 2nd retry: 4 minutes
- 3rd retry: 8 minutes

**Configuration:**
```json
{
  "max_retries": 5
}
```

**Job Status During Retry:**
```json
{
  "status": "queued",
  "retry_count": 2,
  "max_retries": 3,
  "next_retry_at": "2026-01-01T10:04:00",
  "error_message": "Retry 2/3: Connection timeout"
}
```

### 7. Job Scheduling (Cron-like)

Schedule recurring jobs using cron expressions.

**Create Scheduled Job:**
```http
POST /api/v1/feedback-summaries/scheduled-jobs
Content-Type: application/json

{
  "name": "Daily summary generation",
  "cron_expression": "0 2 * * *",
  "task_params": {
    "evaluation_id": 123,
    "student_ids": [456, 457, 458]
  },
  "enabled": true
}
```

**Cron Expression Examples:**
- `0 2 * * *` - Daily at 2 AM
- `0 */6 * * *` - Every 6 hours
- `0 9 * * 1` - Every Monday at 9 AM
- `*/15 * * * *` - Every 15 minutes

**List Scheduled Jobs:**
```http
GET /api/v1/feedback-summaries/scheduled-jobs
```

**Update Scheduled Job:**
```http
PATCH /api/v1/feedback-summaries/scheduled-jobs/{job_id}
Content-Type: application/json

{
  "enabled": false
}
```

**Delete Scheduled Job:**
```http
DELETE /api/v1/feedback-summaries/scheduled-jobs/{job_id}
```

**Run Scheduler Daemon:**
```bash
make scheduler
# or: python backend/scheduler.py
```

### 8. Rate Limiting

Protect API endpoints from abuse with rate limiting.

**Rate Limits:**
- Queue endpoints: 10 requests/minute
- Batch endpoints: 5 requests/minute
- Other endpoints: 100 requests/minute

**Rate Limit Headers:**
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 60
```

**Rate Limit Exceeded Response:**
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42
Content-Type: application/json

{
  "detail": "Rate limit exceeded. Retry after 42 seconds."
}
```

**Rate Limiting by:**
- User ID (when authenticated)
- IP address (when not authenticated)

## Database Schema Changes

### Updated: `summary_generation_jobs`

New fields:
- `progress` (integer): Job progress 0-100%
- `priority` (string): "high" | "normal" | "low"
- `retry_count` (integer): Current retry attempt
- `max_retries` (integer): Maximum retry attempts
- `next_retry_at` (datetime): When to retry next
- `cancelled_at` (datetime): When job was cancelled
- `cancelled_by` (integer): User who cancelled the job
- `webhook_url` (string): Webhook notification URL
- `webhook_delivered` (boolean): Whether webhook was delivered
- `webhook_attempts` (integer): Number of webhook delivery attempts
- `queue_name` (string): Queue name for multi-queue support
- `task_type` (string): Type of task for extensibility

### New: `scheduled_jobs`

Fields:
- `id` (integer): Primary key
- `school_id` (integer): School ID (multi-tenant)
- `name` (string): Job name
- `task_type` (string): Type of task to execute
- `queue_name` (string): Queue to use
- `cron_expression` (string): Cron schedule
- `task_params` (jsonb): Task parameters
- `enabled` (boolean): Whether job is active
- `last_run_at` (datetime): Last execution time
- `next_run_at` (datetime): Next scheduled execution
- `created_at` (datetime): Creation timestamp
- `updated_at` (datetime): Last update timestamp
- `created_by` (integer): User who created the job

## Migration

Run the database migration:
```bash
cd backend
source venv/bin/activate
alembic upgrade head
```

## Running the System

### Start Infrastructure
```bash
make up
```

### Start Backend API
```bash
make be
```

### Start Workers (Multiple Terminals)
```bash
# Terminal 1
make worker

# Terminal 2 (optional, for redundancy)
make worker

# Terminal 3 (optional)
make worker
```

### Start Scheduler (If Using Scheduled Jobs)
```bash
make scheduler
```

### Start Frontend
```bash
make fe
```

## Monitoring

### Check Queue Status
```bash
# Via API
curl http://localhost:8000/api/v1/feedback-summaries/queue/stats

# Via Redis CLI
docker exec -it <redis_container> redis-cli
> LLEN rq:queue:ai-summaries-high
> LLEN rq:queue:ai-summaries
> LLEN rq:queue:ai-summaries-low
> SMEMBERS rq:workers
```

### Check Job Status
```sql
-- Active jobs
SELECT job_id, status, progress, priority, student_id, evaluation_id
FROM summary_generation_jobs
WHERE status IN ('queued', 'processing')
ORDER BY 
  CASE priority 
    WHEN 'high' THEN 1 
    WHEN 'normal' THEN 2 
    WHEN 'low' THEN 3 
  END,
  created_at ASC;

-- Failed jobs with retries
SELECT job_id, retry_count, max_retries, next_retry_at, error_message
FROM summary_generation_jobs
WHERE status = 'queued' AND retry_count > 0
ORDER BY next_retry_at ASC;

-- Scheduled jobs
SELECT name, cron_expression, enabled, next_run_at
FROM scheduled_jobs
WHERE enabled = true
ORDER BY next_run_at ASC;
```

## Testing

Run the test suite:
```bash
cd backend
source venv/bin/activate
pytest tests/test_job_enhancements.py -v
```

**Test Coverage:**
- Job progress tracking
- Job cancellation
- Priority queues
- Webhook notifications
- Rate limiting
- Retry mechanism
- Scheduled jobs
- Queue monitoring
- API endpoints

## Security Considerations

1. **Multi-tenancy**: All operations are scoped by `school_id`
2. **Authentication**: All endpoints require authentication
3. **Rate Limiting**: Prevents API abuse
4. **Webhook Validation**: Webhooks are sent with proper headers
5. **Input Validation**: Cron expressions and URLs are validated
6. **Cancellation Authorization**: Only authorized users can cancel jobs

## Performance Tips

1. **Worker Count**: Run 2-4 workers per CPU core for I/O-bound tasks
2. **Redis Memory**: Ensure adequate Redis memory for queue data
3. **Priority Usage**: Use high priority sparingly to avoid starvation
4. **Webhook Timeouts**: Keep webhook endpoints fast (<1 second)
5. **Scheduled Jobs**: Avoid overlapping schedules for resource-intensive tasks

## Troubleshooting

### Jobs Stuck in Queued State
- Check if workers are running: `ps aux | grep worker.py`
- Check worker logs for errors
- Verify Redis connection: `docker ps | grep redis`

### Webhooks Not Delivered
- Check `webhook_delivered` and `webhook_attempts` in database
- Verify webhook URL is accessible
- Check webhook endpoint logs for errors

### Rate Limit Errors
- Check `X-RateLimit-*` headers for current usage
- Implement exponential backoff in client code
- Request rate limit increase if needed

### Scheduled Jobs Not Running
- Verify scheduler daemon is running: `ps aux | grep scheduler.py`
- Check `next_run_at` in database
- Verify cron expression is valid
- Check scheduler logs for errors

## Future Enhancements

- [ ] Job dependencies (run job B after job A completes)
- [ ] Batch cancellation
- [ ] Custom webhook retry strategies
- [ ] Job result persistence to S3
- [ ] Advanced queue metrics (latency, throughput)
- [ ] Dead letter queue for failed jobs
- [ ] Job chaining and workflows

## Support

For issues or questions:
1. Check the logs (worker, scheduler, backend, redis)
2. Review this documentation
3. Check database for job status
4. Contact the development team
