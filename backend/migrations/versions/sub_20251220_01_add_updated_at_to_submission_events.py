"""add updated_at to submission_events

Revision ID: sub_20251220_01
Revises: notif_20251219_01
Create Date: 2025-12-20 10:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "sub_20251220_01"
down_revision = "notif_20251219_01"
branch_labels = None
depends_on = None


def upgrade():
    # Add updated_at column to submission_events table
    op.add_column(
        "submission_events",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )


def downgrade():
    # Remove updated_at column from submission_events table
    op.drop_column("submission_events", "updated_at")
