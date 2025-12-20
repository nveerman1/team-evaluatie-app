"""add updated_at to notifications

Revision ID: notif_20251220_01
Revises: sub_20251220_01
Create Date: 2025-12-20 19:40:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "notif_20251220_01"
down_revision = "sub_20251220_01"
branch_labels = None
depends_on = None


def upgrade():
    # Add updated_at column to notifications table
    op.add_column(
        "notifications",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )


def downgrade():
    # Remove updated_at column from notifications table
    op.drop_column("notifications", "updated_at")
