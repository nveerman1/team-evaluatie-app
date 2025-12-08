-- SQL Fallback Migration: Create project_teams and project_team_members tables
-- This is a manual SQL version of pt_20251208_01_add_project_team_rosters.py
-- Run this if Alembic migrations cannot be used

-- ========== Create project_teams table ==========
CREATE TABLE IF NOT EXISTS project_teams (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    display_name_at_time VARCHAR(200) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    backfill_source VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_project_teams_id ON project_teams(id);
CREATE INDEX IF NOT EXISTS ix_project_teams_school_id ON project_teams(school_id);
CREATE INDEX IF NOT EXISTS ix_project_team_project ON project_teams(project_id);
CREATE INDEX IF NOT EXISTS ix_project_team_team ON project_teams(team_id);
CREATE INDEX IF NOT EXISTS ix_project_team_project_version ON project_teams(project_id, team_id, version);

-- ========== Create project_team_members table ==========
CREATE TABLE IF NOT EXISTS project_team_members (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL,
    project_team_id INTEGER NOT NULL REFERENCES project_teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_project_team_member_once UNIQUE (project_team_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_project_team_members_id ON project_team_members(id);
CREATE INDEX IF NOT EXISTS ix_project_team_members_school_id ON project_team_members(school_id);
CREATE INDEX IF NOT EXISTS ix_project_team_member_project_team ON project_team_members(project_team_id);
CREATE INDEX IF NOT EXISTS ix_project_team_member_user ON project_team_members(user_id);
CREATE INDEX IF NOT EXISTS ix_project_team_member_composite ON project_team_members(project_team_id, user_id);

-- ========== Add project_team_id and closed_at to evaluations ==========
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS project_team_id INTEGER REFERENCES project_teams(id) ON DELETE RESTRICT;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS ix_eval_project_team ON evaluations(project_team_id);
CREATE INDEX IF NOT EXISTS ix_eval_status ON evaluations(status);
CREATE INDEX IF NOT EXISTS ix_eval_project_team_status ON evaluations(project_team_id, status);

-- ========== Add project_team_id and closed_at to project_assessments ==========
ALTER TABLE project_assessments ADD COLUMN IF NOT EXISTS project_team_id INTEGER REFERENCES project_teams(id) ON DELETE RESTRICT;
ALTER TABLE project_assessments ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS ix_project_assessment_project_team ON project_assessments(project_team_id);
CREATE INDEX IF NOT EXISTS ix_project_assessment_status ON project_assessments(status);
CREATE INDEX IF NOT EXISTS ix_project_assessment_project_team_status ON project_assessments(project_team_id, status);

-- ========== Add project_team_id, status, and closed_at to project_notes_contexts ==========
ALTER TABLE project_notes_contexts ADD COLUMN IF NOT EXISTS project_team_id INTEGER REFERENCES project_teams(id) ON DELETE RESTRICT;
ALTER TABLE project_notes_contexts ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'draft';
ALTER TABLE project_notes_contexts ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS ix_project_notes_context_project_team ON project_notes_contexts(project_team_id);
CREATE INDEX IF NOT EXISTS ix_project_notes_context_status ON project_notes_contexts(status);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 01_create_project_teams.sql completed successfully';
END $$;
