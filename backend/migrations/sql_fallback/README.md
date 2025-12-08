# SQL Fallback Migrations for Project Team Rosters

These SQL scripts are fallback versions of the Alembic migrations for creating project-specific team rosters. Use these if you need to run migrations manually or if Alembic is not available.

## Prerequisites

- PostgreSQL database
- Sufficient privileges to create tables and modify schema
- Backup of your database (recommended)

## Migration Order

Run these scripts in order:

1. **01_create_project_teams.sql** - Creates the project_teams and project_team_members tables, adds foreign keys to existing tables
2. **02_backfill_project_teams.sql** - Backfills data from existing evaluations and assessments

## Running the Migrations

### Using psql

```bash
# Connect to your database
psql -U your_username -d your_database_name

# Run migration 1
\i backend/migrations/sql_fallback/01_create_project_teams.sql

# Run migration 2
\i backend/migrations/sql_fallback/02_backfill_project_teams.sql
```

### Using psql from command line

```bash
psql -U your_username -d your_database_name -f backend/migrations/sql_fallback/01_create_project_teams.sql
psql -U your_username -d your_database_name -f backend/migrations/sql_fallback/02_backfill_project_teams.sql
```

### Using DBeaver or other GUI tools

1. Connect to your database
2. Open the SQL script file
3. Execute the script
4. Check the console/messages for success confirmations

## Verification

After running the migrations, verify the results:

```sql
-- Check project_teams table exists and has data
SELECT COUNT(*) FROM project_teams;

-- Check project_team_members table exists and has data
SELECT COUNT(*) FROM project_team_members;

-- Check backfilled teams
SELECT COUNT(*) FROM project_teams WHERE backfill_source = 'inference';

-- Check evaluations now reference project_teams
SELECT COUNT(*) FROM evaluations WHERE project_team_id IS NOT NULL;

-- Check project_assessments now reference project_teams
SELECT COUNT(*) FROM project_assessments WHERE project_team_id IS NOT NULL;
```

## Rollback

If you need to rollback these changes:

```sql
-- Remove backfilled references
UPDATE project_notes_contexts SET project_team_id = NULL 
WHERE project_team_id IN (SELECT id FROM project_teams WHERE backfill_source = 'inference');

UPDATE project_assessments SET project_team_id = NULL 
WHERE project_team_id IN (SELECT id FROM project_teams WHERE backfill_source = 'inference');

UPDATE evaluations SET project_team_id = NULL 
WHERE project_team_id IN (SELECT id FROM project_teams WHERE backfill_source = 'inference');

-- Delete backfilled members and teams
DELETE FROM project_team_members WHERE project_team_id IN (
    SELECT id FROM project_teams WHERE backfill_source = 'inference'
);
DELETE FROM project_teams WHERE backfill_source = 'inference';

-- Remove columns and tables (only if you want complete rollback)
ALTER TABLE project_notes_contexts DROP COLUMN IF EXISTS closed_at;
ALTER TABLE project_notes_contexts DROP COLUMN IF EXISTS status;
ALTER TABLE project_notes_contexts DROP COLUMN IF EXISTS project_team_id;

ALTER TABLE project_assessments DROP COLUMN IF EXISTS closed_at;
ALTER TABLE project_assessments DROP COLUMN IF EXISTS project_team_id;

ALTER TABLE evaluations DROP COLUMN IF EXISTS closed_at;
ALTER TABLE evaluations DROP COLUMN IF EXISTS project_team_id;

DROP TABLE IF EXISTS project_team_members;
DROP TABLE IF EXISTS project_teams;
```

## Notes

- The `backfill_source = 'inference'` marker is used to identify automatically migrated data
- Teams created manually after the migration will not have this marker
- The backfill process is idempotent - running it multiple times will not create duplicates
- All timestamps preserve the original creation dates from source data

## Support

If you encounter issues:
1. Check the PostgreSQL error messages
2. Verify your database version is PostgreSQL 14+
3. Ensure you have the necessary permissions
4. Check that all prerequisite tables (users, projects, groups, etc.) exist
