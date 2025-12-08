-- SQL Fallback: Backfill project teams from existing data
-- Revision: pt_20251208_02
-- Run this AFTER 01_add_project_team_tables.sql

BEGIN;

-- ========== Create project_teams from evaluations ==========
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
    LEFT JOIN courses c ON c.id = e.course_id
    WHERE e.project_id IS NOT NULL
      AND e.project_team_id IS NULL
      AND u.team_number IS NOT NULL
),
inserted_teams AS (
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
        SELECT 1 FROM project_teams pt
        WHERE pt.project_id = et.project_id
          AND pt.backfill_source = 'inference'
          AND pt.display_name_at_time LIKE '%Team ' || et.team_number
    )
    RETURNING id, project_id, school_id, display_name_at_time
)
SELECT count(*) as teams_created FROM inserted_teams;

-- ========== Create project_team_members from allocations ==========
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
student_teams AS (
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
),
inserted_members AS (
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
        SELECT 1 FROM project_team_members ptm
        WHERE ptm.project_team_id = st.project_team_id
          AND ptm.user_id = st.user_id
    )
    RETURNING id
)
SELECT count(*) as members_created FROM inserted_members;

-- ========== Link evaluations to project_teams ==========
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
),
updated_evals AS (
    UPDATE evaluations e
    SET project_team_id = eu.project_team_id
    FROM eval_updates eu
    WHERE e.id = eu.evaluation_id
    RETURNING e.id
)
SELECT count(*) as evaluations_updated FROM updated_evals;

COMMIT;

-- Verify backfill
SELECT 
    'Backfill completed' as status,
    (SELECT count(*) FROM project_teams WHERE backfill_source = 'inference') as inferred_teams,
    (SELECT count(*) FROM project_team_members) as total_members,
    (SELECT count(*) FROM evaluations WHERE project_team_id IS NOT NULL) as evaluations_with_teams;
