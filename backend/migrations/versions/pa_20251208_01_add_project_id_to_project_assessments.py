"""add project_id to project_assessments

Revision ID: pa_20251208_01
Revises: pt_20251208_02
Create Date: 2025-12-08

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "pa_20251208_01"
down_revision: Union[str, None] = "pt_20251208_02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add project_id column to project_assessments
    op.add_column(
        "project_assessments",
        sa.Column(
            "project_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    # Add foreign key constraint
    op.create_foreign_key(
        "fk_project_assessments_project_id",
        "project_assessments",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_project_assessments_project_id",
        "project_assessments",
        type_="foreignkey",
    )
    op.drop_column("project_assessments", "project_id")
