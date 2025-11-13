"""Multi-tenant architecture refactor

Adds:
- TeacherCourse junction table for teacher-course mapping
- evaluation_type field to Evaluations
- Additional fields to Course (code, level, year, description, is_active)
- AuditLog table for tracking changes
- Various indexes for performance

Revision ID: mt_20251112_01
Revises: lo_20251110_02
Create Date: 2025-11-12 10:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "mt_20251112_01"
down_revision: Union[str, None] = "lo_20251110_02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ========== Course enhancements ==========
    # Add new columns to courses table
    op.add_column("courses", sa.Column("code", sa.String(length=50), nullable=True))
    op.add_column("courses", sa.Column("level", sa.String(length=50), nullable=True))
    op.add_column("courses", sa.Column("year", sa.Integer(), nullable=True))
    op.add_column("courses", sa.Column("description", sa.Text(), nullable=True))
    op.add_column(
        "courses",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    )
    
    # Add unique constraint on (school_id, code)
    op.create_unique_constraint(
        "uq_course_code_per_school", "courses", ["school_id", "code"]
    )
    
    # Add index on (school_id, is_active)
    op.create_index(
        "ix_course_school_active", "courses", ["school_id", "is_active"]
    )

    # ========== TeacherCourse junction table ==========
    op.create_table(
        "teacher_courses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("teacher_id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column(
            "role",
            sa.String(length=50),
            nullable=False,
            server_default="teacher",
        ),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default="true"
        ),
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
        sa.ForeignKeyConstraint(
            ["course_id"], ["courses.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["teacher_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("teacher_id", "course_id", name="uq_teacher_course_once"),
    )
    op.create_index(
        op.f("ix_teacher_courses_id"), "teacher_courses", ["id"], unique=False
    )
    op.create_index(
        "ix_teacher_course_teacher", "teacher_courses", ["teacher_id"], unique=False
    )
    op.create_index(
        "ix_teacher_course_course", "teacher_courses", ["course_id"], unique=False
    )
    op.create_index(
        "ix_teacher_course_school", "teacher_courses", ["school_id"], unique=False
    )

    # ========== Evaluation enhancements ==========
    # Add evaluation_type column
    op.add_column(
        "evaluations",
        sa.Column(
            "evaluation_type",
            sa.String(length=30),
            nullable=False,
            server_default="peer",
        ),
    )
    
    # Add indexes for evaluation_type
    op.create_index("ix_eval_type", "evaluations", ["evaluation_type"])
    op.create_index(
        "ix_eval_school_type", "evaluations", ["school_id", "evaluation_type"]
    )

    # ========== AuditLog table ==========
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("user_email", sa.String(length=320), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_id"), "audit_logs", ["id"], unique=False)
    op.create_index("ix_audit_log_school", "audit_logs", ["school_id"])
    op.create_index("ix_audit_log_user", "audit_logs", ["user_id"])
    op.create_index("ix_audit_log_entity", "audit_logs", ["entity_type", "entity_id"])
    op.create_index("ix_audit_log_action", "audit_logs", ["action"])
    op.create_index("ix_audit_log_created", "audit_logs", ["created_at"])


def downgrade() -> None:
    # Drop audit_logs table
    op.drop_index("ix_audit_log_created", table_name="audit_logs")
    op.drop_index("ix_audit_log_action", table_name="audit_logs")
    op.drop_index("ix_audit_log_entity", table_name="audit_logs")
    op.drop_index("ix_audit_log_user", table_name="audit_logs")
    op.drop_index("ix_audit_log_school", table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_id"), table_name="audit_logs")
    op.drop_table("audit_logs")

    # Drop evaluation indexes and column
    op.drop_index("ix_eval_school_type", table_name="evaluations")
    op.drop_index("ix_eval_type", table_name="evaluations")
    op.drop_column("evaluations", "evaluation_type")

    # Drop teacher_courses table
    op.drop_index("ix_teacher_course_school", table_name="teacher_courses")
    op.drop_index("ix_teacher_course_course", table_name="teacher_courses")
    op.drop_index("ix_teacher_course_teacher", table_name="teacher_courses")
    op.drop_index(op.f("ix_teacher_courses_id"), table_name="teacher_courses")
    op.drop_table("teacher_courses")

    # Drop course enhancements
    op.drop_index("ix_course_school_active", table_name="courses")
    op.drop_constraint("uq_course_code_per_school", "courses", type_="unique")
    op.drop_column("courses", "is_active")
    op.drop_column("courses", "description")
    op.drop_column("courses", "year")
    op.drop_column("courses", "level")
    op.drop_column("courses", "code")
