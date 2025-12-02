"""add learning_objective_ids to peer_evaluation_criterion_templates

Revision ID: pec_20251202_01
Revises: pac_20251129_01
Create Date: 2024-12-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'pec_20251202_01'
down_revision: Union[str, None] = 'pac_20251129_01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add learning_objective_ids column to peer_evaluation_criterion_templates
    op.add_column(
        'peer_evaluation_criterion_templates',
        sa.Column('learning_objective_ids', sa.JSON(), nullable=True, server_default=sa.text("'[]'"))
    )


def downgrade() -> None:
    op.drop_column('peer_evaluation_criterion_templates', 'learning_objective_ids')
