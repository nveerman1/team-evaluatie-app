"""backfill order values for existing rubric criteria

Revision ID: rc_20251212_backfill
Revises: rc_20251212_order
Create Date: 2025-12-12 20:08:00.000000

"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "rc_20251212_backfill"
down_revision = "rc_20251212_order"
branch_labels = None
depends_on = None


def upgrade():
    # Backfill order values for existing criteria based on their current ID order
    # This ensures existing rubrics maintain their current display order
    op.execute("""
        WITH ordered_criteria AS (
            SELECT 
                id,
                rubric_id,
                ROW_NUMBER() OVER (PARTITION BY rubric_id ORDER BY id) as row_num
            FROM rubric_criteria
            WHERE "order" IS NULL
        )
        UPDATE rubric_criteria rc
        SET "order" = oc.row_num
        FROM ordered_criteria oc
        WHERE rc.id = oc.id
    """)


def downgrade():
    # No need to revert the backfill - the order values are fine to keep
    pass
