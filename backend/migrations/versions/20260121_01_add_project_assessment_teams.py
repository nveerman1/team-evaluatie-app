"""Add project_assessment_teams table and refactor data model

Revision ID: 20260121_01_pat
Revises: 20260119_drop_legacy
Create Date: 2026-01-21

Refactors project assessments to be owned by project_id instead of a single project_team_id.
Introduces project_assessment_teams as a child table to link assessments to multiple teams.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260121_01_pat"
down_revision = "20260119_drop_legacy"
branch_labels = None
depends_on = None


def upgrade():
    """
    1. Backfill project_id for existing assessments
    2. Create project_assessment_teams table
    3. Backfill child rows for existing assessments
    4. Create child rows for all teams in each project
    5. Make project_team_id nullable
    """
    
    # Step 1: Backfill project_id for existing assessments
    # Join project_teams to get project_id for each assessment
    op.execute("""
        UPDATE project_assessments pa
        SET project_id = pt.project_id
        FROM project_teams pt
        WHERE pa.project_team_id = pt.id
        AND pa.project_id IS NULL
    """)
    
    # Step 2: Create project_assessment_teams table
    op.create_table(
        "project_assessment_teams",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("project_assessment_id", sa.Integer(), nullable=False),
        sa.Column("project_team_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="not_started"),
        sa.Column("scores_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["project_assessment_id"],
            ["project_assessments.id"],
            name="fk_pat_assessment_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["project_team_id"],
            ["project_teams.id"],
            name="fk_pat_project_team_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "project_assessment_id",
            "project_team_id",
            name="uq_project_assessment_team_once",
        ),
    )
    
    # Create indexes
    op.create_index("ix_pat_assessment", "project_assessment_teams", ["project_assessment_id"])
    op.create_index("ix_pat_team", "project_assessment_teams", ["project_team_id"])
    op.create_index(
        "ix_pat_assessment_status",
        "project_assessment_teams",
        ["project_assessment_id", "status"],
    )
    
    # Step 3: Backfill child rows for existing assessments
    # Create one child row for each assessment's original project_team_id
    op.execute("""
        INSERT INTO project_assessment_teams 
            (school_id, project_assessment_id, project_team_id, status, scores_count, last_updated_at)
        SELECT 
            pa.school_id,
            pa.id,
            pa.project_team_id,
            CASE 
                WHEN pa.status = 'draft' THEN 'not_started'
                WHEN pa.status IN ('open', 'closed') THEN 'in_progress'
                WHEN pa.status = 'published' THEN 'completed'
                ELSE 'not_started'
            END,
            COALESCE(
                (SELECT COUNT(*) FROM project_assessment_scores pas 
                 WHERE pas.assessment_id = pa.id),
                0
            ),
            NOW()
        FROM project_assessments pa
        WHERE pa.project_team_id IS NOT NULL
        ON CONFLICT (project_assessment_id, project_team_id) DO NOTHING
    """)
    
    # Step 4: Create child rows for ALL teams in each project
    # This allows teachers to score all teams within a project
    op.execute("""
        INSERT INTO project_assessment_teams 
            (school_id, project_assessment_id, project_team_id, status, scores_count)
        SELECT DISTINCT
            pa.school_id,
            pa.id,
            pt.id,
            'not_started',
            0
        FROM project_assessments pa
        JOIN project_teams pt ON pt.project_id = pa.project_id
        WHERE pa.project_id IS NOT NULL
        ON CONFLICT (project_assessment_id, project_team_id) DO NOTHING
    """)
    
    # Step 5: Make project_team_id nullable (it's now deprecated)
    op.alter_column(
        "project_assessments",
        "project_team_id",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade():
    """
    Reverse the changes - WARNING: data loss will occur
    """
    
    # Make project_team_id not nullable again (may fail if nulls exist)
    op.alter_column(
        "project_assessments",
        "project_team_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    
    # Drop indexes
    op.drop_index("ix_pat_assessment_status", table_name="project_assessment_teams")
    op.drop_index("ix_pat_team", table_name="project_assessment_teams")
    op.drop_index("ix_pat_assessment", table_name="project_assessment_teams")
    
    # Drop the table
    op.drop_table("project_assessment_teams")
    
    # Note: project_id backfill is kept as it doesn't hurt to have it
