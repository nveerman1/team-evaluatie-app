"""add_status_to_projectplan

Revision ID: ca4111bca819
Revises: d481b0539df8
Create Date: 2026-02-04 16:30:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "ca4111bca819"
down_revision = "d481b0539df8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add status field to project_plans table to control visibility.
    Similar to ProjectAssessment pattern (draft/open/published/closed).
    """
    # Add status column with default 'draft'
    op.add_column(
        "project_plans",
        sa.Column(
            "status", sa.String(length=30), nullable=False, server_default="draft"
        ),
    )

    # Add index on status for better query performance
    op.create_index("ix_project_plan_status", "project_plans", ["status"], unique=False)


def downgrade() -> None:
    """Remove status field from project_plans table."""
    op.drop_index("ix_project_plan_status", table_name="project_plans")
    op.drop_column("project_plans", "status")
