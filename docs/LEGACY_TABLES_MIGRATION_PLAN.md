# Legacy Tables Migration Plan: Phasing Out Group and GroupMember

**Status:** 🟡 In Progress  
**Created:** 2026-01-18  
**Priority:** High (Technical Debt Reduction)

## Executive Summary

The codebase currently operates with **two parallel team management systems**:
1. **Legacy System**: `Group` and `GroupMember` tables (mutable, course-scoped)
2. **Modern System**: `ProjectTeam` and `ProjectTeamMember` tables (immutable, project-scoped)

According to `docs/architecture.md`, the legacy system should be phased out. However, investigation reveals that the legacy tables are **deeply embedded** and serve as the primary system for:
- Project assessments (via `ProjectAssessment.group_id`)
- Student course access control (RBAC via `GroupMember`)
- External assessment team configuration
- Multiple API endpoints and frontend features

**This document provides a comprehensive, phased plan to complete the migration to ProjectTeam architecture.**

---

## Current State Analysis

### Tables to be Phased Out

#### `groups` Table
- **Purpose**: Represents mutable teams within a course
- **Key Fields**: `id`, `school_id`, `course_id`, `name`, `team_number`
- **Relationships**: Has many `GroupMember`, referenced by `ProjectAssessment`

#### `group_members` Table
- **Purpose**: Links students to groups with active status
- **Key Fields**: `id`, `school_id`, `group_id`, `user_id`, `role_in_team`, `active`
- **Unique Constraint**: `(group_id, user_id)`

### Replacement Tables (Already Implemented)

#### `project_teams` Table
- **Purpose**: Immutable snapshots of team composition per project
- **Key Fields**: `id`, `school_id`, `project_id`, `team_id` (optional legacy link), `team_number`, `version`
- **Benefits**: Historical accuracy, project isolation, versioning

#### `project_team_members` Table
- **Purpose**: Immutable student membership in project teams
- **Key Fields**: `id`, `school_id`, `project_team_id`, `user_id`, `role`
- **Benefits**: Frozen rosters for evaluations

---

## Critical Dependencies

### 1. ProjectAssessment Model (HIGHEST PRIORITY)

**File:** `backend/app/infra/db/models.py` (lines 840-842)

```python
class ProjectAssessment(Base):
    # ...
    group_id: Mapped[int] = mapped_column(
        ForeignKey("groups.id", ondelete="RESTRICT"), index=True
    )
    project_team_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("project_teams.id", ondelete="SET NULL"), nullable=True, index=True
    )
```

**Issue**: `group_id` is required, `project_team_id` is optional. Should be reversed.

**Impact**: All project assessment CRUD operations depend on group_id.

### 2. RBAC Student Access Control

**File:** `backend/app/core/rbac.py`

```python
def can_access_course(db: Session, user: User, course_id: int) -> bool:
    # Students: check GroupMember → Group → Course relationship
    member = db.query(GroupMember).join(Group).filter(...).first()
```

**Issue**: Student course access determined entirely via `GroupMember`.

**Impact**: Core authorization logic for students.

### 3. API Endpoints Using group_id

**Critical Endpoints:**
- `project_assessments.py` - All CRUD operations filter by `group_id`
- `external_assessments.py` - Team roster queries use `GroupMember`
- `external_management.py` - External advisory config via `group_id`
- `students.py` - Aliases `Group as Team`, `GroupMember as TeamMember`
- `courses.py` - Student enrollment queries via `GroupMember`
- `evaluations.py` - Access control via `GroupMember` joins
- `allocations.py` - Student selection via `GroupMember`

**See Full List:** [Section 2 of Investigation Summary](#2-api-endpoints-using-group_id)

### 4. Frontend Dependencies

**Files:**
- `frontend/src/services/group.service.ts` - Full CRUD service
- `frontend/src/dtos/group.dto.ts` - Type definitions
- Multiple components use `group_id` in DTOs

---

## Migration Strategy

### Guiding Principles

1. **Zero Downtime**: All changes must maintain backward compatibility
2. **Incremental**: Phase changes to allow testing and rollback
3. **Data Preservation**: Existing data must be migrated, not deleted
4. **Dual-Write Period**: Write to both systems during transition
5. **Feature Flags**: Use flags to toggle between old/new behavior

### Phase Overview

| Phase | Description | Duration | Risk |
|-------|-------------|----------|------|
| **0** | Investigation & Planning | ✅ Complete | Low |
| **1** | Establish CourseEnrollment as Source of Truth | 2 weeks | Medium |
| **2** | Migrate ProjectAssessment to project_team_id | 3 weeks | High |
| **3** | Update RBAC to Use CourseEnrollment | 2 weeks | High |
| **4** | Refactor API Endpoints | 4 weeks | Medium |
| **5** | Deprecate Frontend Group APIs | 2 weeks | Low |
| **6** | Remove Legacy Tables & Code | 1 week | Low |

**Total Estimated Duration:** 14 weeks

---

## Detailed Phase Plans

### Phase 1: Establish CourseEnrollment as Source of Truth

**Goal:** Make `course_enrollments` table the authoritative source for student-course relationships.

#### 1.1 Verify CourseEnrollment Coverage
- [ ] Audit all students to ensure they have CourseEnrollment records
- [ ] Identify students only in GroupMember but not in CourseEnrollment
- [ ] Create migration script to backfill missing CourseEnrollment records from GroupMember

#### 1.2 Create CourseEnrollment Backfill Script
```python
# backend/scripts/backfill_course_enrollments.py
def backfill_from_group_members():
    """
    For each active GroupMember record:
    1. Get group.course_id
    2. Create CourseEnrollment(course_id, student_id, active=True)
    3. Skip if already exists
    """
```

#### 1.3 Add Database Constraints
- [ ] Add unique constraint: `(course_id, student_id)` on course_enrollments (if not exists)
- [ ] Add index: `(course_id, active)` for performance

#### 1.4 Update Student Creation Flow
- [ ] Ensure all new students get CourseEnrollment records
- [ ] Update admin student import to create enrollments
- [ ] Test student creation via UI

**Deliverables:**
- ✅ `backfill_course_enrollments.py` script
- ✅ Database migration for constraints/indexes
- ✅ Verification report showing 100% coverage

---

### Phase 2: Migrate ProjectAssessment to project_team_id

**Goal:** Make `project_team_id` the primary FK, make `group_id` optional/legacy.

#### 2.1 Database Schema Changes

**Migration:** `backend/migrations/versions/pa_20260119_01_project_team_primary.py`

```python
def upgrade():
    # 1. Make project_team_id NOT NULL (after backfill)
    # 2. Make group_id NULLABLE (legacy field)
    # 3. Update FK constraints
    # 4. Add indexes
    
def downgrade():
    # Reverse changes (requires dual-write still active)
```

#### 2.2 Create ProjectAssessment Backfill Script

```python
# backend/scripts/backfill_project_assessment_teams.py
def backfill_project_team_ids():
    """
    For each ProjectAssessment with group_id but no project_team_id:
    1. Find ProjectTeam with team_id == assessment.group_id
    2. If exists: Set assessment.project_team_id
    3. If not: Create ProjectTeam from Group (with backfill_source='migration')
    4. Verify all members are in ProjectTeamMember
    """
```

#### 2.3 Implement Dual-Write Pattern

**During Transition:**
- When creating ProjectAssessment: Write to **both** `group_id` AND `project_team_id`
- When updating teams: Update **both** Group/GroupMember AND ProjectTeam/ProjectTeamMember
- When querying: Read from `project_team_id` (primary), fallback to `group_id` (legacy)

**Code Example:**
```python
class ProjectAssessmentService:
    def create_assessment(self, ..., group_id: Optional[int], project_team_id: int):
        # New: project_team_id is required
        # Old: group_id is optional (for backward compat)
        assessment = ProjectAssessment(
            project_team_id=project_team_id,  # Primary
            group_id=group_id,  # Legacy (will be removed in Phase 6)
            ...
        )
```

#### 2.4 Update Queries in project_assessments.py

**Before:**
```python
assessments = db.query(ProjectAssessment).filter(
    ProjectAssessment.group_id == group_id
).all()
```

**After (with fallback):**
```python
assessments = db.query(ProjectAssessment).filter(
    sa.or_(
        ProjectAssessment.project_team_id == project_team_id,
        ProjectAssessment.group_id == group_id  # Legacy fallback
    )
).all()
```

**Final (after Phase 6):**
```python
assessments = db.query(ProjectAssessment).filter(
    ProjectAssessment.project_team_id == project_team_id
).all()
```

#### 2.5 Update API Schemas

**File:** `backend/app/api/v1/schemas/project_assessments.py`

```python
class ProjectAssessmentCreate(BaseModel):
    project_team_id: int  # Required
    group_id: Optional[int] = None  # Deprecated, for backward compat
    # ...

class ProjectAssessmentOut(BaseModel):
    project_team_id: int
    group_id: Optional[int]  # Will be removed in Phase 6
    # ...
```

#### 2.6 Testing
- [ ] Unit tests: Create assessment with project_team_id
- [ ] Unit tests: Query assessments by project_team_id
- [ ] Integration tests: Full assessment lifecycle
- [ ] Verify dual-write: Both fields populated correctly
- [ ] Performance tests: Query speed with new indexes

**Deliverables:**
- ✅ Migration script
- ✅ Backfill script with verification
- ✅ Updated model and schemas
- ✅ Updated API endpoints with dual-write
- ✅ Test suite with >90% coverage

---

### Phase 3: Update RBAC to Use CourseEnrollment

**Goal:** Replace `GroupMember` queries with `CourseEnrollment` in authorization logic.

#### 3.1 Update can_access_course()

**File:** `backend/app/core/rbac.py`

**Before:**
```python
def can_access_course(db: Session, user: User, course_id: int) -> bool:
    if user.role in ["admin", "teacher"]:
        # Teachers check via teacher_courses
        return db.query(TeacherCourse).filter(...).first() is not None
    else:
        # Students check via GroupMember → Group → Course
        member = db.query(GroupMember).join(Group).filter(
            GroupMember.user_id == user.id,
            Group.course_id == course_id,
            GroupMember.active == True
        ).first()
        return member is not None
```

**After:**
```python
def can_access_course(db: Session, user: User, course_id: int) -> bool:
    if user.role in ["admin", "teacher"]:
        return db.query(TeacherCourse).filter(...).first() is not None
    else:
        # Students check via CourseEnrollment
        enrollment = db.query(CourseEnrollment).filter(
            CourseEnrollment.student_id == user.id,
            CourseEnrollment.course_id == course_id,
            CourseEnrollment.active == True
        ).first()
        return enrollment is not None
```

#### 3.2 Update get_accessible_course_ids()

**Before:**
```python
def get_accessible_course_ids(db: Session, user: User) -> list[int]:
    if user.role == "student":
        group_ids = [gm.group_id for gm in db.query(GroupMember).filter(...)]
        course_ids = [g.course_id for g in db.query(Group).filter(Group.id.in_(group_ids))]
        return course_ids
```

**After:**
```python
def get_accessible_course_ids(db: Session, user: User) -> list[int]:
    if user.role == "student":
        enrollments = db.query(CourseEnrollment).filter(
            CourseEnrollment.student_id == user.id,
            CourseEnrollment.active == True
        ).all()
        return [e.course_id for e in enrollments]
```

#### 3.3 Testing
- [ ] Unit tests: Admin access (should work as before)
- [ ] Unit tests: Teacher access via TeacherCourse
- [ ] Unit tests: Student access via CourseEnrollment
- [ ] Integration tests: Course filtering in API endpoints
- [ ] Regression tests: Verify no access control regressions

**Deliverables:**
- ✅ Updated RBAC functions
- ✅ Test suite covering all roles
- ✅ Documentation update

---

### Phase 4: Refactor API Endpoints

**Goal:** Migrate all API endpoints from `GroupMember` to `ProjectTeamMember` or `CourseEnrollment`.

#### 4.1 Priority Order

| Priority | Router | Effort | Risk |
|----------|--------|--------|------|
| **P0** | project_assessments.py | High | High |
| **P0** | external_assessments.py | High | High |
| **P1** | students.py | Medium | Medium |
| **P1** | courses.py | Medium | Low |
| **P2** | evaluations.py | Medium | Medium |
| **P2** | allocations.py | Medium | Medium |
| **P3** | All others | Low-Medium | Low |

#### 4.2 Refactoring Pattern

**Example: students.py**

**Before:**
```python
@router.get("/courses/{course_id}/students")
def get_course_students(course_id: int, db: Session):
    students = db.query(User).join(GroupMember).join(Group).filter(
        Group.course_id == course_id,
        GroupMember.active == True
    ).all()
    return students
```

**After:**
```python
@router.get("/courses/{course_id}/students")
def get_course_students(course_id: int, db: Session):
    students = db.query(User).join(CourseEnrollment).filter(
        CourseEnrollment.course_id == course_id,
        CourseEnrollment.active == True
    ).all()
    return students
```

#### 4.3 Handle Team Roster Queries

For endpoints that need team composition:

**Before:**
```python
team_members = db.query(GroupMember).filter(
    GroupMember.group_id == group_id
).all()
```

**After:**
```python
# Option 1: Use ProjectTeamMember if project context exists
team_members = db.query(ProjectTeamMember).filter(
    ProjectTeamMember.project_team_id == project_team_id
).all()

# Option 2: Use CourseEnrollment if team context not relevant
students = db.query(User).join(CourseEnrollment).filter(
    CourseEnrollment.course_id == course_id,
    CourseEnrollment.active == True
).all()
```

#### 4.4 Endpoint-by-Endpoint Plan

**detailed_plan.md** will contain specific refactoring steps for each endpoint.

#### 4.5 Testing Strategy
- [ ] Create integration test suite for each endpoint
- [ ] Test with both old and new data (dual-write period)
- [ ] Performance benchmarks (ensure no regression)
- [ ] Frontend integration tests (E2E)

**Deliverables:**
- ✅ Refactored endpoints (all P0, P1, P2)
- ✅ Comprehensive test coverage
- ✅ Performance benchmarks
- ✅ API documentation updates

---

### Phase 5: Deprecate Frontend Group APIs

**Goal:** Update frontend to use project-team APIs, mark group APIs as deprecated.

#### 5.1 Add Deprecation Warnings

**Backend:**
```python
# backend/app/api/v1/routers/groups.py (if exists)
@router.get("/groups", deprecated=True)
async def list_groups(...):
    """
    DEPRECATED: Use /project-teams instead.
    This endpoint will be removed in version 3.0.
    """
    warnings.warn("group API is deprecated", DeprecationWarning)
    # ... existing logic
```

#### 5.2 Update Frontend Services

**Create New Service:**
```typescript
// frontend/src/services/project-team.service.ts
export const projectTeamService = {
  getTeamsForProject: (projectId: number) => 
    api.get(`/project-teams/projects/${projectId}/teams`),
  getTeamMembers: (projectTeamId: number) =>
    api.get(`/project-teams/${projectTeamId}/members`),
  // ...
}
```

**Mark Old Service as Deprecated:**
```typescript
// frontend/src/services/group.service.ts
/**
 * @deprecated Use projectTeamService instead
 */
export const groupService = {
  // ... existing methods
}
```

#### 5.3 Update Frontend Components

**Priority Components:**
1. Project assessment creation/editing
2. Team management UI
3. Student dashboards
4. Teacher course views

**Refactoring Example:**
```typescript
// Before
const { data: groups } = useQuery(['groups', courseId], 
  () => groupService.getGroups(courseId)
);

// After
const { data: teams } = useQuery(['project-teams', projectId],
  () => projectTeamService.getTeamsForProject(projectId)
);
```

#### 5.4 Update DTOs

**Create New DTOs:**
```typescript
// frontend/src/dtos/project-team.dto.ts
export interface ProjectTeamDto {
  id: number;
  project_id: number;
  team_number: number;
  display_name_at_time: string;
  is_locked: boolean;
  members: ProjectTeamMemberDto[];
}

export interface ProjectTeamMemberDto {
  id: number;
  user_id: number;
  role?: string;
  user_name: string;
  user_email: string;
}
```

#### 5.5 Testing
- [ ] Unit tests for new services
- [ ] Integration tests with backend
- [ ] E2E tests for critical user flows
- [ ] Visual regression tests (if applicable)

**Deliverables:**
- ✅ Deprecated backend endpoints with warnings
- ✅ New frontend services and DTOs
- ✅ Migrated components to use new APIs
- ✅ Test coverage >85%

---

### Phase 6: Remove Legacy Tables & Code

**Goal:** Completely remove Group, GroupMember tables and all related code.

⚠️ **CRITICAL:** Only proceed after:
1. All frontend uses project-team APIs
2. All backend endpoints refactored
3. All data migrated and verified
4. Production running with new system for ≥30 days without issues

#### 6.1 Pre-Removal Checklist

- [ ] Verify ZERO queries to groups/group_members tables (check logs)
- [ ] Run full test suite (100% passing)
- [ ] Backup production database
- [ ] Prepare rollback plan
- [ ] Schedule maintenance window

#### 6.2 Code Removal Steps

1. **Remove Model Definitions**
   - Delete `Group` class from `models.py`
   - Delete `GroupMember` class from `models.py`

2. **Remove API Endpoints**
   - Delete `backend/app/api/v1/routers/groups.py` (if exists)
   - Remove group-related endpoints from other routers

3. **Remove Frontend Code**
   - Delete `frontend/src/services/group.service.ts`
   - Delete `frontend/src/dtos/group.dto.ts`
   - Remove group-related components

4. **Remove Foreign Keys**
   - Drop `ProjectAssessment.group_id` column
   - Drop `ProjectTeamExternal.group_id` column
   - Drop `ProjectNote.team_id` column (if refers to group_id)

5. **Drop Tables**
```sql
-- Migration: pa_20260XXX_drop_legacy_tables.py
def upgrade():
    op.drop_table('group_members')
    op.drop_table('groups')
```

#### 6.3 Update Documentation

- [ ] Update `docs/architecture.md` - Remove legacy table documentation
- [ ] Update API documentation - Remove group endpoints
- [ ] Update CHANGELOG.md - Note breaking changes
- [ ] Update migration guides

#### 6.4 Post-Removal Verification

- [ ] Run full test suite
- [ ] Deploy to staging
- [ ] Smoke tests on staging
- [ ] Monitor staging for 3 days
- [ ] Deploy to production
- [ ] Monitor production for 7 days

**Deliverables:**
- ✅ Removed code and tables
- ✅ Updated documentation
- ✅ Verified production stability

---

## Risk Management

### High-Risk Areas

| Risk | Mitigation |
|------|------------|
| **Data Loss** | Full backups before each phase; dual-write during transition |
| **Authorization Bypass** | Extensive RBAC testing; security audit before Phase 3 deployment |
| **Performance Degradation** | Benchmark queries; add indexes proactively; monitor production metrics |
| **Breaking Changes** | Feature flags; gradual rollout; backward compatibility during transition |

### Rollback Strategy

Each phase must have a rollback plan:

**Phase 1-3:** Keep dual-write active, can revert code without data loss  
**Phase 4:** Feature flags allow instant rollback to old endpoints  
**Phase 5:** Old APIs still functional, can revert frontend  
**Phase 6:** Database backup allows restoration (requires maintenance window)

---

## Success Metrics

### Technical Metrics
- [ ] Zero references to Group/GroupMember in codebase (except migrations)
- [ ] All tests passing (>95% coverage)
- [ ] Query performance ≤5% slower than baseline
- [ ] Zero authorization bugs reported

### Business Metrics
- [ ] No user-facing errors related to migration
- [ ] No increase in support tickets
- [ ] All features working as before (functional parity)

---

## Timeline & Resource Allocation

**Team:** 1-2 Backend Engineers + 1 Frontend Engineer + 1 QA Engineer

| Phase | Weeks | Start Date | End Date | Engineer Hours |
|-------|-------|------------|----------|----------------|
| 0 | 1 | Week 1 | Week 1 | 20h |
| 1 | 2 | Week 2 | Week 3 | 60h |
| 2 | 3 | Week 4 | Week 6 | 100h |
| 3 | 2 | Week 7 | Week 8 | 60h |
| 4 | 4 | Week 9 | Week 12 | 120h |
| 5 | 2 | Week 13 | Week 14 | 60h |
| 6 | 1 | Week 15 | Week 15 | 30h |
| **Total** | **15** | - | - | **450h** |

**Estimated Calendar Time:** ~4 months (with buffer)

---

## Appendix

### A. Current Group/GroupMember Usage Summary

**Backend Files with Group/GroupMember References:**
- `backend/app/infra/db/models.py` - Model definitions
- `backend/app/core/rbac.py` - Authorization logic
- `backend/app/api/v1/routers/project_assessments.py`
- `backend/app/api/v1/routers/external_assessments.py`
- `backend/app/api/v1/routers/external_management.py`
- `backend/app/api/v1/routers/students.py`
- `backend/app/api/v1/routers/courses.py`
- `backend/app/api/v1/routers/evaluations.py`
- `backend/app/api/v1/routers/allocations.py`
- `backend/app/api/v1/routers/project_notes.py`
- `backend/app/api/v1/routers/competencies.py`
- `backend/app/api/v1/routers/dashboard.py`
- `backend/app/api/v1/routers/grades.py`
- `backend/app/api/v1/routers/overview.py`
- `backend/app/infra/services/project_team_service.py`

**Frontend Files:**
- `frontend/src/services/group.service.ts`
- `frontend/src/dtos/group.dto.ts`
- `frontend/src/dtos/project-assessment.dto.ts`
- Multiple component files

**Total Estimate:** ~50+ files with direct references

### B. Related Documentation

- `docs/architecture.md` - Architecture overview
- `docs/DEPRECATION-team-number.md` - User.team_number deprecation
- `docs/PROJECT_TEAM_ROSTERS_IMPLEMENTATION.md` - ProjectTeam implementation
- `docs/PROJECT_TEAM_ROSTERS_ADR.md` - Architecture decision record
- `docs/MIGRATION-project-team-rosters.md` - Migration notes

### C. Questions & Decisions

**Q: Should we keep group_id for historical data?**  
A: Yes, during transition phases (1-5). Remove only in Phase 6 after verification.

**Q: What about external assessments using group_id?**  
A: Migrate to project_team_id in Phase 2, maintain backward compat with optional group_id.

**Q: Can we skip phases?**  
A: No. Each phase builds on previous. Skipping risks data integrity and authorization bugs.

---

## Next Steps

1. **Review & Approval**: Share this plan with tech leads and stakeholders
2. **Scheduling**: Allocate engineering resources for Q1-Q2 2026
3. **Kickoff**: Begin Phase 1 immediately after approval
4. **Tracking**: Create JIRA epic/tickets for each phase
5. **Communication**: Announce plan to team, set expectations

---

**Document Owner:** Engineering Team  
**Last Updated:** 2026-01-18  
**Next Review:** After each phase completion
