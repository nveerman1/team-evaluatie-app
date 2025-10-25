"""make course_id nullable on evaluations

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6  # ← vervang door jouw laatst gebruikte revision id
Create Date: 2025-10-25 13:35:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"  # ← pas aan
branch_labels = None
depends_on = None


def upgrade():
    # maak course_id nullable
    op.alter_column(
        "evaluations",
        "course_id",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade():
    # (alleen als je terug wil) maak course_id weer NOT NULL
    op.execute(
        """
        UPDATE evaluations
        SET course_id = 0
        WHERE course_id IS NULL
    """
    )
    op.alter_column(
        "evaluations",
        "course_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
