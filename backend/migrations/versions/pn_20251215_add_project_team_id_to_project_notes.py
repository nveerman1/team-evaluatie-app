"""Add project_team_id to project_notes

Revision ID: pn_20251215_01
Revises: 553d97716b1d
Create Date: 2025-12-15 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'pn_20251215_01'
down_revision: Union[str, None] = '553d97716b1d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add project_team_id column to project_notes table
    op.add_column('project_notes', sa.Column('project_team_id', sa.Integer(), nullable=True))
    
    # Add foreign key constraint
    op.create_foreign_key(
        'fk_project_notes_project_team_id',
        'project_notes',
        'project_teams',
        ['project_team_id'],
        ['id'],
        ondelete='CASCADE'
    )
    
    # Add index for project_team_id
    op.create_index('ix_project_note_project_team', 'project_notes', ['project_team_id'], unique=False)


def downgrade() -> None:
    # Remove index
    op.drop_index('ix_project_note_project_team', table_name='project_notes')
    
    # Remove foreign key
    op.drop_constraint('fk_project_notes_project_team_id', 'project_notes', type_='foreignkey')
    
    # Remove column
    op.drop_column('project_notes', 'project_team_id')
