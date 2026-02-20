# Seed Script Testing Guide

## Prerequisites

1. **PostgreSQL Database Running**
   ```bash
   cd /home/runner/work/team-evaluatie-app/team-evaluatie-app
   make up  # or: docker compose -f ops/docker/compose.dev.yml up -d
   ```

2. **Python Dependencies Installed**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. **Database Migrations Applied**
   ```bash
   cd backend
   alembic upgrade head
   ```

## Testing Steps

### 1. Run Demo Seed with Reset

This is the primary test - run the seed script with full reset:

```bash
cd backend
python -m scripts.seed --mode demo --reset --seed 42
```

**Expected Output:**
- ✓ Database reset complete
- ✓ All sections complete without errors:
  - Creating Classes
  - Creating Students
  - Creating Course
  - Creating Projects
  - Creating Project Teams
  - Creating Rubrics
  - Creating Evaluations
  - Creating Reflections
  - Creating Project Assessments
  - Creating Competency Windows
  - Creating Learning Objectives
  - Creating Clients
  - Creating RFID Cards & Attendance
- ✓ Final summary with entity counts

**Common Errors to Watch For:**
- ❌ `TypeError: 'X' is an invalid keyword argument for Y` → Field mismatch (should be fixed)
- ❌ `IntegrityError: NOT NULL constraint failed` → Missing required field (should be fixed)
- ❌ `IntegrityError: FOREIGN KEY constraint failed` → Invalid FK reference (should be fixed)

### 2. Run Smoke Test

After successful seeding, verify data integrity:

```bash
cd backend
python scripts/seed_smoke_test.py
```

**Expected Output:**
- ✓ All entity count checks pass (26+ users, 24 students, 3 projects, etc.)
- ✓ All unique constraints respected
- ✓ All critical business rules satisfied
- ⚠ Some warnings are OK (e.g., students not in course, evaluations without allocations)

### 3. Spot Check Database

Manually verify a few key records:

```sql
-- Connect to database
psql -h localhost -U postgres team_evaluatie_app

-- Check school exists
SELECT id, name FROM schools;

-- Check students have proper class names
SELECT id, email, name, class_name FROM users WHERE role = 'student' LIMIT 5;

-- Check project teams have members
SELECT pt.id, pt.team_number, pt.display_name_at_time, COUNT(ptm.id) as member_count
FROM project_teams pt
LEFT JOIN project_team_members ptm ON pt.id = ptm.project_team_id
GROUP BY pt.id, pt.team_number, pt.display_name_at_time
ORDER BY pt.id;

-- Check rubric criteria have correct field names (order not order_index)
SELECT id, rubric_id, name, "order", weight FROM rubric_criteria;

-- Check reflections use 'text' not 'content'
SELECT id, evaluation_id, user_id, LENGTH(text) as text_length, word_count
FROM reflections;

-- Check competency scores use correct FK names
SELECT cs.id, cs.window_id, cs.user_id, cs.competency_id, cs.score
FROM competency_self_scores cs
LIMIT 5;
```

### 4. Test Base Seed (Idempotent)

Base seed should be idempotent - can run multiple times:

```bash
cd backend
python -m scripts.seed --mode base
python -m scripts.seed --mode base  # Run again, should not create duplicates
```

**Expected:**
- No errors on second run
- Entity counts unchanged (use smoke test to verify)

### 5. Test Different Random Seeds

Verify deterministic behavior with different seeds:

```bash
cd backend
python -m scripts.seed --mode demo --reset --seed 100
python scripts/seed_smoke_test.py

python -m scripts.seed --mode demo --reset --seed 200
python scripts/seed_smoke_test.py
```

Both should complete successfully with same entity counts.

## Troubleshooting

### Issue: Import Errors

```
ModuleNotFoundError: No module named 'sqlalchemy'
```

**Fix:** Install dependencies
```bash
cd backend
pip install -r requirements.txt
```

### Issue: Database Connection Failed

```
connection to server at "localhost" (127.0.0.1), port 5432 failed
```

**Fix:** Start PostgreSQL
```bash
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app
make up
# Wait 10 seconds for DB to start
```

### Issue: Invalid Keyword Argument

```
TypeError: 'field_name' is an invalid keyword argument for Model
```

**This should not happen** - if it does:
1. Check which model and field are mentioned
2. Verify the field exists in `backend/app/infra/db/models.py`
3. The `create_instance()` helper should have filtered it out
4. Report as a bug - may need to adjust the fix

### Issue: IntegrityError (NOT NULL)

```
sqlalchemy.exc.IntegrityError: ... NOT NULL constraint failed: table.column
```

**This should not happen** - if it does:
1. Check which table/column failed
2. Verify the seed script sets that field
3. May need to add the field with a default value

### Issue: IntegrityError (FOREIGN KEY)

```
sqlalchemy.exc.IntegrityError: ... FOREIGN KEY constraint failed
```

**This should not happen** - if it does:
1. Check which FK constraint failed
2. Verify parent record exists before creating child
3. Verify correct ID is being used (e.g., `user_id` not `student_id`)

## Success Criteria

The seed script is working correctly when:

1. ✅ Demo seed with `--reset` completes without errors
2. ✅ Smoke test passes all checks
3. ✅ All expected entities are created (24 students, 3 projects, 6 teams, etc.)
4. ✅ No TypeErrors about invalid keyword arguments
5. ✅ No IntegrityErrors about NULL or FK constraints
6. ✅ Database can be queried and data looks correct
7. ✅ Base seed is idempotent (can run multiple times)

## Performance

Expected runtime:
- Base seed: ~2 seconds
- Demo seed (with reset): ~10-15 seconds
- Smoke test: ~2 seconds

If much slower, may indicate:
- Database performance issues
- Network latency to database
- Too many individual commits (batch commits where possible)

## Files Modified in This Fix

1. `backend/app/db/seed_utils.py` - Added `create_instance()` helper
2. `backend/scripts/seed.py` - Fixed all field mismatches
3. `backend/scripts/seed_smoke_test.py` - Removed Group/GroupMember references
4. `SEED_FIXES_SUMMARY.md` - Detailed change documentation
5. `SEED_TESTING_GUIDE.md` - This file

## Additional Resources

- **Seed Script Source:** `backend/scripts/seed.py`
- **Model Definitions:** `backend/app/infra/db/models.py`
- **Seed Utils:** `backend/app/db/seed_utils.py`
- **Smoke Test:** `backend/scripts/seed_smoke_test.py`
- **Database Schema:** Check Alembic migrations in `backend/migrations/versions/`
