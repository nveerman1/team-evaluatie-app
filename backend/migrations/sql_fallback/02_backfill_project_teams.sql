-- SQL Fallback Migration: Backfill project_teams and project_team_members
-- This is a manual SQL version of pt_20251208_02_backfill_project_teams.py
-- Run this AFTER running 01_create_project_teams.sql

-- ===== Step 1: Backfill from evaluations =====
INSERT INTO project_teams (school_id, project_id, team_id, display_name_at_time, version, backfill_source, created_at, updated_at)
SELECT DISTINCT
    e.school_id,
    e.project_id,
    NULL as team_id,
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
ON CONFLICT DO NOTHING;

-- ===== Step 2: Backfill from project_assessments =====
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
ON CONFLICT DO NOTHING;

-- ===== Step 3: Populate project_team_members from group_members =====
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
ON CONFLICT DO NOTHING;

-- ===== Step 4: Update evaluations to reference project_team_id =====
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
    );

-- ===== Step 5: Update project_assessments to reference project_team_id =====
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
    );

-- ===== Step 6: Update project_notes_contexts to reference project_team_id =====
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
    );

-- Success message
DO $$
DECLARE
    teams_count INTEGER;
    members_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO teams_count FROM project_teams WHERE backfill_source = 'inference';
    SELECT COUNT(*) INTO members_count FROM project_team_members ptm
        INNER JOIN project_teams pt ON ptm.project_team_id = pt.id
        WHERE pt.backfill_source = 'inference';
    
    RAISE NOTICE 'Migration 02_backfill_project_teams.sql completed successfully';
    RAISE NOTICE 'Created % project teams and % team members', teams_count, members_count;
END $$;
