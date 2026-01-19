"""make project_team_id primary in project_assessments

Revision ID: pa_20260119_01
Revises: queue_20260101_05
Create Date: 2026-01-19 12:00:00.000000

Phase 2.1: Migrate ProjectAssessment to project_team_id

This migration makes project_team_id the primary foreign key and group_id optional.
IMPORTANT: Run backfill script BEFORE applying this migration:
    python scripts/backfill_project_assessment_teams.py --commit

Changes:
1. Make project_team_id NOT NULL (required)
2. Make group_id NULLABLE (legacy field)
3. Change FK constraints (group_id from CASCADE to RESTRICT)
4. Add composite index for queries

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
    Make project_team_id required and group_id optional.
    
    Prerequisites:
    - All ProjectAssessment records must have project_team_id populated
    - Run backfill_project_assessment_teams.py first
    """
    
    # 1. Make project_team_id NOT NULL
    # This will fail if any records still have NULL project_team_id
    op.alter_column(
        "project_assessments",
        "project_team_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    
    # 2. Make group_id NULLABLE (legacy field)
    op.alter_column(
        "project_assessments",
        "group_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
    
    # 3. Drop existing FK constraint for group_id and recreate with RESTRICT
    # This prevents accidental deletion of groups that are still referenced
    op.drop_constraint(
        "project_assessments_group_id_fkey",
        "project_assessments",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "project_assessments_group_id_fkey",
        "project_assessments",
        "groups",
        ["group_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    
    # 4. Add composite index for efficient queries
    # This helps when querying by project_team_id with other filters
    op.create_index(
        "ix_project_assessments_team_project",
        "project_assessments",
        ["project_team_id", "project_id"],
    )
    
    # 5. Add index for legacy group_id queries during transition
    # This ensures queries with group_id fallback remain fast
    op.create_index(
        "ix_project_assessments_group",
        "project_assessments",
        ["group_id"],
    )


def downgrade():
    """
    Revert to group_id primary, project_team_id optional.
    
    NOTE: This requires dual-write to still be active, otherwise data loss occurs.
    """
    
    # Drop indexes
    op.drop_index("ix_project_assessments_group", "project_assessments")
    op.drop_index("ix_project_assessments_team_project", "project_assessments")
    
    # Revert FK constraint for group_id back to CASCADE
    op.drop_constraint(
        "project_assessments_group_id_fkey",
        "project_assessments",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "project_assessments_group_id_fkey",
        "project_assessments",
        "groups",
        ["group_id"],
        ["id"],
        ondelete="CASCADE",
    )
    
    # Make group_id NOT NULL again
    op.alter_column(
        "project_assessments",
        "group_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    
    # Make project_team_id NULLABLE again
    op.alter_column(
        "project_assessments",
        "project_team_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
