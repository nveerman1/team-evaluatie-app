"""add_client_tables

Revision ID: xyz789
Revises: ghi123jkl456
Create Date: 2025-11-15 22:43:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "xyz789"
down_revision = "ghi123jkl456"
branch_labels = None
depends_on = None


def upgrade():
    # Create clients table
    op.create_table(
        "clients",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("organization", sa.String(length=200), nullable=False),
        sa.Column("contact_name", sa.String(length=200), nullable=True),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("level", sa.String(length=50), nullable=True),
        sa.Column("sector", sa.String(length=100), nullable=True),
        sa.Column("tags", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_client_organization", "clients", ["organization"], unique=False)
    op.create_index("ix_client_school_active", "clients", ["school_id", "active"], unique=False)
    op.create_index(op.f("ix_clients_id"), "clients", ["id"], unique=False)
    op.create_index(op.f("ix_clients_school_id"), "clients", ["school_id"], unique=False)

    # Create client_logs table
    op.create_table(
        "client_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("log_type", sa.String(length=50), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_client_log_client", "client_logs", ["client_id"], unique=False)
    op.create_index("ix_client_log_created_at", "client_logs", ["created_at"], unique=False)
    op.create_index(op.f("ix_client_logs_author_id"), "client_logs", ["author_id"], unique=False)
    op.create_index(op.f("ix_client_logs_client_id"), "client_logs", ["client_id"], unique=False)
    op.create_index(op.f("ix_client_logs_id"), "client_logs", ["id"], unique=False)

    # Create client_project_links table
    op.create_table(
        "client_project_links",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("project_assessment_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("start_date", sa.DateTime(), nullable=True),
        sa.Column("end_date", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_assessment_id"], ["project_assessments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("client_id", "project_assessment_id", name="uq_client_project_once"),
    )
    op.create_index("ix_client_project_client", "client_project_links", ["client_id"], unique=False)
    op.create_index("ix_client_project_project", "client_project_links", ["project_assessment_id"], unique=False)
    op.create_index(op.f("ix_client_project_links_client_id"), "client_project_links", ["client_id"], unique=False)
    op.create_index(op.f("ix_client_project_links_id"), "client_project_links", ["id"], unique=False)
    op.create_index(op.f("ix_client_project_links_project_assessment_id"), "client_project_links", ["project_assessment_id"], unique=False)


def downgrade():
    # Drop client_project_links table
    op.drop_index(op.f("ix_client_project_links_project_assessment_id"), table_name="client_project_links")
    op.drop_index(op.f("ix_client_project_links_id"), table_name="client_project_links")
    op.drop_index(op.f("ix_client_project_links_client_id"), table_name="client_project_links")
    op.drop_index("ix_client_project_project", table_name="client_project_links")
    op.drop_index("ix_client_project_client", table_name="client_project_links")
    op.drop_table("client_project_links")

    # Drop client_logs table
    op.drop_index(op.f("ix_client_logs_id"), table_name="client_logs")
    op.drop_index(op.f("ix_client_logs_client_id"), table_name="client_logs")
    op.drop_index(op.f("ix_client_logs_author_id"), table_name="client_logs")
    op.drop_index("ix_client_log_created_at", table_name="client_logs")
    op.drop_index("ix_client_log_client", table_name="client_logs")
    op.drop_table("client_logs")

    # Drop clients table
    op.drop_index(op.f("ix_clients_school_id"), table_name="clients")
    op.drop_index(op.f("ix_clients_id"), table_name="clients")
    op.drop_index("ix_client_school_active", table_name="clients")
    op.drop_index("ix_client_organization", table_name="clients")
    op.drop_table("clients")
