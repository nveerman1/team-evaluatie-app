"""add_general_comment_to_project_assessment_teams

Revision ID: b1c2d3e4f5a6
Revises: a1b2c3d4e5f6
Create Date: 2026-03-23 11:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "b1c2d3e4f5a6"
down_revision = "a2b3c4d5e6f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add general_comment column to project_assessment_teams table."""
    op.add_column(
        "project_assessment_teams",
        sa.Column(
            "general_comment",
            sa.Text(),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Remove general_comment column from project_assessment_teams table."""
    op.drop_column("project_assessment_teams", "general_comment")
