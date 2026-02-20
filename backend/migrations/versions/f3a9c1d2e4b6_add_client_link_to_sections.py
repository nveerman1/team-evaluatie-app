"""add_client_link_to_sections

Revision ID: f3a9c1d2e4b6
Revises: ca4111bca819
Create Date: 2026-02-20 21:50:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "f3a9c1d2e4b6"
down_revision = "ca4111bca819"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    1. Add client_id FK to project_plan_sections so teachers can link a
       projectplan client section to an existing CMS Client record.
    2. Add unique constraint on (school_id, organization) in clients to
       prevent exact duplicate client entries per school.
    """
    # 1. Add client_id column to project_plan_sections
    op.add_column(
        "project_plan_sections",
        sa.Column("client_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_pps_client_id",
        "project_plan_sections",
        "clients",
        ["client_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_pps_client_id", "project_plan_sections", ["client_id"], unique=False
    )

    # 2. Add unique constraint on (school_id, organization) in clients
    op.create_unique_constraint(
        "uq_client_school_org",
        "clients",
        ["school_id", "organization"],
    )


def downgrade() -> None:
    """Reverse the migration."""
    op.drop_constraint("uq_client_school_org", "clients", type_="unique")
    op.drop_index("ix_pps_client_id", table_name="project_plan_sections")
    op.drop_constraint("fk_pps_client_id", "project_plan_sections", type_="foreignkey")
    op.drop_column("project_plan_sections", "client_id")
