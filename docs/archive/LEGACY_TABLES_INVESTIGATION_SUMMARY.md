# Legacy Tables Investigation Summary

**Date:** 2026-01-18  
**Issue:** Onderzoek wat nog gebruik maakt van de legacy tabellen (Group, GroupMember)  
**Status:** ✅ Investigation Complete

---

## Quick Summary

The legacy `groups` and `group_members` tables are **extensively used** throughout the codebase despite the modern `project_teams` architecture being available. Complete phase-out requires a **15-week, 6-phase migration** affecting ~50+ files across backend and frontend.

---

## Key Findings

### 1. Critical Dependencies (Blockers for Removal)

| Component | Issue | Impact |
|-----------|-------|--------|
| **ProjectAssessment** | `group_id` is required FK, `project_team_id` is optional | All project assessments depend on Group table |
| **RBAC (Authorization)** | Student course access via `GroupMember → Group → Course` | Core security logic uses legacy tables |
| **External Assessments** | Team roster queries use `GroupMember` | External evaluator system tied to groups |
| **API Endpoints** | 13+ routers query `Group`/`GroupMember` | Widespread backend dependency |
| **Frontend** | Full CRUD service for groups + multiple components | UI directly coupled to legacy APIs |

### 2. Usage Statistics

**Backend:**
- **15+ routers** use Group/GroupMember queries
- **~30+ files** with direct model references
- **~100+ queries** across the codebase

**Frontend:**
- **1 dedicated service** (`group.service.ts`)
- **3 DTO files** with group types
- **20+ components** reference group data

### 3. Recommended Migration Path

**Phase Breakdown:**

| Phase | Description | Duration | Risk |
|-------|-------------|----------|------|
| 1 | Establish CourseEnrollment as source of truth | 2 weeks | Medium |
| 2 | Migrate ProjectAssessment to project_team_id | 3 weeks | **High** |
| 3 | Update RBAC to use CourseEnrollment | 2 weeks | **High** |
| 4 | Refactor all API endpoints | 4 weeks | Medium |
| 5 | Deprecate frontend group APIs | 2 weeks | Low |
| 6 | Remove legacy tables & code | 1 week | Low |

**Total:** 14 weeks (3.5 months) + 1 week buffer

---

## Detailed Findings

### Backend API Endpoints Using group_id

| Router | Specific Usage |
|--------|----------------|
| `project_assessments.py` | All CRUD operations filter by `ProjectAssessment.group_id` |
| `external_assessments.py` | Team member queries via `GroupMember` joins |
| `external_management.py` | External advisory config via `GET /groups/{group_id}/external-advisory` |
| `students.py` | Aliases `Group as Team`, `GroupMember as TeamMember` |
| `courses.py` | Student enrollment queries via `GroupMember.active` filters |
| `evaluations.py` | Access control joins: `GroupMember.group_id == Group.id` |
| `project_notes.py` | Note author access via `GroupMember` for course students |
| `competencies.py` | Multiple `GroupMember` joins for student queries |
| `allocations.py` | Student selection via `GroupMember` for active course students |
| `grades.py` | Grade aggregation via `GroupMember.group_id == Group.id` |
| `dashboard.py` | User dashboard data via `GroupMember` for courses/groups |
| `overview.py` | Student overviews via `Group` and `GroupMember` |
| `admin_students.py` | Course/group queries via `GroupMember` |

### RBAC Dependencies

**File:** `backend/app/core/rbac.py`

**Current Implementation:**
```python
def can_access_course(db: Session, user: User, course_id: int) -> bool:
    # Students: Check via GroupMember → Group → Course
    member = db.query(GroupMember).join(Group).filter(
        GroupMember.user_id == user.id,
        Group.course_id == course_id,
        GroupMember.active == True
    ).first()
    return member is not None

def get_accessible_course_ids(db: Session, user: User) -> list[int]:
    # Students: Get all courses via GroupMember
    group_ids = [gm.group_id for gm in db.query(GroupMember).filter(...)]
    course_ids = [g.course_id for g in db.query(Group).filter(Group.id.in_(group_ids))]
    return course_ids
```

**Required Change:** Use `CourseEnrollment` table instead of `GroupMember` → `Group` chain.

### Frontend Dependencies

**Services:**
```typescript
// frontend/src/services/group.service.ts
export const groupService = {
  getGroups(courseId?: number): Promise<GroupDto[]>
  getGroup(groupId: number): Promise<GroupDto>
  createGroup(data: GroupCreateDto): Promise<GroupDto>
  updateGroup(groupId: number, data: GroupUpdateDto): Promise<GroupDto>
  deleteGroup(groupId: number): Promise<void>
  getGroupMembers(groupId: number): Promise<GroupMemberDto[]>
  addGroupMember(groupId: number, userId: number): Promise<GroupMemberDto>
  removeGroupMember(groupId: number, userId: number): Promise<void>
}
```

**DTOs:**
- `frontend/src/dtos/group.dto.ts` - Group, GroupMember, GroupCreate, GroupUpdate types
- `frontend/src/dtos/project-assessment.dto.ts` - All assessment types include `group_id` field
- `frontend/src/dtos/project.dto.ts` - WizardProjectAssessmentOut includes `group_id`

---

## Migration Complexity Assessment

### High Complexity (Requires Careful Planning)

1. **ProjectAssessment Model Refactoring**
   - Change required field from `group_id` to `project_team_id`
   - Backfill all existing assessments
   - Maintain dual-write during transition
   - Update all queries across 13+ routers

2. **RBAC Authorization Logic**
   - Core security function used by every protected endpoint
   - Must maintain perfect accuracy (no authorization bypasses)
   - Requires extensive testing

3. **External Assessment System**
   - Involves external users (opdrachtgevers) via tokens
   - Must not break existing invitations
   - Team roster queries need migration

### Medium Complexity

4. **API Endpoint Refactoring**
   - 13+ routers need query updates
   - Straightforward replacements: `GroupMember` → `CourseEnrollment` or `ProjectTeamMember`
   - Can be done incrementally

5. **Frontend Migration**
   - Replace group service with project-team service
   - Update DTOs and types
   - Refactor components to use new APIs

### Low Complexity

6. **Final Cleanup**
   - Remove models and tables
   - Remove deprecated endpoints
   - Update documentation

---

## Risk Analysis

### Critical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Authorization Bypass** | Medium | Critical | Extensive RBAC testing, security audit |
| **Data Loss** | Low | Critical | Full backups, dual-write pattern, verification scripts |
| **Breaking Changes** | High | High | Backward compatibility, feature flags, gradual rollout |
| **Performance Degradation** | Medium | Medium | Benchmark queries, add indexes, monitor metrics |

### Risk Mitigation Strategy

1. **Dual-Write Period**: Write to both old and new systems during Phases 2-4
2. **Feature Flags**: Toggle between old/new behavior without deployment
3. **Comprehensive Testing**: Unit, integration, E2E, and regression tests
4. **Gradual Rollout**: Deploy to staging → 10% prod → 100% prod
5. **Rollback Plan**: Each phase has documented rollback procedure
6. **Monitoring**: Track errors, performance, user complaints post-deployment

---

## Recommended Approach

### Option A: Full Migration (Recommended)

**Pros:**
- Removes technical debt completely
- Simplifies architecture (single team system)
- Improves maintainability
- Enables future features (versioned rosters, historical accuracy)

**Cons:**
- 15 weeks of engineering effort (~450 hours)
- High risk during Phases 2-3
- Requires careful coordination

**When:** Start in Q1 2026, complete by Q2 2026

### Option B: Hybrid Approach (Not Recommended)

Keep both systems indefinitely, document which to use when.

**Pros:**
- No migration effort
- No risk of breaking changes

**Cons:**
- Ongoing maintenance burden (2 systems)
- Developer confusion (which system to use?)
- Technical debt accumulation
- Blocks future improvements

### Option C: Postpone (Acceptable Short-Term)

Focus on other priorities, revisit in 6-12 months.

**Pros:**
- Allows focus on features
- More time to plan

**Cons:**
- Technical debt grows
- Migration becomes harder over time
- New features may add more dependencies

---

## Next Steps

### Immediate (This Week)

1. ✅ **Complete Investigation** - Document current state (done)
2. ✅ **Create Migration Plan** - Detailed phase-by-phase plan (done)
3. [ ] **Stakeholder Review** - Share findings with tech leads
4. [ ] **Go/No-Go Decision** - Decide on Option A, B, or C

### Short-Term (Next 2 Weeks)

If approved for Option A:

5. [ ] **Resource Allocation** - Assign 1-2 backend + 1 frontend engineer
6. [ ] **Create JIRA Epic** - Break down phases into tickets
7. [ ] **Phase 1 Kickoff** - Begin CourseEnrollment backfill

### Long-Term (Q1-Q2 2026)

8. [ ] Execute Phases 1-6 according to plan
9. [ ] Monitor and adjust timeline as needed
10. [ ] Celebrate technical debt reduction! 🎉

---

## Related Documents

- **Detailed Migration Plan:** `docs/LEGACY_TABLES_MIGRATION_PLAN.md` (this investigation's output)
- **Architecture Docs:** `docs/architecture.md`
- **ProjectTeam ADR:** `docs/PROJECT_TEAM_ROSTERS_ADR.md`
- **ProjectTeam Implementation:** `docs/PROJECT_TEAM_ROSTERS_IMPLEMENTATION.md`
- **Deprecation Plan:** `docs/DEPRECATION-team-number.md`

---

## Questions?

Contact the engineering team or see `LEGACY_TABLES_MIGRATION_PLAN.md` for detailed phase plans.
