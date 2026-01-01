"""Fix created_at column in summary_generation_jobs table

Revision ID: queue_20260101_05
Revises: queue_20260101_04
Create Date: 2026-01-01 19:40:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "queue_20260101_05"
down_revision: Union[str, None] = "queue_20260101_04"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Fix created_at column in summary_generation_jobs table to match Base class definition.
    
    The column was created without server_default, but should have
    server_default=NOW() and timezone support to match the Base class definition.
    """
    # Alter created_at column to add server_default and timezone support
    op.alter_column(
        "summary_generation_jobs",
        "created_at",
        existing_type=sa.DateTime(),
        type_=sa.DateTime(timezone=True),
        server_default=sa.text("NOW()"),
        nullable=False,
    )


def downgrade() -> None:
    """Revert created_at column to original state without server_default."""
    op.alter_column(
        "summary_generation_jobs",
        "created_at",
        existing_type=sa.DateTime(timezone=True),
        type_=sa.DateTime(),
        server_default=None,
        nullable=False,
    )
