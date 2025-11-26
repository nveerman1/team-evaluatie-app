"""add_external_assessments

Revision ID: ext_20251124_01
Revises: lo_20251119_02
Create Date: 2025-11-24 16:30:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "ext_20251124_01"
down_revision = "lo_20251119_02"
branch_labels = None
depends_on = None


def upgrade():
    # Create external_evaluators table
    op.create_table(
        "external_evaluators",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("organisation", sa.String(length=200), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_external_evaluators_id"), "external_evaluators", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_external_evaluators_school_id"),
        "external_evaluators",
        ["school_id"],
        unique=False,
    )
    op.create_index(
        "ix_external_evaluator_email", "external_evaluators", ["email"], unique=False
    )
    op.create_index(
        "ix_external_evaluator_school_email",
        "external_evaluators",
        ["school_id", "email"],
        unique=False,
    )

    # Create project_team_externals table
    op.create_table(
        "project_team_externals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("external_evaluator_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("invitation_token", sa.String(length=128), nullable=False),
        sa.Column("token_expires_at", sa.DateTime(), nullable=True),
        sa.Column(
            "status", sa.String(length=30), nullable=False, server_default="NOT_INVITED"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("invited_at", sa.DateTime(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["external_evaluator_id"], ["external_evaluators.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_project_team_externals_id"),
        "project_team_externals",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_project_team_externals_school_id"),
        "project_team_externals",
        ["school_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_team_external_group",
        "project_team_externals",
        ["group_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_team_external_evaluator",
        "project_team_externals",
        ["external_evaluator_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_team_external_project",
        "project_team_externals",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_team_external_status",
        "project_team_externals",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_project_team_external_token",
        "project_team_externals",
        ["invitation_token"],
        unique=True,
    )

    # Add external evaluator fields to project_assessments table
    op.add_column(
        "project_assessments",
        sa.Column("external_evaluator_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "project_assessments",
        sa.Column(
            "role", sa.String(length=20), nullable=False, server_default="TEACHER"
        ),
    )
    op.add_column(
        "project_assessments",
        sa.Column("is_advisory", sa.Boolean(), nullable=False, server_default="false"),
    )

    # Make teacher_id nullable to support external assessments
    op.alter_column("project_assessments", "teacher_id", nullable=True)

    # Add foreign key for external evaluator
    op.create_foreign_key(
        "fk_project_assessments_external_evaluator",
        "project_assessments",
        "external_evaluators",
        ["external_evaluator_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Add indexes
    op.create_index(
        "ix_project_assessment_external",
        "project_assessments",
        ["external_evaluator_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_assessment_role", "project_assessments", ["role"], unique=False
    )

    # Add visible_to_external field to rubric_criteria table
    op.add_column(
        "rubric_criteria",
        sa.Column(
            "visible_to_external", sa.Boolean(), nullable=False, server_default="true"
        ),
    )


def downgrade():
    # Remove visible_to_external from rubric_criteria
    op.drop_column("rubric_criteria", "visible_to_external")

    # Remove indexes from project_assessments
    op.drop_index("ix_project_assessment_role", table_name="project_assessments")
    op.drop_index("ix_project_assessment_external", table_name="project_assessments")

    # Remove foreign key
    op.drop_constraint(
        "fk_project_assessments_external_evaluator",
        "project_assessments",
        type_="foreignkey",
    )

    # Make teacher_id not nullable again
    op.alter_column("project_assessments", "teacher_id", nullable=False)

    # Remove columns from project_assessments
    op.drop_column("project_assessments", "is_advisory")
    op.drop_column("project_assessments", "role")
    op.drop_column("project_assessments", "external_evaluator_id")

    # Drop project_team_externals table
    op.drop_index("ix_project_team_external_token", table_name="project_team_externals")
    op.drop_index(
        "ix_project_team_external_status", table_name="project_team_externals"
    )
    op.drop_index(
        "ix_project_team_external_project", table_name="project_team_externals"
    )
    op.drop_index(
        "ix_project_team_external_evaluator", table_name="project_team_externals"
    )
    op.drop_index("ix_project_team_external_group", table_name="project_team_externals")
    op.drop_index(
        op.f("ix_project_team_externals_school_id"), table_name="project_team_externals"
    )
    op.drop_index(
        op.f("ix_project_team_externals_id"), table_name="project_team_externals"
    )
    op.drop_table("project_team_externals")

    # Drop external_evaluators table
    op.drop_index(
        "ix_external_evaluator_school_email", table_name="external_evaluators"
    )
    op.drop_index("ix_external_evaluator_email", table_name="external_evaluators")
    op.drop_index(
        op.f("ix_external_evaluators_school_id"), table_name="external_evaluators"
    )
    op.drop_index(op.f("ix_external_evaluators_id"), table_name="external_evaluators")
    op.drop_table("external_evaluators")
