# Migration Guide: Project-Specific Team Rosters

This guide explains how to migrate to the new project-specific team roster system.

## Overview

The new system introduces **project teams** (`project_teams`) and **project team members** (`project_team_members`) to replace the single `team_number` field on users. This enables:

- Historical team roster preservation
- Project-specific team assignments
- Roster locking when evaluations are active
- Version tracking for team changes

## Prerequisites

Before migrating:

1. **Backup your database** - This is critical!
   ```bash
   pg_dump your_database > backup_$(date +%Y%m%d).sql
   ```

2. **Stop the application** - Ensure no users are active during migration

3. **Verify PostgreSQL version** - Requires PostgreSQL 14+

## Migration Methods

### Method 1: Using Alembic (Recommended)

If you're using Python/Alembic for database migrations:

```bash
cd backend

# Verify current migration state
alembic current

# Show pending migrations
alembic history

# Run migrations
alembic upgrade head

# Verify successful migration
alembic current
# Should show: pt_20251208_02 (head)
```

### Method 2: Manual SQL Migration (Fallback)

If Alembic is not available or you prefer SQL:

1. **Navigate to SQL scripts**:
   ```bash
   cd backend/migrations/sql_fallback
   ```

2. **Review the README**:
   ```bash
   cat README.md
   ```

3. **Run migrations in order**:
   ```bash
   # Migration 1: Create tables
   psql -U your_user -d your_database -f 01_create_project_teams.sql
   
   # Migration 2: Backfill data
   psql -U your_user -d your_database -f 02_backfill_project_teams.sql
   ```

4. **Verify results**:
   ```sql
   -- Check tables created
   \dt project_teams
   \dt project_team_members
   
   -- Check backfilled data
   SELECT COUNT(*) FROM project_teams WHERE backfill_source = 'inference';
   SELECT COUNT(*) FROM project_team_members;
   
   -- Check foreign keys added
   SELECT COUNT(*) FROM evaluations WHERE project_team_id IS NOT NULL;
   SELECT COUNT(*) FROM project_assessments WHERE project_team_id IS NOT NULL;
   ```

## Post-Migration Steps

### 1. Verify Data Integrity

Run these SQL queries to verify the migration:

```sql
-- Verify all evaluations with projects have project_team_id
SELECT COUNT(*) 
FROM evaluations 
WHERE project_id IS NOT NULL 
  AND project_team_id IS NULL;
-- Should return 0

-- Verify project teams have members
SELECT pt.id, pt.display_name_at_time, COUNT(ptm.id) as member_count
FROM project_teams pt
LEFT JOIN project_team_members ptm ON pt.id = ptm.project_team_id
GROUP BY pt.id, pt.display_name_at_time
HAVING COUNT(ptm.id) = 0;
-- Empty result is good (all teams have members)

-- Check backfill statistics
SELECT 
    backfill_source,
    COUNT(*) as team_count,
    COUNT(DISTINCT project_id) as project_count
FROM project_teams
GROUP BY backfill_source;
```

### 2. Review Inferred Data

The migration marks auto-migrated data with `backfill_source = 'inference'`. Review this data:

```sql
-- Teams created by inference
SELECT 
    pt.id,
    pt.project_id,
    pt.display_name_at_time,
    COUNT(ptm.id) as member_count,
    pt.created_at
FROM project_teams pt
LEFT JOIN project_team_members ptm ON pt.id = ptm.project_team_id
WHERE pt.backfill_source = 'inference'
GROUP BY pt.id, pt.project_id, pt.display_name_at_time, pt.created_at
ORDER BY pt.created_at DESC;
```

### 3. Manual Corrections (If Needed)

If the inference is incorrect for some teams:

```sql
-- Example: Add missing member to a project team
INSERT INTO project_team_members (school_id, project_team_id, user_id, role)
VALUES (1, 123, 456, NULL);

-- Example: Update team display name
UPDATE project_teams 
SET display_name_at_time = 'Correct Team Name'
WHERE id = 123;
```

### 4. Update Application

After successful migration:

1. **Deploy new backend code** with project team support
2. **Update frontend** to use new project team APIs
3. **Restart application services**

### 5. Monitor

Watch for:
- Evaluation creation with project_team_id
- Team roster locking on evaluation close
- Error logs for any migration-related issues

## Rollback Procedure

If you need to rollback:

### Using Alembic

```bash
cd backend
alembic downgrade pt_20251208_01
```

### Using SQL

```sql
-- Remove backfilled references
UPDATE project_notes_contexts SET project_team_id = NULL 
WHERE project_team_id IN (SELECT id FROM project_teams WHERE backfill_source = 'inference');

UPDATE project_assessments SET project_team_id = NULL 
WHERE project_team_id IN (SELECT id FROM project_teams WHERE backfill_source = 'inference');

UPDATE evaluations SET project_team_id = NULL 
WHERE project_team_id IN (SELECT id FROM project_teams WHERE backfill_source = 'inference');

-- Delete backfilled data
DELETE FROM project_team_members WHERE project_team_id IN (
    SELECT id FROM project_teams WHERE backfill_source = 'inference'
);
DELETE FROM project_teams WHERE backfill_source = 'inference';

-- Optional: Full rollback (removes all project team data)
DROP TABLE IF EXISTS project_team_members CASCADE;
DROP TABLE IF EXISTS project_teams CASCADE;

ALTER TABLE evaluations DROP COLUMN IF EXISTS closed_at;
ALTER TABLE evaluations DROP COLUMN IF EXISTS project_team_id;

ALTER TABLE project_assessments DROP COLUMN IF EXISTS closed_at;
ALTER TABLE project_assessments DROP COLUMN IF EXISTS project_team_id;

ALTER TABLE project_notes_contexts DROP COLUMN IF EXISTS closed_at;
ALTER TABLE project_notes_contexts DROP COLUMN IF EXISTS status;
ALTER TABLE project_notes_contexts DROP COLUMN IF EXISTS project_team_id;
```

## Troubleshooting

### Issue: Migration fails with foreign key error

**Cause**: Referential integrity issues in existing data

**Solution**:
```sql
-- Find orphaned records
SELECT e.id, e.project_id 
FROM evaluations e 
LEFT JOIN projects p ON e.project_id = p.id
WHERE e.project_id IS NOT NULL AND p.id IS NULL;

-- Clean up or fix references
```

### Issue: No members backfilled for teams

**Cause**: No group_members existed for the original groups

**Solution**: Manually add members using the current student roster:
```sql
INSERT INTO project_team_members (school_id, project_team_id, user_id, role)
SELECT 
    pt.school_id,
    pt.id,
    u.id,
    NULL
FROM project_teams pt
CROSS JOIN users u
WHERE pt.id = [your_team_id]
  AND u.team_number = [your_team_number]
  AND u.school_id = pt.school_id;
```

### Issue: Performance degradation after migration

**Cause**: Missing indexes or large dataset

**Solution**: Verify indexes exist:
```sql
-- Check indexes
\di project_teams
\di project_team_members

-- If missing, create them (already in migration but check):
CREATE INDEX IF NOT EXISTS ix_project_team_project ON project_teams(project_id);
CREATE INDEX IF NOT EXISTS ix_project_team_member_project_team ON project_team_members(project_team_id);
```

## FAQ

**Q: Will this break existing evaluations?**  
A: No. The migration backfills project_team_id for all existing evaluations.

**Q: What happens to student.team_number?**  
A: It remains in the database for now but won't be used. It will be removed in a future release.

**Q: Can I still use Groups?**  
A: Yes. Groups still exist and project_teams can link to them via team_id.

**Q: How do I create teams for new projects?**  
A: Use the API endpoints or UI to create project teams. They can be created from scratch or cloned from previous projects.

**Q: What if backfill didn't work correctly?**  
A: Review the data using the SQL queries above. Manual corrections are safe to make.

## Support

For issues:
1. Check the troubleshooting section
2. Review logs for detailed error messages
3. Consult the ADR document: `docs/ADR-project-team-rosters.md`
4. Contact the development team

## Related Documentation

- [ADR: Project-Specific Team Rosters](../docs/ADR-project-team-rosters.md)
- [SQL Fallback README](../backend/migrations/sql_fallback/README.md)
- [API Documentation](http://localhost:8000/docs) (when running)
