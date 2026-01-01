#!/usr/bin/env python
"""
RQ Worker for processing AI summary generation jobs.

Usage:
    python worker.py

This worker processes jobs from the 'ai-summaries' queue.
"""
import sys
import logging
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from rq import Worker, Queue, Connection
from app.infra.queue.connection import RedisConnection

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    """Run the RQ worker."""
    logger.info("Starting RQ worker for AI summary generation...")
    
    # Get Redis connection
    redis_conn = RedisConnection.get_connection()
    
    # Create worker and listen to the queue
    with Connection(redis_conn):
        queues = [Queue('ai-summaries')]
        worker = Worker(queues, connection=redis_conn)
        
        logger.info(f"Worker listening on queues: {[q.name for q in queues]}")
        logger.info("Press Ctrl+C to stop the worker")
        
        try:
            worker.work(with_scheduler=True)
        except KeyboardInterrupt:
            logger.info("Worker stopped by user")
        finally:
            RedisConnection.close_connection()


if __name__ == '__main__':
    main()
