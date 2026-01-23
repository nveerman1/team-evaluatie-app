# Statistieken Tab Implementation Summary

## Overview
This document summarizes the implementation of the "Statistieken" (Statistics) tab in the teacher 3de-blok module. The tab is positioned directly left of "RFID Kaarten" as requested.

## Implementation Details

### Backend Changes

#### New Pydantic Schemas (`backend/app/api/v1/schemas/attendance.py`)
Added the following schemas for statistics responses:
- `CourseOut` - Course information for dropdown filters
- `StatsSummary` - School vs external work breakdown with percentages
- `WeeklyStats` - Weekly attendance trend data
- `DailyStats` - Daily unique student counts
- `HeatmapCell` / `HeatmapData` - Heatmap visualization data
- `StudentSignal` / `SignalsData` - Anomaly detection results
- `EngagementStudent` / `TopBottomData` - Top/bottom engagement rankings

#### New API Endpoints (`backend/app/api/v1/routers/attendance.py`)
All endpoints require teacher/admin authentication and are automatically scoped to the user's school:

1. **GET `/api/v1/attendance/courses`**
   - Returns list of courses for filter dropdowns
   - No additional parameters required

2. **GET `/api/v1/attendance/stats/summary`**
   - Returns school vs external work breakdown
   - Parameters: `period` (4w/8w/all), `course_id`, `project_id`
   - Calculates minutes, blocks, and percentages

3. **GET `/api/v1/attendance/stats/weekly`**
   - Returns weekly attendance trend data
   - Parameters: `period`, `course_id`, `project_id`
   - Groups by week using PostgreSQL `date_trunc`

4. **GET `/api/v1/attendance/stats/daily`**
   - Returns daily unique student counts
   - Parameters: `period`, `course_id`, `project_id`
   - Counts unique students per day (school check-ins only)

5. **GET `/api/v1/attendance/stats/heatmap`**
   - Returns aggregated hourly heatmap data
   - Parameters: `period`, `course_id`, `project_id`
   - Shows Mon-Fri, 8:00-18:00 with average student counts

6. **GET `/api/v1/attendance/stats/signals`**
   - Returns anomaly detection results
   - Parameters: `period`, `course_id`, `project_id`
   - Three signal types with configurable thresholds:
     * Extern/low school: ≥4h external, ≤2 blocks school
     * Many pending: ≥3 pending external registrations
     * Long open: ≥12h without check-out

7. **GET `/api/v1/attendance/stats/top-bottom`**
   - Returns top 5 and bottom 5 students by engagement
   - Parameters: `period`, `course_id`, `project_id`, `mode` (4w/scope)
   - Mode determines whether to always use last 4 weeks or selected period

### Frontend Changes

#### New Component (`frontend/src/app/(teacher)/teacher/3de-blok/components/StatistiekenTab.tsx`)
Comprehensive statistics dashboard with:

**Filters (top row):**
- Period selector: laatste 4 weken (default), laatste 8 weken, alles
- Course dropdown: "Alle vakken" + courses from API
- Project dropdown: "Alle projecten" + projects from API
- Download CSV button (exports summary data)

**Visualizations:**
1. **School vs Extern Donut Chart**
   - Uses Chart.js Doughnut chart
   - Shows blue (school) vs amber (extern goedgekeurd)
   - Displays percentages in tooltips

2. **Weekly Trend Line Chart**
   - Total blocks per week (school + approved external)
   - Tooltips show week start date and block count
   - Blue line with subtle fill

3. **Daily Bar Chart**
   - Unique students per day (school check-ins)
   - Bar chart with date labels
   - Blue bars matching theme

4. **Heatmap Table**
   - Mon-Fri columns, 8:00-18:00 rows
   - Cool blue-gray color scale (low saturation)
   - Tooltips show weekday, hour, and average count
   - Empty cells when no data

**Signal Cards (3 columns):**
- Each card has icon, title, description, and list of matching students
- Shows up to 5 students per signal type
- Color-coded: amber (extern/school), blue (pending), rose (open)
- Student rows show name, course, and relevant value

**Top & Bottom Engagement:**
- Two columns: Top 5 and Bottom 5
- Ranked by total blocks (school + approved external)
- Toggle: "Alleen laatste 4 weken" (default ON)
- Green highlights for top, gray for bottom
- Shows rank number, name, course, and block count

**State Management:**
- Loading state with spinner
- Empty states handled gracefully
- Error states with toast notifications
- All data fetched in parallel for performance

#### Service Extension (`frontend/src/services/attendance.service.ts`)
Added TypeScript interfaces and service methods:
- `Course`, `StatsSummary`, `WeeklyStats`, `DailyStats`
- `HeatmapCell`, `HeatmapData`, `StudentSignal`, `SignalsData`
- `EngagementStudent`, `TopBottomData`
- Service methods for all 7 new endpoints

#### Main Page Update (`frontend/src/app/(teacher)/teacher/3de-blok/page.tsx`)
- Added "Statistieken" tab to tabs array
- Positioned before "RFID Kaarten" as requested
- Added tab content rendering with conditional display

### Documentation
Created `STATISTICS_ENDPOINTS_TESTING.md` with:
- Authentication instructions
- Curl examples for all endpoints
- Expected response shapes
- Query parameter documentation
- HTTP status code reference

## Technical Decisions

### Backend
1. **SQL Aggregations**: All calculations done in database using efficient GROUP BY queries
2. **Date Filtering**: PostgreSQL `date_trunc` for weekly grouping
3. **School Scoping**: Automatic filtering by `current_user.school_id`
4. **Validation**: Query parameters validated with Pydantic and regex patterns
5. **Performance**: Parallel subqueries for signals endpoint

### Frontend
1. **Chart Library**: Used existing Chart.js (already in package.json)
2. **Data Fetching**: Parallel Promise.all for performance
3. **State Management**: React useState with proper dependency arrays
4. **Styling**: Consistent with existing tabs (rounded-2xl, ring-1, shadow-sm)
5. **Error Handling**: Toast notifications for user feedback

### Color Scheme (Heatmap)
- Used cool blue-gray palette as specified in requirements
- Low saturation to match mockup style
- 5 intensity levels from bg-blue-100/50 to bg-blue-500/90

## Block Calculation
Standard throughout application:
- 1 block = 75 minutes
- Formula: `seconds / (75 * 60)`
- Applied to both school and external work

## Signal Thresholds (Constants)
```python
MIN_EXTERN_HOURS = 4        # Minimum external hours for signal
MAX_SCHOOL_BLOCKS = 2       # Maximum school blocks for signal
MIN_PENDING_COUNT = 3       # Minimum pending registrations
LONG_OPEN_HOURS = 12        # Hours before open session is flagged
```

## Data Flow
1. User selects filters (period, course, project)
2. Frontend calls all 6 stats endpoints in parallel
3. Backend queries database with school-scoped filters
4. Backend aggregates data and returns structured responses
5. Frontend renders charts, heatmap, signals, and rankings
6. User can export summary data as CSV

## Authentication & Authorization
- All endpoints require authentication (JWT via cookies or headers)
- Only teachers and admins can access statistics
- Data automatically filtered to user's school
- Role check in each endpoint using `current_user.role`

## Testing Completed
✅ Python syntax validation (no errors)
✅ TypeScript compilation (no errors)
✅ ESLint checks (no errors, only pre-existing warnings)
✅ Code review completed (3 issues addressed)
✅ CodeQL security scan (0 alerts)

## Not Implemented (Out of Scope)
- Deep linking from signal cards to other tabs (mentioned in requirements as "later")
- Student detail view on click (mentioned as optional/later)
- Real-time updates (would require WebSocket/polling)
- More granular filters (e.g., class filter was explicitly excluded)
- Custom time range picker (fixed options: 4w, 8w, all)

## Files Changed
- `backend/app/api/v1/schemas/attendance.py` (added schemas)
- `backend/app/api/v1/routers/attendance.py` (added endpoints)
- `frontend/src/services/attendance.service.ts` (added interfaces and methods)
- `frontend/src/app/(teacher)/teacher/3de-blok/page.tsx` (added tab)
- `frontend/src/app/(teacher)/teacher/3de-blok/components/StatistiekenTab.tsx` (new component)
- `STATISTICS_ENDPOINTS_TESTING.md` (new documentation)

## Dependencies
No new dependencies added. Used existing:
- Chart.js and react-chartjs-2 (already in package.json)
- Lucide React for icons
- Tailwind CSS for styling
- FastAPI, SQLAlchemy, Pydantic (backend)

## Deployment Considerations
1. Database indexes already exist on `user_id`, `check_in`, `project_id`
2. No migrations needed (using existing schema)
3. No environment variables required
4. No new secrets or configuration
5. Backward compatible (no breaking changes)

## Future Enhancements (Not Implemented)
Based on requirements "later" or "optioneel":
- Deep linking to other tabs with pre-filled filters
- Click student in top/bottom to view detail page
- Custom date range picker
- More advanced anomaly detection
- Export individual charts as images
- Schedule reports via email
- Compare multiple periods side by side
