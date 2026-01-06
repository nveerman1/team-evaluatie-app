"""Redis connection management for queue system."""

from __future__ import annotations

import logging
from typing import Optional
from redis import Redis
from rq import Queue
from app.core.config import settings

logger = logging.getLogger(__name__)

# Redis connection configuration
REDIS_SOCKET_TIMEOUT = 600  # 10 minute timeout for operations
REDIS_SOCKET_CONNECT_TIMEOUT = 5  # 5 second timeout for initial connection
REDIS_HEALTH_CHECK_INTERVAL = 30  # Periodic health checks every 30 seconds


class RedisConnection:
    """Singleton Redis connection manager."""

    _instance: Optional[Redis] = None

    @classmethod
    def get_connection(cls) -> Redis:
        """Get or create Redis connection.

        Note: decode_responses=False is required for RQ to work correctly.
        RQ stores binary-serialized data (pickled payloads) in Redis, which
        cannot be decoded as UTF-8 strings. Using decode_responses=True would
        cause UnicodeDecodeError when the worker tries to fetch jobs.
        """
        if cls._instance is None:
            # Parse Redis URL from settings or use defaults
            redis_url = getattr(settings, "REDIS_URL", "redis://localhost:6379/0")
            # IMPORTANT: decode_responses must be False for RQ compatibility
            # RQ stores binary data that cannot be decoded as UTF-8
            # Enable socket keepalive to prevent connection timeouts
            cls._instance = Redis.from_url(
                redis_url,
                decode_responses=False,
                socket_keepalive=True,
                socket_connect_timeout=REDIS_SOCKET_CONNECT_TIMEOUT,
                socket_timeout=REDIS_SOCKET_TIMEOUT,
                health_check_interval=REDIS_HEALTH_CHECK_INTERVAL,
                retry_on_timeout=True,  # Automatically retry on timeout
            )
            logger.info(f"Redis connection established: {redis_url}")
            logger.info(
                f"Redis connection settings: socket_timeout={REDIS_SOCKET_TIMEOUT}s, "
                f"health_check_interval={REDIS_HEALTH_CHECK_INTERVAL}s, retry_on_timeout=True"
            )
        return cls._instance

    @classmethod
    def close_connection(cls):
        """Close Redis connection."""
        if cls._instance:
            cls._instance.close()
            cls._instance = None
            logger.info("Redis connection closed")


def get_queue(name: str = "default") -> Queue:
    """
    Get RQ queue instance.

    Args:
        name: Queue name (supports priority suffixes like 'ai-summaries-high')

    Returns:
        Queue instance
    """
    conn = RedisConnection.get_connection()
    return Queue(name, connection=conn)
