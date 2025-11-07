"""add external invite tables

Revision ID: xyz789abc012
Revises: pqr678stu901
Create Date: 2025-11-07 14:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision = "xyz789abc012"
down_revision = "pqr678stu901"
branch_labels = None
depends_on = None


def upgrade():
    # Create competency_external_invites table
    op.create_table(
        "competency_external_invites",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("window_id", sa.Integer(), nullable=False),
        sa.Column("subject_user_id", sa.Integer(), nullable=False),
        sa.Column("invited_by_user_id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("external_name", sa.String(200), nullable=True),
        sa.Column("external_organization", sa.String(200), nullable=True),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rubric_snapshot", JSON(), nullable=False, server_default="{}"),
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
        sa.ForeignKeyConstraint(
            ["subject_user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["invited_by_user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.UniqueConstraint("token_hash", name="uq_external_invite_token"),
    )
    op.create_index(
        "ix_competency_external_invites_id", "competency_external_invites", ["id"]
    )
    op.create_index(
        "ix_external_invite_window", "competency_external_invites", ["window_id"]
    )
    op.create_index(
        "ix_external_invite_subject", "competency_external_invites", ["subject_user_id"]
    )
    op.create_index(
        "ix_external_invite_status", "competency_external_invites", ["status"]
    )
    op.create_index(
        "ix_external_invite_window_subject",
        "competency_external_invites",
        ["window_id", "subject_user_id"],
    )
    op.create_index(
        "ix_external_invite_token_hash",
        "competency_external_invites",
        ["token_hash"],
    )

    # Create competency_external_scores table
    op.create_table(
        "competency_external_scores",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("invite_id", sa.Integer(), nullable=False),
        sa.Column("window_id", sa.Integer(), nullable=False),
        sa.Column("subject_user_id", sa.Integer(), nullable=False),
        sa.Column("competency_id", sa.Integer(), nullable=False),
        sa.Column("score", sa.SmallInteger(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("reviewer_name", sa.String(200), nullable=True),
        sa.Column("reviewer_organization", sa.String(200), nullable=True),
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
            ["invite_id"], ["competency_external_invites.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["window_id"], ["competency_windows.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["subject_user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["competency_id"], ["competencies.id"], ondelete="CASCADE"
        ),
        sa.UniqueConstraint(
            "invite_id", "competency_id", name="uq_external_score_per_competency"
        ),
    )
    op.create_index(
        "ix_competency_external_scores_id", "competency_external_scores", ["id"]
    )
    op.create_index(
        "ix_external_score_window_subject",
        "competency_external_scores",
        ["window_id", "subject_user_id"],
    )
    op.create_index(
        "ix_external_score_competency", "competency_external_scores", ["competency_id"]
    )


def downgrade():
    op.drop_table("competency_external_scores")
    op.drop_table("competency_external_invites")
