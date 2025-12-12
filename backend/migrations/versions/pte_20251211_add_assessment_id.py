"""add assessment_id to project_team_externals

Revision ID: pte_20251211_assess
Revises: pt_20251210_team_num
Create Date: 2025-12-11 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'pte_20251211_assess'
down_revision = 'pt_20251210_team_num'
branch_labels = None
depends_on = None


def upgrade():
    """Add assessment_id column to project_team_externals table.
    
    This enables proper per-assessment scoping of external invitations.
    Previously, external invitations were shared across all assessments
    in the same project/course due to the lack of assessment_id.
    """
    # Add assessment_id column (nullable for backward compatibility)
    op.add_column('project_team_externals', 
        sa.Column('assessment_id', sa.Integer(), nullable=True)
    )
    
    # Add foreign key constraint to project_assessments
    op.create_foreign_key(
        'fk_project_team_externals_assessment',
        'project_team_externals',
        'project_assessments',
        ['assessment_id'],
        ['id'],
        ondelete='CASCADE'
    )
    
    # Add index for better query performance
    op.create_index(
        'ix_project_team_external_assessment',
        'project_team_externals',
        ['assessment_id'],
        unique=False
    )


def downgrade():
    """Remove assessment_id column from project_team_externals table."""
    # Drop index first
    op.drop_index(
        'ix_project_team_external_assessment',
        table_name='project_team_externals'
    )
    
    # Drop foreign key constraint
    op.drop_constraint(
        'fk_project_team_externals_assessment',
        'project_team_externals',
        type_='foreignkey'
    )
    
    # Drop column
    op.drop_column('project_team_externals', 'assessment_id')
