# SQL Fallback Migration Files

These SQL files provide a fallback method to execute migrations if the Alembic migration tool cannot be used or encounters issues.

## When to Use

Use these SQL files when:
- Alembic is not available or installed
- Migration tool detection fails
- You need to manually apply migrations to a database
- Debugging or testing migrations in isolation

## Files

### 01_add_project_team_tables.sql
**Purpose**: Creates the base project team infrastructure
- Creates `project_teams` table
- Creates `project_team_members` table  
- Adds `project_team_id` FK to evaluations, assessments, and notes
- Adds `closed_at` timestamp columns
- Adds `status` field to project_notes_contexts
- Creates all necessary indices

**Prerequisites**: None (this is the first migration)

### 02_backfill_project_teams.sql
**Purpose**: Backfills project team data from existing records
- Infers project teams from evaluation data and student team_numbers
- Creates project_team_members from allocation history
- Links existing evaluations to newly created project teams
- Marks backfilled data with `backfill_source='inference'`

**Prerequisites**: 01_add_project_team_tables.sql must be run first

### 03_nullify_team_numbers.sql
**Purpose**: Phases out the legacy team_number field
- Sets `users.team_number` to NULL for students now in project teams
- Signals transition to project-specific roster system
- Keeps column for backward compatibility

**Prerequisites**: 02_backfill_project_teams.sql must be run first

## Execution Instructions

### Using psql

```bash
# Connect to your database
psql -h localhost -U your_username -d team_evaluatie_db

# Run migrations in order
\i backend/migrations/sql_fallback/01_add_project_team_tables.sql
\i backend/migrations/sql_fallback/02_backfill_project_teams.sql
\i backend/migrations/sql_fallback/03_nullify_team_numbers.sql
```

### Using psql from command line

```bash
# Run each file in sequence
psql -h localhost -U your_username -d team_evaluatie_db -f backend/migrations/sql_fallback/01_add_project_team_tables.sql
psql -h localhost -U your_username -d team_evaluatie_db -f backend/migrations/sql_fallback/02_backfill_project_teams.sql
psql -h localhost -U your_username -d team_evaluatie_db -f backend/migrations/sql_fallback/03_nullify_team_numbers.sql
```

### Using pgAdmin or other GUI tools

1. Open each SQL file
2. Connect to your database
3. Execute files in numerical order (01, 02, 03)
4. Verify output for success messages

## Verification

Each migration includes verification queries at the end that show:
- Tables created
- Rows affected
- Data integrity checks

Review these outputs to confirm successful execution.

## Rollback

These migrations use standard SQL with IF NOT EXISTS clauses where appropriate, making them idempotent for the most part. However, they do not include automatic rollback procedures.

If you need to rollback:
1. The corresponding Alembic migration files have `downgrade()` functions
2. You can manually reverse changes (see Alembic migration code for reference)
3. Restore from a backup if needed

## Support

For issues with these migrations:
1. Check that prerequisites are met
2. Verify database connection and permissions
3. Review error messages carefully
4. Consult Alembic migration files in `migrations/versions/` for reference
5. Contact the development team

## Notes

- All migrations are wrapped in transactions (BEGIN/COMMIT)
- Idempotent where possible (IF NOT EXISTS, IF NOT EXISTS)
- Include verification queries
- Safe to re-run if they failed partway through
