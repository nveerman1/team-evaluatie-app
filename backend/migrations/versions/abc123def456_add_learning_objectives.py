"""add learning objectives

Revision ID: abc123def456
Revises: xyz789abc012
Create Date: 2025-11-09 23:32:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision = "abc123def456"
down_revision = "xyz789abc012"
branch_labels = None
depends_on = None


def upgrade():
    # Create learning_objectives table
    op.create_table(
        "learning_objectives",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("domain", sa.String(50), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("level", sa.String(50), nullable=True),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("metadata_json", JSON(), nullable=False, server_default="{}"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_learning_objective_school",
        "learning_objectives",
        ["school_id"],
    )
    op.create_index(
        "ix_learning_objective_domain",
        "learning_objectives",
        ["school_id", "domain"],
    )
    op.create_index(
        "ix_learning_objective_active",
        "learning_objectives",
        ["school_id", "active"],
    )

    # Create many-to-many association table
    op.create_table(
        "rubric_criterion_learning_objectives",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("criterion_id", sa.Integer(), nullable=False),
        sa.Column("learning_objective_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["criterion_id"],
            ["rubric_criteria.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["learning_objective_id"],
            ["learning_objectives.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "criterion_id",
            "learning_objective_id",
            name="uq_criterion_learning_objective",
        ),
    )
    op.create_index(
        "ix_criterion_lo_criterion",
        "rubric_criterion_learning_objectives",
        ["criterion_id"],
    )
    op.create_index(
        "ix_criterion_lo_objective",
        "rubric_criterion_learning_objectives",
        ["learning_objective_id"],
    )


def downgrade():
    op.drop_table("rubric_criterion_learning_objectives")
    op.drop_table("learning_objectives")
