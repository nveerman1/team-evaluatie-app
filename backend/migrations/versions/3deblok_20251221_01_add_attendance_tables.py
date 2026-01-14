"""Add attendance tables for 3de Blok RFID module

Revision ID: 3deblok_20251221_01
Revises:
Create Date: 2025-12-21 22:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "3deblok_20251221_01"
down_revision: Union[str, None] = "notif_20251220_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create rfid_cards table
    op.create_table(
        "rfid_cards",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("uid", sa.String(length=50), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uid", name="uq_rfid_uid"),
    )
    op.create_index("ix_rfid_cards_user_id", "rfid_cards", ["user_id"])
    op.create_index(
        "ix_rfid_cards_uid_active",
        "rfid_cards",
        ["uid"],
        postgresql_where=sa.text("is_active = true"),
    )

    # Create attendance_events table
    op.create_table(
        "attendance_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("check_in", sa.DateTime(timezone=True), nullable=False),
        sa.Column("check_out", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_external", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("location", sa.String(length=200), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("approval_status", sa.String(length=20), nullable=True),
        sa.Column("approved_by", sa.Integer(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "source", sa.String(length=20), nullable=False, server_default="manual"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.CheckConstraint(
            "check_out IS NULL OR check_out > check_in", name="check_valid_times"
        ),
        sa.CheckConstraint(
            "(is_external = false) OR (is_external = true AND location IS NOT NULL AND approval_status IS NOT NULL)",
            name="check_external_fields",
        ),
        sa.CheckConstraint(
            "approval_status IN ('pending', 'approved', 'rejected') OR approval_status IS NULL",
            name="check_approval_status_values",
        ),
        sa.CheckConstraint(
            "source IN ('rfid', 'manual', 'import', 'api')", name="check_source_values"
        ),
        sa.ForeignKeyConstraint(["approved_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_attendance_events_user_id", "attendance_events", ["user_id"])
    op.create_index(
        "ix_attendance_events_project_id", "attendance_events", ["project_id"]
    )
    op.create_index("ix_attendance_events_check_in", "attendance_events", ["check_in"])
    op.create_index(
        "ix_attendance_events_open_sessions",
        "attendance_events",
        ["user_id", "check_in"],
        postgresql_where=sa.text("check_out IS NULL"),
    )
    op.create_index(
        "ix_attendance_events_external_pending",
        "attendance_events",
        ["user_id", "approval_status"],
        postgresql_where=sa.text("is_external = true AND approval_status = 'pending'"),
    )

    # Create attendance_aggregates table (cached totals)
    op.create_table(
        "attendance_aggregates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "total_school_seconds", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "total_external_approved_seconds",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "lesson_blocks",
            sa.Numeric(precision=10, scale=1),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "last_recomputed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_attendance_aggregates_user_id"),
    )
    op.create_index(
        "ix_attendance_aggregates_user_id", "attendance_aggregates", ["user_id"]
    )

    # Create view: open_sessions
    op.execute("""
        CREATE VIEW open_sessions AS
        SELECT 
            ae.id,
            ae.user_id,
            u.name AS user_name,
            u.email AS user_email,
            u.class_name,
            ae.check_in,
            ae.project_id,
            p.title AS project_name,
            EXTRACT(EPOCH FROM (NOW() - ae.check_in))::INTEGER AS duration_seconds
        FROM attendance_events ae
        JOIN users u ON ae.user_id = u.id
        LEFT JOIN projects p ON ae.project_id = p.id
        WHERE ae.check_out IS NULL AND ae.is_external = false;
    """)

    # Create function: compute_user_attendance_totals
    op.execute("""
        CREATE OR REPLACE FUNCTION compute_user_attendance_totals(p_user_id INTEGER)
        RETURNS TABLE(
            total_school_seconds INTEGER,
            total_external_approved_seconds INTEGER,
            lesson_blocks NUMERIC(10,1)
        ) AS $$
        DECLARE
            school_secs INTEGER;
            external_secs INTEGER;
        BEGIN
            SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (check_out - check_in))::INTEGER), 0)
            INTO school_secs
            FROM attendance_events
            WHERE user_id = p_user_id 
              AND is_external = false 
              AND check_out IS NOT NULL
              AND check_out > check_in;
            
            SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (check_out - check_in))::INTEGER), 0)
            INTO external_secs
            FROM attendance_events
            WHERE user_id = p_user_id 
              AND is_external = true 
              AND approval_status = 'approved'
              AND check_out IS NOT NULL
              AND check_out > check_in;
            
            RETURN QUERY SELECT 
                school_secs,
                external_secs,
                ROUND(((school_secs + external_secs)::NUMERIC / (75 * 60)), 1);
        END;
        $$ LANGUAGE plpgsql;
    """)


def downgrade() -> None:
    # Drop function
    op.execute("DROP FUNCTION IF EXISTS compute_user_attendance_totals(INTEGER);")

    # Drop view
    op.execute("DROP VIEW IF EXISTS open_sessions;")

    # Drop tables
    op.drop_table("attendance_aggregates")
    op.drop_table("attendance_events")
    op.drop_table("rfid_cards")
