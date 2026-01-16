"""add self assessment tables

Revision ID: pasa_20260116_01
Revises: task_20250104_01
Create Date: 2026-01-16 14:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "pasa_20260116_01"
down_revision = "task_20250104_01"
branch_labels = None
depends_on = None


def upgrade():
    # Create project_assessment_self_assessments table
    op.create_table(
        "project_assessment_self_assessments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("assessment_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("team_number", sa.Integer(), nullable=True),
        sa.Column("locked", sa.Boolean(), nullable=False, server_default="false"),
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
            ["assessment_id"],
            ["project_assessments.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["student_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "assessment_id",
            "student_id",
            name="uq_self_assessment_once_per_student",
        ),
    )

    # Create indexes for self_assessments
    op.create_index(
        op.f("ix_project_assessment_self_assessments_id"),
        "project_assessment_self_assessments",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_project_assessment_self_assessments_school_id"),
        "project_assessment_self_assessments",
        ["school_id"],
        unique=False,
    )
    op.create_index(
        "ix_self_assessment_assessment",
        "project_assessment_self_assessments",
        ["assessment_id"],
        unique=False,
    )
    op.create_index(
        "ix_self_assessment_student",
        "project_assessment_self_assessments",
        ["student_id"],
        unique=False,
    )

    # Create project_assessment_self_assessment_scores table
    op.create_table(
        "project_assessment_self_assessment_scores",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("self_assessment_id", sa.Integer(), nullable=False),
        sa.Column("criterion_id", sa.Integer(), nullable=False),
        sa.Column("score", sa.SmallInteger(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["self_assessment_id"],
            ["project_assessment_self_assessments.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["criterion_id"],
            ["rubric_criteria.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "self_assessment_id",
            "criterion_id",
            name="uq_self_score_per_criterion",
        ),
    )

    # Create indexes for self_assessment_scores
    op.create_index(
        op.f("ix_project_assessment_self_assessment_scores_id"),
        "project_assessment_self_assessment_scores",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_project_assessment_self_assessment_scores_school_id"),
        "project_assessment_self_assessment_scores",
        ["school_id"],
        unique=False,
    )
    op.create_index(
        "ix_self_score_self_assessment",
        "project_assessment_self_assessment_scores",
        ["self_assessment_id"],
        unique=False,
    )
    op.create_index(
        "ix_self_score_criterion",
        "project_assessment_self_assessment_scores",
        ["criterion_id"],
        unique=False,
    )


def downgrade():
    # Drop indexes for self_assessment_scores
    op.drop_index(
        "ix_self_score_criterion",
        table_name="project_assessment_self_assessment_scores",
    )
    op.drop_index(
        "ix_self_score_self_assessment",
        table_name="project_assessment_self_assessment_scores",
    )
    op.drop_index(
        op.f("ix_project_assessment_self_assessment_scores_school_id"),
        table_name="project_assessment_self_assessment_scores",
    )
    op.drop_index(
        op.f("ix_project_assessment_self_assessment_scores_id"),
        table_name="project_assessment_self_assessment_scores",
    )

    # Drop self_assessment_scores table
    op.drop_table("project_assessment_self_assessment_scores")

    # Drop indexes for self_assessments
    op.drop_index(
        "ix_self_assessment_student",
        table_name="project_assessment_self_assessments",
    )
    op.drop_index(
        "ix_self_assessment_assessment",
        table_name="project_assessment_self_assessments",
    )
    op.drop_index(
        op.f("ix_project_assessment_self_assessments_school_id"),
        table_name="project_assessment_self_assessments",
    )
    op.drop_index(
        op.f("ix_project_assessment_self_assessments_id"),
        table_name="project_assessment_self_assessments",
    )

    # Drop self_assessments table
    op.drop_table("project_assessment_self_assessments")
