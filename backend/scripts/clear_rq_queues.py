#!/usr/bin/env python
"""
Clear RQ queues (development/maintenance utility).

This script clears all jobs from the RQ queues and optionally resets
the Redis database. Use this after changing RQ serializer settings or
to recover from corrupted jobs.

WARNING: This will delete all queued, processing, and completed jobs.
Only use this in development or after taking appropriate backups.

Usage:
    python scripts/clear_rq_queues.py [--flush-db]
    
Options:
    --flush-db    Also flush the entire Redis database (use with caution)
"""
import sys
import argparse
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from rq import Queue
from app.infra.queue.connection import RedisConnection

QUEUE_NAMES = [
    'ai-summaries-high',
    'ai-summaries',
    'ai-summaries-low',
]


def clear_queues():
    """Clear all RQ queues."""
    redis_conn = RedisConnection.get_connection()
    
    for queue_name in QUEUE_NAMES:
        queue = Queue(queue_name, connection=redis_conn)
        
        # Get counts before clearing
        count = len(queue)
        
        if count > 0:
            print(f"Clearing queue '{queue_name}' ({count} jobs)...")
            queue.empty()
            print(f"  ✓ Queue '{queue_name}' cleared")
        else:
            print(f"Queue '{queue_name}' is already empty")
    
    # Also clear failed queue
    failed_queue = Queue('failed', connection=redis_conn)
    failed_count = len(failed_queue)
    if failed_count > 0:
        print(f"Clearing failed queue ({failed_count} jobs)...")
        failed_queue.empty()
        print(f"  ✓ Failed queue cleared")
    
    print("\nAll queues cleared successfully!")


def flush_redis_db():
    """Flush the entire Redis database."""
    print("\n⚠️  WARNING: This will delete ALL data in the Redis database!")
    confirm = input("Type 'YES' to confirm: ")
    
    if confirm != 'YES':
        print("Aborted.")
        return
    
    redis_conn = RedisConnection.get_connection()
    redis_conn.flushdb()
    print("✓ Redis database flushed")


def main():
    parser = argparse.ArgumentParser(
        description='Clear RQ queues for development/maintenance.'
    )
    parser.add_argument(
        '--flush-db',
        action='store_true',
        help='Also flush the entire Redis database (requires confirmation)'
    )
    
    args = parser.parse_args()
    
    print("RQ Queue Maintenance Tool")
    print("=" * 50)
    
    try:
        clear_queues()
        
        if args.flush_db:
            flush_redis_db()
        
        print("\n✓ Done!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        sys.exit(1)
    
    finally:
        RedisConnection.close_connection()


if __name__ == '__main__':
    main()
