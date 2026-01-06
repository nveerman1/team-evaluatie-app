#!/usr/bin/env python
"""
RQ Worker for processing AI summary generation jobs.

Usage:
    python worker.py

This worker processes jobs from multiple queues with priority support:
- ai-summaries-high (high priority)
- ai-summaries (normal priority)
- ai-summaries-low (low priority)
"""
import sys
import time
import logging
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from rq import Worker, Queue
from redis.exceptions import RedisError, ConnectionError, TimeoutError
from app.infra.queue.connection import RedisConnection

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    """Run the RQ worker with auto-restart on connection failures."""
    logger.info("Starting RQ worker for AI summary generation...")
    logger.info("Auto-restart enabled for Redis connection failures")
    
    restart_count = 0
    max_restart_attempts = 100  # Prevent infinite restart loops in case of persistent issues
    
    while restart_count < max_restart_attempts:
        try:
            # Get Redis connection (will create new one if previous was closed)
            redis_conn = RedisConnection.get_connection()
            
            # Log Redis connection parameters on first start or after restart
            if restart_count == 0:
                logger.info("Redis connection parameters:")
                logger.info(f"  - socket_keepalive: True")
                logger.info(f"  - socket_timeout: 600s (10 minutes)")
                logger.info(f"  - health_check_interval: 30s")
                logger.info(f"  - retry_on_timeout: True")
            
            # Create queues with priority order (high to low)
            # Worker will process jobs from high priority queue first
            queues = [
                Queue('ai-summaries-high', connection=redis_conn),
                Queue('ai-summaries', connection=redis_conn),
                Queue('ai-summaries-low', connection=redis_conn),
            ]
            worker = Worker(queues, connection=redis_conn)
            
            if restart_count > 0:
                logger.info(f"Worker restarted (attempt #{restart_count})")
            
            logger.info(f"Worker listening on queues (priority order): {[q.name for q in queues]}")
            logger.info("Press Ctrl+C to stop the worker")
            
            # Run the worker with scheduler
            worker.work(with_scheduler=True)
            
            # If we reach here, worker stopped gracefully
            logger.info("Worker stopped gracefully")
            break
            
        except KeyboardInterrupt:
            logger.info("Worker stopped by user (Ctrl+C)")
            break
            
        except (RedisError, ConnectionError, TimeoutError) as e:
            restart_count += 1
            logger.error(f"Redis connection error (attempt #{restart_count}): {type(e).__name__}: {e}")
            logger.error("Stack trace:", exc_info=True)
            
            # Close existing connection to force reconnection
            try:
                RedisConnection.close_connection()
            except Exception as close_err:
                logger.warning(f"Error closing Redis connection: {close_err}")
            
            if restart_count < max_restart_attempts:
                logger.info(f"Restarting worker in 2 seconds... (attempt #{restart_count}/{max_restart_attempts})")
                time.sleep(2)
            else:
                logger.error(f"Maximum restart attempts ({max_restart_attempts}) reached. Exiting.")
                break
                
        except Exception as e:
            restart_count += 1
            logger.error(f"Unexpected error (attempt #{restart_count}): {type(e).__name__}: {e}")
            logger.error("Stack trace:", exc_info=True)
            
            # Close existing connection
            try:
                RedisConnection.close_connection()
            except Exception as close_err:
                logger.warning(f"Error closing Redis connection: {close_err}")
            
            if restart_count < max_restart_attempts:
                logger.info(f"Restarting worker in 2 seconds... (attempt #{restart_count}/{max_restart_attempts})")
                time.sleep(2)
            else:
                logger.error(f"Maximum restart attempts ({max_restart_attempts}) reached. Exiting.")
                break
    
    # Final cleanup
    try:
        RedisConnection.close_connection()
    except Exception as e:
        logger.warning(f"Error during final cleanup: {e}")


if __name__ == '__main__':
    main()
