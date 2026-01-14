"""add competency monitor tables

Revision ID: mno345pqr678
Revises: ghi123jkl456
Create Date: 2025-11-02 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision = "mno345pqr678"
down_revision = "ghi123jkl456"
branch_labels = None
depends_on = None


def upgrade():
    # Create competencies table
    op.create_table(
        "competencies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("scale_min", sa.SmallInteger(), nullable=False, server_default="1"),
        sa.Column("scale_max", sa.SmallInteger(), nullable=False, server_default="5"),
        sa.Column("scale_labels", JSON(), nullable=False, server_default="{}"),
        sa.Column("metadata_json", JSON(), nullable=False, server_default="{}"),
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
        sa.UniqueConstraint("school_id", "name", name="uq_competency_name_per_school"),
    )
    op.create_index("ix_competencies_id", "competencies", ["id"])
    op.create_index("ix_competency_school", "competencies", ["school_id"])

    # Create competency_windows table
    op.create_table(
        "competency_windows",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("class_names", JSON(), nullable=False, server_default="[]"),
        sa.Column("course_id", sa.Integer(), nullable=True),
        sa.Column("start_date", sa.DateTime(), nullable=True),
        sa.Column("end_date", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column(
            "require_self_score", sa.Boolean(), nullable=False, server_default="true"
        ),
        sa.Column("require_goal", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "require_reflection", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.Column("settings", JSON(), nullable=False, server_default="{}"),
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
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_competency_windows_id", "competency_windows", ["id"])
    op.create_index("ix_competency_window_school", "competency_windows", ["school_id"])
    op.create_index(
        "ix_competency_window_status", "competency_windows", ["school_id", "status"]
    )

    # Create competency_self_scores table
    op.create_table(
        "competency_self_scores",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("window_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("competency_id", sa.Integer(), nullable=False),
        sa.Column("score", sa.SmallInteger(), nullable=False),
        sa.Column("example", sa.Text(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["window_id"], ["competency_windows.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["competency_id"], ["competencies.id"], ondelete="CASCADE"
        ),
        sa.UniqueConstraint(
            "window_id", "user_id", "competency_id", name="uq_self_score_once"
        ),
    )
    op.create_index("ix_competency_self_scores_id", "competency_self_scores", ["id"])
    op.create_index(
        "ix_self_score_window_user", "competency_self_scores", ["window_id", "user_id"]
    )

    # Create competency_peer_labels table
    op.create_table(
        "competency_peer_labels",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("window_id", sa.Integer(), nullable=False),
        sa.Column("from_user_id", sa.Integer(), nullable=False),
        sa.Column("to_user_id", sa.Integer(), nullable=False),
        sa.Column("competency_id", sa.Integer(), nullable=False),
        sa.Column(
            "sentiment", sa.String(20), nullable=False, server_default="positive"
        ),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["window_id"], ["competency_windows.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["from_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["to_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["competency_id"], ["competencies.id"], ondelete="CASCADE"
        ),
    )
    op.create_index("ix_competency_peer_labels_id", "competency_peer_labels", ["id"])
    op.create_index(
        "ix_peer_label_window_to", "competency_peer_labels", ["window_id", "to_user_id"]
    )
    op.create_index(
        "ix_peer_label_competency", "competency_peer_labels", ["competency_id"]
    )

    # Create competency_teacher_observations table
    op.create_table(
        "competency_teacher_observations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("window_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("competency_id", sa.Integer(), nullable=False),
        sa.Column("teacher_id", sa.Integer(), nullable=False),
        sa.Column("score", sa.SmallInteger(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["window_id"], ["competency_windows.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["competency_id"], ["competencies.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["teacher_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "window_id", "user_id", "competency_id", name="uq_teacher_obs_once"
        ),
    )
    op.create_index(
        "ix_competency_teacher_observations_id",
        "competency_teacher_observations",
        ["id"],
    )
    op.create_index(
        "ix_teacher_obs_window_user",
        "competency_teacher_observations",
        ["window_id", "user_id"],
    )

    # Create competency_goals table
    op.create_table(
        "competency_goals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("window_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("competency_id", sa.Integer(), nullable=True),
        sa.Column("goal_text", sa.Text(), nullable=False),
        sa.Column("success_criteria", sa.Text(), nullable=True),
        sa.Column(
            "status", sa.String(20), nullable=False, server_default="in_progress"
        ),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["window_id"], ["competency_windows.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["competency_id"], ["competencies.id"], ondelete="SET NULL"
        ),
    )
    op.create_index("ix_competency_goals_id", "competency_goals", ["id"])
    op.create_index(
        "ix_competency_goal_window_user", "competency_goals", ["window_id", "user_id"]
    )

    # Create competency_reflections table
    op.create_table(
        "competency_reflections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("window_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("goal_id", sa.Integer(), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("goal_achieved", sa.Boolean(), nullable=True),
        sa.Column("evidence", sa.Text(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["window_id"], ["competency_windows.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["goal_id"], ["competency_goals.id"], ondelete="SET NULL"
        ),
        sa.UniqueConstraint(
            "window_id", "user_id", name="uq_competency_reflection_once"
        ),
    )
    op.create_index("ix_competency_reflections_id", "competency_reflections", ["id"])
    op.create_index(
        "ix_competency_reflection_window_user",
        "competency_reflections",
        ["window_id", "user_id"],
    )


def downgrade():
    # Drop tables in reverse order
    op.drop_table("competency_reflections")
    op.drop_table("competency_goals")
    op.drop_table("competency_teacher_observations")
    op.drop_table("competency_peer_labels")
    op.drop_table("competency_self_scores")
    op.drop_table("competency_windows")
    op.drop_table("competencies")
