"""Add calendar_feed_token to users table

Revision ID: a3b4c5d6e7f8
Revises: f9a1b2c3d4e5
Create Date: 2026-03-29 19:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a3b4c5d6e7f8"
down_revision = "f9a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("calendar_feed_token", sa.String(length=255), nullable=True),
    )
    op.create_unique_constraint(
        "uq_users_calendar_feed_token", "users", ["calendar_feed_token"]
    )
    op.create_index(
        "ix_users_calendar_feed_token", "users", ["calendar_feed_token"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_users_calendar_feed_token", table_name="users")
    op.drop_constraint("uq_users_calendar_feed_token", "users", type_="unique")
    op.drop_column("users", "calendar_feed_token")
