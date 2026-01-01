# Migration Notes

## Overview

This document describes the database schema changes and migration steps for the multi-tenant multi-course architecture refactoring.

## Database Changes

### New Tables

1. **teacher_courses**
   - Junction table linking teachers to courses
   - Fields: id, school_id, teacher_id, course_id, role, is_active
   - Unique constraint on (teacher_id, course_id)

2. **audit_logs**
   - Tracks all mutating actions in the system
   - Fields: id, school_id, user_id, user_email, action, entity_type, entity_id, details, ip_address, user_agent, created_at

### Modified Tables

1. **courses**
   - Added: `code` (VARCHAR 50, nullable)
   - Added: `level` (VARCHAR 50, nullable) - e.g., "onderbouw", "bovenbouw"
   - Added: `year` (INTEGER, nullable) - academic year
   - Added: `description` (TEXT, nullable)
   - Added: `is_active` (BOOLEAN, default true) - for soft deletes
   - New unique constraint: (school_id, code)
   - New index: (school_id, is_active)

2. **evaluations**
   - Added: `evaluation_type` (VARCHAR 30, default "peer") - values: "peer", "project", "competency"
   - New indexes: evaluation_type, (school_id, evaluation_type)

## Migration Script

The migration is in: `backend/migrations/versions/mt_20251112_01_multi_tenant_refactor.py`

### Running the Migration

```bash
# Backup your database first!
pg_dump -U app -d tea > backup_$(date +%Y%m%d_%H%M%S).sql

# Run the migration
cd backend
alembic upgrade head

# Verify the migration
alembic current
```

### Rollback

If you need to rollback:

```bash
cd backend
alembic downgrade -1
```

## Data Migration Steps

### Step 1: Verify Existing Data

Before running the migration, check your existing data:

```sql
-- Count schools
SELECT COUNT(*) FROM schools;

-- Count courses
SELECT COUNT(*) FROM courses;

-- Count users by role
SELECT role, COUNT(*) FROM users GROUP BY role;

-- Count evaluations
SELECT COUNT(*) FROM evaluations;
```

### Step 2: Run Schema Migration

```bash
cd backend
alembic upgrade mt_20251112_01
```

This will:
- Add new columns to courses and evaluations
- Create teacher_courses and audit_logs tables
- Add all necessary indexes and constraints

### Step 3: Backfill Data (Manual Steps)

After the schema migration, you need to populate the new fields:

#### 3.1 Backfill Course Codes

Assign codes to existing courses (customize based on your data):

```sql
-- Example: Set code based on course name
UPDATE courses 
SET code = 'OO' 
WHERE name ILIKE '%onderzoek%ontwerp%' AND code IS NULL;

UPDATE courses 
SET code = 'XPLR' 
WHERE name ILIKE '%xplr%' AND code IS NULL;

UPDATE courses 
SET code = 'BIO' 
WHERE name ILIKE '%bio%' AND code IS NULL;

-- Set default level if applicable
UPDATE courses 
SET level = 'bovenbouw' 
WHERE code = 'OO' AND level IS NULL;
```

#### 3.2 Assign Teachers to Courses

If you have teachers who should be assigned to specific courses:

```sql
-- Example: Assign all teachers with role='teacher' to the O&O course
-- Adjust the WHERE clause based on your data
INSERT INTO teacher_courses (school_id, teacher_id, course_id, role, is_active, created_at, updated_at)
SELECT 
    u.school_id,
    u.id as teacher_id,
    c.id as course_id,
    'teacher' as role,
    true as is_active,
    NOW() as created_at,
    NOW() as updated_at
FROM users u
CROSS JOIN courses c
WHERE u.role = 'teacher'
  AND c.code = 'OO'  -- Adjust based on your course identification
ON CONFLICT (teacher_id, course_id) DO NOTHING;
```

Or manually assign specific teachers:

```sql
-- Assign specific teacher to specific course
INSERT INTO teacher_courses (school_id, teacher_id, course_id, role, is_active, created_at, updated_at)
SELECT 
    u.school_id,
    u.id,
    c.id,
    'coordinator',  -- or 'teacher'
    true,
    NOW(),
    NOW()
FROM users u, courses c
WHERE u.email = 'teacher@example.com'
  AND c.code = 'OO';
```

#### 3.3 Verify Data Migration

```sql
-- Check that all courses have school_id
SELECT COUNT(*) FROM courses WHERE school_id IS NULL;

-- Check teacher assignments
SELECT u.name, u.email, c.name as course_name, tc.role
FROM teacher_courses tc
JOIN users u ON u.id = tc.teacher_id
JOIN courses c ON c.id = tc.course_id
WHERE tc.is_active = true;

-- Check evaluation types
SELECT evaluation_type, COUNT(*) 
FROM evaluations 
GROUP BY evaluation_type;
```

## Breaking Changes

### 1. Course API Changes

**Before:**
```typescript
// Course had minimal fields
interface Course {
  id: number;
  school_id: number;
  name: string;
  period?: string;
}
```

**After:**
```typescript
interface Course {
  id: number;
  school_id: number;
  name: string;
  code?: string;         // NEW
  period?: string;
  level?: string;        // NEW
  year?: number;         // NEW
  description?: string;  // NEW
  is_active: boolean;    // NEW
  created_at: string;
  updated_at: string;
}
```

### 2. Evaluation Type

All evaluations now have an `evaluation_type` field. Existing evaluations default to "peer".

```typescript
interface Evaluation {
  // ... existing fields
  evaluation_type: "peer" | "project" | "competency";  // NEW
}
```

### 3. Teacher Access Control

Teachers now need to be explicitly assigned to courses via the `teacher_courses` table:

- Teachers can only access courses they're assigned to
- Use the new `/api/v1/courses/{id}/teachers` endpoints to manage assignments

### 4. New Required Permissions

Some operations now require explicit RBAC checks:

- Creating courses: requires admin or teacher role
- Assigning teachers: requires admin role
- Deleting courses: requires admin role (soft delete only)

## Frontend Updates Needed

### 1. Course Selection

Add course selector in navigation:

```typescript
// Fetch user's accessible courses
const courses = await api.get('/api/v1/courses');

// Display in dropdown/sidebar
<CourseSelector 
  courses={courses.courses}
  selected={currentCourse}
  onChange={handleCourseChange}
/>
```

### 2. Teacher Management UI

For admins, add UI to manage teacher-course assignments:

```typescript
// List teachers for a course
const teachers = await api.get(`/api/v1/courses/${courseId}/teachers`);

// Assign teacher
await api.post(`/api/v1/courses/${courseId}/teachers`, {
  teacher_id: teacherId,
  role: 'teacher'  // or 'coordinator'
});

// Remove teacher
await api.delete(`/api/v1/courses/${courseId}/teachers/${teacherId}`);
```

### 3. Evaluation Type Handling

Update evaluation forms to include type selection:

```typescript
<select name="evaluation_type">
  <option value="peer">Peer Evaluation</option>
  <option value="project">Project Assessment</option>
  <option value="competency">Competency Monitor</option>
</select>
```

### 4. Filter by Course

Add course filtering to list views:

```typescript
const evaluations = await api.get('/api/v1/evaluations', {
  params: { course_id: currentCourse.id }
});
```

## Testing Checklist

After migration, test the following:

- [ ] Admin can create a course
- [ ] Admin can assign teacher to course
- [ ] Teacher can access assigned courses only
- [ ] Teacher can create evaluation for their course
- [ ] Student can access courses they're enrolled in
- [ ] Course filters work correctly
- [ ] Evaluation type is preserved
- [ ] Audit logs are created for mutations
- [ ] Existing evaluations still work
- [ ] Existing scores are preserved
- [ ] Grade calculations still work

## Rollback Plan

If issues are encountered:

1. **Stop the application**
   ```bash
   # Stop backend
   pkill -f uvicorn
   ```

2. **Restore database from backup**
   ```bash
   psql -U app -d tea < backup_YYYYMMDD_HHMMSS.sql
   ```

3. **Rollback migration**
   ```bash
   cd backend
   alembic downgrade -1
   ```

4. **Restart application**
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

## Support

If you encounter issues during migration:

1. Check logs: `backend/logs/` or console output
2. Verify database state: Run the verification queries above
3. Check for constraint violations: Look for foreign key errors
4. Contact support with:
   - Migration output
   - Error messages
   - Database state (counts of key tables)

## Future Migrations

Additional migrations planned:

1. **School Configuration Table**
   - Store school-specific settings
   - Somtoday credentials
   - Email templates

2. **User Metadata**
   - Add JSON metadata field to users
   - Store Somtoday IDs, preferences

3. **Analytics Tables**
   - Denormalized tables for performance
   - Learning objective progress tracking
   - Competency trends

## Notes

- All migrations support rollback (downgrade)
- Schema changes are backward compatible where possible
- Existing API endpoints remain functional
- New endpoints follow RESTful conventions
- RBAC is enforced server-side (never trust client)
- All queries are scoped to school_id for security
