# Phase 2 Complete - Simplified Migration (No group_id)

**Date:** 2026-01-19  
**Status:** ✅ **COMPLETE - SIMPLIFIED**

---

## Executive Summary

Phase 2 is **complete** with a **simplified implementation**. Since the repository is in local development with no production data, we completely removed `group_id` from `ProjectAssessment` instead of keeping it for backward compatibility. This results in a cleaner, simpler codebase that uses `project_team_id` exclusively.

### What Changed

- **Database Schema**: `group_id` column completely removed, `project_team_id` is the only FK
- **API Schemas**: Only `project_team_id` required, no `group_id` field
- **API Endpoints**: Simplified queries using `project_team_id` only
- **No Backward Compatibility**: Clean break from legacy architecture

### Benefits

✅ **Simpler**: No dual-write complexity  
✅ **Cleaner**: Single source of truth  
✅ **Modern**: Uses immutable team architecture from start  
✅ **Direct**: Skips gradual migration, jumps to end state

---

## Deliverables

| Item | Status | Description |
|------|--------|-------------|
| Database Migration | ✅ Complete | Drops `group_id` column entirely |
| Model Updates | ✅ Complete | Only `project_team_id` field |
| API Schema Updates | ✅ Complete | No `group_id` references |
| API Endpoint Updates | ✅ Complete | Simplified queries |
| Integration Tests | ✅ Complete | project_team_id-only tests |
| Documentation | ✅ Complete | This document |

**Not Needed:**
- ~~Backfill script~~ (no data to migrate)
- ~~Dual-write pattern~~ (no backward compatibility needed)
- ~~Legacy support~~ (fresh start)

---

## Migration Steps for Local Dev

### Prerequisites
- Local development environment only
- OK to lose all existing data
- No production data to preserve

### Step-by-Step

1. **Apply Database Migration**
   ```bash
   cd backend
   alembic upgrade head
   ```
   This drops the `group_id` column and makes `project_team_id` required.

2. **Restart Application**
   ```bash
   # Restart your dev server
   ```

3. **Done!**
   No backfill needed since we're starting fresh.

### Rollback (If Needed)

```bash
alembic downgrade -1
```

Note: Rollback will recreate the `group_id` column but it will be empty.

---

## Technical Changes

### Schema Changes

**Before (Original):**
```python
group_id: Mapped[int] = mapped_column(
    ForeignKey("groups.id", ondelete="CASCADE"), 
    nullable=False
)
project_team_id: Mapped[Optional[int]] = mapped_column(
    ForeignKey("project_teams.id", ondelete="RESTRICT"),
    nullable=True
)
```

**After (Simplified):**
```python
project_team_id: Mapped[int] = mapped_column(
    ForeignKey("project_teams.id", ondelete="RESTRICT"),
    nullable=False
)
# group_id removed completely
```

### API Changes

**Before (Original):**
```python
class ProjectAssessmentCreate(BaseModel):
    group_id: int  # Required
    rubric_id: int
    ...
```

**After (Simplified):**
```python
class ProjectAssessmentCreate(BaseModel):
    project_team_id: int  # Required - only FK
    rubric_id: int
    ...
```

### Migration SQL (Summary)

```sql
-- Drop foreign key constraint
ALTER TABLE project_assessments 
  DROP CONSTRAINT project_assessments_group_id_fkey;

-- Drop the column
ALTER TABLE project_assessments 
  DROP COLUMN group_id;

-- Make project_team_id NOT NULL
ALTER TABLE project_assessments 
  ALTER COLUMN project_team_id SET NOT NULL;

-- Add index
CREATE INDEX ix_project_assessments_team_project 
  ON project_assessments (project_team_id, project_id);
```

---

## Code Simplifications

### Removed Complexity

1. **No Dual-Write**
   - Old: Write to both `group_id` and `project_team_id`
   - New: Write only to `project_team_id`

2. **No Fallback Logic**
   - Old: Query by `project_team_id` with `group_id` fallback
   - New: Query only by `project_team_id`

3. **No Backfill**
   - Old: Complex backfill script to populate `project_team_id`
   - New: No backfill needed (fresh start)

4. **No Backward Compatibility**
   - Old: Support both old and new clients
   - New: All clients use new schema

### Simpler Queries

**Before:**
```python
# Complex: dual-read with fallback
if project_team_id:
    stmt = stmt.where(ProjectAssessment.project_team_id == project_team_id)
if group_id:  # Legacy fallback
    stmt = stmt.where(ProjectAssessment.group_id == group_id)
```

**After:**
```python
# Simple: single source of truth
if project_team_id:
    stmt = stmt.where(ProjectAssessment.project_team_id == project_team_id)
```

---

## Testing Summary

### Integration Tests

✅ **API Endpoint Tests** (`test_project_assessment_phase2_api.py`)
- Create assessment with project_team_id
- List by project_team_id
- Response includes project_team_id
- No group_id references

**Removed Tests:**
- ~~Backfill script tests~~ (not needed)
- ~~Dual-write tests~~ (not needed)
- ~~Backward compatibility tests~~ (not needed)

---

## Comparison with Original Plan

### Original Plan (Phase 2 + Phase 6)

Was going to take **6 phases** over ~15 weeks:
- Phase 2: Make project_team_id primary, keep group_id optional
- Phase 3-5: Gradually migrate other parts
- Phase 6: Finally remove group_id

### Simplified Approach (This PR)

Done in **1 phase** immediately:
- ✅ Removed group_id entirely
- ✅ Use project_team_id exclusively
- ✅ Clean architecture from start

**Time Saved:** ~14 weeks  
**Complexity Removed:** Dual-write, backfill, backward compat

---

## What's Next

### Frontend Updates (Required)

Frontend must be updated to use `project_team_id`:

1. Update assessment creation to send `project_team_id`
2. Update list queries to filter by `project_team_id`
3. Remove any `group_id` references

### Phase 3: Update RBAC (Next)

The next phase is to update RBAC to use `CourseEnrollment` instead of `GroupMember`:
- Update `can_access_course()` function
- Update `get_accessible_course_ids()` function
- This is already **90% done** from Phase 1

### Other Endpoints (Phase 4)

Other API endpoints still use Groups/GroupMembers:
- external_assessments.py
- students.py
- evaluations.py
- etc.

These can be migrated gradually or all at once depending on requirements.

---

## Key Decisions

### Why Remove group_id Completely?

**User confirmed:**
- Local development only
- OK to lose all data
- Want clean architecture

**Benefits:**
- Simpler implementation
- No technical debt
- Jump directly to end goal
- Easier to maintain

### Why Skip Backfill?

Since we're in local dev with no data to preserve, there's nothing to backfill. Fresh installations start with the new schema directly.

---

## Files Changed

### Simplified Implementation
- `backend/app/infra/db/models.py` - Removed group_id field
- `backend/app/api/v1/schemas/project_assessments.py` - Removed group_id from schemas
- `backend/app/api/v1/routers/project_assessments.py` - Simplified queries
- `backend/migrations/versions/pa_20260119_01_project_team_primary.py` - Drops group_id column

### Removed Files
- ~~`backend/scripts/backfill_project_assessment_teams.py`~~ (not needed)
- ~~`backend/tests/test_project_assessment_backfill.py`~~ (not needed)

### Updated Tests
- `backend/tests/test_project_assessment_phase2_api.py` - Simplified tests

---

## Support & Questions

**For Migration Issues:**
- Check that ProjectTeam records exist before creating assessments
- Ensure frontend is updated to send `project_team_id`

**For Development:**
- Use `project_team_id` exclusively
- No `group_id` field exists
- All queries filter by `project_team_id`

---

**Document Owner:** Engineering Team  
**Last Updated:** 2026-01-19  
**Version:** 2.0 (Simplified)  
**Related Documents:**
- `LEGACY_TABLES_MIGRATION_PLAN.md`
- `PHASE_1_COMPLETE.md`
