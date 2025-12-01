"""Add teacher_id, course_id, subject_id, is_template to competencies

This migration extends the competencies table to support
the two-tier architecture (similar to learning_objectives):

1. Central/Template competencies (is_template=True):
   - Managed by admin via /admin/templates
   - Linked to subject_id
   - Can be linked to rubric criteria
   - Read-only for teachers

2. Teacher-specific competencies (is_template=False):
   - Owned by teacher (teacher_id)
   - Optionally linked to course (for sharing with colleagues)
   - Visible/editable only by owner

3. Shared competencies (teacher-specific with course_id):
   - Visible to all teachers assigned to that course (read-only)

Existing competencies are marked as is_template=True
(backward compatible - they were implicitly central competencies).

Revision ID: comp_20251201_01
Revises: lo_20251130_01
Create Date: 2025-12-01 18:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "comp_20251201_01"
down_revision: Union[str, None] = "lo_20251130_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add subject_id column
    op.add_column(
        "competencies",
        sa.Column("subject_id", sa.Integer(), nullable=True),
    )

    # 2. Add teacher_id column
    op.add_column(
        "competencies",
        sa.Column("teacher_id", sa.Integer(), nullable=True),
    )

    # 3. Add course_id column
    op.add_column(
        "competencies",
        sa.Column("course_id", sa.Integer(), nullable=True),
    )

    # 4. Add is_template column with default False initially
    # We'll update existing records and then change the default
    op.add_column(
        "competencies",
        sa.Column("is_template", sa.Boolean(), nullable=True, server_default="false"),
    )

    # 5. Set is_template=True for all existing records (they are central competencies)
    op.execute(
        "UPDATE competencies SET is_template = true WHERE is_template IS NULL OR is_template = false"
    )

    # 6. Make is_template NOT NULL after data migration
    op.alter_column(
        "competencies",
        "is_template",
        nullable=False,
        server_default=None,
    )

    # 7. Add foreign key for subject_id
    op.create_foreign_key(
        "fk_competencies_subject_id_subjects",
        "competencies",
        "subjects",
        ["subject_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 8. Add foreign key for teacher_id
    op.create_foreign_key(
        "fk_competencies_teacher_id_users",
        "competencies",
        "users",
        ["teacher_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # 9. Add foreign key for course_id
    op.create_foreign_key(
        "fk_competencies_course_id_courses",
        "competencies",
        "courses",
        ["course_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 10. Add indexes
    op.create_index(
        "ix_competency_subject",
        "competencies",
        ["subject_id"],
    )

    op.create_index(
        "ix_competency_teacher",
        "competencies",
        ["teacher_id"],
    )

    op.create_index(
        "ix_competency_course",
        "competencies",
        ["course_id"],
    )

    op.create_index(
        "ix_competency_is_template",
        "competencies",
        ["school_id", "is_template"],
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index(
        "ix_competency_is_template",
        table_name="competencies",
    )

    op.drop_index(
        "ix_competency_course",
        table_name="competencies",
    )

    op.drop_index(
        "ix_competency_teacher",
        table_name="competencies",
    )

    op.drop_index(
        "ix_competency_subject",
        table_name="competencies",
    )

    # Drop foreign keys
    op.drop_constraint(
        "fk_competencies_course_id_courses",
        "competencies",
        type_="foreignkey",
    )

    op.drop_constraint(
        "fk_competencies_teacher_id_users",
        "competencies",
        type_="foreignkey",
    )

    op.drop_constraint(
        "fk_competencies_subject_id_subjects",
        "competencies",
        type_="foreignkey",
    )

    # Drop columns
    op.drop_column("competencies", "is_template")
    op.drop_column("competencies", "course_id")
    op.drop_column("competencies", "teacher_id")
    op.drop_column("competencies", "subject_id")
