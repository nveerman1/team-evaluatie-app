"""Add project assessment criterion templates table

Revision ID: pac_20251129_01
Revises: pec_20251129_01
Create Date: 2025-11-29

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "pac_20251129_01"
down_revision: Union[str, None] = "pec_20251129_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the project_assessment_criterion_templates table
    op.create_table(
        "project_assessment_criterion_templates",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "school_id",
            sa.Integer(),
            sa.ForeignKey("schools.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "subject_id",
            sa.Integer(),
            sa.ForeignKey("subjects.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("target_level", sa.String(20), nullable=True, index=True),
        sa.Column("level_descriptors", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("learning_objective_ids", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # Create indexes
    op.create_index(
        "ix_project_assessment_criterion_template_school",
        "project_assessment_criterion_templates",
        ["school_id"],
    )
    op.create_index(
        "ix_project_assessment_criterion_template_subject",
        "project_assessment_criterion_templates",
        ["subject_id"],
    )
    op.create_index(
        "ix_project_assessment_criterion_template_category",
        "project_assessment_criterion_templates",
        ["category"],
    )
    op.create_index(
        "ix_project_assessment_criterion_template_target_level",
        "project_assessment_criterion_templates",
        ["target_level"],
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index(
        "ix_project_assessment_criterion_template_target_level",
        table_name="project_assessment_criterion_templates",
    )
    op.drop_index(
        "ix_project_assessment_criterion_template_category",
        table_name="project_assessment_criterion_templates",
    )
    op.drop_index(
        "ix_project_assessment_criterion_template_subject",
        table_name="project_assessment_criterion_templates",
    )
    op.drop_index(
        "ix_project_assessment_criterion_template_school",
        table_name="project_assessment_criterion_templates",
    )

    # Drop the table
    op.drop_table("project_assessment_criterion_templates")
