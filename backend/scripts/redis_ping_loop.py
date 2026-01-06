#!/usr/bin/env python
"""
Redis connection stability test script.

This script continuously pings Redis to test connection stability and detect
any timeout or connection issues. Useful for diagnosing Redis connection problems.

Usage:
    python scripts/redis_ping_loop.py [--interval SECONDS] [--duration MINUTES]

Options:
    --interval SECONDS    Ping interval in seconds (default: 1)
    --duration MINUTES    Total test duration in minutes (default: 15)

Example:
    # Test for 15 minutes with 1 second intervals
    python scripts/redis_ping_loop.py

    # Test for 30 minutes with 5 second intervals
    python scripts/redis_ping_loop.py --interval 5 --duration 30
"""
import sys
import time
import argparse
import logging
from pathlib import Path
from datetime import datetime, timedelta

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from redis.exceptions import RedisError, ConnectionError, TimeoutError  # noqa: E402
from app.infra.queue.connection import (  # noqa: E402
    RedisConnection,
    REDIS_SOCKET_TIMEOUT,
    REDIS_HEALTH_CHECK_INTERVAL,
)

# Setup logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Test Redis connection stability",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=1.0,
        help="Ping interval in seconds (default: 1)",
    )
    parser.add_argument(
        "--duration",
        type=float,
        default=15.0,
        help="Total test duration in minutes (default: 15)",
    )
    return parser.parse_args()


def main():
    """Run Redis ping loop test."""
    args = parse_args()

    interval = args.interval
    duration_minutes = args.duration
    duration_seconds = duration_minutes * 60

    logger.info("=" * 70)
    logger.info("Redis Connection Stability Test")
    logger.info("=" * 70)
    logger.info(f"Test duration: {duration_minutes} minutes")
    logger.info(f"Ping interval: {interval} seconds")
    logger.info("Press Ctrl+C to stop early")
    logger.info("=" * 70)

    # Get Redis connection
    redis_conn = RedisConnection.get_connection()
    logger.info("Redis connection established")
    logger.info(
        f"Connection settings: socket_timeout={REDIS_SOCKET_TIMEOUT}s, "
        f"health_check_interval={REDIS_HEALTH_CHECK_INTERVAL}s, retry_on_timeout=True"
    )
    logger.info("")

    start_time = datetime.now()
    end_time = start_time + timedelta(seconds=duration_seconds)

    ping_count = 0
    success_count = 0
    error_count = 0
    total_latency = 0.0
    min_latency = float("inf")
    max_latency = 0.0

    try:
        while datetime.now() < end_time:
            ping_count += 1

            try:
                # Measure ping latency
                ping_start = time.time()
                result = redis_conn.ping()
                ping_end = time.time()
                latency_ms = (ping_end - ping_start) * 1000

                if result:
                    success_count += 1
                    total_latency += latency_ms
                    min_latency = min(min_latency, latency_ms)
                    max_latency = max(max_latency, latency_ms)

                    # Log every 30 pings or if latency is high
                    if ping_count % 30 == 0 or latency_ms > 100:
                        elapsed = (datetime.now() - start_time).total_seconds()
                        avg_latency = (
                            total_latency / success_count if success_count > 0 else 0
                        )
                        logger.info(
                            f"[{elapsed:.0f}s] Ping #{ping_count}: OK "
                            f"(latency: {latency_ms:.2f}ms, avg: {avg_latency:.2f}ms, "
                            f"min: {min_latency:.2f}ms, max: {max_latency:.2f}ms)"
                        )
                else:
                    error_count += 1
                    logger.warning(f"Ping #{ping_count}: FAILED - Redis returned False")

            except (RedisError, ConnectionError, TimeoutError) as e:
                error_count += 1
                elapsed = (datetime.now() - start_time).total_seconds()
                logger.error(
                    f"[{elapsed:.0f}s] Ping #{ping_count}: ERROR - {type(e).__name__}: {e}"
                )

                # Try to reconnect
                try:
                    logger.info("Attempting to reconnect...")
                    RedisConnection.close_connection()
                    time.sleep(1)
                    redis_conn = RedisConnection.get_connection()
                    logger.info("Reconnected successfully")
                except Exception as reconnect_err:
                    logger.error(f"Reconnection failed: {reconnect_err}")

            except Exception as e:
                error_count += 1
                elapsed = (datetime.now() - start_time).total_seconds()
                logger.error(
                    f"[{elapsed:.0f}s] Ping #{ping_count}: UNEXPECTED ERROR - {type(e).__name__}: {e}",
                    exc_info=True,
                )

            # Wait for next ping
            time.sleep(interval)

    except KeyboardInterrupt:
        logger.info("\nTest interrupted by user (Ctrl+C)")

    # Print summary
    elapsed = (datetime.now() - start_time).total_seconds()
    avg_latency = total_latency / success_count if success_count > 0 else 0

    logger.info("")
    logger.info("=" * 70)
    logger.info("Test Summary")
    logger.info("=" * 70)
    logger.info(f"Total duration:    {elapsed:.1f} seconds ({elapsed/60:.1f} minutes)")
    logger.info(f"Total pings:       {ping_count}")
    logger.info(
        f"Successful pings:  {success_count} ({success_count/ping_count*100:.1f}%)"
    )
    logger.info(f"Failed pings:      {error_count} ({error_count/ping_count*100:.1f}%)")
    if success_count > 0:
        logger.info(f"Latency (avg):     {avg_latency:.2f}ms")
        logger.info(f"Latency (min):     {min_latency:.2f}ms")
        logger.info(f"Latency (max):     {max_latency:.2f}ms")
    logger.info("=" * 70)

    # Cleanup
    try:
        RedisConnection.close_connection()
        logger.info("Redis connection closed")
    except Exception as e:
        logger.warning(f"Error closing connection: {e}")

    # Exit with error code if there were failures
    if error_count > 0:
        logger.warning(f"Test completed with {error_count} errors")
        sys.exit(1)
    else:
        logger.info("Test completed successfully with no errors")
        sys.exit(0)


if __name__ == "__main__":
    main()
