"""remove group_id from project_assessments

Revision ID: pa_20260119_01
Revises: queue_20260101_05
Create Date: 2026-01-19 12:00:00.000000

Phase 2 Complete: Remove group_id, use project_team_id exclusively

This migration removes the legacy group_id column from project_assessments
since we're in local dev and can lose all data. This simplifies the architecture.

Changes:
1. Make project_team_id NOT NULL (if not already)
2. Drop group_id column entirely
3. Add composite index for queries

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "pa_20260119_01"
down_revision = "queue_20260101_05"
branch_labels = None
depends_on = None


def upgrade():
    """
    Remove group_id from project_assessments, use project_team_id exclusively.
    
    WARNING: This will drop the group_id column and all data in it.
    Only run in local dev where data loss is acceptable.
    
    For existing databases with data:
    - Deletes any ProjectAssessment records where project_team_id is NULL
    - Then makes project_team_id NOT NULL
    - Then drops group_id column
    """
    
    # 0. Delete any existing records where project_team_id is NULL
    # (Since we're in local dev and can lose data, this is acceptable)
    op.execute(
        "DELETE FROM project_assessments WHERE project_team_id IS NULL"
    )
    
    # 1. Make project_team_id NOT NULL (if not already)
    op.alter_column(
        "project_assessments",
        "project_team_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    
    # 2. Drop existing FK constraint and index for group_id
    op.drop_constraint(
        "project_assessments_group_id_fkey",
        "project_assessments",
        type_="foreignkey",
    )
    
    # Drop the group_id column entirely
    op.drop_column("project_assessments", "group_id")
    
    # 3. Add composite index for efficient queries
    op.create_index(
        "ix_project_assessments_team_project",
        "project_assessments",
        ["project_team_id", "project_id"],
    )


def downgrade():
    """
    Restore group_id column.
    
    NOTE: This will recreate the column but data will be lost.
    """
    
    # Drop index
    op.drop_index("ix_project_assessments_team_project", "project_assessments")
    
    # Add group_id column back
    op.add_column(
        "project_assessments",
        sa.Column("group_id", sa.Integer(), nullable=True),
    )
    
    # Recreate FK constraint
    op.create_foreign_key(
        "project_assessments_group_id_fkey",
        "project_assessments",
        "groups",
        ["group_id"],
        ["id"],
        ondelete="CASCADE",
    )
    
    # Make project_team_id NULLABLE again
    op.alter_column(
        "project_assessments",
        "project_team_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
