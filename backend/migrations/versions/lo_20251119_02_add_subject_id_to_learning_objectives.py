"""Add subject_id to learning_objectives for template support

This migration adds subject_id to learning objectives to support
subject-specific learning objective templates. Existing learning
objectives will have subject_id=NULL (school-wide).

Revision ID: lo_20251119_02
Revises: tmpl_20251119_01
Create Date: 2025-11-19 12:40:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "lo_20251119_02"
down_revision: Union[str, None] = "tmpl_20251119_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add subject_id column to learning_objectives table
    op.add_column(
        "learning_objectives",
        sa.Column("subject_id", sa.Integer(), nullable=True),
    )

    # Add foreign key constraint
    op.create_foreign_key(
        "fk_learning_objectives_subject_id_subjects",
        "learning_objectives",
        "subjects",
        ["subject_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Add index on subject_id
    op.create_index(
        "ix_learning_objective_subject",
        "learning_objectives",
        ["subject_id"],
    )


def downgrade() -> None:
    # Drop index
    op.drop_index("ix_learning_objective_subject", table_name="learning_objectives")

    # Drop foreign key
    op.drop_constraint(
        "fk_learning_objectives_subject_id_subjects",
        "learning_objectives",
        type_="foreignkey",
    )

    # Drop column
    op.drop_column("learning_objectives", "subject_id")
