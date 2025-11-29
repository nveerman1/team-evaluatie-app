"""Add target_level to peer evaluation criterion templates

Revision ID: pec_20251129_01
Revises: stud_20251126_01
Create Date: 2025-11-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "pec_20251129_01"
down_revision: Union[str, None] = "stud_20251126_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add target_level column to peer_evaluation_criterion_templates table
    op.add_column(
        "peer_evaluation_criterion_templates",
        sa.Column("target_level", sa.String(20), nullable=True),
    )
    
    # Add index for filtering by target_level
    op.create_index(
        "ix_peer_criterion_template_target_level",
        "peer_evaluation_criterion_templates",
        ["target_level"],
    )


def downgrade() -> None:
    # Drop the index
    op.drop_index(
        "ix_peer_criterion_template_target_level",
        table_name="peer_evaluation_criterion_templates",
    )
    
    # Drop the column
    op.drop_column("peer_evaluation_criterion_templates", "target_level")
