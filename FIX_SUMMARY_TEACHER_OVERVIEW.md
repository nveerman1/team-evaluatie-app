# Fix Summary: Teacher Overview Bugs

**Date**: 2026-01-21  
**Issue**: Multiple bugs on `/teacher/overview?tab=projecten`

## Problems Fixed

### 1. Duplicate Projects in UI
**Symptom**: Each project appeared multiple times in the overview list (e.g., "MMR (eind)" repeated)

**Root Cause**: 
- Backend endpoint `get_project_overview` joined through `ProjectAssessmentTeam` table
- This created one row per team for each project assessment
- Example: Project with 3 teams returned 3 identical project rows

**Fix** (`backend/app/api/v1/routers/overview.py`):
```python
# BEFORE: Joined through ProjectAssessmentTeam causing duplicates
query = db.query(ProjectAssessment, ProjectTeam, Course, Project, Client)
    .join(ProjectAssessmentTeam, ...)
    .join(ProjectTeam, ...)

# AFTER: Direct joins (no distinct needed)
query = db.query(ProjectAssessment, Course, Project, Client)
    .outerjoin(Project, ...)
    .outerjoin(Course, ...)
```

**Impact**: Each project now appears exactly once in the overview.

---

### 2. Duplicate React Key Warnings
**Symptom**: Console warning "Encountered two children with the same key, `19`"

**Root Cause**:
- Team rows used `key={team.team_number}` 
- When multiple projects had "Team 1", "Team 2", etc., keys collided
- React requires globally unique keys within the same parent

**Fix** (`frontend/src/app/(teacher)/teacher/overview/components/ProjectOverviewTab.tsx`):
```typescript
// BEFORE: Only team number (not unique across projects)
<tr key={team.team_number}>

// AFTER: Composite key combining project and team
<tr key={`${project.projectId}-team-${team.team_number}`}>
```

**Impact**: No more duplicate key warnings, React can efficiently track changes.

---

### 3. Team 1 Shows Project Name
**Symptom**: In "Teamscores" table, Team 1 displayed as "Project MMR" instead of "Team 1"

**Root Cause**:
- When creating a default team for projects without teams, the code set:
  ```python
  display_name_at_time=f"Project {project.title}"
  ```
- This was intended as a placeholder but became the actual team name shown in UI

**Fix** (`backend/app/api/v1/routers/projects.py`):
```python
# BEFORE: Used project title as team name
display_name_at_time=f"Project {project.title}"

# AFTER: Proper team name
display_name_at_time="Team 1"
```

**Impact**: Team 1 now correctly shows "Team 1" or its custom name, never the project name.

---

### 4. PostgreSQL JSON Equality Error (POST-FIX)
**Symptom**: 500 Internal Server Error with message "could not identify an equality operator for type json"

**Root Cause**:
- Initial fix added `.distinct()` to the query to ensure uniqueness
- PostgreSQL cannot apply `DISTINCT` to queries with JSON columns (`metadata_json`)
- JSON types don't have an equality operator for DISTINCT operations

**Fix** (`backend/app/api/v1/routers/overview.py`):
```python
# Initial attempt: Added distinct() but it caused error with JSON columns
query = db.query(ProjectAssessment, Course, Project, Client) \
    .outerjoin(Project, ...) \
    .outerjoin(Course, ...) \
    .distinct()  # ❌ Fails: "could not identify an equality operator for type json"

# Final fix: Removed distinct() - not needed with direct outer joins
query = db.query(ProjectAssessment, Course, Project, Client) \
    .outerjoin(Project, ...) \
    .outerjoin(Course, ...)
    # No distinct() needed - each ProjectAssessment appears once naturally
```

**Impact**: Query executes successfully. Direct outer joins naturally return one row per ProjectAssessment without needing DISTINCT.

---

### 5. Duplicate Detection Guard (Prevention)
**Addition**: Added validation to detect if duplicates ever occur again

**Implementation** (`backend/app/api/v1/routers/overview.py`):
```python
# Validate no duplicate project_ids in response
project_ids = [p.project_id for p in projects]
unique_project_ids = set(project_ids)
if len(project_ids) != len(unique_project_ids):
    duplicates = [pid for pid, count in Counter(project_ids).items() if count > 1]
    logging.warning(f"Duplicate project IDs detected: {duplicates}")
```

**Impact**: If duplicates occur due to future code changes, they'll be logged immediately.

---

## About "Unable to add filesystem" Warning

This warning originates from Next.js/Turbopack's file watching system during development. It's a benign tooling message that cannot be fixed in application code. It typically occurs when the dev server tries to watch invalid or non-existent paths.

**Recommendation**: Safe to ignore in development. Does not affect production builds.

---

## Files Changed

1. `backend/app/api/v1/routers/overview.py`
   - Fixed query to eliminate duplicate projects
   - Removed `.distinct()` to avoid JSON equality error
   - Added validation guard with logging
   
2. `backend/app/api/v1/routers/projects.py`
   - Fixed default team name from project title to "Team 1"
   
3. `frontend/src/app/(teacher)/teacher/overview/components/ProjectOverviewTab.tsx`
   - Fixed React keys to be unique across all projects

---

## Testing Recommendations

1. **Navigate to** `/teacher/overview?tab=projecten`
2. **Verify**: Each project appears exactly once
3. **Expand a project**: Check team names are correct (not showing project name)
4. **Console**: No "duplicate key" warnings
5. **Create new project**: Verify Team 1 gets proper team name
6. **No errors**: Page loads without 500 errors

---

## Regression Prevention

- All fixes include inline comments with date and explanation
- Validation guard logs warnings if duplicates detected
- React key pattern ensures uniqueness across projects
- Future team creation follows established "Team N" naming pattern
- Direct outer joins eliminate need for DISTINCT (avoiding JSON column issues)
