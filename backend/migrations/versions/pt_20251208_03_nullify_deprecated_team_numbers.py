"""Set student.team_number to NULL where replaced by project teams

This migration marks the transition away from the global team_number field
on users to project-specific team rosters in project_team_members.

For any students who are members of project teams, we clear their legacy
team_number field to indicate the new system is in use.

Revision ID: pt_20251208_03
Revises: pt_20251208_02
Create Date: 2025-12-08

"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = "pt_20251208_03"
down_revision: Union[str, None] = "pt_20251208_02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Set team_number to NULL for students who are in project teams
    
    This signals the transition to the new project-specific roster system.
    The team_number column remains in the database for:
    1. Backward compatibility during transitional releases
    2. Manual/ad-hoc team assignments not yet migrated
    3. Legacy data reference
    """
    conn = op.get_bind()
    
    # Clear team_number for users who are now in project teams
    nullify_sql = text("""
        UPDATE users
        SET team_number = NULL
        WHERE id IN (
            SELECT DISTINCT user_id 
            FROM project_team_members
        )
        AND team_number IS NOT NULL
        RETURNING id;
    """)
    
    result = conn.execute(nullify_sql)
    users_updated = result.rowcount or 0
    print(f"Cleared team_number for {users_updated} users now in project teams")


def downgrade() -> None:
    """
    Restore team_number from project team memberships
    
    WARNING: This attempts to restore team_number but may lose information
    if a student was in multiple teams across projects. Only the most recent
    team number will be restored.
    """
    conn = op.get_bind()
    
    # Try to restore team_number from project team display names
    restore_sql = text("""
        WITH latest_teams AS (
            SELECT DISTINCT ON (ptm.user_id)
                ptm.user_id,
                CAST(substring(pt.display_name_at_time from 'Team ([0-9]+)') AS INTEGER) as team_number
            FROM project_team_members ptm
            JOIN project_teams pt ON pt.id = ptm.project_team_id
            WHERE pt.display_name_at_time LIKE '%Team %'
            ORDER BY ptm.user_id, ptm.created_at DESC
        )
        UPDATE users u
        SET team_number = lt.team_number
        FROM latest_teams lt
        WHERE u.id = lt.user_id
          AND lt.team_number IS NOT NULL
        RETURNING u.id;
    """)
    
    result = conn.execute(restore_sql)
    users_restored = result.rowcount or 0
    print(f"Restored team_number for {users_restored} users (best effort)")
