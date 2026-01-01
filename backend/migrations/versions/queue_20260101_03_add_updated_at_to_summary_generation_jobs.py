"""Add updated_at column to summary_generation_jobs

Revision ID: queue_20260101_03
Revises: queue_20260101_02
Create Date: 2026-01-01 19:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "queue_20260101_03"
down_revision: Union[str, None] = "queue_20260101_02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add updated_at column to summary_generation_jobs table.
    
    This column tracks when job records are modified and is consistent
    with the Base class definition which includes updated_at with
    server_default=func.now() and onupdate=func.now().
    """
    # Add updated_at column with timezone support, matching Base class definition
    op.add_column(
        "summary_generation_jobs",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )
    
    # Backfill existing rows: set updated_at to created_at for existing records
    # This ensures historical consistency
    op.execute(
        "UPDATE summary_generation_jobs SET updated_at = created_at WHERE updated_at IS NULL"
    )


def downgrade() -> None:
    """Remove updated_at column from summary_generation_jobs table."""
    op.drop_column("summary_generation_jobs", "updated_at")
