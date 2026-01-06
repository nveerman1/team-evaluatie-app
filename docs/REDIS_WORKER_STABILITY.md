# Redis Worker Connection Stability

## Problem Addressed

This document describes the fix for the issue where the RQ worker stops after ~6 minutes with "Redis connection timeout, quitting...".

## Root Cause

The issue was caused by:
1. Missing health check interval - the client couldn't detect idle connection drops
2. No retry mechanism - transient failures were fatal
3. Aggressive socket timeout (5 minutes) - too short for idle workers
4. Basic keepalive only - not sufficient for detecting connection issues

## Solution Implemented

### 1. Enhanced Redis Connection Settings

In `backend/app/infra/queue/connection.py`, we've configured:

```python
REDIS_SOCKET_TIMEOUT = 600  # 10 minute timeout (increased from 5 minutes)
REDIS_SOCKET_CONNECT_TIMEOUT = 5  # 5 second timeout for initial connection
REDIS_HEALTH_CHECK_INTERVAL = 30  # Health checks every 30 seconds

Redis.from_url(
    redis_url,
    socket_keepalive=True,              # Keep connections alive
    socket_connect_timeout=5,            # Fast connection timeout
    socket_timeout=600,                  # Longer operation timeout
    health_check_interval=30,            # Periodic health checks
    retry_on_timeout=True,               # Auto-retry on timeout
)
```

**Key improvements:**
- `health_check_interval=30`: The Redis client now pings the server every 30 seconds to detect connection issues early
- `retry_on_timeout=True`: Automatically retries operations that timeout, handling transient network issues
- `socket_timeout=600`: Increased from 300s to 600s to accommodate longer idle periods
- `socket_keepalive=True`: TCP keepalive to prevent idle connection drops

### 2. Worker Auto-Restart

In `backend/worker.py`, the worker now automatically restarts on connection failures:

```python
MAX_WORKER_RESTART_ATTEMPTS = 100  # Maximum restart attempts
RESTART_DELAY_SECONDS = 2          # Delay between restarts

while restart_count < MAX_WORKER_RESTART_ATTEMPTS:
    try:
        worker.work(with_scheduler=True)
    except (RedisError, ConnectionError, TimeoutError) as e:
        # Log error with full stack trace
        # Close and reopen connection
        # Wait 2 seconds and retry
```

**Key improvements:**
- Automatic restart on Redis connection failures
- Full error logging with stack traces
- Configurable retry limit (100 attempts)
- Clean Ctrl+C shutdown behavior preserved

## Testing

### Manual Testing (Recommended)

To verify the worker runs stably for extended periods:

```bash
# Start Redis (if using Docker Compose)
make up

# In one terminal, start the worker
cd backend
source venv/bin/activate  # or: . venv/bin/activate
python worker.py
```

**Expected output:**
```
2024-01-06 12:00:00 - __main__ - INFO - Starting RQ worker for AI summary generation...
2024-01-06 12:00:00 - __main__ - INFO - Auto-restart enabled for Redis connection failures
2024-01-06 12:00:00 - app.infra.queue.connection - INFO - Redis connection established: redis://localhost:6379/0
2024-01-06 12:00:00 - app.infra.queue.connection - INFO - Redis connection settings: socket_timeout=600s, health_check_interval=30s, retry_on_timeout=True
2024-01-06 12:00:00 - __main__ - INFO - Redis connection parameters:
2024-01-06 12:00:00 - __main__ - INFO -   - socket_keepalive: True
2024-01-06 12:00:00 - __main__ - INFO -   - socket_timeout: 600s
2024-01-06 12:00:00 - __main__ - INFO -   - health_check_interval: 30s
2024-01-06 12:00:00 - __main__ - INFO -   - retry_on_timeout: True
2024-01-06 12:00:00 - __main__ - INFO - Worker listening on queues (priority order): ['ai-summaries-high', 'ai-summaries', 'ai-summaries-low']
```

**Test criteria:**
- ✅ Worker should run for > 15 minutes without stopping
- ✅ Worker should continue processing jobs
- ✅ No "Redis connection timeout" errors
- ✅ Ctrl+C should stop the worker cleanly

### Automated Testing with redis_ping_loop.py

A diagnostic script is available to test Redis connection stability:

```bash
cd backend

# Test for 15 minutes with 1-second ping intervals (default)
python scripts/redis_ping_loop.py

# Test for 30 minutes with 5-second ping intervals
python scripts/redis_ping_loop.py --interval 5 --duration 30
```

**Expected output:**
```
==========================================================================
Redis Connection Stability Test
==========================================================================
Test duration: 15.0 minutes
Ping interval: 1.0 seconds
Press Ctrl+C to stop early
==========================================================================
Redis connection established
Connection settings: socket_timeout=600s, health_check_interval=30s, retry_on_timeout=True

[30s] Ping #30: OK (latency: 0.52ms, avg: 0.48ms, min: 0.42ms, max: 0.52ms)
[60s] Ping #60: OK (latency: 0.46ms, avg: 0.47ms, min: 0.42ms, max: 0.52ms)
...
==========================================================================
Test Summary
==========================================================================
Total duration:    900.0 seconds (15.0 minutes)
Total pings:       900
Successful pings:  900 (100.0%)
Failed pings:      0 (0.0%)
Latency (avg):     0.48ms
Latency (min):     0.42ms
Latency (max):     0.52ms
==========================================================================
```

**Test criteria:**
- ✅ 100% successful pings
- ✅ No connection errors
- ✅ Consistent low latency

## Configuration

### Environment Variables

Configure Redis connection via environment variable:

```bash
# Default
REDIS_URL=redis://localhost:6379/0

# For Docker Compose
REDIS_URL=redis://redis:6379/0

# With password
REDIS_URL=redis://:password@redis:6379/0
```

### Tuning Parameters

If you need to adjust the connection settings, modify these constants in `backend/app/infra/queue/connection.py`:

```python
REDIS_SOCKET_TIMEOUT = 600  # Increase if jobs take longer than 10 minutes
REDIS_SOCKET_CONNECT_TIMEOUT = 5  # Increase if connection is slow
REDIS_HEALTH_CHECK_INTERVAL = 30  # Decrease for more frequent checks
```

And in `backend/worker.py`:

```python
MAX_WORKER_RESTART_ATTEMPTS = 100  # Increase if environment is unstable
RESTART_DELAY_SECONDS = 2  # Increase to reduce restart frequency
```

## Troubleshooting

### Worker Still Stops After 6 Minutes

**Possible causes:**
1. Redis server configuration issue
2. Network/firewall dropping idle connections
3. WSL2-specific networking issues (if on Windows)

**Debug steps:**
```bash
# 1. Check Redis server logs
docker logs <redis-container-name>

# 2. Run the ping test script
python scripts/redis_ping_loop.py --duration 15

# 3. Check if Redis is accessible
redis-cli -h localhost -p 6379 ping

# 4. Monitor worker logs carefully
python worker.py 2>&1 | tee worker.log
```

### Connection Errors Persist

If you see repeated connection errors:

1. **Check Redis is running:**
   ```bash
   docker ps | grep redis
   ```

2. **Verify Redis URL:**
   ```bash
   echo $REDIS_URL
   # Should match your Redis server address
   ```

3. **Test direct connection:**
   ```bash
   redis-cli -u redis://localhost:6379/0 ping
   ```

4. **Check firewall/network:**
   - Ensure port 6379 is open
   - Check if any firewalls are blocking connections

### Worker Restarts Too Frequently

If the worker restarts multiple times:

1. **Check the error messages** - they'll indicate the specific problem
2. **Increase RESTART_DELAY_SECONDS** to reduce restart frequency
3. **Check Redis server health** - it might be overloaded or misconfigured

## Monitoring

### Production Monitoring

For production deployments, consider:

1. **Process monitoring:** Use systemd, supervisord, or Docker restart policies
2. **Log aggregation:** Collect worker logs for analysis
3. **Metrics:** Monitor worker restart count, job processing rate, Redis connection health
4. **Alerts:** Set up alerts for repeated worker restarts or connection failures

### Example systemd service

```ini
[Unit]
Description=RQ Worker for AI Summary Generation
After=network.target redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/backend
Environment="REDIS_URL=redis://localhost:6379/0"
ExecStart=/path/to/venv/bin/python worker.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## Summary

The fix ensures the RQ worker runs reliably by:
- ✅ Detecting connection issues early with health checks
- ✅ Handling transient failures with automatic retries
- ✅ Using appropriate timeouts for long-running operations
- ✅ Automatically restarting on persistent connection failures
- ✅ Providing detailed logging for troubleshooting

The worker should now run indefinitely without stopping due to Redis connection timeouts.
