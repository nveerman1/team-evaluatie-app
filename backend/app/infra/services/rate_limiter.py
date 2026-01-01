"""Rate limiting service using Redis."""
from __future__ import annotations

import logging
import time
from typing import Optional
from redis import Redis
from app.infra.queue.connection import RedisConnection

logger = logging.getLogger(__name__)


class RateLimiter:
    """Rate limiter using Redis with sliding window algorithm."""
    
    def __init__(self, redis_conn: Optional[Redis] = None):
        """
        Initialize rate limiter.
        
        Args:
            redis_conn: Redis connection (defaults to shared connection)
        """
        self.redis = redis_conn or RedisConnection.get_connection()
    
    def is_allowed(
        self,
        key: str,
        max_requests: int,
        window_seconds: int,
    ) -> tuple[bool, Optional[int]]:
        """
        Check if request is allowed under rate limit.
        
        Uses sliding window algorithm for accurate rate limiting:
        - Stores timestamps in Redis sorted set (score = timestamp)
        - Removes entries outside the time window
        - Counts remaining entries in window
        - Compares count against max_requests
        
        Args:
            key: Unique identifier for rate limit (e.g., "user:123:api_call")
            max_requests: Maximum number of requests allowed in window
            window_seconds: Time window in seconds
            
        Returns:
            Tuple of (is_allowed, retry_after_seconds)
            - is_allowed: True if request should be allowed, False if rate limit exceeded
            - retry_after_seconds: None if allowed, positive integer (seconds to wait) if blocked
        """
        now = time.time()
        window_start = now - window_seconds
        
        # Use Redis sorted set with timestamps as scores
        rate_key = f"rate_limit:{key}"
        
        pipe = self.redis.pipeline()
        
        # Remove old entries outside the window
        pipe.zremrangebyscore(rate_key, 0, window_start)
        
        # Count current requests in window
        pipe.zcard(rate_key)
        
        # Add current request
        pipe.zadd(rate_key, {str(now): now})
        
        # Set expiration to cleanup old keys
        pipe.expire(rate_key, window_seconds + 60)
        
        results = pipe.execute()
        current_count = results[1]
        
        if current_count < max_requests:
            # Request allowed
            return True, None
        else:
            # Request blocked - calculate retry time
            # Get oldest request in window
            oldest_requests = self.redis.zrange(rate_key, 0, 0, withscores=True)
            if oldest_requests:
                oldest_time = oldest_requests[0][1]
                retry_after = int(oldest_time + window_seconds - now) + 1
                return False, max(1, retry_after)  # Ensure at least 1 second
            else:
                return False, window_seconds
    
    def reset(self, key: str):
        """
        Reset rate limit for a key.
        
        Args:
            key: Rate limit key to reset
        """
        rate_key = f"rate_limit:{key}"
        self.redis.delete(rate_key)
        logger.info(f"Rate limit reset for key: {key}")
    
    def get_usage(self, key: str, window_seconds: int) -> dict:
        """
        Get current rate limit usage.
        
        Args:
            key: Rate limit key
            window_seconds: Time window in seconds
            
        Returns:
            Dictionary with usage information
        """
        now = time.time()
        window_start = now - window_seconds
        rate_key = f"rate_limit:{key}"
        
        # Count requests in current window
        count = self.redis.zcount(rate_key, window_start, now)
        
        # Get oldest and newest timestamps
        oldest_requests = self.redis.zrange(rate_key, 0, 0, withscores=True)
        newest_requests = self.redis.zrange(rate_key, -1, -1, withscores=True)
        
        oldest_time = oldest_requests[0][1] if oldest_requests else None
        newest_time = newest_requests[0][1] if newest_requests else None
        
        return {
            "current_count": count,
            "window_seconds": window_seconds,
            "oldest_request": oldest_time,
            "newest_request": newest_time,
        }
