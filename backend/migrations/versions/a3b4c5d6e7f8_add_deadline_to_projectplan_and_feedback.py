"""add_deadline_to_projectplan_and_feedback

Revision ID: a3b4c5d6e7f8
Revises: f3a9c1d2e4b6
Create Date: 2026-04-04 08:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a3b4c5d6e7f8"
down_revision = "f3a9c1d2e4b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add a nullable deadline column to:
    1. project_plans  — deadline for students to submit their project plan
    2. project_feedback_rounds — deadline for students to fill in feedback
    """
    op.add_column(
        "project_plans",
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "project_feedback_rounds",
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    """Remove deadline columns."""
    op.drop_column("project_feedback_rounds", "deadline")
    op.drop_column("project_plans", "deadline")
