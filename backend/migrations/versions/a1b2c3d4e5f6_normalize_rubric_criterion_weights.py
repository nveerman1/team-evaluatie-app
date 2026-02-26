"""Normalize rubric_criterion weights to sum to 1.0 per rubric

Each rubric's criteria weights are divided by the rubric's total weight so that
they sum to 1.0. Rubrics with a total weight of 0 receive equal weights (1/N).
This is needed because older seed data stored weight=1.0 per criterion regardless
of how many criteria a rubric contained.

Revision ID: a1b2c3d4e5f6
Revises: f9a1b2c3d4e5
Create Date: 2026-02-26 14:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "f9a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade():
    """Normalize rubric_criterion weights so they sum to 1.0 per rubric."""
    conn = op.get_bind()

    # Fetch all rubric IDs that have criteria
    rubric_ids = conn.execute(
        text("SELECT DISTINCT rubric_id FROM rubric_criterion")
    ).fetchall()

    for (rubric_id,) in rubric_ids:
        criteria = conn.execute(
            text("SELECT id, weight FROM rubric_criterion WHERE rubric_id = :rid"),
            {"rid": rubric_id},
        ).fetchall()

        if not criteria:
            continue

        total = sum(row[1] for row in criteria)
        count = len(criteria)

        if total == 0:
            # Assign equal weights
            new_weight = 1.0 / count
            conn.execute(
                text("UPDATE rubric_criterion SET weight = :w WHERE rubric_id = :rid"),
                {"w": new_weight, "rid": rubric_id},
            )
        elif abs(total - 1.0) > 0.01:
            # Normalize proportionally
            for crit_id, weight in criteria:
                conn.execute(
                    text("UPDATE rubric_criterion SET weight = :w WHERE id = :id"),
                    {"w": weight / total, "id": crit_id},
                )
        # else: already sums to ~1.0, no change needed


def downgrade():
    """Cannot fully restore original weights; reset all to 1.0 per criterion."""
    conn = op.get_bind()
    conn.execute(text("UPDATE rubric_criterion SET weight = 1.0"))
