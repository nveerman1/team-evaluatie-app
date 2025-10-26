"""add_grade_column_to_grades_table

Revision ID: 2723836e9d8b
Revises: c7d8e9f0abcd
Create Date: 2025-10-26 20:48:50.906461

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2723836e9d8b'
down_revision: Union[str, None] = 'c7d8e9f0abcd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add the missing 'grade' column to the 'grades' table
    op.add_column(
        'grades',
        sa.Column('grade', sa.Numeric(precision=5, scale=2), nullable=True)
    )


def downgrade() -> None:
    # Remove the 'grade' column from the 'grades' table
    op.drop_column('grades', 'grade')
