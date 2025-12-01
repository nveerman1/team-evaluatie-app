"""Add phase column to competencies

This migration adds a 'phase' column to competencies for
onderbouw/bovenbouw filtering (similar to learning_objectives).

Revision ID: comp_20251201_02
Revises: comp_20251201_01
Create Date: 2025-12-01 21:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "comp_20251201_02"
down_revision: Union[str, None] = "comp_20251201_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add phase column for onderbouw/bovenbouw filtering
    op.add_column(
        "competencies",
        sa.Column("phase", sa.String(20), nullable=True),
    )

    # Add index for phase filtering
    op.create_index(
        "ix_competency_phase",
        "competencies",
        ["school_id", "phase"],
    )


def downgrade() -> None:
    # Drop index
    op.drop_index(
        "ix_competency_phase",
        table_name="competencies",
    )

    # Drop column
    op.drop_column("competencies", "phase")
