"""add subprojects table

Revision ID: subp_20251203_01
Revises: pec_20251202_01
Create Date: 2024-12-03

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "subp_20251203_01"
down_revision: Union[str, None] = "pec_20251202_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create subprojects table
    op.create_table(
        "subprojects",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("team_number", sa.Integer(), nullable=True),
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
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_subproject_school", "subprojects", ["school_id"], unique=False)
    op.create_index("ix_subproject_project", "subprojects", ["project_id"], unique=False)
    op.create_index("ix_subproject_client", "subprojects", ["client_id"], unique=False)
    op.create_index(
        "ix_subproject_team", "subprojects", ["project_id", "team_number"], unique=False
    )
    op.create_index(op.f("ix_subprojects_id"), "subprojects", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_subprojects_id"), table_name="subprojects")
    op.drop_index("ix_subproject_team", table_name="subprojects")
    op.drop_index("ix_subproject_client", table_name="subprojects")
    op.drop_index("ix_subproject_project", table_name="subprojects")
    op.drop_index("ix_subproject_school", table_name="subprojects")
    op.drop_table("subprojects")
