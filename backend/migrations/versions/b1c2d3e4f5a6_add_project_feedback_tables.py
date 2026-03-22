"""Add project feedback tables

Revision ID: b1c2d3e4f5a6
Revises: a2b3c4d5e6f7
Create Date: 2026-03-22 12:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "b1c2d3e4f5a6"
down_revision = "a2b3c4d5e6f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_feedback_rounds",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("school_id", sa.Integer(), nullable=False, index=True),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "teacher_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("closed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "project_feedback_questions",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("school_id", sa.Integer(), nullable=False, index=True),
        sa.Column(
            "round_id",
            sa.Integer(),
            sa.ForeignKey("project_feedback_rounds.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("question_text", sa.String(500), nullable=False),
        sa.Column("question_type", sa.String(30), nullable=False, server_default="rating"),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default="1"),
    )

    op.create_table(
        "project_feedback_responses",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("school_id", sa.Integer(), nullable=False, index=True),
        sa.Column(
            "round_id",
            sa.Integer(),
            sa.ForeignKey("project_feedback_rounds.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "student_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("round_id", "student_id", name="uq_feedback_response_student"),
    )

    op.create_table(
        "project_feedback_answers",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("school_id", sa.Integer(), nullable=False, index=True),
        sa.Column(
            "response_id",
            sa.Integer(),
            sa.ForeignKey("project_feedback_responses.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "question_id",
            sa.Integer(),
            sa.ForeignKey("project_feedback_questions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("rating_value", sa.SmallInteger(), nullable=True),
        sa.Column("text_value", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("project_feedback_answers")
    op.drop_table("project_feedback_responses")
    op.drop_table("project_feedback_questions")
    op.drop_table("project_feedback_rounds")
