# Phase 2 Implementation - ProjectAssessment Migration

**Date:** 2026-01-19  
**Status:** ✅ **IMPLEMENTATION COMPLETE** - Pending Testing & Deployment

---

## What Was Accomplished

Phase 2 has successfully migrated `ProjectAssessment` to use `project_team_id` as the primary foreign key, with `group_id` remaining as an optional legacy field for backward compatibility.

### Deliverables

1. ✅ **Database Schema Migration**
   - Created migration `pa_20260119_01_project_team_primary.py`
   - `project_team_id` is now NOT NULL (required)
   - `group_id` is now NULLABLE (optional/legacy)
   - Updated FK constraints (group_id changed from CASCADE to RESTRICT)
   - Added composite indexes for query performance
   - Added legacy group_id index for backward compatibility

2. ✅ **Backfill Script**
   - Created `backfill_project_assessment_teams.py`
   - Links existing ProjectAssessment records to ProjectTeam
   - Creates new ProjectTeam records where missing
   - Automatically creates ProjectTeamMember records
   - Supports dry-run and commit modes
   - Comprehensive error handling and reporting

3. ✅ **Model Updates**
   - Updated `ProjectAssessment` model in `models.py`
   - `project_team_id` is now required (Mapped[int])
   - `group_id` is now optional (Mapped[Optional[int]])
   - Added comments indicating Phase 2 migration status

4. ✅ **API Schema Updates**
   - `ProjectAssessmentCreate`: project_team_id is required, group_id is optional
   - `ProjectAssessmentOut`: reflects new field requirements
   - Maintains backward compatibility for clients still sending group_id

5. ✅ **API Endpoint Updates**
   - `create_project_assessment`: Uses project_team_id as primary, implements dual-write
   - `list_project_assessments`: Updated to filter by project_team_id primarily
   - Added `project_team_id` query parameter for filtering
   - Maintains `group_id` query parameter for backward compatibility
   - Updated response building to handle nullable group_id
   - Teachers now filtered by project teams instead of groups
   - Students filtered directly by their project team membership

6. ✅ **Tests**
   - Unit tests for backfill script (`test_project_assessment_backfill.py`)
   - Integration tests for API endpoints (`test_project_assessment_phase2_api.py`)
   - Tests cover:
     - Linking to existing ProjectTeam
     - Creating new ProjectTeam when missing
     - Dry-run mode
     - Skip already populated records
     - API create with project_team_id
     - API list filtering by both IDs
     - Backward compatibility

---

## Key Changes

### Dual-Write Pattern

All new assessments now write to **both** fields:
- `project_team_id` (primary, required)
- `group_id` (legacy, optional for backward compatibility)

If `group_id` is not provided, it's automatically populated from `project_team.team_id`.

### Query Pattern

Queries now use `project_team_id` as the primary filter, with `group_id` available for backward compatibility:

```python
# Filter by project_team_id (primary)
if project_team_id:
    stmt = stmt.where(ProjectAssessment.project_team_id == project_team_id)

# Filter by group_id (legacy fallback)
if group_id:
    stmt = stmt.where(ProjectAssessment.group_id == group_id)
```

### Access Control Updates

**Teachers:**
- Now filtered by project teams from their assigned courses
- More accurate than using groups

**Students:**
- Directly filtered by their project team membership
- Simpler and more efficient queries

---

## Migration Process

### For Fresh Installations

No migration needed! Fresh installations can immediately use the new schema:

1. Deploy with updated schema
2. Create assessments using `project_team_id`
3. `group_id` is automatically populated from `project_team.team_id`

### For Existing Installations

**Prerequisites:**
1. Ensure all ProjectTeam records are created (from Phase 1 or project setup)
2. Backup database before migration

**Steps:**

1. **Run Backfill Script (Dry-Run)**
   ```bash
   cd backend
   python scripts/backfill_project_assessment_teams.py
   ```
   Review the output to see what changes will be made.

2. **Run Backfill Script (Commit)**
   ```bash
   python scripts/backfill_project_assessment_teams.py --commit
   ```
   This populates `project_team_id` for all existing assessments.

3. **Apply Database Migration**
   ```bash
   alembic upgrade head
   ```
   This makes `project_team_id` NOT NULL and `group_id` NULLABLE.

4. **Verify Migration**
   Check that all assessments have `project_team_id` populated:
   ```sql
   SELECT COUNT(*) FROM project_assessments WHERE project_team_id IS NULL;
   -- Should return 0
   ```

---

## Testing

### Unit Tests

Run the backfill tests:
```bash
cd backend
pytest tests/test_project_assessment_backfill.py -v
```

### Integration Tests

Run the API tests:
```bash
pytest tests/test_project_assessment_phase2_api.py -v
```

### Full Test Suite

Run all tests to ensure no regressions:
```bash
pytest -v
```

---

## Impact Assessment

### Positive Impacts ✅

1. **Immutable Team References**: Assessments now reference frozen team rosters
2. **Historical Accuracy**: Team composition at assessment time is preserved
3. **Cleaner Architecture**: Primary FK is the modern ProjectTeam system
4. **Backward Compatible**: Existing code using group_id still works
5. **Better Access Control**: More accurate filtering for teachers and students

### API Changes ⚠️

1. **Breaking Change (Mitigated)**: `ProjectAssessmentCreate` now requires `project_team_id`
   - Mitigation: `group_id` still accepted for backward compatibility
   - Frontend needs update to send `project_team_id`

2. **New Query Parameter**: `project_team_id` added to list endpoint
   - Old `group_id` parameter still works

3. **Response Fields**: Both `project_team_id` and `group_id` in responses
   - Allows gradual migration of clients

### No Breaking Changes for ❌

- Assessments created before migration still work
- Queries by `group_id` still function
- All existing data preserved

---

## Next Steps

### Immediate (This Phase)

1. ✅ Create migration script
2. ✅ Create backfill script
3. ✅ Update models and schemas
4. ✅ Update API endpoints
5. ✅ Create tests
6. ⏳ **Run tests** (pending)
7. ⏳ **Code review** (pending)
8. ⏳ **Security scan** (pending)

### Future Phases

**Phase 3: Update RBAC to Use CourseEnrollment**
- Replace GroupMember queries with CourseEnrollment in authorization
- Update `can_access_course()` and related functions

**Phase 4: Refactor Other API Endpoints**
- Update external_assessments.py
- Update students.py
- Update courses.py
- And other endpoints using Group/GroupMember

**Phase 5: Deprecate Frontend Group APIs**
- Update frontend to use project-team APIs
- Mark group APIs as deprecated

**Phase 6: Remove Legacy Tables**
- Drop `group_id` column from ProjectAssessment
- Drop `groups` and `group_members` tables
- Remove all legacy code

---

## Known Issues / Limitations

1. **Frontend Not Updated**: Frontend still needs updates to send `project_team_id`
   - Current mitigation: API accepts both, auto-populates from legacy field

2. **Other Endpoints Not Updated**: Only project_assessments router updated
   - Other endpoints still use group_id queries
   - Will be addressed in Phase 4

3. **External Assessments**: May need similar migration
   - To be evaluated in Phase 4

---

## Files Changed

### Backend Scripts
- `backend/scripts/backfill_project_assessment_teams.py` - New backfill script

### Migrations
- `backend/migrations/versions/pa_20260119_01_project_team_primary.py` - Schema migration

### Models
- `backend/app/infra/db/models.py` - Updated ProjectAssessment model

### API
- `backend/app/api/v1/schemas/project_assessments.py` - Updated schemas
- `backend/app/api/v1/routers/project_assessments.py` - Updated endpoints

### Tests
- `backend/tests/test_project_assessment_backfill.py` - Backfill unit tests
- `backend/tests/test_project_assessment_phase2_api.py` - API integration tests

### Documentation
- `docs/PHASE_2_IMPLEMENTATION.md` - This file

---

## Questions or Issues?

For questions about Phase 2 implementation:
- See `docs/LEGACY_TABLES_MIGRATION_PLAN.md` for the overall plan
- See `docs/PHASE_1_COMPLETE.md` for Phase 1 context
- Check test files for usage examples

---

**Document Owner:** Engineering Team  
**Last Updated:** 2026-01-19  
**Related Docs:** 
- `LEGACY_TABLES_MIGRATION_PLAN.md` (overall plan)
- `PHASE_1_COMPLETE.md` (previous phase)
- `LEGACY_TABLES_README.md` (context)
