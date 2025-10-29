"""add project assessment tables

Revision ID: def789ghi012
Revises: 49147e418f67
Create Date: 2025-10-29 21:30:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "def789ghi012"
down_revision = "49147e418f67"
branch_labels = None
depends_on = None


def upgrade():
    # Create project_assessments table
    op.create_table(
        "project_assessments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("rubric_id", sa.Integer(), nullable=False),
        sa.Column("teacher_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("version", sa.String(50), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["rubric_id"], ["rubrics.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["teacher_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_project_assessment_group", "project_assessments", ["group_id"])
    op.create_index(
        "ix_project_assessment_teacher", "project_assessments", ["teacher_id"]
    )
    op.create_index("ix_project_assessments_id", "project_assessments", ["id"])
    op.create_index(
        "ix_project_assessments_school_id", "project_assessments", ["school_id"]
    )

    # Create project_assessment_scores table
    op.create_table(
        "project_assessment_scores",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("assessment_id", sa.Integer(), nullable=False),
        sa.Column("criterion_id", sa.Integer(), nullable=False),
        sa.Column("score", sa.SmallInteger(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["assessment_id"], ["project_assessments.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["criterion_id"], ["rubric_criteria.id"], ondelete="CASCADE"
        ),
        sa.UniqueConstraint(
            "assessment_id", "criterion_id", name="uq_project_score_per_criterion"
        ),
    )
    op.create_index(
        "ix_project_score_assessment", "project_assessment_scores", ["assessment_id"]
    )
    op.create_index(
        "ix_project_assessment_scores_id", "project_assessment_scores", ["id"]
    )
    op.create_index(
        "ix_project_assessment_scores_school_id",
        "project_assessment_scores",
        ["school_id"],
    )

    # Create project_assessment_reflections table
    op.create_table(
        "project_assessment_reflections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("assessment_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("word_count", sa.Integer(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["assessment_id"], ["project_assessments.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "assessment_id", "user_id", name="uq_project_reflection_once"
        ),
    )
    op.create_index(
        "ix_project_reflection_assessment",
        "project_assessment_reflections",
        ["assessment_id"],
    )
    op.create_index(
        "ix_project_assessment_reflections_id", "project_assessment_reflections", ["id"]
    )
    op.create_index(
        "ix_project_assessment_reflections_school_id",
        "project_assessment_reflections",
        ["school_id"],
    )


def downgrade():
    # Drop tables in reverse order
    op.drop_table("project_assessment_reflections")
    op.drop_table("project_assessment_scores")
    op.drop_table("project_assessments")
