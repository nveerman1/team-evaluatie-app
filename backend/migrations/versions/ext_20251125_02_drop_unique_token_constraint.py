"""drop_unique_token_constraint

Revision ID: ext_20251125_02
Revises: ext_20251124_01
Create Date: 2025-11-25 16:20:00.000000

This migration changes the invitation_token index from unique to non-unique.
This is needed to support the "ALL_TEAMS" mode where multiple teams share the same token.
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "ext_20251125_02"
down_revision = "ext_20251124_01"
branch_labels = None
depends_on = None


def upgrade():
    # Drop the unique index on invitation_token
    op.drop_index("ix_project_team_external_token", table_name="project_team_externals")
    
    # Create a non-unique index for lookup performance
    op.create_index(
        "ix_project_team_external_token",
        "project_team_externals",
        ["invitation_token"],
        unique=False,
    )


def downgrade():
    # Drop the non-unique index
    op.drop_index("ix_project_team_external_token", table_name="project_team_externals")
    
    # Recreate the unique index
    op.create_index(
        "ix_project_team_external_token",
        "project_team_externals",
        ["invitation_token"],
        unique=True,
    )
