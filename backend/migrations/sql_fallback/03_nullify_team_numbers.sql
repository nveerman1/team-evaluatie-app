-- SQL Fallback: Set team_number to NULL for users in project teams
-- Revision: pt_20251208_03
-- Run this AFTER 02_backfill_project_teams.sql

BEGIN;

-- Clear team_number for users who are now in project teams
WITH updated_users AS (
    UPDATE users
    SET team_number = NULL
    WHERE id IN (
        SELECT DISTINCT user_id 
        FROM project_team_members
    )
    AND team_number IS NOT NULL
    RETURNING id
)
SELECT count(*) as users_updated FROM updated_users;

COMMIT;

-- Verify nullification
SELECT 
    'Team numbers cleared' as status,
    (SELECT count(*) FROM users WHERE team_number IS NULL) as users_without_team_number,
    (SELECT count(*) FROM users WHERE team_number IS NOT NULL) as users_with_team_number,
    (SELECT count(DISTINCT user_id) FROM project_team_members) as users_in_project_teams;
