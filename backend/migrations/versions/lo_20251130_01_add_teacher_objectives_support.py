"""Add teacher_id, course_id, is_template to learning_objectives

This migration extends the learning_objectives table to support
the two-tier architecture:

1. Central/Template objectives (is_template=True):
   - Managed by admin via /admin/templates
   - Linked to subject_id
   - Can be linked to rubric criteria
   - Read-only for teachers

2. Teacher-specific objectives (is_template=False):
   - Owned by teacher (teacher_id)
   - Optionally linked to course
   - Cannot be linked to rubric templates
   - Visible/editable only by owner

Existing learning objectives are marked as is_template=True
(backward compatible - they were implicitly central objectives).

Revision ID: lo_20251130_01
Revises: pac_20251129_01
Create Date: 2025-11-30 19:40:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "lo_20251130_01"
down_revision: Union[str, None] = "pac_20251129_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add teacher_id column
    op.add_column(
        "learning_objectives",
        sa.Column("teacher_id", sa.Integer(), nullable=True),
    )

    # 2. Add course_id column
    op.add_column(
        "learning_objectives",
        sa.Column("course_id", sa.Integer(), nullable=True),
    )

    # 3. Add is_template column with default False initially
    # We'll update existing records and then change the default
    op.add_column(
        "learning_objectives",
        sa.Column("is_template", sa.Boolean(), nullable=True, server_default="false"),
    )

    # 4. Set is_template=True for all existing records (they are central objectives)
    op.execute(
        "UPDATE learning_objectives SET is_template = true WHERE is_template IS NULL OR is_template = false"
    )

    # 5. Make is_template NOT NULL after data migration
    op.alter_column(
        "learning_objectives",
        "is_template",
        nullable=False,
        server_default=None,
    )

    # 6. Add foreign key for teacher_id
    op.create_foreign_key(
        "fk_learning_objectives_teacher_id_users",
        "learning_objectives",
        "users",
        ["teacher_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # 7. Add foreign key for course_id
    op.create_foreign_key(
        "fk_learning_objectives_course_id_courses",
        "learning_objectives",
        "courses",
        ["course_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 8. Add indexes
    op.create_index(
        "ix_learning_objective_teacher",
        "learning_objectives",
        ["teacher_id"],
    )

    op.create_index(
        "ix_learning_objective_course",
        "learning_objectives",
        ["course_id"],
    )

    op.create_index(
        "ix_learning_objective_is_template",
        "learning_objectives",
        ["school_id", "is_template"],
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index(
        "ix_learning_objective_is_template",
        table_name="learning_objectives",
    )

    op.drop_index(
        "ix_learning_objective_course",
        table_name="learning_objectives",
    )

    op.drop_index(
        "ix_learning_objective_teacher",
        table_name="learning_objectives",
    )

    # Drop foreign keys
    op.drop_constraint(
        "fk_learning_objectives_course_id_courses",
        "learning_objectives",
        type_="foreignkey",
    )

    op.drop_constraint(
        "fk_learning_objectives_teacher_id_users",
        "learning_objectives",
        type_="foreignkey",
    )

    # Drop columns
    op.drop_column("learning_objectives", "is_template")
    op.drop_column("learning_objectives", "course_id")
    op.drop_column("learning_objectives", "teacher_id")
