"""Add Subject model and link to Course

This migration introduces the Subject entity as an organizational level between
School and Course. The hierarchy becomes: School → Subject → Course → Group.

Changes:
- Create subjects table with fields: id, school_id, name, code, color, icon, is_active
- Add subject_id column to courses table (nullable FK to subjects.id)
- Optionally backfill subjects based on existing course codes

Revision ID: subj_20251119_01
Revises: proj20251116
Create Date: 2025-11-19 08:30:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "subj_20251119_01"
down_revision: Union[str, None] = "proj20251116"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ========== Create subjects table ==========
    op.create_table(
        "subjects",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("color", sa.String(length=20), nullable=True),
        sa.Column("icon", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes
    op.create_index("ix_subjects_id", "subjects", ["id"])
    op.create_index("ix_subjects_school_id", "subjects", ["school_id"])
    op.create_index("ix_subject_school_active", "subjects", ["school_id", "is_active"])

    # Create unique constraint on school_id + code
    op.create_unique_constraint(
        "uq_subject_code_per_school", "subjects", ["school_id", "code"]
    )

    # ========== Add subject_id to courses ==========
    op.add_column(
        "courses",
        sa.Column("subject_id", sa.Integer(), nullable=True),
    )

    # Add FK constraint from courses.subject_id to subjects.id
    op.create_foreign_key(
        "fk_courses_subject_id_subjects",
        "courses",
        "subjects",
        ["subject_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Create index on subject_id
    op.create_index("ix_course_subject", "courses", ["subject_id"])

    # ========== Optional: Data migration ==========
    # Backfill subjects based on existing course codes
    # This groups courses by their code and creates a subject for each unique code

    # Note: This is a simple backfill strategy. Adjust if your data has different patterns.
    # Uncomment the following to enable data migration:

    # from sqlalchemy import text
    #
    # connection = op.get_bind()
    #
    # # For each school, find unique course codes and create subjects
    # result = connection.execute(text("""
    #     SELECT DISTINCT school_id, code
    #     FROM courses
    #     WHERE code IS NOT NULL AND code != ''
    #     ORDER BY school_id, code
    # """))
    #
    # for row in result:
    #     school_id = row[0]
    #     code = row[1]
    #
    #     # Create subject for this school + code combination
    #     connection.execute(text("""
    #         INSERT INTO subjects (school_id, name, code, is_active, created_at, updated_at)
    #         VALUES (:school_id, :name, :code, true, now(), now())
    #         ON CONFLICT (school_id, code) DO NOTHING
    #     """), {"school_id": school_id, "name": code, "code": code})
    #
    # # Link courses to their corresponding subjects
    # connection.execute(text("""
    #     UPDATE courses c
    #     SET subject_id = s.id
    #     FROM subjects s
    #     WHERE c.school_id = s.school_id
    #       AND c.code = s.code
    #       AND c.code IS NOT NULL
    #       AND c.subject_id IS NULL
    # """))


def downgrade() -> None:
    # Remove FK and column from courses
    op.drop_index("ix_course_subject", table_name="courses")
    op.drop_constraint("fk_courses_subject_id_subjects", "courses", type_="foreignkey")
    op.drop_column("courses", "subject_id")

    # Drop subjects table
    op.drop_constraint("uq_subject_code_per_school", "subjects", type_="unique")
    op.drop_index("ix_subject_school_active", table_name="subjects")
    op.drop_index("ix_subjects_school_id", table_name="subjects")
    op.drop_index("ix_subjects_id", table_name="subjects")
    op.drop_table("subjects")
