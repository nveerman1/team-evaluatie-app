"""restructure learning objectives with phase and rubric target_level

Revision ID: lo_20251110_02
Revises: c8f4e6b2d9a1
Create Date: 2025-11-10 20:45:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "lo_20251110_02"
down_revision = "c8f4e6b2d9a1"
branch_labels = None
depends_on = None


def upgrade():
    # Add phase column to learning_objectives, drop level and active
    op.add_column(
        "learning_objectives", sa.Column("phase", sa.String(20), nullable=True)
    )

    # Migrate existing data: set phase based on level (if any pattern exists)
    # For now, we'll set all to null and let users update them
    # If you want to migrate: UPDATE learning_objectives SET phase = 'onderbouw' WHERE level IN ('...') etc.

    # Drop the level and active columns
    op.drop_index("ix_learning_objective_active", table_name="learning_objectives")
    op.drop_column("learning_objectives", "level")
    op.drop_column("learning_objectives", "active")

    # Add index for phase
    op.create_index(
        "ix_learning_objective_phase", "learning_objectives", ["school_id", "phase"]
    )

    # Add target_level column to rubrics
    op.add_column("rubrics", sa.Column("target_level", sa.String(20), nullable=True))


def downgrade():
    # Remove target_level from rubrics
    op.drop_column("rubrics", "target_level")

    # Remove phase index and column from learning_objectives
    op.drop_index("ix_learning_objective_phase", table_name="learning_objectives")
    op.drop_column("learning_objectives", "phase")

    # Restore level and active columns
    op.add_column(
        "learning_objectives", sa.Column("level", sa.String(50), nullable=True)
    )
    op.add_column(
        "learning_objectives",
        sa.Column(
            "active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
    )
    op.create_index(
        "ix_learning_objective_active", "learning_objectives", ["school_id", "active"]
    )
