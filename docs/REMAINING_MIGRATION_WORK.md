# Legacy Tables Migration - Remaining Work Plan

**Date:** 2026-01-19  
**Status:** 🟢 Phase 1 & 2 Complete - Updated Plan for Remaining Phases

---

## What's Been Completed

### ✅ Phase 1: CourseEnrollment Migration (COMPLETE)
- Migrated to use `course_enrollments` as sole source of truth for student-course relationships
- Removed all writes to `group_members` table
- Simplified API endpoints to use CourseEnrollment directly
- **Result:** Student enrollment no longer uses legacy Group/GroupMember tables

### ✅ Phase 2: ProjectAssessment Migration (COMPLETE - SIMPLIFIED)
- **Completely removed** `group_id` from ProjectAssessment model
- Uses `project_team_id` exclusively (no backward compatibility)
- All queries updated to use ProjectTeam/ProjectTeamMember
- Migration drops `group_id` column entirely
- **Result:** Project assessments now use modern immutable team architecture exclusively

### Impact of Simplified Approach

Since we're in local dev and removed `group_id` completely, we've **jumped ahead** and accomplished parts of what was originally planned for Phases 2-6:

- ✅ No dual-write complexity
- ✅ No backward compatibility burden  
- ✅ ProjectAssessment fully modernized
- ✅ ~700 lines of legacy code removed

---

## What Still Needs to Be Done

The legacy `groups` and `group_members` tables **still exist** and are **still being used** by other parts of the codebase. Here's what remains:

### 🔴 Phase 3: Update RBAC (Authorization Logic)

**Goal:** Replace GroupMember queries with CourseEnrollment in authorization functions

**Priority:** HIGH (affects all student access control)

#### What Needs Changing

**File:** `backend/app/core/rbac.py`

Currently, student course access is determined via GroupMember:
```python
def can_access_course(db: Session, user: User, course_id: int) -> bool:
    # Students check via GroupMember → Group → Course
    member = db.query(GroupMember).join(Group).filter(...).first()
    return member is not None
```

**Should be:**
```python
def can_access_course(db: Session, user: User, course_id: int) -> bool:
    # Students check via CourseEnrollment
    enrollment = db.query(CourseEnrollment).filter(
        CourseEnrollment.student_id == user.id,
        CourseEnrollment.course_id == course_id,
        CourseEnrollment.active == True
    ).first()
    return enrollment is not None
```

#### Tasks
- [ ] Update `can_access_course()` to use CourseEnrollment
- [ ] Update `get_accessible_course_ids()` to use CourseEnrollment
- [ ] Update any other RBAC helper functions
- [ ] Test authorization for all user roles
- [ ] Ensure no access control regressions

**Estimated Effort:** 1-2 weeks  
**Risk:** High (security-critical)

---

### 🟡 Phase 4: Migrate Remaining API Endpoints

**Goal:** Update all remaining endpoints that query Group/GroupMember tables

**Priority:** MEDIUM-HIGH

#### Endpoints Still Using Legacy Tables

Based on the original investigation, these endpoints still reference groups/group_members:

| Endpoint | File | Current Usage | Effort |
|----------|------|---------------|--------|
| External Assessments | `external_assessments.py` | Team roster via GroupMember | High |
| External Management | `external_management.py` | Advisory config via group_id | Medium |
| Evaluations | `evaluations.py` | Access control via GroupMember | Medium |
| Allocations | `allocations.py` | Student selection via GroupMember | Medium |
| Dashboard/Stats | Various | Team aggregations | Low |

#### Refactoring Strategy

**Option 1: Use CourseEnrollment** (when team context not needed)
```python
# Get all students in a course
students = db.query(User).join(CourseEnrollment).filter(
    CourseEnrollment.course_id == course_id,
    CourseEnrollment.active == True
).all()
```

**Option 2: Use ProjectTeam** (when team context needed)
```python
# Get team members for a project
team_members = db.query(ProjectTeamMember).filter(
    ProjectTeamMember.project_team_id == project_team_id
).all()
```

**Key Question:** What if we need "current team assignments" outside project context?
- Groups represented mutable "current" teams in a course
- ProjectTeams are immutable per-project snapshots
- **Solution:** accept that teams only exist in project context

#### Tasks
- [ ] Audit each endpoint to understand what data it needs
- [ ] Decide on replacement strategy (CourseEnrollment vs ProjectTeam vs new approach)
- [ ] Refactor endpoints one by one
- [ ] Update tests for each endpoint
- [ ] Verify frontend still works with changes

**Estimated Effort:** 3-4 weeks  
**Risk:** Medium (requires careful design decisions)

---

### 🟢 Phase 5: Drop Legacy Tables

**Goal:** Completely remove groups and group_members tables from database

**Priority:** LOW (can happen last)

⚠️ **ONLY proceed after ALL code stops using these tables**

#### Pre-Removal Checklist
- [ ] Phases 3 & 4 complete
- [ ] No queries to groups/group_members in logs
- [ ] All tests passing
- [ ] Database backup created

#### Removal Steps

1. **Drop Foreign Keys**
   ```python
   # Migration: drop_legacy_group_tables.py
   def upgrade():
       # Drop any remaining FKs referencing groups
       op.drop_constraint('project_team_external_group_id_fkey', 'project_team_externals')
       # etc.
   ```

2. **Drop Tables**
   ```python
   def upgrade():
       op.drop_table('group_members')
       op.drop_table('groups')
   ```

3. **Remove Model Definitions**
   - Delete `Group` class from `models.py`
   - Delete `GroupMember` class from `models.py`

4. **Clean Up Imports**
   - Remove Group/GroupMember imports from all files

#### Tasks
- [ ] Create migration to drop tables
- [ ] Remove model definitions
- [ ] Clean up imports across codebase
- [ ] Update documentation
- [ ] Final test suite run

**Estimated Effort:** 1 week  
**Risk:** Low (just cleanup at this point)

---

## Summary of Remaining Work

### Timeline Estimate

| Phase | Description | Duration | Dependencies |
|-------|-------------|----------|--------------|
| Phase 3 | RBAC Updates | 1-2 weeks | None |
| Phase 4 | API Endpoints | 3-4 weeks | Phase 3 recommended |
| Phase 5 | Drop Tables | 1 week | Phases 3 & 4 complete |
| **Total** | **Remaining Work** | **5-7 weeks** | |

### Effort Comparison

- **Original Plan:** 15 weeks (Phases 0-6)
- **Completed:** ~2 weeks (Phases 1-2, simplified)
- **Remaining:** 5-7 weeks (Phases 3-5)
- **Saved:** ~6 weeks (by simplifying Phase 2)

---

## Key Design Decisions Needed

### Decision 1: Mutable Teams Outside Projects

**Problem:** Groups represented mutable team assignments in a course. ProjectTeams are immutable per-project. What if we need mutable teams outside project context?

**Options:**
1. **Accept project-only teams** - Teams only exist within projects
2. **Create CourseTe am model** - New table for mutable course-level teams
3. **Repurpose Groups differently** - Keep groups but for different purpose
4. **Use alternative grouping** - Ad-hoc grouping when needed

**Recommendation:** Start with Option 1 (project-only teams) since that's what the architecture doc suggests. Only add CourseTeam if specific use case emerges.

### Decision 2: External Assessment Team Assignment

**Problem:** External assessments currently use `group_id` to assign advisory teams. With no groups, how do we assign teams?

**Options:**
1. **Use ProjectTeam** - Assign external assessments to project teams
2. **Direct student assignment** - Skip team concept, assign individual students
3. **Create AssessmentTeam** - New lightweight team concept for assessments

**Recommendation:** Use ProjectTeam (Option 1) since external assessments are typically project-related anyway.

---

## Next Steps

### Immediate (This Week)
1. Review this plan with stakeholders
2. Make design decisions on key questions above
3. Start Phase 3 (RBAC updates)

### Short Term (Next 2 weeks)
1. Complete Phase 3 (RBAC)
2. Begin Phase 4 (API endpoints)
3. Test thoroughly at each step

### Medium Term (Next 1-2 months)
1. Complete Phase 4 (all endpoints migrated)
2. Monitor logs to verify no legacy table usage
3. Execute Phase 5 (drop tables)

---

## Success Criteria

✅ **Phase 3 Complete** when:
- All RBAC functions use CourseEnrollment
- No GroupMember queries in authorization logic
- All tests passing with no access control regressions

✅ **Phase 4 Complete** when:
- All API endpoints refactored
- No queries to group_members table in application code
- Frontend works correctly with all changes
- Full test suite passing

✅ **Phase 5 Complete** when:
- groups and group_members tables dropped from database
- No references to Group/GroupMember models in code
- All tests passing
- Documentation updated

✅ **Migration Fully Complete** when:
- All phases done
- Production running successfully with new architecture
- Legacy code completely removed
- Team velocity back to normal

---

## Questions or Concerns?

**For Phase 3:**
- Which RBAC functions exist beyond `can_access_course()`?
- Are there any edge cases in authorization we should test?

**For Phase 4:**
- Do we need mutable team assignments outside project context?
- How should external assessments assign teams?
- Should we create new team models or reuse ProjectTeam?

**For Phase 5:**
- Any other tables with FKs to groups/group_members?
- Should we keep models for historical data access?

---

**Document Owner:** Engineering Team  
**Last Updated:** 2026-01-19  
**Related Documents:**
- `LEGACY_TABLES_MIGRATION_PLAN.md` (original full plan)
- `PHASE_1_COMPLETE.md`
- `PHASE_2_COMPLETE_SIMPLIFIED.md`
