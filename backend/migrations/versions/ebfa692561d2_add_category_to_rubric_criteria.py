"""add_category_to_rubric_criteria

Revision ID: ebfa692561d2
Revises: pqr678stu901
Create Date: 2025-11-05 09:55:10.902215

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ebfa692561d2'
down_revision: Union[str, None] = 'pqr678stu901'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add category column to rubric_criteria
    op.add_column('rubric_criteria', sa.Column('category', sa.String(length=100), nullable=True))
    op.create_index('ix_rubric_criteria_category', 'rubric_criteria', ['category'], unique=False)


def downgrade() -> None:
    # Drop category column and index
    op.drop_index('ix_rubric_criteria_category', table_name='rubric_criteria')
    op.drop_column('rubric_criteria', 'category')
