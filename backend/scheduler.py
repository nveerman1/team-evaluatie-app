#!/usr/bin/env python
"""
Scheduler daemon for processing scheduled jobs.

Usage:
    python scheduler.py

This process runs continuously and executes scheduled jobs at their designated times.
"""

import sys
import time
import logging
from pathlib import Path
from datetime import datetime

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.infra.db.session import SessionLocal
from app.infra.services.scheduler_service import SchedulerService

# Setup logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def main():
    """Run the scheduler daemon."""
    logger.info("Starting scheduler daemon for scheduled jobs...")
    logger.info("Checking for due jobs every 60 seconds")
    logger.info("Press Ctrl+C to stop the scheduler")

    try:
        while True:
            try:
                # Create new session for each tick
                db = SessionLocal()
                scheduler = SchedulerService(db)

                # Execute due jobs
                executed_count = scheduler.run_scheduler_tick()

                if executed_count > 0:
                    logger.info(
                        f"Executed {executed_count} scheduled jobs at {datetime.now()}"
                    )

                db.close()

            except Exception as e:
                logger.error(f"Error in scheduler tick: {e}", exc_info=True)

            # Wait 60 seconds before next check
            time.sleep(60)

    except KeyboardInterrupt:
        logger.info("Scheduler stopped by user")


if __name__ == "__main__":
    main()
