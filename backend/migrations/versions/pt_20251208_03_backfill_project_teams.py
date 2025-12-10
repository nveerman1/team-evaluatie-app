"""Backfill project teams from existing data

This migration backfills project_teams and project_team_members from existing
evaluations, assessments, and notes that reference teams.

Revision ID: pt_20251208_03
Revises: pt_20251208_01
Create Date: 2025-12-08

"""

from typing import Sequence, Union
from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = "pt_20251208_03"
down_revision: Union[str, None] = "pt_20251208_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Backfill project_teams and project_team_members from existing data

    Strategy:
    1. Create project_teams for each unique (project_id, group_id) combination from evaluations
    2. Create project_teams for each unique (project_id, group_id) from project_assessments
    3. Populate project_team_members based on group_members at time of evaluation/assessment
    4. Update evaluations to reference the new project_team_id
    5. Update project_assessments to reference the new project_team_id
    6. Set backfill_source = 'inference' for all backfilled records
    """

    conn = op.get_bind()

    # ===== Step 1: Backfill from evaluations =====
    # Create project_teams from evaluations that have project_id
    # We'll infer the team from users' team_number or from existing groups

    conn.execute(
        text(
            """
        INSERT INTO project_teams (school_id, project_id, team_id, display_name_at_time, version, backfill_source, created_at, updated_at)
        SELECT DISTINCT
            e.school_id,
            e.project_id,
            NULL::INTEGER as team_id,  -- We don't have direct group reference in evaluations
            COALESCE(c.name, 'Team (inferred)') as display_name_at_time,
            1 as version,
            'inference' as backfill_source,
            e.created_at,
            e.created_at as updated_at
        FROM evaluations e
        LEFT JOIN courses c ON e.course_id = c.id
        WHERE e.project_id IS NOT NULL
            AND e.project_team_id IS NULL
            AND NOT EXISTS (
                SELECT 1 FROM project_teams pt 
                WHERE pt.project_id = e.project_id 
                AND pt.school_id = e.school_id
            )
        ORDER BY e.created_at DESC
        ON CONFLICT DO NOTHING
    """
        )
    )

    # ===== Step 2: Backfill from project_assessments =====
    # Create project_teams from project_assessments that have both project_id and group_id

    conn.execute(
        text(
            """
        INSERT INTO project_teams (school_id, project_id, team_id, display_name_at_time, version, backfill_source, created_at, updated_at)
        SELECT DISTINCT
            pa.school_id,
            pa.project_id,
            pa.group_id as team_id,
            g.name as display_name_at_time,
            1 as version,
            'inference' as backfill_source,
            pa.created_at,
            pa.created_at as updated_at
        FROM project_assessments pa
        INNER JOIN groups g ON pa.group_id = g.id
        WHERE pa.project_id IS NOT NULL
            AND pa.project_team_id IS NULL
            AND NOT EXISTS (
                SELECT 1 FROM project_teams pt 
                WHERE pt.project_id = pa.project_id 
                AND pt.team_id = pa.group_id
                AND pt.school_id = pa.school_id
            )
        ORDER BY pa.created_at DESC
        ON CONFLICT DO NOTHING
    """
        )
    )

    # ===== Step 3: Populate project_team_members from group_members =====
    # For project_teams that have a team_id (group_id), copy members from that group

    conn.execute(
        text(
            """
        INSERT INTO project_team_members (school_id, project_team_id, user_id, role, created_at, updated_at)
        SELECT DISTINCT
            pt.school_id,
            pt.id as project_team_id,
            gm.user_id,
            gm.role_in_team as role,
            pt.created_at,
            pt.created_at as updated_at
        FROM project_teams pt
        INNER JOIN group_members gm ON pt.team_id = gm.group_id
        WHERE pt.team_id IS NOT NULL
            AND pt.backfill_source = 'inference'
            AND NOT EXISTS (
                SELECT 1 FROM project_team_members ptm
                WHERE ptm.project_team_id = pt.id 
                AND ptm.user_id = gm.user_id
            )
        ON CONFLICT DO NOTHING
    """
        )
    )

    # ===== Step 4: Update evaluations to reference project_team_id =====
    # Match evaluations to project_teams based on project_id

    conn.execute(
        text(
            """
        UPDATE evaluations e
        SET project_team_id = (
            SELECT pt.id 
            FROM project_teams pt
            WHERE pt.project_id = e.project_id
            AND pt.school_id = e.school_id
            AND pt.backfill_source = 'inference'
            ORDER BY pt.created_at DESC
            LIMIT 1
        )
        WHERE e.project_id IS NOT NULL
            AND e.project_team_id IS NULL
            AND EXISTS (
                SELECT 1 FROM project_teams pt 
                WHERE pt.project_id = e.project_id 
                AND pt.school_id = e.school_id
                AND pt.backfill_source = 'inference'
            )
    """
        )
    )

    # ===== Step 5: Update project_assessments to reference project_team_id =====
    # Match project_assessments to project_teams based on project_id and group_id

    conn.execute(
        text(
            """
        UPDATE project_assessments pa
        SET project_team_id = (
            SELECT pt.id 
            FROM project_teams pt
            WHERE pt.project_id = pa.project_id
            AND pt.team_id = pa.group_id
            AND pt.school_id = pa.school_id
            ORDER BY pt.created_at DESC
            LIMIT 1
        )
        WHERE pa.project_id IS NOT NULL
            AND pa.project_team_id IS NULL
            AND EXISTS (
                SELECT 1 FROM project_teams pt 
                WHERE pt.project_id = pa.project_id 
                AND pt.team_id = pa.group_id
                AND pt.school_id = pa.school_id
            )
    """
        )
    )

    # ===== Step 6: Update project_notes_contexts to reference project_team_id =====
    # Match project_notes_contexts to project_teams based on project_id

    conn.execute(
        text(
            """
        UPDATE project_notes_contexts pnc
        SET project_team_id = (
            SELECT pt.id 
            FROM project_teams pt
            WHERE pt.project_id = pnc.project_id
            AND pt.school_id = pnc.school_id
            ORDER BY pt.created_at DESC
            LIMIT 1
        )
        WHERE pnc.project_id IS NOT NULL
            AND pnc.project_team_id IS NULL
            AND EXISTS (
                SELECT 1 FROM project_teams pt 
                WHERE pt.project_id = pnc.project_id 
                AND pt.school_id = pnc.school_id
            )
    """
        )
    )


def downgrade() -> None:
    """
    Remove backfilled data

    Note: This will only remove project_teams that were created by this backfill.
    Other project_teams created manually will remain.
    """

    conn = op.get_bind()

    # Clear project_team_id references from notes contexts
    conn.execute(
        text(
            """
        UPDATE project_notes_contexts
        SET project_team_id = NULL
        WHERE project_team_id IN (
            SELECT id FROM project_teams WHERE backfill_source = 'inference'
        )
    """
        )
    )

    # Clear project_team_id references from project_assessments
    conn.execute(
        text(
            """
        UPDATE project_assessments
        SET project_team_id = NULL
        WHERE project_team_id IN (
            SELECT id FROM project_teams WHERE backfill_source = 'inference'
        )
    """
        )
    )

    # Clear project_team_id references from evaluations
    conn.execute(
        text(
            """
        UPDATE evaluations
        SET project_team_id = NULL
        WHERE project_team_id IN (
            SELECT id FROM project_teams WHERE backfill_source = 'inference'
        )
    """
        )
    )

    # Delete project_team_members for backfilled teams
    conn.execute(
        text(
            """
        DELETE FROM project_team_members
        WHERE project_team_id IN (
            SELECT id FROM project_teams WHERE backfill_source = 'inference'
        )
    """
        )
    )

    # Delete backfilled project_teams
    conn.execute(
        text(
            """
        DELETE FROM project_teams
        WHERE backfill_source = 'inference'
    """
        )
    )
