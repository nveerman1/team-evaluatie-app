# Quick Start Guide: Async AI Summary Generation

This guide will help you get the new async AI summary generation system up and running in 5 minutes.

## Prerequisites

- Docker and Docker Compose installed
- Python 3.11+ with venv
- Node.js 18+ with pnpm
- Git repository cloned

## Step-by-Step Setup

### 1. Start Infrastructure (Redis + PostgreSQL)

```bash
cd /path/to/team-evaluatie-app
make up
```

Wait for services to be healthy:
```bash
docker ps
# Should show redis and postgres containers running
```

### 2. Setup Backend (First Time Only)

```bash
cd backend

# Create virtual environment (if not exists)
python -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements-dev.txt

# Run migrations
alembic upgrade head
```

### 3. Test the Setup

```bash
# Still in backend directory with venv activated
python test_async_summary.py
```

Expected output:
```
============================================================
Async AI Summary Generation - Test Suite
============================================================

Testing imports...
✓ All imports successful

Testing configuration...
  REDIS_URL: redis://localhost:6379/0
  OLLAMA_BASE_URL: http://localhost:11434
  ...
✓ Configuration loaded

Testing Redis connection...
✓ Redis connected: ...

Testing database connection...
✓ Database connected and table exists

Testing queue operations...
✓ Queue 'ai-summaries' accessible, 0 jobs pending
  0 workers connected

Testing task structure...
✓ Task signature correct: ['school_id', 'evaluation_id', 'student_id', 'job_id']

============================================================
Test Results Summary
============================================================
✓ PASS   Imports
✓ PASS   Configuration
✓ PASS   Redis Connection
✓ PASS   Database Connection
✓ PASS   Queue Operations
✓ PASS   Task Structure

6/6 tests passed

🎉 All tests passed! System is ready.
```

If any tests fail, see the error messages and fix before continuing.

### 4. Start the Worker

Open a new terminal:

```bash
cd /path/to/team-evaluatie-app
make worker
```

Expected output:
```
Starting RQ worker for AI summary generation...
Worker listening on queues: ['ai-summaries']
Press Ctrl+C to stop the worker
...
```

Keep this terminal open. The worker will process jobs in the background.

### 5. Start the Backend API

Open another new terminal:

```bash
cd /path/to/team-evaluatie-app
make be
```

Expected output:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### 6. Start the Frontend

Open yet another terminal:

```bash
cd /path/to/team-evaluatie-app
make fe
```

Expected output:
```
ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

### 7. Test the System

1. Open browser to http://localhost:3000
2. Login as a student (e.g., student.4a.1@school1.demo / demo123)
3. Navigate to an evaluation
4. Click on "Overzicht" tab
5. You should see:
   - "In wachtrij" or "Genereren..." status
   - A loading spinner
   - After a few seconds, the AI summary appears

### 8. Monitor the System

**Check worker logs:**
- Look at the terminal where `make worker` is running
- You should see log messages when jobs are processed

**Check job status in database:**
```bash
cd backend
source venv/bin/activate
python -c "
from app.infra.db.base import SessionLocal
from app.infra.db.models import SummaryGenerationJob

db = SessionLocal()
jobs = db.query(SummaryGenerationJob).order_by(SummaryGenerationJob.created_at.desc()).limit(10).all()
for job in jobs:
    print(f'{job.job_id}: {job.status} (student {job.student_id})')
db.close()
"
```

**Check Redis queue:**
```bash
docker exec -it <redis_container_name> redis-cli LLEN rq:queue:ai-summaries
```

## Common Issues

### "Redis connection failed"

**Solution:**
```bash
make up  # Start Redis
docker ps  # Verify Redis is running
```

### "Table 'summary_generation_jobs' does not exist"

**Solution:**
```bash
cd backend
source venv/bin/activate
alembic upgrade head
```

### "Worker not processing jobs"

**Solution:**
1. Check worker is running: `ps aux | grep worker.py`
2. Restart worker: Ctrl+C then `make worker`
3. Check worker logs for errors

### "Frontend shows 'Failed to queue job'"

**Solution:**
1. Check backend is running: http://localhost:8000/docs
2. Check backend logs for errors
3. Verify user is authenticated

### "Summary stuck in 'Processing' state"

**Solution:**
1. Check if Ollama is running: `curl http://localhost:11434/api/tags`
2. Check worker logs for errors
3. Check database for error_message

## Quick Commands Reference

```bash
# Infrastructure
make up          # Start Redis + PostgreSQL
make down        # Stop all services

# Backend
make be          # Start FastAPI server
make worker      # Start RQ worker
make test        # Run tests

# Frontend
make fe          # Start Next.js dev server

# Database
cd backend && alembic upgrade head    # Run migrations
cd backend && alembic downgrade -1    # Rollback one migration

# Monitoring
docker ps                             # Check running containers
docker logs <container_name>          # View container logs
python test_async_summary.py          # Run test suite
```

## Architecture Overview

```
┌─────────────┐
│   Browser   │
│  (Student)  │
└──────┬──────┘
       │ 1. Visit /overzicht
       ↓
┌─────────────────────┐
│   Next.js Frontend  │
│  (Port 3000)        │
└──────┬──────────────┘
       │ 2. POST /queue
       ↓
┌─────────────────────┐
│   FastAPI Backend   │
│   (Port 8000)       │
└──────┬──────────────┘
       │ 3. Queue job
       ↓
┌─────────────────────┐
│    Redis Queue      │
│   (Port 6379)       │
└──────┬──────────────┘
       │ 4. Pick job
       ↓
┌─────────────────────┐
│    RQ Worker        │
│  (Background)       │
└──────┬──────────────┘
       │ 5. Generate
       ↓
┌─────────────────────┐
│   Ollama/Mistral    │
│   (Port 11434)      │
└──────┬──────────────┘
       │ 6. Summary
       ↓
┌─────────────────────┐
│   PostgreSQL DB     │
│   (Port 5432)       │
└──────┬──────────────┘
       │ 7. Store result
       ↓
     Frontend polls for status
```

## Next Steps

1. ✅ **Test with multiple students** - Create evaluations and test with 10+ students
2. ✅ **Monitor performance** - Watch logs and database queries
3. ✅ **Scale workers** - If needed, run multiple workers in different terminals
4. ✅ **Configure for production** - See `docs/ASYNC_SUMMARY_GENERATION.md`

## Need Help?

- **Documentation:** `docs/ASYNC_SUMMARY_GENERATION.md`
- **Implementation Details:** `ASYNC_IMPLEMENTATION_SUMMARY.md`
- **API Docs:** http://localhost:8000/docs (when backend is running)
- **Test Script:** `python backend/test_async_summary.py`

Happy coding! 🚀
