# Phase 1 Implementation: Establish CourseEnrollment as Source of Truth

**Status:** ✅ Complete  
**Date:** 2026-01-18  
**Phase:** 1 of 6 (Legacy Tables Migration)

---

## Overview

Phase 1 establishes the `course_enrollments` table as the authoritative source for student-course relationships, preparing the codebase for migration away from the legacy `GroupMember` table.

**Key Achievement:** All student creation and update flows now create CourseEnrollment records alongside GroupMember records (dual-write pattern).

---

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
