# Phase 1 Implementation: CourseEnrollment-Only Migration

**Status:** ✅ Complete  
**Date:** 2026-01-19 (Updated)  
**Phase:** 1 of 6 (Legacy Tables Migration - Simplified)

---

## Overview

Phase 1 migrates to use `course_enrollments` table as the **sole** source for student-course relationships. This simplified approach removes all legacy GroupMember/Group dependencies, ideal for fresh installations without existing data.

**Key Achievement:** All student creation and update flows now use CourseEnrollment exclusively - no writes to GroupMember.

---

## Approach: CourseEnrollment-Only

**Decision:** Based on user requirements for a fresh installation with no existing data, we simplified from the original dual-write pattern to a CourseEnrollment-only approach.

**Benefits:**
- Simpler codebase with single source of truth
- No legacy dependencies
- Cleaner architecture
- Reduced maintenance burden

**Trade-offs:**
- Not compatible with existing code that queries GroupMember/Group
- Team-related API fields return None
- Migration scripts remain for reference but aren't needed for fresh installs

---

## Implementation Details

### ✅ 1.1 Remove GroupMember Usage

**Files Modified:**
- `backend/app/api/v1/routers/admin_students.py`
- `backend/app/api/v1/routers/students.py`

**Changes:**
- Removed all GroupMember/Group imports and usage
- Removed Team/TeamMember aliasing
- Simplified query logic to use CourseEnrollment only

---

### ✅ 1.2 CourseEnrollment Management

**Function:** `_set_user_course_enrollment()`
**Location:** `backend/app/api/v1/routers/admin_students.py`

**Purpose:** Manages student course enrollment using CourseEnrollment table exclusively.

**Logic:**
```python
def _set_user_course_enrollment(
    db: Session, school_id: int, user_id: int, course_name: Optional[str]
):
    """
    Ensures student is enrolled in the specified course via CourseEnrollment.
    - If course_name is empty/None: do nothing.
    - If already enrolled in the course: ensure enrollment is active.
    - Otherwise: create enrollment for this course.
    """
    if not course_name:
        return

    # Find or create the course
    course = db.query(Course).filter(...).first()
    if not course:
        course = Course(school_id=school_id, name=course_name)
        db.add(course)
        db.flush()

    # Check/create enrollment
    enrollment = db.query(CourseEnrollment).filter(...).first()
    if enrollment:
        if not enrollment.active:
            enrollment.active = True
    else:
        db.add(CourseEnrollment(
            course_id=course.id,
            student_id=user_id,
            active=True
        ))
```

**Used in:**
- Student creation (POST /api/v1/admin/students)
- Student update (PUT /api/v1/admin/students/{id})
- CSV import (POST /api/v1/admin/students/import.csv)

---

### ✅ 1.3 Simplified Student Endpoints

**File:** `backend/app/api/v1/routers/students.py`

**Changes:**

1. **Removed:**
   - Team/TeamMember imports and aliasing
   - Complex GroupMember join queries
   - `/teams` endpoint
   - Team field population logic

2. **Simplified:**
   - `list_students()` - Direct CourseEnrollment queries
   - `create_student()` - CourseEnrollment creation only
   - `update_student()` - CourseEnrollment management only
   - `_to_out_row()` - No team parameters needed

3. **Query Example:**
```python
# Get active enrollments for students
enrollments = (
    db.query(CourseEnrollment, Course.name)
    .join(Course, CourseEnrollment.course_id == Course.id)
    .filter(
        CourseEnrollment.student_id.in_(user_ids),
        CourseEnrollment.active.is_(True),
        Course.school_id == current_user.school_id,
    )
    .all()
)
```

---

### ✅ 1.4 Database Constraints

**Status:** Verified - Already in place

The `course_enrollments` table has:
- **Unique Constraint:** `uq_course_enrollment_once` on `(course_id, student_id)`
- **Indexes:**
  - `ix_course_enrollment_course` on `course_id`
  - `ix_course_enrollment_student` on `student_id`

**Location:** `backend/app/infra/db/models.py` lines 319-323

**No changes to GroupMember/Group tables** - they're simply not used.

---

### ✅ 1.5 Migration Scripts (Legacy Reference)

**Purpose:** These scripts remain for reference only, useful if migrating from an existing GroupMember-based installation.

#### Audit Script

**Script:** `backend/scripts/audit_course_enrollments.py`

**What it does:**
- Compares GroupMember records with CourseEnrollment records
- Reports coverage gaps
- Provides statistics

**Usage:**
```bash
cd backend
python scripts/audit_course_enrollments.py
```

**Note:** For fresh installations, this will show 0 GroupMember records and 100% CourseEnrollment coverage.

#### Backfill Script

**Script:** `backend/scripts/backfill_course_enrollments.py`

**What it does:**
- Creates CourseEnrollment records from GroupMember data
- Handles dry-run and commit modes

**Usage:**
```bash
# Dry run
python scripts/backfill_course_enrollments.py

# Commit changes
python scripts/backfill_course_enrollments.py --commit
```

**Note:** For fresh installations, this script is not needed.

---

### ✅ 1.6 Testing

**Test File:** `backend/tests/test_course_enrollment_backfill.py`

**Test Coverage:**
- ✅ CourseEnrollment creation logic
- ✅ Unique pair identification
- ✅ Active/inactive filtering
- ✅ Idempotent creation
- ✅ Coverage calculation
- ✅ Multiple enrollments handling

**Running Tests:**
```bash
cd backend
pytest tests/test_course_enrollment_backfill.py -v
```

---

### ✅ 1.7 Documentation

**Updated Files:**
- `backend/scripts/README.md` - Script documentation
- `docs/PHASE_1_IMPLEMENTATION.md` - This file
- `docs/PHASE_1_COMPLETE.md` - Completion summary

---

## API Changes

### Student Creation

**Endpoint:** `POST /api/v1/admin/students`

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "course_name": "Mathematics 101"
}
```

**Response:**
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "class_name": null,
  "course_id": 5,
  "course_name": "Mathematics 101",
  "team_id": null,
  "team_name": null,
  "team_number": null,
  "status": "active"
}
```

**Note:** Team fields return null.

### Student List

**Endpoint:** `GET /api/v1/students`

**Query Parameters:**
- `q` - Search by name or email
- `class_or_course` - Filter by class or course name
- `class_name` - Filter by class name
- `status` - Filter by active/inactive
- `page`, `limit` - Pagination

**Note:** `team_id` parameter removed.

### CSV Import

**Endpoint:** `POST /api/v1/admin/students/import.csv`

**CSV Format:**
```csv
name,email,class_name,course,status
John Doe,john@example.com,Class A,Math 101,active
Jane Smith,jane@example.com,Class B,Physics 201,active
```

**Supported Columns:**
- `name`, `email` - Required
- `class_name` - Optional
- `course` or `course_name` - Optional (creates CourseEnrollment)
- `team_number` - Ignored (kept for compatibility)
- `status` - Optional (active/inactive)

---

## Implementation Notes

### Design Decisions

1. **CourseEnrollment-Only:** Based on user having fresh installation with no legacy data.

2. **Team Fields Return None:** Kept in API schemas for compatibility but always return None.

3. **Migration Scripts Retained:** Useful for reference and documentation, even though not needed for fresh installs.

4. **Simplified Queries:** Removed complex Team/TeamMember joins, using direct CourseEnrollment queries.

5. **Active Field:** Supports soft-deletes by setting `active=False` instead of hard deletes.

### Code Quality

- ✅ Proper SQLAlchemy boolean comparisons (`.is_(True)`)
- ✅ Clear English comments
- ✅ Simplified function signatures
- ✅ Removed ~300+ lines of legacy code

### Known Limitations

1. **Team Functionality Removed:** If team-based features are needed later, they must be reimplemented.

2. **API Compatibility:** Code that queries GroupMember/Group will not work.

3. **Frontend Updates:** Frontend may need updates to remove team-related UI elements.

---

## Verification Steps

### For Fresh Installations

1. **Create a student:**
```bash
curl -X POST /api/v1/admin/students \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Student", "email": "test@example.com", "course_name": "Test Course"}'
```

2. **Verify enrollment:**
```sql
SELECT * FROM course_enrollments WHERE student_id = <student_id>;
```

3. **Verify no GroupMember records:**
```sql
SELECT COUNT(*) FROM group_members;  -- Should be 0
```

### For Existing Installations

1. Run audit script to see coverage
2. Run backfill script if needed
3. Verify 100% coverage

---

## Next Steps

**Phase 1 is now COMPLETE** with CourseEnrollment-only approach.

### Future Considerations

1. **Frontend Updates:** Consider removing team-related UI components
2. **API Schema Updates:** Mark team fields as deprecated in OpenAPI spec
3. **Cleanup:** Consider removing GroupMember/Group references from other parts of codebase
4. **Phase 2:** Original plan's Phase 2 may not be needed if Groups are not used

---

## Questions or Issues?

Contact the engineering team or refer to:
- **Completion Summary:** `docs/PHASE_1_COMPLETE.md`
- **Scripts README:** `backend/scripts/README.md`
- **Original Plan:** `docs/LEGACY_TABLES_MIGRATION_PLAN.md` (note: modified for CourseEnrollment-only)

---

**Document Owner:** Engineering Team  
**Last Updated:** 2026-01-19  
**Related Issue:** Legacy Tables Phase-Out (Simplified for Fresh Installation)


## Deliverables

### ✅ 1.1 Verify CourseEnrollment Coverage

**Script:** `backend/scripts/audit_course_enrollments.py`

**Purpose:** Audit tool to verify all students with active GroupMember records have corresponding CourseEnrollment records.

**Features:**
- Fetches all active GroupMember records
- Identifies unique student-course pairs
- Checks for missing or inactive CourseEnrollment records
- Provides detailed reporting with coverage statistics
- Exit codes for automation (0=pass, 1=warning, 2=fail)

**Usage:**
```bash
cd backend
python scripts/audit_course_enrollments.py
```

**Output Includes:**
- Total active GroupMember records
- Unique student-course pairs identified
- Coverage percentage
- List of students missing CourseEnrollment
- List of students with inactive CourseEnrollment

---

### ✅ 1.2 Create CourseEnrollment Backfill Script

**Script:** `backend/scripts/backfill_course_enrollments.py`

**Purpose:** Backfill tool to create missing CourseEnrollment records from GroupMember data.

**Features:**
- Identifies missing CourseEnrollment records
- Creates new enrollments for students without them
- Reactivates inactive enrollments where needed
- Handles duplicate prevention (unique constraint)
- Safe dry-run mode by default
- Idempotent operation (safe to run multiple times)

**Usage:**
```bash
# Dry run (preview only)
python scripts/backfill_course_enrollments.py

# Live run (commit changes)
python scripts/backfill_course_enrollments.py --commit
```

**Safety Features:**
- Dry-run mode by default
- Comprehensive logging of all actions
- Respects unique constraints to prevent duplicates
- Handles edge cases (multiple groups, multiple courses)

---

### ✅ 1.3 Database Constraints Verification

**Status:** Verified - Already in place

The `course_enrollments` table already has the necessary constraints:
- **Unique Constraint:** `uq_course_enrollment_once` on `(course_id, student_id)`
- **Indexes:**
  - `ix_course_enrollment_course` on `course_id`
  - `ix_course_enrollment_student` on `student_id`
  - Index on `(course_id, active)` for performance (if needed, can be added)

**Location:** `backend/app/infra/db/models.py` lines 319-323

---

### ✅ 1.4 Update Student Creation Flow

**Status:** Complete - All flows now create CourseEnrollment records

**Updated Files:**
- `backend/app/api/v1/routers/admin_students.py`
- `backend/app/api/v1/routers/students.py`

**Changes Made:**

#### admin_students.py
Added `_ensure_course_enrollment()` helper function:
```python
def _ensure_course_enrollment(db: Session, course_id: int, student_id: int):
    """
    Phase 1 Migration Helper: Ensures a CourseEnrollment record exists for student.
    Creates or reactivates as needed.
    """
```

Updated `_set_user_course_membership()` to call this helper, ensuring that:
- When a student is assigned to a course via course_name in admin panel
- When a student is imported via CSV with course information
- CourseEnrollment record is created or reactivated

#### students.py
Updated both `create_student()` and `update_student()` endpoints to create CourseEnrollment records when:
- Student is assigned to a team via `team_id`
- Student is assigned via `course_id` + `team_number`

Both flows now ensure CourseEnrollment exists alongside GroupMember (dual-write pattern).

**Verification:**
Going forward, all new student enrollments will have CourseEnrollment records. Existing students can be backfilled using the backfill script.

---

**Test File:** `backend/tests/test_course_enrollment_backfill.py`

**Test Coverage:**
- ✅ Backfill logic validation
- ✅ Unique pair identification
- ✅ Inactive member filtering
- ✅ Idempotent creation
- ✅ Coverage calculation
- ✅ Multiple groups in same course
- ✅ Multiple courses for same student

**Running Tests:**
```bash
cd backend
pytest tests/test_course_enrollment_backfill.py -v
```

---

### ✅ 1.5 Documentation

**Updated Files:**
- `backend/scripts/README.md` - Added documentation for audit and backfill scripts
- `docs/PHASE_1_IMPLEMENTATION.md` - This file

---

## Verification Steps

Before considering Phase 1 complete, run the following verification:

### 1. Run the Audit Script

```bash
cd backend
python scripts/audit_course_enrollments.py
```

**Expected Output:**
- Should show current coverage percentage
- Lists any gaps (students missing CourseEnrollment)

### 2. Run Backfill in Dry-Run Mode

```bash
python scripts/backfill_course_enrollments.py
```

**Expected Output:**
- Shows what would be created/activated
- No actual changes made to database

### 3. Run Backfill with Commit (if gaps found)

```bash
python scripts/backfill_course_enrollments.py --commit
```

**Expected Output:**
- Creates missing enrollments
- Activates inactive enrollments
- Reports success

### 4. Re-run Audit to Confirm 100% Coverage

```bash
python scripts/audit_course_enrollments.py
```

**Expected Output:**
- ✅ AUDIT PASSED: All students have active CourseEnrollment records
- 100.0% coverage

---

## Implementation Notes

### Design Decisions

1. **Dry-Run by Default:** The backfill script defaults to dry-run mode to prevent accidental data changes. Requires explicit `--commit` flag.

2. **Idempotent Design:** Both scripts can be run multiple times safely. Existing enrollments are not duplicated.

3. **Active-Only Focus:** Only active GroupMember records are considered. Inactive members are intentionally excluded.

4. **Unique Pair Logic:** Students in multiple groups of the same course only get one CourseEnrollment record (correct behavior).

5. **Comprehensive Logging:** Both scripts provide detailed output for troubleshooting and verification.

### Known Limitations

1. **No Automatic Scheduling:** Scripts must be run manually. Consider adding to deployment/maintenance procedures if needed.

2. **Performance:** For very large datasets (10,000+ students), consider adding batch processing or progress indicators.

3. **Historical Data:** The backfill only creates enrollments for currently active GroupMember records. Historical inactive records are not backfilled (by design).

---

## Next Steps

Phase 1 is now **COMPLETE**. Ready to proceed with Phase 2.

### Phase 2 Preview: Migrate ProjectAssessment to project_team_id

**Goal:** Make `project_team_id` the primary FK in ProjectAssessment table.

**Major Tasks:**
1. Create database migration to make `project_team_id` NOT NULL
2. Backfill all ProjectAssessment records with `project_team_id`
3. Implement dual-write pattern during transition
4. Update queries to use `project_team_id` (with fallback to `group_id`)
5. Update API schemas

**Estimated Duration:** 3 weeks  
**Risk Level:** High (touches core assessment functionality)

---

## Questions or Issues?

Contact the engineering team or refer to:
- **Full Migration Plan:** `docs/LEGACY_TABLES_MIGRATION_PLAN.md`
- **Investigation Summary:** `docs/LEGACY_TABLES_INVESTIGATION_SUMMARY.md`
- **Scripts README:** `backend/scripts/README.md`

---

**Document Owner:** Engineering Team  
**Last Updated:** 2026-01-18  
**Related Issue:** Legacy Tables Phase-Out
