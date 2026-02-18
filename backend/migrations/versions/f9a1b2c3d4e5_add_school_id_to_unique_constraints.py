"""Add school_id to unique constraints for multi-tenant isolation

Revision ID: f9a1b2c3d4e5
Revises: e8a9b2c3d4f5
Create Date: 2026-02-18 16:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f9a1b2c3d4e5'
down_revision = 'e8a9b2c3d4f5'
branch_labels = None
depends_on = None


def upgrade():
    """
    Add school_id to unique constraints for better multi-tenant isolation.
    
    This prevents potential data leakage across schools by ensuring
    that unique constraints are scoped per school.
    """
    # Drop old unique constraint on project_plan_teams
    op.drop_constraint('uq_project_plan_team', 'project_plan_teams', type_='unique')
    
    # Add new unique constraint including school_id
    op.create_unique_constraint(
        'uq_project_plan_team',
        'project_plan_teams',
        ['school_id', 'project_plan_id', 'project_team_id']
    )
    
    # Drop old unique constraint on project_plan_sections
    op.drop_constraint('uq_project_plan_team_section_key', 'project_plan_sections', type_='unique')
    
    # Add new unique constraint including school_id
    op.create_unique_constraint(
        'uq_project_plan_team_section_key',
        'project_plan_sections',
        ['school_id', 'project_plan_team_id', 'key']
    )


def downgrade():
    """
    Revert unique constraints to old format (not recommended for production).
    """
    # Revert project_plan_teams
    op.drop_constraint('uq_project_plan_team', 'project_plan_teams', type_='unique')
    op.create_unique_constraint(
        'uq_project_plan_team',
        'project_plan_teams',
        ['project_plan_id', 'project_team_id']
    )
    
    # Revert project_plan_sections
    op.drop_constraint('uq_project_plan_team_section_key', 'project_plan_sections', type_='unique')
    op.create_unique_constraint(
        'uq_project_plan_team_section_key',
        'project_plan_sections',
        ['project_plan_team_id', 'key']
    )
