# 3de Blok RFID Attendance Module - Implementation Summary

## Overview

This document provides a complete summary of the implementation of the 3de Blok RFID attendance module as a native feature in the Team Evaluatie App, based on the rebuild strategy outlined in `docs/3de_blok/REBUILD_PLAN.md`.

**Implementation Date:** 2025-12-21
**Status:** Backend Complete, Frontend In Progress

## What Has Been Implemented

### ✅ 1. Database Schema & Models

**Location:** `backend/migrations/versions/3deblok_20251221_01_add_attendance_tables.py`

Three new PostgreSQL tables have been added:

#### 1.1 `rfid_cards` Table
- Links RFID card UIDs to users
- Supports multiple cards per user
- Active/inactive status for card management
- Fields: id, user_id, uid (unique), label, is_active, created_at, updated_at, created_by

#### 1.2 `attendance_events` Table (Unified)
- Handles both school check-ins and external work registrations
- Fields:
  - id, user_id, project_id (optional)
  - check_in, check_out (timestamps)
  - is_external (boolean flag)
  - location, description (for external work)
  - approval_status, approved_by, approved_at (approval workflow)
  - source (rfid, manual, import, api)
  - created_at, updated_at, created_by
- **Constraints:**
  - check_out must be after check_in
  - External work requires location and approval_status
  - approval_status in ('pending', 'approved', 'rejected')
  - source in ('rfid', 'manual', 'import', 'api')

#### 1.3 `attendance_aggregates` Table (Cache)
- Stores pre-computed totals per user for performance
- Fields: id, user_id, total_school_seconds, total_external_approved_seconds, lesson_blocks, last_recomputed_at

#### 1.4 Database Views & Functions
- **View:** `open_sessions` - Shows currently present students with live duration
- **Function:** `compute_user_attendance_totals(user_id)` - Calculates all attendance metrics

**SQLAlchemy Models:** `backend/app/infra/db/models.py`
- `RFIDCard`, `AttendanceEvent`, `AttendanceAggregate` classes
- Proper relationships and type hints

**Pydantic Schemas:** `backend/app/api/v1/schemas/attendance.py`
- Request/response schemas for all endpoints
- Validation logic (e.g., check_out > check_in)

### ✅ 2. Backend API Endpoints

**Location:** `backend/app/api/v1/routers/attendance.py`, `backend/app/api/v1/routers/rfid.py`

#### 2.1 RFID Scan Endpoint (Raspberry Pi)
```
POST /api/v1/attendance/scan
```
- **Purpose:** Core RFID functionality for Raspberry Pi readers
- **Logic:**
  - Lookup RFID card by UID
  - Check for open session:
    - If exists → check-out (close session)
    - If not → check-in (open new session)
- **Response:** User info + action taken + event details
- **Auth:** Public endpoint (API key to be added)

#### 2.2 Teacher Management Endpoints
```
GET    /api/v1/attendance/events        # List with filters & pagination
PATCH  /api/v1/attendance/events/:id    # Edit event times
DELETE /api/v1/attendance/events/:id    # Delete single event
POST   /api/v1/attendance/events/bulk-delete  # Bulk delete
```
- **Filters:** user_id, class_name, project_id, start_date, end_date, is_external, status_open, approval_status
- **Pagination:** page, per_page (max 100)
- **Auth:** Teacher/admin only

#### 2.3 External Work Endpoints
```
POST   /api/v1/attendance/external           # Student registers external work
PATCH  /api/v1/attendance/external/:id/approve  # Teacher approves
PATCH  /api/v1/attendance/external/:id/reject   # Teacher rejects (with reason)
POST   /api/v1/attendance/external/bulk-approve # Bulk approve
```
- **Workflow:** Student submits → Teacher approves/rejects → Counts toward totals
- **Auth:** Student can create, Teacher/admin can approve/reject

#### 2.4 Student Endpoint
```
GET /api/v1/attendance/me  # Own totals (school, external approved, external pending, lesson blocks)
```

#### 2.5 Presence Endpoint (Real-time)
```
GET /api/v1/attendance/presence  # List currently present students
```
- Returns open sessions with live duration
- Teacher/admin only

#### 2.6 RFID Management Endpoints
```
GET    /api/v1/rfid/:user_id     # List user's cards
POST   /api/v1/rfid/:user_id     # Assign new card
PATCH  /api/v1/rfid/:id          # Update card (e.g., deactivate)
DELETE /api/v1/rfid/:id          # Delete card
```
- Teacher/admin only
- Prevents UID duplicates (409 Conflict)

**Router Registration:** All routers registered in `backend/app/main.py`

### ✅ 3. Frontend Implementation

**Location:** `frontend/src/app/(teacher)/teacher/3de-blok/`

#### 3.1 Navigation
- Added "3de Blok (RFID)" menu item in teacher sidebar
- Icon: Clock icon
- Location: Under "Projecttools" section

#### 3.2 Attendance Dashboard Page
**File:** `frontend/src/app/(teacher)/teacher/3de-blok/page.tsx`

**Features:**
- Real-time presence view (currently present students)
- Auto-refresh every 30 seconds
- Search by name or class
- Grouped by class
- Shows:
  - Student name and email
  - Check-in time
  - Live duration
  - Badge with initials
- Summary card: Total present count

**UI Components Used:**
- Card, Input, Button, Badge from component library
- Lucide icons (Users, Clock, Calendar, TrendingUp)

#### 3.3 Service Layer
**File:** `frontend/src/services/attendance.service.ts`

**Exports:**
- `attendanceService` - All attendance API calls
- `rfidService` - All RFID card management calls

**Methods:**
- `listEvents()` - Get attendance events with filters
- `getPresence()` - Get currently present students
- `updateEvent()` - Edit event times
- `deleteEvent()` - Delete single event
- `bulkDeleteEvents()` - Bulk delete
- `createExternalWork()` - Register external work
- `approveExternalWork()` - Approve external work
- `rejectExternalWork()` - Reject with reason
- `bulkApproveExternalWork()` - Bulk approve
- `getMyAttendance()` - Student's own totals

## Implementation Details

### Database Migration Strategy

The migration is idempotent and can be run safely:
```bash
cd backend
alembic upgrade head
```

**Migration includes:**
- DDL for all tables with constraints
- Indexes for performance
- View creation SQL
- Function creation SQL (plpgsql)

### API Design Patterns

1. **School Scoping:** All queries automatically scoped to current user's school via JOIN with users table
2. **Role-Based Access:** 
   - RFID scan: Public (to be secured with API key)
   - Teacher endpoints: Teacher + Admin only
   - Student endpoints: Current user only
3. **Pagination:** Standard page/per_page parameters
4. **Filtering:** Multiple optional query parameters
5. **Bulk Operations:** Accept array of IDs
6. **Validation:** Pydantic models with custom validators

### Frontend Architecture

1. **Next.js App Router:** File-based routing under `(teacher)` group
2. **API Service Layer:** Centralized API calls with TypeScript interfaces
3. **UI Components:** Reusable components from existing design system
4. **Real-time Updates:** Auto-refresh with setInterval
5. **Error Handling:** Try-catch with user-friendly error messages

## What Still Needs to be Implemented

### Backend
- [ ] CSV/PDF export endpoint
- [ ] Stats/analytics endpoint (aggregated data for charts)
- [ ] Overview endpoint (totals per student for all classes)
- [ ] API key authentication for RFID scan endpoint
- [ ] Scheduled job to auto-close open sessions >24h
- [ ] Aggregates recompute trigger (after events change)

### Frontend
- [ ] Full events table with sorting, filtering, editing
- [ ] External work management page (approve/reject UI)
- [ ] RFID card management UI (assign/deactivate cards)
- [ ] Student dashboard (own attendance + register external work)
- [ ] Stats page with charts (top students, trends, heatmap)
- [ ] Overview page (totals per student)
- [ ] CSV export button
- [ ] Edit event modal
- [ ] External work registration form

## Usage Examples

### For Raspberry Pi (RFID Scanner)

```python
import requests

SCAN_URL = "https://team-app.example.com/api/v1/attendance/scan"

def scan_rfid_card(uid):
    response = requests.post(
        SCAN_URL,
        json={"uid": uid, "device_id": "rpi-workshop-1"}
    )
    data = response.json()
    
    if data["status"] == "ok":
        action = data["action"]  # "check_in" or "check_out"
        user = data["user"]
        print(f"{action.upper()}: {user['name']} ({user['class_name']})")
    else:
        print(f"Error: {data.get('message')}")

# Example: Student scans card
scan_rfid_card("ABC123DEF")
```

### For Teachers (API)

```typescript
import { attendanceService } from '@/services/attendance.service';

// Get currently present students
const present = await attendanceService.getPresence();

// Get all events for a specific student
const events = await attendanceService.listEvents({
  user_id: 42,
  page: 1,
  per_page: 50
});

// Approve external work
await attendanceService.approveExternalWork(eventId);

// Bulk delete events
await attendanceService.bulkDeleteEvents([123, 124, 125]);
```

### For Students (API)

```typescript
import { attendanceService } from '@/services/attendance.service';

// Get own attendance totals
const totals = await attendanceService.getMyAttendance();
console.log(`Lesblokken: ${totals.lesson_blocks}`);

// Register external work
await attendanceService.createExternalWork({
  check_in: "2025-01-15T09:00:00Z",
  check_out: "2025-01-15T17:00:00Z",
  location: "Stage bedrijf XYZ",
  description: "Werken aan webapplicatie"
});
```

## Data Model Relationships

```
schools (existing)
  ↓
users (existing)
  ↓
├─ rfid_cards (user_id → users.id)
│  └─ uid (UNIQUE)
│
└─ attendance_events (user_id → users.id)
   ├─ project_id → projects.id (optional)
   ├─ approved_by → users.id (optional)
   └─ created_by → users.id (optional)
```

## Security Considerations

1. **School Scoping:** All queries automatically filtered by school_id
2. **Role Checks:** Teacher/admin required for management endpoints
3. **CSRF Protection:** All mutation endpoints require authentication
4. **RFID Scan Endpoint:** 
   - Currently public for Raspberry Pi access
   - TODO: Add API key or IP whitelist
5. **UID Uniqueness:** Enforced at database level (UNIQUE constraint)
6. **Approval Workflow:** External work requires teacher approval before counting

## Performance Optimizations

1. **Indexes:**
   - user_id, project_id, check_in
   - Partial indexes for open sessions and pending external work
2. **Views:** `open_sessions` pre-joins users for quick presence queries
3. **Aggregates Table:** Cache for expensive calculations (to be used)
4. **Function:** `compute_user_attendance_totals()` for on-demand calculation

## Testing Checklist

- [ ] Run Alembic migration
- [ ] Test RFID scan (check-in)
- [ ] Test RFID scan (check-out)
- [ ] Test RFID scan (unknown UID)
- [ ] Test listing events with filters
- [ ] Test edit event times
- [ ] Test delete event
- [ ] Test bulk delete
- [ ] Test create external work
- [ ] Test approve external work
- [ ] Test reject external work
- [ ] Test bulk approve
- [ ] Test get my attendance (student)
- [ ] Test get presence (teacher)
- [ ] Test RFID card CRUD
- [ ] Test frontend dashboard loads
- [ ] Test frontend auto-refresh
- [ ] Test frontend search
- [ ] Verify duration calculations
- [ ] Verify lesson blocks calculation (total_seconds / 4500)
- [ ] Test permissions (student vs teacher vs admin)

## Migration from Legacy System

### Data Export from MariaDB

```sql
-- Export students with RFID cards
SELECT id, uid, username, name, class, role
FROM students
INTO OUTFILE '/tmp/students_export.csv'
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n';

-- Export attendance logs
SELECT id, uid, check_in, check_out
FROM logs
WHERE check_out IS NOT NULL
INTO OUTFILE '/tmp/logs_export.csv'
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n';

-- Export external work
SELECT id, student_uid, location, description, start_time, end_time, status
FROM external_work
INTO OUTFILE '/tmp/external_work_export.csv'
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n';
```

### Import Strategy (Not Yet Implemented)

1. Match students.username → users.email (in Team App)
2. Create rfid_cards entries for matched users
3. Import logs as attendance_events (is_external=false, source='import')
4. Import external_work as attendance_events (is_external=true, source='import')
5. Handle unmatched entries in quarantine table
6. Provide manual mapping UI for teachers

## Configuration

### Environment Variables

```bash
# Backend (add to .env)
# RFID_API_KEY=your-secret-key-here  # TODO: For Raspberry Pi auth

# Database connection (existing)
DATABASE_URL=postgresql://user:pass@localhost/team_app
```

### CORS Settings

The RFID scan endpoint must be accessible from Raspberry Pi devices:
```python
# backend/app/core/config.py
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://192.168.1.100",  # Add Raspberry Pi IP
]
```

## Next Steps

1. **Immediate:**
   - Test the existing implementation
   - Run database migration
   - Verify all endpoints work

2. **Short-term (Week 1-2):**
   - Complete frontend pages (events table, external work management)
   - Add CSV export
   - Add stats/analytics endpoint
   - Implement RFID card management UI

3. **Medium-term (Week 3-4):**
   - Student portal (own dashboard + external work form)
   - Stats page with charts
   - Raspberry Pi setup guide
   - User documentation

4. **Long-term:**
   - Data migration from legacy system
   - Weekly PDF reports (scheduled job)
   - Email notifications
   - Advanced analytics (heatmaps, trends)

## Documentation References

- **Complete Rebuild Plan:** `docs/3de_blok/REBUILD_PLAN.md` (1140 lines)
- **Architecture Diagrams:** `docs/3de_blok/ARCHITECTURE_DIAGRAM.md`
- **Quick Start Guide:** `docs/3de_blok/QUICK_START.md`
- **Executive Summary:** `docs/3de_blok/REBUILD_SUMMARY.md`

## Contributors

- Implementation: GitHub Copilot
- Planning & Architecture: Based on repository analysis
- Date: 2025-12-21

---

**Status:** ✅ Core backend complete, ✅ Basic frontend implemented, 🔄 Full UI in progress
