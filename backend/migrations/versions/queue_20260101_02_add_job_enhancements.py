"""Add job enhancements: progress, priority, retry, cancellation, webhooks, scheduling

Revision ID: queue_20260101_02
Revises: queue_20260101_01
Create Date: 2026-01-01 13:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "queue_20260101_02"
down_revision: Union[str, None] = "queue_20260101_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add progress tracking
    op.add_column(
        "summary_generation_jobs",
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
    )

    # Add priority support
    op.add_column(
        "summary_generation_jobs",
        sa.Column(
            "priority", sa.String(length=20), nullable=False, server_default="normal"
        ),
    )

    # Add retry support
    op.add_column(
        "summary_generation_jobs",
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "summary_generation_jobs",
        sa.Column("max_retries", sa.Integer(), nullable=False, server_default="3"),
    )
    op.add_column(
        "summary_generation_jobs",
        sa.Column("next_retry_at", sa.DateTime(), nullable=True),
    )

    # Add cancellation support
    op.add_column(
        "summary_generation_jobs",
        sa.Column("cancelled_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "summary_generation_jobs",
        sa.Column("cancelled_by", sa.Integer(), nullable=True),
    )

    # Add webhook support
    op.add_column(
        "summary_generation_jobs",
        sa.Column("webhook_url", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "summary_generation_jobs",
        sa.Column(
            "webhook_delivered", sa.Boolean(), nullable=False, server_default="false"
        ),
    )
    op.add_column(
        "summary_generation_jobs",
        sa.Column("webhook_attempts", sa.Integer(), nullable=False, server_default="0"),
    )

    # Add queue name for multi-queue support
    op.add_column(
        "summary_generation_jobs",
        sa.Column(
            "queue_name",
            sa.String(length=100),
            nullable=False,
            server_default="ai-summaries",
        ),
    )

    # Add task type for generic queue support
    op.add_column(
        "summary_generation_jobs",
        sa.Column(
            "task_type",
            sa.String(length=100),
            nullable=False,
            server_default="generate_summary",
        ),
    )

    # Create indexes for new fields
    op.create_index(
        "ix_summary_job_priority", "summary_generation_jobs", ["priority", "created_at"]
    )
    op.create_index("ix_summary_job_queue", "summary_generation_jobs", ["queue_name"])
    op.create_index(
        "ix_summary_job_next_retry", "summary_generation_jobs", ["next_retry_at"]
    )

    # Create scheduled_jobs table for cron-like scheduling
    op.create_table(
        "scheduled_jobs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("task_type", sa.String(length=100), nullable=False),
        sa.Column("queue_name", sa.String(length=100), nullable=False),
        sa.Column("cron_expression", sa.String(length=100), nullable=False),
        sa.Column(
            "task_params", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_run_at", sa.DateTime(), nullable=True),
        sa.Column("next_run_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_scheduled_jobs_id", "scheduled_jobs", ["id"])
    op.create_index("ix_scheduled_jobs_school_id", "scheduled_jobs", ["school_id"])
    op.create_index("ix_scheduled_jobs_enabled", "scheduled_jobs", ["enabled"])
    op.create_index("ix_scheduled_jobs_next_run", "scheduled_jobs", ["next_run_at"])


def downgrade() -> None:
    # Drop scheduled_jobs table
    op.drop_index("ix_scheduled_jobs_next_run", table_name="scheduled_jobs")
    op.drop_index("ix_scheduled_jobs_enabled", table_name="scheduled_jobs")
    op.drop_index("ix_scheduled_jobs_school_id", table_name="scheduled_jobs")
    op.drop_index("ix_scheduled_jobs_id", table_name="scheduled_jobs")
    op.drop_table("scheduled_jobs")

    # Drop indexes
    op.drop_index("ix_summary_job_next_retry", table_name="summary_generation_jobs")
    op.drop_index("ix_summary_job_queue", table_name="summary_generation_jobs")
    op.drop_index("ix_summary_job_priority", table_name="summary_generation_jobs")

    # Drop columns
    op.drop_column("summary_generation_jobs", "task_type")
    op.drop_column("summary_generation_jobs", "queue_name")
    op.drop_column("summary_generation_jobs", "webhook_attempts")
    op.drop_column("summary_generation_jobs", "webhook_delivered")
    op.drop_column("summary_generation_jobs", "webhook_url")
    op.drop_column("summary_generation_jobs", "cancelled_by")
    op.drop_column("summary_generation_jobs", "cancelled_at")
    op.drop_column("summary_generation_jobs", "next_retry_at")
    op.drop_column("summary_generation_jobs", "max_retries")
    op.drop_column("summary_generation_jobs", "retry_count")
    op.drop_column("summary_generation_jobs", "priority")
    op.drop_column("summary_generation_jobs", "progress")
