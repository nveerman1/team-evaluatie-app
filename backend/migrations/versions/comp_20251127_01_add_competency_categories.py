"""add competency categories and link to competencies and rubric criteria

Revision ID: comp_20251127_01
Revises: stud_20251126_01
Create Date: 2025-11-27 20:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "comp_20251127_01"
down_revision = "stud_20251126_01"
branch_labels = None
depends_on = None


def upgrade():
    # Create competency_categories table
    op.create_table(
        "competency_categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("icon", sa.String(100), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
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
        sa.UniqueConstraint(
            "school_id", "name", name="uq_competency_category_name_per_school"
        ),
    )
    op.create_index("ix_competency_categories_id", "competency_categories", ["id"])
    op.create_index(
        "ix_competency_category_school", "competency_categories", ["school_id"]
    )

    # Add category_id column to competencies table
    op.add_column(
        "competencies",
        sa.Column("category_id", sa.Integer(), nullable=True),
    )
    op.create_index("ix_competency_category_id", "competencies", ["category_id"])
    op.create_foreign_key(
        "fk_competencies_category_id_competency_categories",
        "competencies",
        "competency_categories",
        ["category_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Add competency_id column to rubric_criteria table
    op.add_column(
        "rubric_criteria",
        sa.Column("competency_id", sa.Integer(), nullable=True),
    )
    op.create_index("ix_criterion_competency", "rubric_criteria", ["competency_id"])
    op.create_foreign_key(
        "fk_rubric_criteria_competency_id_competencies",
        "rubric_criteria",
        "competencies",
        ["competency_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade():
    # Drop competency_id from rubric_criteria
    op.drop_constraint(
        "fk_rubric_criteria_competency_id_competencies",
        "rubric_criteria",
        type_="foreignkey",
    )
    op.drop_index("ix_criterion_competency", table_name="rubric_criteria")
    op.drop_column("rubric_criteria", "competency_id")

    # Drop category_id from competencies
    op.drop_constraint(
        "fk_competencies_category_id_competency_categories",
        "competencies",
        type_="foreignkey",
    )
    op.drop_index("ix_competency_category_id", table_name="competencies")
    op.drop_column("competencies", "category_id")

    # Drop competency_categories table
    op.drop_index("ix_competency_category_school", table_name="competency_categories")
    op.drop_index("ix_competency_categories_id", table_name="competency_categories")
    op.drop_table("competency_categories")
