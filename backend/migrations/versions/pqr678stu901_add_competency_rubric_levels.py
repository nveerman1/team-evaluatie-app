"""add competency rubric levels

Revision ID: pqr678stu901
Revises: mno345pqr678
Create Date: 2025-11-02 20:45:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "pqr678stu901"
down_revision = "mno345pqr678"
branch_labels = None
depends_on = None


def upgrade():
    # Create competency_rubric_levels table
    op.create_table(
        "competency_rubric_levels",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("competency_id", sa.Integer(), nullable=False),
        sa.Column("level", sa.SmallInteger(), nullable=False),
        sa.Column("label", sa.String(100), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["competency_id"], ["competencies.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("competency_id", "level", name="uq_rubric_level_per_competency"),
    )
    op.create_index("ix_competency_rubric_levels_id", "competency_rubric_levels", ["id"])
    op.create_index("ix_rubric_level_competency", "competency_rubric_levels", ["competency_id"])


def downgrade():
    op.drop_table("competency_rubric_levels")
