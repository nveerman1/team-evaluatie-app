"""Redis connection management for queue system."""
from __future__ import annotations

import logging
from typing import Optional
from redis import Redis
from rq import Queue
from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisConnection:
    """Singleton Redis connection manager."""
    
    _instance: Optional[Redis] = None
    
    @classmethod
    def get_connection(cls) -> Redis:
        """Get or create Redis connection."""
        if cls._instance is None:
            # Parse Redis URL from settings or use defaults
            redis_url = getattr(settings, 'REDIS_URL', 'redis://localhost:6379/0')
            cls._instance = Redis.from_url(redis_url, decode_responses=True)
            logger.info(f"Redis connection established: {redis_url}")
        return cls._instance
    
    @classmethod
    def close_connection(cls):
        """Close Redis connection."""
        if cls._instance:
            cls._instance.close()
            cls._instance = None
            logger.info("Redis connection closed")


def get_queue(name: str = 'default') -> Queue:
    """
    Get RQ queue instance.
    
    Args:
        name: Queue name (supports priority suffixes like 'ai-summaries-high')
    
    Returns:
        Queue instance
    """
    conn = RedisConnection.get_connection()
    return Queue(name, connection=conn)
