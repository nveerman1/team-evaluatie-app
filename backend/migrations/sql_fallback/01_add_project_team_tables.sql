-- SQL Fallback: Add project team tables and columns
-- Revision: pt_20251208_01
-- Run this if Alembic migration cannot be executed

BEGIN;

-- ========== Create project_teams table ==========
CREATE TABLE IF NOT EXISTS project_teams (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    display_name_at_time VARCHAR(200) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    backfill_source VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
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
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uq_project_team_member_once UNIQUE (project_team_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_project_team_members_id ON project_team_members(id);
CREATE INDEX IF NOT EXISTS ix_project_team_members_school_id ON project_team_members(school_id);
CREATE INDEX IF NOT EXISTS ix_project_team_member_project_team ON project_team_members(project_team_id);
CREATE INDEX IF NOT EXISTS ix_project_team_member_user ON project_team_members(user_id);
CREATE INDEX IF NOT EXISTS ix_project_team_member_composite ON project_team_members(project_team_id, user_id);

-- ========== Add columns to evaluations ==========
ALTER TABLE evaluations 
    ADD COLUMN IF NOT EXISTS project_team_id INTEGER REFERENCES project_teams(id) ON DELETE RESTRICT;

ALTER TABLE evaluations 
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS ix_eval_project_team ON evaluations(project_team_id);
CREATE INDEX IF NOT EXISTS ix_eval_status ON evaluations(status);
CREATE INDEX IF NOT EXISTS ix_eval_project_team_status ON evaluations(project_team_id, status);

-- ========== Add columns to project_assessments ==========
ALTER TABLE project_assessments 
    ADD COLUMN IF NOT EXISTS project_team_id INTEGER REFERENCES project_teams(id) ON DELETE RESTRICT;

ALTER TABLE project_assessments 
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS ix_project_assessment_project_team ON project_assessments(project_team_id);
CREATE INDEX IF NOT EXISTS ix_project_assessment_status ON project_assessments(status);
CREATE INDEX IF NOT EXISTS ix_project_assessment_project_team_status ON project_assessments(project_team_id, status);

-- ========== Add columns to project_notes_contexts ==========
ALTER TABLE project_notes_contexts 
    ADD COLUMN IF NOT EXISTS project_team_id INTEGER REFERENCES project_teams(id) ON DELETE RESTRICT;

ALTER TABLE project_notes_contexts 
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'draft';

ALTER TABLE project_notes_contexts 
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS ix_project_notes_context_project_team ON project_notes_contexts(project_team_id);
CREATE INDEX IF NOT EXISTS ix_project_notes_context_status ON project_notes_contexts(status);

COMMIT;

-- Verify tables were created
SELECT 'Tables created successfully' as status,
       (SELECT count(*) FROM information_schema.tables WHERE table_name = 'project_teams') as project_teams_exists,
       (SELECT count(*) FROM information_schema.tables WHERE table_name = 'project_team_members') as project_team_members_exists;
