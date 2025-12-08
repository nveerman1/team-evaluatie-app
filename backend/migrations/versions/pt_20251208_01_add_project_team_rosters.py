"""Add project team rosters and evaluation status tracking

This migration introduces project-specific team rosters to preserve historical team
composition for evaluations. Teams are frozen at project start time.

Changes:
- Create project_teams table to track team snapshots per project
- Create project_team_members table to store frozen team membership
- Add project_team_id FK to evaluations, project_assessments, and project_notes_contexts
- Add closed_at timestamp to evaluations, project_assessments, and project_notes_contexts
- Add status field to project_notes_contexts
- Add indices for performance

Revision ID: pt_20251208_01
Revises: subp_20251203_01
Create Date: 2025-12-08

"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "pt_20251208_01"
down_revision: Union[str, None] = "subp_20251203_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ========== Create project_teams table ==========
    op.create_table(
        "project_teams",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("team_id", sa.Integer(), nullable=True),
        sa.Column("display_name_at_time", sa.String(length=200), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("backfill_source", sa.String(length=50), nullable=True),
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
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["team_id"], ["groups.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_project_teams_id", "project_teams", ["id"], unique=False)
    op.create_index("ix_project_teams_school_id", "project_teams", ["school_id"], unique=False)
    op.create_index("ix_project_team_project", "project_teams", ["project_id"], unique=False)
    op.create_index("ix_project_team_team", "project_teams", ["team_id"], unique=False)
    op.create_index(
        "ix_project_team_project_version",
        "project_teams",
        ["project_id", "team_id", "version"],
        unique=False,
    )

    # ========== Create project_team_members table ==========
    op.create_table(
        "project_team_members",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("project_team_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=100), nullable=True),
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
            ["project_team_id"], ["project_teams.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "project_team_id", "user_id", name="uq_project_team_member_once"
        ),
    )
    op.create_index(
        "ix_project_team_members_id", "project_team_members", ["id"], unique=False
    )
    op.create_index(
        "ix_project_team_members_school_id",
        "project_team_members",
        ["school_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_team_member_project_team",
        "project_team_members",
        ["project_team_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_team_member_user",
        "project_team_members",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_team_member_composite",
        "project_team_members",
        ["project_team_id", "user_id"],
        unique=False,
    )

    # ========== Add project_team_id and closed_at to evaluations ==========
    op.add_column(
        "evaluations",
        sa.Column("project_team_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "evaluations",
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_evaluations_project_team_id_project_teams",
        "evaluations",
        "project_teams",
        ["project_team_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_eval_project_team", "evaluations", ["project_team_id"], unique=False
    )
    op.create_index("ix_eval_status", "evaluations", ["status"], unique=False)
    op.create_index(
        "ix_eval_project_team_status",
        "evaluations",
        ["project_team_id", "status"],
        unique=False,
    )

    # ========== Add project_team_id and closed_at to project_assessments ==========
    op.add_column(
        "project_assessments",
        sa.Column("project_team_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "project_assessments",
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_project_assessments_project_team_id_project_teams",
        "project_assessments",
        "project_teams",
        ["project_team_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_project_assessment_project_team",
        "project_assessments",
        ["project_team_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_assessment_status",
        "project_assessments",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_project_assessment_project_team_status",
        "project_assessments",
        ["project_team_id", "status"],
        unique=False,
    )

    # ========== Add project_team_id, status, and closed_at to project_notes_contexts ==========
    op.add_column(
        "project_notes_contexts",
        sa.Column("project_team_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "project_notes_contexts",
        sa.Column(
            "status",
            sa.String(length=30),
            nullable=False,
            server_default="draft",
        ),
    )
    op.add_column(
        "project_notes_contexts",
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_project_notes_contexts_project_team_id_project_teams",
        "project_notes_contexts",
        "project_teams",
        ["project_team_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_project_notes_context_project_team",
        "project_notes_contexts",
        ["project_team_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_notes_context_status",
        "project_notes_contexts",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    # Remove indices and columns from project_notes_contexts
    op.drop_index("ix_project_notes_context_status", table_name="project_notes_contexts")
    op.drop_index(
        "ix_project_notes_context_project_team", table_name="project_notes_contexts"
    )
    op.drop_constraint(
        "fk_project_notes_contexts_project_team_id_project_teams",
        "project_notes_contexts",
        type_="foreignkey",
    )
    op.drop_column("project_notes_contexts", "closed_at")
    op.drop_column("project_notes_contexts", "status")
    op.drop_column("project_notes_contexts", "project_team_id")

    # Remove indices and columns from project_assessments
    op.drop_index(
        "ix_project_assessment_project_team_status", table_name="project_assessments"
    )
    op.drop_index("ix_project_assessment_status", table_name="project_assessments")
    op.drop_index(
        "ix_project_assessment_project_team", table_name="project_assessments"
    )
    op.drop_constraint(
        "fk_project_assessments_project_team_id_project_teams",
        "project_assessments",
        type_="foreignkey",
    )
    op.drop_column("project_assessments", "closed_at")
    op.drop_column("project_assessments", "project_team_id")

    # Remove indices and columns from evaluations
    op.drop_index("ix_eval_project_team_status", table_name="evaluations")
    op.drop_index("ix_eval_status", table_name="evaluations")
    op.drop_index("ix_eval_project_team", table_name="evaluations")
    op.drop_constraint(
        "fk_evaluations_project_team_id_project_teams",
        "evaluations",
        type_="foreignkey",
    )
    op.drop_column("evaluations", "closed_at")
    op.drop_column("evaluations", "project_team_id")

    # Drop project_team_members table
    op.drop_index("ix_project_team_member_composite", table_name="project_team_members")
    op.drop_index("ix_project_team_member_user", table_name="project_team_members")
    op.drop_index(
        "ix_project_team_member_project_team", table_name="project_team_members"
    )
    op.drop_index("ix_project_team_members_school_id", table_name="project_team_members")
    op.drop_index("ix_project_team_members_id", table_name="project_team_members")
    op.drop_table("project_team_members")

    # Drop project_teams table
    op.drop_index("ix_project_team_project_version", table_name="project_teams")
    op.drop_index("ix_project_team_team", table_name="project_teams")
    op.drop_index("ix_project_team_project", table_name="project_teams")
    op.drop_index("ix_project_teams_school_id", table_name="project_teams")
    op.drop_index("ix_project_teams_id", table_name="project_teams")
    op.drop_table("project_teams")
