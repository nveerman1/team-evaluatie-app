#!/usr/bin/env python3
"""
Clean up stuck jobs in the summary_generation_jobs table.

This script marks jobs that are stuck in "queued" state as "failed" so that
new jobs can be created for the same student/evaluation pairs.

Usage:
    cd backend
    python scripts/cleanup_stuck_jobs.py
    
Options:
    --dry-run    Show what would be done without making changes
    --older-than MINUTES    Only clean jobs older than N minutes (default: 10)
"""
import sys
from pathlib import Path
from datetime import datetime, timedelta
import argparse

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.infra.db.session import SessionLocal  # noqa: E402
from app.infra.db.models import SummaryGenerationJob  # noqa: E402


def cleanup_stuck_jobs(dry_run: bool = False, older_than_minutes: int = 10):
    """
    Clean up jobs stuck in queued state.
    
    Args:
        dry_run: If True, show what would be done without making changes
        older_than_minutes: Only clean jobs older than this many minutes
    """
    db = SessionLocal()
    
    try:
        # Find stuck jobs
        cutoff_time = datetime.utcnow() - timedelta(minutes=older_than_minutes)
        
        stuck_jobs = db.query(SummaryGenerationJob).filter(
            SummaryGenerationJob.status == "queued",
            SummaryGenerationJob.created_at < cutoff_time
        ).all()
        
        if not stuck_jobs:
            print(f"✓ No stuck jobs found (older than {older_than_minutes} minutes)")
            return 0
        
        print(f"Found {len(stuck_jobs)} stuck job(s) older than {older_than_minutes} minutes:")
        print()
        
        for job in stuck_jobs:
            age_minutes = (datetime.utcnow() - job.created_at.replace(tzinfo=None)).total_seconds() / 60
            print(f"  Job: {job.job_id}")
            print(f"    Student: {job.student_id}, Evaluation: {job.evaluation_id}")
            print(f"    Created: {job.created_at} ({age_minutes:.1f} minutes ago)")
            print(f"    Priority: {job.priority}, Queue: {job.queue_name}")
            
            if not dry_run:
                job.status = "failed"
                job.error_message = "Job stuck in queued state - cleaned up by maintenance script"
                job.completed_at = datetime.utcnow()
                print(f"    → Marked as FAILED")
            else:
                print(f"    → Would mark as FAILED (dry-run)")
            print()
        
        if not dry_run:
            db.commit()
            print(f"✓ Cleaned up {len(stuck_jobs)} job(s)")
        else:
            print(f"✓ Dry-run complete. Run without --dry-run to apply changes.")
        
        return len(stuck_jobs)
        
    except Exception as e:
        print(f"✗ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        description="Clean up stuck jobs in summary_generation_jobs table"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes"
    )
    parser.add_argument(
        "--older-than",
        type=int,
        default=10,
        help="Only clean jobs older than N minutes (default: 10)"
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("Clean Up Stuck Jobs")
    print("=" * 60)
    print()
    
    if args.dry_run:
        print("⚠️  DRY-RUN MODE - No changes will be made")
        print()
    
    count = cleanup_stuck_jobs(
        dry_run=args.dry_run,
        older_than_minutes=args.older_than
    )
    
    return 0 if count >= 0 else 1


if __name__ == "__main__":
    sys.exit(main())
