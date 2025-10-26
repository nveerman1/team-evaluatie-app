"""add grade column to grades

Revision ID: 4b9dc9370c68
Revises: c7d8e9f0abcd
Create Date: 2025-10-26 22:15:23.912298

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4b9dc9370c68"
down_revision: Union[str, None] = "c7d8e9f0abcd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # 1) Kolom toevoegen (float/NUMERIC, nullable toegestaan)
    op.add_column("grades", sa.Column("grade", sa.Float(), nullable=True))

    # 2) Backfill: als er al published cijfers waren, gebruik die als initiële waarde
    #    (zodat de UI niet leeg is bij bestaande data)
    op.execute(
        """
        UPDATE grades
        SET grade = published_grade
        WHERE grade IS NULL AND published_grade IS NOT NULL
        """
    )


def downgrade():
    op.drop_column("grades", "grade")
