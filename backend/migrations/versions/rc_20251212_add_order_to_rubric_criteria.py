"""add order to rubric_criteria

Revision ID: rc_20251212_order
Revises: pt_20251210_team_num
Create Date: 2025-12-12 19:45:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'rc_20251212_order'
down_revision = 'pt_20251210_team_num'
branch_labels = None
depends_on = None


def upgrade():
    # Add order column to rubric_criteria table
    op.add_column('rubric_criteria', 
        sa.Column('order', sa.Integer(), nullable=True)
    )
    
    # Add index for better query performance when ordering by this field
    op.create_index(
        'ix_rubric_criteria_order',
        'rubric_criteria',
        ['order'],
        unique=False
    )


def downgrade():
    # Remove index
    op.drop_index('ix_rubric_criteria_order', table_name='rubric_criteria')
    
    # Remove column
    op.drop_column('rubric_criteria', 'order')
