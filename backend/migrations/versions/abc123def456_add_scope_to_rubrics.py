"""add scope to rubrics

Revision ID: abc123def456
Revises: 49147e418f67
Create Date: 2025-10-29 21:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "abc123def456"
down_revision = "49147e418f67"
branch_labels = None
depends_on = None


def upgrade():
    # Add scope column to rubrics table
    op.add_column(
        "rubrics",
        sa.Column("scope", sa.String(20), nullable=False, server_default="peer"),
    )

    # Create index on school_id and scope
    op.create_index(
        "ix_rubric_school_scope",
        "rubrics",
        ["school_id", "scope"],
    )


def downgrade():
    # Drop index
    op.drop_index("ix_rubric_school_scope", table_name="rubrics")

    # Remove scope column
    op.drop_column("rubrics", "scope")
