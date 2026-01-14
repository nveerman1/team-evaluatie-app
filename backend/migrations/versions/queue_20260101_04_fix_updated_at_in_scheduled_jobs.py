"""Fix updated_at column in scheduled_jobs table

Revision ID: queue_20260101_04
Revises: queue_20260101_03
Create Date: 2026-01-01 19:35:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "queue_20260101_04"
down_revision: Union[str, None] = "queue_20260101_03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Fix updated_at column in scheduled_jobs table to match Base class definition.

    The column was created as nullable without server_default, but should have
    server_default=NOW() and onupdate=NOW() to match the Base class definition.
    """
    # First, backfill existing NULL values with created_at
    op.execute(
        "UPDATE scheduled_jobs SET updated_at = created_at WHERE updated_at IS NULL"
    )

    # Alter column to add server_default and make it NOT NULL
    op.alter_column(
        "scheduled_jobs",
        "updated_at",
        existing_type=sa.DateTime(),
        type_=sa.DateTime(timezone=True),
        server_default=sa.text("NOW()"),
        nullable=False,
    )


def downgrade() -> None:
    """Revert updated_at column to original nullable state without server_default."""
    op.alter_column(
        "scheduled_jobs",
        "updated_at",
        existing_type=sa.DateTime(timezone=True),
        type_=sa.DateTime(),
        server_default=None,
        nullable=True,
    )
