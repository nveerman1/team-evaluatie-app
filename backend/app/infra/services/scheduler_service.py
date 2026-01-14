"""Job scheduling service with cron-like support."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional
from croniter import croniter
from sqlalchemy.orm import Session

from app.infra.db.models import ScheduledJob
from app.infra.queue.connection import get_queue

logger = logging.getLogger(__name__)


class SchedulerService:
    """Service for managing scheduled jobs."""

    def __init__(self, db: Session):
        """
        Initialize scheduler service.

        Args:
            db: Database session
        """
        self.db = db

    def create_scheduled_job(
        self,
        school_id: int,
        name: str,
        task_type: str,
        queue_name: str,
        cron_expression: str,
        task_params: Optional[dict] = None,
        enabled: bool = True,
        created_by: Optional[int] = None,
    ) -> ScheduledJob:
        """
        Create a new scheduled job.

        Args:
            school_id: School ID
            name: Job name
            task_type: Type of task to execute
            queue_name: Queue to enqueue job to
            cron_expression: Cron expression (e.g., "0 2 * * *" for daily at 2am)
            task_params: Parameters to pass to task
            enabled: Whether job is enabled
            created_by: User ID who created the job

        Returns:
            Created ScheduledJob instance

        Raises:
            ValueError: If cron expression is invalid
        """
        # Validate cron expression
        try:
            cron = croniter(cron_expression)
            next_run = cron.get_next(datetime)
        except Exception as e:
            raise ValueError(f"Invalid cron expression: {e}")

        scheduled_job = ScheduledJob(
            school_id=school_id,
            name=name,
            task_type=task_type,
            queue_name=queue_name,
            cron_expression=cron_expression,
            task_params=task_params,
            enabled=enabled,
            next_run_at=next_run,
            created_by=created_by,
        )

        self.db.add(scheduled_job)
        self.db.commit()
        self.db.refresh(scheduled_job)

        logger.info(f"Created scheduled job '{name}' (ID: {scheduled_job.id})")
        return scheduled_job

    def update_scheduled_job(
        self, job_id: int, school_id: int, **updates
    ) -> Optional[ScheduledJob]:
        """
        Update a scheduled job.

        Args:
            job_id: Job ID
            school_id: School ID (for multi-tenant isolation)
            **updates: Fields to update

        Returns:
            Updated ScheduledJob or None if not found
        """
        job = (
            self.db.query(ScheduledJob)
            .filter(
                ScheduledJob.id == job_id,
                ScheduledJob.school_id == school_id,
            )
            .first()
        )

        if not job:
            return None

        # If cron expression is updated, recalculate next run
        if "cron_expression" in updates:
            try:
                cron = croniter(updates["cron_expression"])
                updates["next_run_at"] = cron.get_next(datetime)
            except Exception as e:
                raise ValueError(f"Invalid cron expression: {e}")

        for key, value in updates.items():
            if hasattr(job, key):
                setattr(job, key, value)

        job.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(job)

        logger.info(f"Updated scheduled job ID {job_id}")
        return job

    def delete_scheduled_job(
        self,
        job_id: int,
        school_id: int,
    ) -> bool:
        """
        Delete a scheduled job.

        Args:
            job_id: Job ID
            school_id: School ID (for multi-tenant isolation)

        Returns:
            True if deleted, False if not found
        """
        job = (
            self.db.query(ScheduledJob)
            .filter(
                ScheduledJob.id == job_id,
                ScheduledJob.school_id == school_id,
            )
            .first()
        )

        if not job:
            return False

        self.db.delete(job)
        self.db.commit()

        logger.info(f"Deleted scheduled job ID {job_id}")
        return True

    def get_due_jobs(self) -> list[ScheduledJob]:
        """
        Get all enabled jobs that are due to run.

        Returns:
            List of ScheduledJob instances
        """
        now = datetime.utcnow()

        jobs = (
            self.db.query(ScheduledJob)
            .filter(
                ScheduledJob.enabled == True,
                ScheduledJob.next_run_at <= now,
            )
            .all()
        )

        return jobs

    def execute_scheduled_job(self, job: ScheduledJob) -> bool:
        """
        Execute a scheduled job by enqueueing it.

        Uses a task registry pattern for extensibility.

        Args:
            job: ScheduledJob to execute

        Returns:
            True if successfully enqueued, False otherwise
        """
        # Task registry: maps task_type to callable function
        task_registry = {
            "generate_summary": self._get_generate_summary_task,
            # Add more task types here as needed
        }

        try:
            # Get task function from registry
            task_getter = task_registry.get(job.task_type)
            if not task_getter:
                logger.error(f"Unknown task type: {job.task_type}")
                return False

            task_func = task_getter()
            queue = get_queue(job.queue_name)

            # Enqueue the task
            params = job.task_params or {}
            queue.enqueue(task_func, **params)

            # Update last_run_at and calculate next_run_at
            job.last_run_at = datetime.utcnow()

            cron = croniter(job.cron_expression, job.last_run_at)
            job.next_run_at = cron.get_next(datetime)

            self.db.commit()

            logger.info(
                f"Executed scheduled job '{job.name}' (ID: {job.id}), next run: {job.next_run_at}"
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to execute scheduled job ID {job.id}: {e}", exc_info=True
            )
            return False

    def _get_generate_summary_task(self):
        """Get the generate_ai_summary_task function."""
        from app.infra.queue.tasks import generate_ai_summary_task

        return generate_ai_summary_task

    def run_scheduler_tick(self) -> int:
        """
        Run one scheduler tick - execute all due jobs.

        Should be called periodically (e.g., every minute).

        Returns:
            Number of jobs executed
        """
        due_jobs = self.get_due_jobs()
        executed_count = 0

        for job in due_jobs:
            if self.execute_scheduled_job(job):
                executed_count += 1

        if executed_count > 0:
            logger.info(f"Scheduler tick: executed {executed_count} jobs")

        return executed_count
