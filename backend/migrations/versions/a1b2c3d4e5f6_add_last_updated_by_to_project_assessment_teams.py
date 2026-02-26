"""add_last_updated_by_to_project_assessment_teams

Revision ID: a1b2c3d4e5f6
Revises: f3a9c1d2e4b6
Create Date: 2026-02-26 21:33:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "f3a9c1d2e4b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add last_updated_by_id column to project_assessment_teams table."""
    op.add_column(
        "project_assessment_teams",
        sa.Column(
            "last_updated_by_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Remove last_updated_by_id column from project_assessment_teams table."""
    op.drop_column("project_assessment_teams", "last_updated_by_id")
