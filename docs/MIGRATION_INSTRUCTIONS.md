# Migration Instructions: Project-Specific Team Rosters

## Overview
This document provides step-by-step instructions for migrating to the project-specific team roster system.

## Prerequisites
- PostgreSQL 14+
- Python 3.11+
- Alembic (if using Python migrations)
- Database backup (recommended)

## Migration Steps

### Step 1: Backup Database
```bash
# Create a backup before running migrations
pg_dump -h localhost -U your_username -d team_evaluatie_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Choose Migration Method

#### Option A: Using Alembic (Recommended)
```bash
cd backend

# Check current migration status
alembic current

# Run migrations
alembic upgrade head

# Expected output:
# - pt_20251208_01: Creates tables and adds columns
# - pt_20251208_02: Backfills historical data
# - pt_20251208_03: Nullifies deprecated team_number fields
```

#### Option B: Using SQL Fallback
If Alembic is unavailable, use the SQL fallback files:

```bash
cd backend/migrations/sql_fallback

# Run migrations in order
psql -h localhost -U your_username -d team_evaluatie_db -f 01_add_project_team_tables.sql
psql -h localhost -U your_username -d team_evaluatie_db -f 02_backfill_project_teams.sql
psql -h localhost -U your_username -d team_evaluatie_db -f 03_nullify_team_numbers.sql
```

See `backend/migrations/sql_fallback/README.md` for detailed SQL migration instructions.

### Step 3: Verify Migration

```sql
-- Connect to your database
psql -h localhost -U your_username -d team_evaluatie_db

-- Verify tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('project_teams', 'project_team_members');

-- Check backfill statistics
SELECT 
    (SELECT count(*) FROM project_teams) as total_teams,
    (SELECT count(*) FROM project_teams WHERE backfill_source = 'inference') as inferred_teams,
    (SELECT count(*) FROM project_team_members) as total_members,
    (SELECT count(*) FROM evaluations WHERE project_team_id IS NOT NULL) as evaluations_with_teams;

-- Verify team_number nullification
SELECT 
    (SELECT count(*) FROM users WHERE team_number IS NULL) as users_without_team_number,
    (SELECT count(*) FROM users WHERE team_number IS NOT NULL) as users_with_team_number,
    (SELECT count(DISTINCT user_id) FROM project_team_members) as users_in_project_teams;
```

Expected results:
- `project_teams` and `project_team_members` tables exist
- Inferred teams marked with `backfill_source='inference'`
- Evaluations linked to project teams where possible
- User team_number set to NULL for users in project teams

### Step 4: Review Backfilled Data

Check data quality of backfilled project teams:

```sql
-- Find teams that were inferred vs. explicitly backfilled
SELECT 
    pt.id,
    pt.display_name_at_time,
    pt.backfill_source,
    pt.version,
    COUNT(ptm.id) as member_count
FROM project_teams pt
LEFT JOIN project_team_members ptm ON ptm.project_team_id = pt.id
WHERE pt.backfill_source IS NOT NULL
GROUP BY pt.id, pt.display_name_at_time, pt.backfill_source, pt.version
ORDER BY pt.created_at DESC;

-- Check for evaluations without project teams (should be minimal)
SELECT COUNT(*) as evaluations_without_teams
FROM evaluations
WHERE project_id IS NOT NULL AND project_team_id IS NULL;
```

### Step 5: Update Application

No application restarts are required for the database changes, but:

1. **Backend**: Already includes the necessary code changes
2. **Frontend**: Deploy updated frontend with project team management UI

```bash
# Backend - no restart needed, models are compatible
# Frontend - rebuild and deploy
cd frontend
npm run build
# Deploy according to your process
```

## Post-Migration Validation

### Test Evaluation Creation
1. Log in as a teacher
2. Navigate to create new evaluation
3. Select a project
4. Verify project_team_id is required
5. Create evaluation successfully

### Test Team Management
1. Navigate to Class Teams page
2. Select a project
3. View project teams
4. Create new project team
5. Add members to team
6. Create evaluation using that team
7. Verify team becomes locked (read-only)

### Test Historical Evaluations
1. Open an old evaluation (created before migration)
2. Verify it shows the correct team roster from time of creation
3. Check that team members are frozen (read-only)

## Rollback Procedure

If you need to rollback:

### Using Alembic
```bash
cd backend

# Rollback one migration at a time
alembic downgrade -1  # Rollback team_number nullification
alembic downgrade -1  # Rollback backfill
alembic downgrade -1  # Rollback table creation
```

### Using SQL
```sql
-- WARNING: This will delete all project team data
BEGIN;

-- Remove backfilled data first
UPDATE evaluations SET project_team_id = NULL WHERE project_team_id IS NOT NULL;
UPDATE project_assessments SET project_team_id = NULL WHERE project_team_id IS NOT NULL;
UPDATE project_notes_contexts SET project_team_id = NULL WHERE project_team_id IS NOT NULL;

-- Delete project team data
DELETE FROM project_team_members;
DELETE FROM project_teams;

-- Restore team_number if you have a backup
-- (Or rely on users re-entering team assignments)

COMMIT;
```

## Troubleshooting

### Issue: Migration fails during backfill
**Solution**: Check logs for specific errors. Common causes:
- Orphaned evaluation records (no valid students)
- Data integrity issues (missing courses, etc.)
- Insufficient database permissions

### Issue: Some evaluations don't have project_team_id
**Workaround**: These are likely evaluations without project_id. They don't need project teams.
```sql
-- Verify these are project-less evaluations
SELECT id, title, project_id, course_id 
FROM evaluations 
WHERE project_team_id IS NULL;
```

### Issue: Frontend can't create evaluations
**Cause**: Frontend not passing `project_team_id` when required
**Solution**: Ensure frontend is updated and project team is selected before creating evaluation

### Issue: Can't modify team members
**Cause**: Team is locked due to existing evaluations
**Solution**: This is expected behavior. Create a new team version:
```sql
-- Check if team is locked
SELECT 
    pt.id,
    pt.display_name_at_time,
    (SELECT count(*) FROM evaluations WHERE project_team_id = pt.id) as eval_count
FROM project_teams pt
WHERE pt.id = YOUR_TEAM_ID;

-- If locked, create new version via API or manually
```

## Performance Considerations

The migrations add indices for optimal query performance:

```sql
-- Check index usage after migration
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as times_used
FROM pg_stat_user_indexes
WHERE tablename IN ('project_teams', 'project_team_members', 'evaluations', 'project_assessments')
ORDER BY idx_scan DESC;
```

If you have a large database (>100K evaluations), consider:
- Running migrations during low-traffic hours
- Monitoring database CPU/memory during backfill
- Creating indices manually first for faster inserts

## Support

For issues or questions:
1. Check the ADR: `docs/PROJECT_TEAM_ROSTERS_ADR.md`
2. Review implementation details: `docs/PROJECT_TEAM_ROSTERS_IMPLEMENTATION.md`
3. Examine migration code: `backend/migrations/versions/pt_20251208_*.py`
4. Contact development team

## Verification Checklist

After migration, verify:
- [ ] `project_teams` table exists and contains data
- [ ] `project_team_members` table exists and contains data
- [ ] Evaluations with projects have `project_team_id` set
- [ ] Project assessments with projects have `project_team_id` set
- [ ] Users in project teams have `team_number = NULL`
- [ ] Historical evaluations display correct frozen rosters
- [ ] New evaluations require `project_team_id` when `project_id` provided
- [ ] Close evaluation endpoint works and locks teams
- [ ] Frontend can create and manage project teams
- [ ] CSV import/export works with project team members
- [ ] Performance is acceptable (query times < 100ms)
