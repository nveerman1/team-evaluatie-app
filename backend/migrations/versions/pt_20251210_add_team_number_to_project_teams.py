"""add team_number to project_teams

Revision ID: pt_20251210_team_num
Revises: pt_20251208_03
Create Date: 2025-12-10 13:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "pt_20251210_team_num"
down_revision = "pt_20251208_03"
branch_labels = None
depends_on = None


def upgrade():
    # Add team_number column to project_teams table
    op.add_column(
        "project_teams", sa.Column("team_number", sa.Integer(), nullable=True)
    )

    # Add index for better query performance
    op.create_index(
        "ix_project_teams_project_team_number",
        "project_teams",
        ["project_id", "team_number"],
        unique=False,
    )

    # Backfill team_number from linked groups where available
    # Extract team number from display_name_at_time for others
    op.execute(
        """
        UPDATE project_teams pt
        SET team_number = g.team_number
        FROM groups g
        WHERE pt.team_id = g.id
        AND g.team_number IS NOT NULL
    """
    )

    # For teams without a linked group, try to extract number from display_name_at_time
    # Matches patterns like "Team 1", "Team 2", etc.
    op.execute(
        """
        UPDATE project_teams
        SET team_number = CAST(
            substring(display_name_at_time from '\\d+')
            AS INTEGER
        )
        WHERE team_number IS NULL
        AND display_name_at_time ~ '\\d+'
    """
    )


def downgrade():
    # Remove index
    op.drop_index("ix_project_teams_project_team_number", table_name="project_teams")

    # Remove column
    op.drop_column("project_teams", "team_number")
