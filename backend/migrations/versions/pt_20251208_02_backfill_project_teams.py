"""Backfill project teams from existing evaluation data

This migration creates project_team records from existing evaluations,
assessments, and notes that reference projects but don't yet have project_team_id.

Logic:
- For each distinct (project_id, course_id) in evaluations/assessments/notes
- Create a project_team with display_name based on course/class name
- Infer members from students who participated in the evaluation
- Mark as backfill_source='inference' to indicate data quality

Revision ID: pt_20251208_02
Revises: pt_20251208_01
Create Date: 2025-12-08

"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = "pt_20251208_02"
down_revision: Union[str, None] = "pt_20251208_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Backfill project_teams and project_team_members from existing data
    
    Strategy:
    1. Find all evaluations with project_id but no project_team_id
    2. Group by (project_id, team_number) from student data
    3. Create project_teams for each unique combination
    4. Create project_team_members from students in those teams
    5. Update evaluations to link to the new project_teams
    """
    conn = op.get_bind()
    
    # ========== Backfill from evaluations with allocations ==========
    # This handles peer evaluations that have student allocations
    
    backfill_evaluations_sql = text("""
        WITH eval_teams AS (
            -- Find distinct (project_id, team_number) combinations from evaluations
            SELECT DISTINCT
                e.project_id,
                e.course_id,
                e.school_id,
                u.team_number,
                c.name as course_name,
                c.code as course_code
            FROM evaluations e
            JOIN allocations a ON a.evaluation_id = e.id
            JOIN users u ON u.id = a.reviewee_id
            WHERE e.project_id IS NOT NULL
              AND e.project_team_id IS NULL
              AND u.team_number IS NOT NULL
        ),
        inserted_teams AS (
            -- Create project_teams for each combination
            INSERT INTO project_teams (
                school_id,
                project_id,
                team_id,
                display_name_at_time,
                version,
                backfill_source,
                created_at,
                updated_at
            )
            SELECT DISTINCT
                et.school_id,
                et.project_id,
                NULL as team_id,
                COALESCE(et.course_code, et.course_name, 'Team') || ' - Team ' || et.team_number as display_name,
                1 as version,
                'inference' as backfill_source,
                now() as created_at,
                now() as updated_at
            FROM eval_teams et
            WHERE NOT EXISTS (
                -- Don't create duplicates
                SELECT 1 FROM project_teams pt
                WHERE pt.project_id = et.project_id
                  AND pt.backfill_source = 'inference'
                  AND pt.display_name_at_time LIKE '%Team ' || et.team_number
            )
            RETURNING id, project_id, school_id, display_name_at_time
        )
        SELECT count(*) FROM inserted_teams;
    """)
    
    result = conn.execute(backfill_evaluations_sql)
    teams_created = result.scalar() or 0
    print(f"Created {teams_created} project teams from evaluations")
    
    # ========== Backfill members from allocations ==========
    backfill_members_sql = text("""
        WITH team_mappings AS (
            -- Map project_team_id to team_number via display_name parsing
            SELECT 
                pt.id as project_team_id,
                pt.project_id,
                pt.school_id,
                CAST(substring(pt.display_name_at_time from 'Team ([0-9]+)') AS INTEGER) as team_number
            FROM project_teams pt
            WHERE pt.backfill_source = 'inference'
              AND pt.display_name_at_time LIKE '%Team %'
        ),
        student_teams AS (
            -- Find students who participated in evaluations for this project/team
            SELECT DISTINCT
                tm.project_team_id,
                tm.school_id,
                u.id as user_id,
                NULL as role
            FROM team_mappings tm
            JOIN evaluations e ON e.project_id = tm.project_id AND e.school_id = tm.school_id
            JOIN allocations a ON a.evaluation_id = e.id
            JOIN users u ON u.id = a.reviewee_id
            WHERE u.team_number = tm.team_number
              AND e.project_team_id IS NULL
        )
        INSERT INTO project_team_members (
            school_id,
            project_team_id,
            user_id,
            role,
            created_at,
            updated_at
        )
        SELECT DISTINCT
            st.school_id,
            st.project_team_id,
            st.user_id,
            st.role,
            now() as created_at,
            now() as updated_at
        FROM student_teams st
        WHERE NOT EXISTS (
            -- Don't create duplicates
            SELECT 1 FROM project_team_members ptm
            WHERE ptm.project_team_id = st.project_team_id
              AND ptm.user_id = st.user_id
        )
        RETURNING id;
    """)
    
    result = conn.execute(backfill_members_sql)
    members_created = result.rowcount or 0
    print(f"Created {members_created} project team members from allocations")
    
    # ========== Update evaluations to link to project_teams ==========
    update_evaluations_sql = text("""
        WITH team_mappings AS (
            SELECT 
                pt.id as project_team_id,
                pt.project_id,
                pt.school_id,
                CAST(substring(pt.display_name_at_time from 'Team ([0-9]+)') AS INTEGER) as team_number
            FROM project_teams pt
            WHERE pt.backfill_source = 'inference'
              AND pt.display_name_at_time LIKE '%Team %'
        ),
        eval_updates AS (
            SELECT DISTINCT
                e.id as evaluation_id,
                tm.project_team_id
            FROM evaluations e
            JOIN allocations a ON a.evaluation_id = e.id
            JOIN users u ON u.id = a.reviewee_id
            JOIN team_mappings tm ON tm.project_id = e.project_id 
                                  AND tm.school_id = e.school_id 
                                  AND tm.team_number = u.team_number
            WHERE e.project_id IS NOT NULL
              AND e.project_team_id IS NULL
              AND u.team_number IS NOT NULL
        )
        UPDATE evaluations e
        SET project_team_id = eu.project_team_id
        FROM eval_updates eu
        WHERE e.id = eu.evaluation_id
        RETURNING e.id;
    """)
    
    result = conn.execute(update_evaluations_sql)
    evals_updated = result.rowcount or 0
    print(f"Updated {evals_updated} evaluations with project_team_id")


def downgrade() -> None:
    """
    Remove backfilled data
    
    WARNING: This will delete inferred project teams and their members.
    Evaluations will lose their project_team_id references.
    """
    conn = op.get_bind()
    
    # Unlink evaluations from backfilled teams
    conn.execute(text("""
        UPDATE evaluations e
        SET project_team_id = NULL
        WHERE project_team_id IN (
            SELECT id FROM project_teams WHERE backfill_source = 'inference'
        )
    """))
    
    # Delete backfilled members (cascade will handle this, but explicit is clearer)
    conn.execute(text("""
        DELETE FROM project_team_members
        WHERE project_team_id IN (
            SELECT id FROM project_teams WHERE backfill_source = 'inference'
        )
    """))
    
    # Delete backfilled teams
    conn.execute(text("""
        DELETE FROM project_teams WHERE backfill_source = 'inference'
    """))
    
    print("Removed all backfilled project teams and members")
