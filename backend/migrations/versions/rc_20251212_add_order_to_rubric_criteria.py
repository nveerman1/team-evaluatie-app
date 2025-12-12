"""add order to rubric_criteria

Revision ID: rc_20251212_order
Revises: pte_20251211_assess
Create Date: 2025-12-12 19:45:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "rc_20251212_order"
down_revision = "pte_20251211_assess"
branch_labels = None
depends_on = None


def upgrade():
    # Add order column to rubric_criteria table
    op.add_column("rubric_criteria", sa.Column("order", sa.Integer(), nullable=True))

    # Add index for better query performance when ordering by this field
    op.create_index(
        "ix_rubric_criteria_order", "rubric_criteria", ["order"], unique=False
    )
    
    # Note: Backfill is done in a separate migration (rc_20251212_02_backfill_order)
    # to handle cases where this migration was already run before the backfill was added


def downgrade():
    # Remove index
    op.drop_index("ix_rubric_criteria_order", table_name="rubric_criteria")

    # Remove column
    op.drop_column("rubric_criteria", "order")
