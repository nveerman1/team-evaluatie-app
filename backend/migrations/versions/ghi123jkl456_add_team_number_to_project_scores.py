"""add_team_number_to_project_scores

Revision ID: ghi123jkl456
Revises: def789ghi012
Create Date: 2025-10-31 22:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ghi123jkl456'
down_revision = 'def789ghi012'
branch_labels = None
depends_on = None


def upgrade():
    # Add team_number column to project_assessment_scores
    op.add_column('project_assessment_scores', 
                  sa.Column('team_number', sa.Integer(), nullable=True))
    
    # Add index for better query performance
    op.create_index('ix_project_score_team', 'project_assessment_scores', 
                   ['assessment_id', 'team_number'])
    
    # Drop old unique constraint
    op.drop_constraint('uq_project_score_per_criterion', 'project_assessment_scores', type_='unique')
    
    # Create new unique constraint including team_number
    op.create_unique_constraint('uq_project_score_per_criterion_team', 
                               'project_assessment_scores', 
                               ['assessment_id', 'criterion_id', 'team_number'])


def downgrade():
    # Drop new constraint
    op.drop_constraint('uq_project_score_per_criterion_team', 'project_assessment_scores', type_='unique')
    
    # Recreate old constraint
    op.create_unique_constraint('uq_project_score_per_criterion', 
                               'project_assessment_scores', 
                               ['assessment_id', 'criterion_id'])
    
    # Drop index
    op.drop_index('ix_project_score_team', 'project_assessment_scores')
    
    # Drop team_number column
    op.drop_column('project_assessment_scores', 'team_number')
