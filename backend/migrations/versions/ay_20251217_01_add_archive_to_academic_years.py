"""add archive fields to academic years

Revision ID: ay_20251217_01
Revises: subp_20251203_01
Create Date: 2025-12-17

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "ay_20251217_01"
down_revision: Union[str, None] = "subp_20251203_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_archived and archived_at columns to academic_years table
    op.add_column(
        "academic_years",
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "academic_years",
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    # Remove archive columns
    op.drop_column("academic_years", "archived_at")
    op.drop_column("academic_years", "is_archived")
