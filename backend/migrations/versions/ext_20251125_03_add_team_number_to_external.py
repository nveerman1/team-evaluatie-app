"""Add team_number column to project_team_externals

Revision ID: ext_20251125_03
Revises: ext_20251125_02
Create Date: 2025-11-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ext_20251125_03'
down_revision: Union[str, None] = 'ext_20251125_02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add team_number column to project_team_externals
    op.add_column(
        'project_team_externals',
        sa.Column('team_number', sa.Integer(), nullable=True)
    )
    
    # Create index for team_number
    op.create_index(
        'ix_project_team_external_team_number',
        'project_team_externals',
        ['team_number']
    )
    
    # Create composite index for group_id + team_number
    op.create_index(
        'ix_project_team_external_group_team',
        'project_team_externals',
        ['group_id', 'team_number']
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_project_team_external_group_team', table_name='project_team_externals')
    op.drop_index('ix_project_team_external_team_number', table_name='project_team_externals')
    
    # Drop column
    op.drop_column('project_team_externals', 'team_number')
