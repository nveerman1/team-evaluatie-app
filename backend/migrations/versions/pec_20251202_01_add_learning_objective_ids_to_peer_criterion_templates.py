"""add learning_objective_ids to peer_evaluation_criterion_templates

Revision ID: pec_20251202_01
Revises: 
Create Date: 2024-12-02

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'pec_20251202_01'
down_revision = None
branch_labels = ('pec_lo',)
depends_on = None


def upgrade() -> None:
    # Add learning_objective_ids column to peer_evaluation_criterion_templates
    op.add_column(
        'peer_evaluation_criterion_templates',
        sa.Column('learning_objective_ids', sa.JSON(), nullable=True, server_default='[]')
    )
    
    # Set default value for existing rows
    op.execute(
        "UPDATE peer_evaluation_criterion_templates SET learning_objective_ids = '[]' WHERE learning_objective_ids IS NULL"
    )


def downgrade() -> None:
    op.drop_column('peer_evaluation_criterion_templates', 'learning_objective_ids')
