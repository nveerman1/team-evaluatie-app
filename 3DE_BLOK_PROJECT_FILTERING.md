# 3de Blok - Project Filtering Implementation

## Overview

This document explains how attendance events (both external and school) are linked to projects and how the project-based filtering works in the 3de-blok Overview tab.

## How Events are Linked to Projects

### Database Structure

Projects are primarily linked to **courses** (via `course_id`), not directly to classes. Students are enrolled in courses through the `course_enrollments` table:

```sql
projects:
  - id
  - course_id (FK to courses)
  - class_name (optional, for reference)
  - start_date
  - end_date
  - status
  
courses:
  - id
  - name
  - school_id
  
course_enrollments:
  - student_id (FK to users)
  - course_id (FK to courses)
  - active

attendance_events:
  - user_id (FK to users)
  - project_id (FK to projects, nullable)
  - check_in (timestamp)
  - check_out (timestamp)
  - is_external (boolean)
```

### Event-Project Association Methods

Events can be associated with projects in two ways:

1. **Direct Association** (Optional): Events can be explicitly linked to a project via `project_id`
2. **Date-based Filtering** (Implemented): Events are filtered by falling within a project's date range

The current implementation uses **date-based filtering** because:
- It's more flexible and doesn't require manual project assignment for every event
- It automatically includes all relevant events that occurred during a project period
- It works for both RFID check-ins and external work registrations

### Filtering Logic

When a user selects a class + project combination in the Overview tab:

1. **Class Filter**: Filters students by `class_name`
2. **Project Dropdown Population**: 
   - Finds all students in the selected class
   - Looks up which courses those students are enrolled in
   - Returns projects linked to those courses
3. **Project Filter**: Filters attendance events by date range:
   - Events with `check_in >= project.start_date`
   - Events with `check_in < end_of_day(project.end_date)`

This means:
- Only projects from courses that class members are enrolled in appear in the dropdown
- All school attendance events that occurred during the project period are counted
- All external work events that were started during the project period are counted
- Events are counted regardless of whether they have an explicit `project_id` link

## Implementation Details

### Backend Changes

#### 1. Updated `/api/v1/attendance/overview` Endpoint

**Location**: `backend/app/api/v1/routers/attendance.py`

Added `project_id` query parameter:

```python
@router.get("/overview")
def get_attendance_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    class_name: Optional[str] = Query(None),
    project_id: Optional[int] = Query(None),  # NEW
):
```

The endpoint now:
1. Fetches the project if `project_id` is provided
2. Validates the project belongs to the current school
3. Applies date range filters to all attendance queries (school, external approved, external pending)

**Date Filtering Implementation**:
```python
def apply_project_date_filter(query, project: Project):
    """
    Apply project date range filter to an attendance query.
    Filters events where check_in falls within project start and end dates.
    """
    if project.start_date:
        query = query.filter(AttendanceEvent.check_in >= project.start_date)
    if project.end_date:
        # Filter events before the start of the next day
        next_day = project.end_date + timedelta(days=1)
        query = query.filter(AttendanceEvent.check_in < next_day)
    return query
```

This helper function is used three times to filter school, external approved, and external pending attendance queries.

#### 2. New `/api/v1/attendance/projects-by-class` Endpoint

**Location**: `backend/app/api/v1/routers/attendance.py`

New endpoint to fetch projects filtered by class through course enrollments:

```python
@router.get("/projects-by-class")
def get_projects_by_class(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    class_name: Optional[str] = Query(None),
):
```

How it works:
1. Gets all students in the specified class
2. Finds all courses those students are enrolled in (via `course_enrollments`)
3. Returns projects linked to those courses (via `project.course_id`)

Returns:
- Projects with status `active` or `completed`
- Filtered by courses that class students are enrolled in
- Ordered by `start_date` (most recent first)
- Includes: id, title, class_name, start_date, end_date, status

### Frontend Changes

#### Updated OverzichtTab Component

**Location**: `frontend/src/app/(teacher)/teacher/3de-blok/components/OverzichtTab.tsx`

Added:
1. **Project Interface**:
```typescript
interface Project {
  id: number;
  title: string;
  class_name: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
}
```

2. **State Management**:
```typescript
const [projects, setProjects] = useState<Project[]>([]);
const [projectFilter, setProjectFilter] = useState("");
```

3. **Cascading Filter Logic**:
   - When class is selected → fetch projects for that class
   - When class is cleared → clear projects list and project filter
   - When project is selected → include in overview API call

4. **UI Updates**:
   - Added third dropdown for project selection
   - Dropdown is disabled when:
     - No class is selected, OR
     - No projects exist for the selected class
   - Uses `flex-wrap` to handle responsive layout

## User Experience Flow

### Step 1: Initial State
- All students from all classes are shown
- Total attendance across all time periods
- Project dropdown is disabled

### Step 2: Select Class
```
User selects: "SDAIA-A"
↓
Backend queries:
  1. Find students where class_name = "SDAIA-A"
  2. Find course_enrollments for those students
  3. Find projects linked to those courses
↓
Project dropdown becomes enabled and populated with relevant projects
↓
Overview updates to show only SDAIA-A students
```

### Step 3: Select Project
```
User selects: "Keuzeopdracht - Periode 3"
↓
Backend fetches attendance overview with:
  - class_name = "SDAIA-A"
  - project_id = 42
↓
Overview shows SDAIA-A students with attendance filtered to project dates
```

### Result Display

The table shows:
- **School uren**: Total time checked in at school during project period
- **Extern (goedgekeurd)**: Approved external work during project period
- **Extern (in afwachting)**: Pending external work during project period
- **Lesblokken**: Calculated from (school + approved external) / 75 minutes

All times and lesson blocks are calculated **only** from events that fall within the selected project's date range.

## Example Scenarios

### Scenario 1: Full Year Project
```
Project: "3de Blok - Jaar 2024-2025"
Start Date: 2024-09-01
End Date: 2025-06-30
Class: SDAIA-A

Result: Shows all attendance for SDAIA-A students from Sept 2024 to June 2025
```

### Scenario 2: Short Project
```
Project: "Sprint Week"
Start Date: 2025-01-15
End Date: 2025-01-19
Class: SDAIA-B

Result: Shows only attendance during that specific week for SDAIA-B students
```

### Scenario 3: Multiple Projects
If a student worked on multiple projects in the same class:
- Selecting different projects shows different attendance totals
- Each project view is independent and shows only relevant events
- Total attendance across all projects would require viewing without project filter

## Technical Notes

### Date Handling

**Important**: The end date filter uses the start of the next day:
```python
next_day = project.end_date + timedelta(days=1)
query = query.filter(AttendanceEvent.check_in < next_day)
# Example: 2025-01-31 → filter events before 2025-02-01 00:00:00
```

This ensures events that occurred on the last day of the project are included, while being more performant and clearer than using `datetime.max.time()`.

### Performance Considerations

- Date filtering is done at the database level using SQL WHERE clauses
- No in-memory filtering of large datasets
- Queries use existing indexes on `attendance_events.user_id` and `attendance_events.check_in`

### Future Enhancements

Potential improvements:
1. **Explicit Project Assignment**: Add UI to assign events to specific projects
2. **Multi-Project View**: Allow selecting multiple projects to see combined totals
3. **Project Progress Tracking**: Show target hours vs actual hours for projects
4. **Team-based Filtering**: Combine with project teams to show team-level statistics
5. **Export by Project**: Add CSV export filtered by project

## API Reference

### GET /api/v1/attendance/overview

**Query Parameters**:
- `class_name` (string, optional): Filter by class
- `project_id` (integer, optional): Filter events by project date range

**Response**:
```json
[
  {
    "user_id": 123,
    "user_name": "Jan de Vries",
    "user_email": "jan@example.com",
    "class_name": "SDAIA-A",
    "total_school_seconds": 45000,
    "total_external_approved_seconds": 18000,
    "total_external_pending_seconds": 7200,
    "lesson_blocks": 14.0
  }
]
```

### GET /api/v1/attendance/projects-by-class

**Query Parameters**:
- `class_name` (string, optional): Filter projects by class

**Response**:
```json
[
  {
    "id": 42,
    "title": "Keuzeopdracht - Periode 3",
    "class_name": "SDAIA-A",
    "start_date": "2025-01-01",
    "end_date": "2025-03-31",
    "status": "active"
  }
]
```

## Testing Checklist

- [ ] Backend endpoint returns correct projects for a class
- [ ] Backend endpoint filters attendance by project date range
- [ ] Frontend dropdown populates when class is selected
- [ ] Frontend dropdown is disabled when no class is selected
- [ ] Frontend makes correct API call with both class and project filters
- [ ] Table updates correctly when project is selected
- [ ] Lesson blocks are calculated correctly based on filtered events
- [ ] Selecting different projects shows different totals
- [ ] Clearing class filter also clears project filter

## Related Documentation

- [3DE_BLOK_IMPLEMENTATION_SUMMARY.md](3DE_BLOK_IMPLEMENTATION_SUMMARY.md) - Overall 3de Blok module documentation
- Backend attendance router: `backend/app/api/v1/routers/attendance.py`
- Frontend component: `frontend/src/app/(teacher)/teacher/3de-blok/components/OverzichtTab.tsx`
- Project model: `backend/app/infra/db/models.py` (Project class)
- Attendance model: `backend/app/infra/db/models.py` (AttendanceEvent class)
