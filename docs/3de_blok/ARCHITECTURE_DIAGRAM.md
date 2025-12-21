# Architecture Diagram: 3de Blok → Team Evaluatie App

## Current Architecture (Legacy)

```
┌─────────────────────────────────────────────────────────────┐
│                    3de Blok App (Standalone)                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐     ┌──────────────┐    ┌──────────────┐ │
│  │  Flask App   │────▶│   MariaDB    │    │ Raspberry Pi │ │
│  │              │     │              │    │   (RFID)     │ │
│  │ - Blueprints │     │ - students   │    │              │ │
│  │ - Templates  │     │ - logs       │    │  RC522       │ │
│  │ - Services   │     │ - external_  │    │  Reader      │ │
│  │              │     │   work       │    └──────┬───────┘ │
│  │              │     │ - admins     │           │         │
│  └──────┬───────┘     └──────────────┘           │         │
│         │                                         │         │
│         │          POST /api/scan                 │         │
│         └─────────────────────────────────────────┘         │
│                                                               │
│  Users:                                                       │
│  - Separate login (admins + students)                        │
│  - Own user database                                         │
│  - Own klassen/classes                                       │
│                                                               │
│  Cron Jobs:                                                   │
│  - Weekly PDF reports → OneDrive                             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Target Architecture (Integrated)

```
┌───────────────────────────────────────────────────────────────────────────┐
│                        Team Evaluatie App                                  │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │                     React Frontend (TypeScript)                  │     │
│  ├──────────────────────────────────────────────────────────────────┤     │
│  │                                                                    │     │
│  │  Main Navigation:                                                 │     │
│  │  ├─ Dashboard                                                     │     │
│  │  ├─ Projects                                                      │     │
│  │  ├─ Evaluations                                                   │     │
│  │  └─ [NEW] 3de Blok ◀────────────────────────────────────┐        │     │
│  │      ├─ Dashboard (logs overzicht)                       │        │     │
│  │      ├─ Aanwezig (realtime)                              │        │     │
│  │      ├─ Extern werk                                      │        │     │
│  │      ├─ Admin (students + RFID)                          │        │     │
│  │      ├─ Stats (analytics)                                │        │     │
│  │      └─ Overview (totalen)                               │        │     │
│  │                                                           │        │     │
│  │  Components:                                              │        │     │
│  │  - AttendanceDashboardPage                               │        │     │
│  │  - PresencePage (WebSocket)                              │        │     │
│  │  - ExternalWorkManagementPage                            │        │     │
│  │  - StudentAdminPage                                      │        │     │
│  │  - StatsPage (charts)                                    │        │     │
│  │  - OverviewPage                                          │        │     │
│  │  - StudentDashboardPage                                  │        │     │
│  │                                                           │        │     │
│  └───────────────────────────┬──────────────────────────────┘        │     │
│                              │                                        │     │
│                              │ REST API + WebSocket                   │     │
│                              ▼                                        │     │
│  ┌──────────────────────────────────────────────────────────────┐    │     │
│  │                  Backend (Node.js/Express)                   │    │     │
│  ├──────────────────────────────────────────────────────────────┤    │     │
│  │                                                                │    │     │
│  │  Existing Routes:                                             │    │     │
│  │  - /api/v1/auth                                              │    │     │
│  │  - /api/v1/users                                             │    │     │
│  │  - /api/v1/projects                                          │    │     │
│  │  - /api/v1/evaluations                                       │    │     │
│  │                                                                │    │     │
│  │  [NEW] Attendance Routes:                                     │    │     │
│  │  - POST   /api/v1/attendance/scan        ◀─────┐             │    │     │
│  │  - GET    /api/v1/attendance/events      │     │             │    │     │
│  │  - PATCH  /api/v1/attendance/events/:id  │     │             │    │     │
│  │  - DELETE /api/v1/attendance/events/:id  │     │             │    │     │
│  │  - POST   /api/v1/attendance/external    │     │             │    │     │
│  │  - PATCH  /api/v1/attendance/external/:id/approve           │    │     │
│  │  - GET    /api/v1/attendance/me          │     │             │    │     │
│  │  - GET    /api/v1/attendance/export      │     │             │    │     │
│  │                                            │     │             │    │     │
│  │  Business Logic:                           │     │             │    │     │
│  │  - Toggle check-in/check-out               │     │             │    │     │
│  │  - Compute totals & lesson blocks          │     │             │    │     │
│  │  - Approval workflow (extern werk)         │     │             │    │     │
│  │  - Filters & pagination                    │     │             │    │     │
│  │  - CSV/PDF export generation               │     │             │    │     │
│  │                                            │     │             │    │     │
│  └────────────────────┬───────────────────────┘     │             │    │     │
│                       │                             │             │    │     │
│                       │                             │             │    │     │
│                       ▼                             │             │    │     │
│  ┌──────────────────────────────────────────────────┼─────────┐  │    │     │
│  │              PostgreSQL Database                 │         │  │    │     │
│  ├──────────────────────────────────────────────────┼─────────┤  │    │     │
│  │                                                   │         │  │    │     │
│  │  Existing Tables:                                │         │  │    │     │
│  │  ├─ users (id, username, email, full_name,      │         │  │    │     │
│  │  │          password_hash, role)                 │         │  │    │     │
│  │  ├─ courses (id, name, year)                     │         │  │    │     │
│  │  ├─ projects (id, name, course_id, ...)         │         │  │    │     │
│  │  └─ ... (evaluations, submissions, etc.)        │         │  │    │     │
│  │                                                   │         │  │    │     │
│  │  [NEW] Attendance Tables:                        │         │  │    │     │
│  │  ├─ rfid_cards                                   │         │  │    │     │
│  │  │  ├─ id, user_id (FK → users)                 │         │  │    │     │
│  │  │  ├─ uid (UNIQUE)                              │         │  │    │     │
│  │  │  ├─ label, is_active                          │         │  │    │     │
│  │  │  └─ created_at, created_by                    │         │  │    │     │
│  │  │                                                │         │  │    │     │
│  │  ├─ attendance_events (UNIFIED: school + extern) │         │  │    │     │
│  │  │  ├─ id, user_id (FK → users)                 │         │  │    │     │
│  │  │  ├─ project_id (FK → projects, NULL OK)      │         │  │    │     │
│  │  │  ├─ check_in, check_out (TIMESTAMPTZ)        │         │  │    │     │
│  │  │  ├─ is_external (BOOLEAN)                     │         │  │    │     │
│  │  │  ├─ location, description (extern only)       │         │  │    │     │
│  │  │  ├─ approval_status (pending/approved/...)    │         │  │    │     │
│  │  │  ├─ source (rfid/manual/import/api)          │         │  │    │     │
│  │  │  └─ created_at, updated_at                    │         │  │    │     │
│  │  │                                                │         │  │    │     │
│  │  └─ attendance_aggregates (denormalized cache)   │         │  │    │     │
│  │     ├─ user_id (UNIQUE)                          │         │  │    │     │
│  │     ├─ total_school_seconds                      │         │  │    │     │
│  │     ├─ total_external_approved_seconds           │         │  │    │     │
│  │     ├─ lesson_blocks                             │         │  │    │     │
│  │     └─ last_recomputed_at                        │         │  │    │     │
│  │                                                   │         │  │    │     │
│  │  Views:                                           │         │  │    │     │
│  │  └─ open_sessions (check_out IS NULL)           │         │  │    │     │
│  │                                                   │         │  │    │     │
│  │  Functions:                                       │         │  │    │     │
│  │  └─ compute_user_attendance_totals(user_id)     │         │  │    │     │
│  │                                                   │         │  │    │     │
│  └───────────────────────────────────────────────────┘         │  │    │     │
│                                                                 │  │    │     │
│  ┌───────────────────────────────────────┐                     │  │    │     │
│  │       Scheduled Jobs (Cron/Celery)    │                     │  │    │     │
│  ├───────────────────────────────────────┤                     │  │    │     │
│  │  - Weekly class reports (PDF)         │                     │  │    │     │
│  │  - Nightly auto-close open sessions   │                     │  │    │     │
│  │  - Recompute aggregates (incremental) │                     │  │    │     │
│  └───────────────────────────────────────┘                     │  │    │     │
│                                                                 │  │    │     │
└─────────────────────────────────────────────────────────────────┘  │    │     │
                                                                      │    │     │
┌─────────────────────────────────────────────────────────────────────┘    │     │
│  Hardware Integration                                                     │     │
├───────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  ┌──────────────────────┐                                                       │
│  │   Raspberry Pi       │                                                       │
│  │                      │         HTTPS (JSON)                                  │
│  │  ┌────────────────┐  │         POST /api/v1/attendance/scan                 │
│  │  │  RC522 RFID    │  │         {"uid": "ABC123", "device_id": "rpi-1"}      │
│  │  │  Reader        │  ├─────────────────────────────────────────────────────▶│
│  │  └────────────────┘  │                                                       │
│  │                      │         Response:                                     │
│  │  ┌────────────────┐  │         {"status": "ok", "action": "check_in",       │
│  │  │  LED/Display   │◀─┤          "user": {...}, "event": {...}}              │
│  │  │  Feedback      │  │                                                       │
│  │  └────────────────┘  │                                                       │
│  │                      │                                                       │
│  │  Python Script:      │         Auth: API key of IP whitelist                │
│  │  - Read UID          │                                                       │
│  │  - POST to API       │                                                       │
│  │  - Show feedback     │                                                       │
│  └──────────────────────┘                                                       │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow: RFID Scan

```
Student scant kaart
        │
        ▼
┌───────────────────┐
│  Raspberry Pi     │  1. Read UID van RFID kaart
│  RC522 Reader     │
└────────┬──────────┘
         │
         │ POST /api/v1/attendance/scan
         │ {"uid": "ABC123"}
         ▼
┌───────────────────┐
│  Team App Backend │  2. Lookup user via rfid_cards tabel
│  Scan Endpoint    │     SELECT user_id FROM rfid_cards WHERE uid='ABC123'
└────────┬──────────┘
         │
         │ 3. Check laatste event van deze user
         │    SELECT * FROM attendance_events 
         │    WHERE user_id=X ORDER BY check_in DESC LIMIT 1
         ▼
┌───────────────────┐
│  Business Logic   │  4. Beslissing:
│                   │     - Als check_out IS NULL → CHECK-OUT (close session)
└────────┬──────────┘     - Anders → CHECK-IN (open new session)
         │
         │ 5a. CHECK-OUT:
         │     UPDATE attendance_events 
         │     SET check_out=NOW() WHERE id=last_event_id
         │
         │ 5b. CHECK-IN:
         │     INSERT INTO attendance_events 
         │     (user_id, check_in, source) VALUES (X, NOW(), 'rfid')
         ▼
┌───────────────────┐
│  Response         │  6. Return JSON met actie + student info
│                   │     {"status":"ok", "action":"check_in", 
└────────┬──────────┘      "user":{...}, "event":{...}}
         │
         │ 7. Optioneel: trigger aggregates update
         │    (kan async via queue)
         ▼
┌───────────────────┐
│  Raspberry Pi     │  8. Toon feedback:
│  Feedback         │     - LED groen (success)
└───────────────────┘     - Display: "Welkom Jan! Check-in 10:30"
                          - Beep (audio feedback)
```

## Data Flow: External Work Approval

```
Student registreert extern werk
        │
        ▼
┌───────────────────┐
│  Student Portal   │  1. Vul formulier in:
│  /3de-blok/       │     - Location: "Bedrijf XYZ"
│  student/extern   │     - Description: "Stage"
└────────┬──────────┘     - Start/end datetime
         │                - Optional: project_id
         │
         │ POST /api/v1/attendance/external
         │ {location, description, check_in, check_out, project_id}
         ▼
┌───────────────────┐
│  Backend          │  2. INSERT INTO attendance_events
│  External         │     SET is_external=true, 
│  Endpoint         │         approval_status='pending',
└────────┬──────────┘         source='manual'
         │
         │ 3. Notificatie naar docent (optioneel)
         │    - Email/push notification
         │    - Badge count in UI
         ▼
┌───────────────────┐
│  Teacher Portal   │  4. Docent ziet lijst pending registraties
│  /3de-blok/extern │     - Filter op klas, project, periode
└────────┬──────────┘     - Sorteer op submit date
         │
         │ Docent bekijkt entry details
         ▼
┌───────────────────┐
│  Approval Action  │  5a. APPROVE:
│                   │      PATCH /api/v1/attendance/external/:id/approve
└────────┬──────────┘      UPDATE approval_status='approved', 
         │                         approved_by=teacher_id,
         │                         approved_at=NOW()
         │
         │ 5b. REJECT:
         │     PATCH /api/v1/attendance/external/:id/reject
         │     UPDATE approval_status='rejected'
         │     (+ optional reason in notes)
         ▼
┌───────────────────┐
│  Update           │  6. Herbereken totals (indien approved)
│  Aggregates       │     CALL compute_user_attendance_totals(user_id)
└────────┬──────────┘
         │
         │ 7. Notificatie naar student (optioneel)
         ▼
┌───────────────────┐
│  Student Portal   │  8. Student ziet status update
│  Dashboard        │     - Badge: "Approved" (groen)
└───────────────────┘     - Telt mee in totaal tijd + blokken
```

## Migration Flow

```
┌─────────────────┐
│  Legacy MySQL   │  Step 1: Export
│  (3de Blok)     │  ─────────────────────────────────
└────────┬────────┘  mysql> SELECT ... INTO OUTFILE 
         │             '*.csv'
         │ 
         │ students.csv (uid, username, name, class)
         │ logs.csv (id, uid, check_in, check_out)
         │ external_work.csv (...)
         ▼
┌─────────────────┐
│  CSV Files      │  Step 2: Transform
│  /tmp/*.csv     │  ─────────────────────────────────
└────────┬────────┘  python migrate_students.py
         │           - Match username → Team App users
         │           - Create mapping table
         │           - Quarantine unmatched
         ▼
┌─────────────────┐
│  Mapping Table  │  Step 3: Review
│  + Quarantine   │  ─────────────────────────────────
└────────┬────────┘  Teacher portal: manual mapping UI
         │           - Fuzzy match suggestions
         │           - Link or skip
         │
         │ 95% matched automatically
         │ 5% manual review
         ▼
┌─────────────────┐
│  Import Scripts │  Step 4: Load
│                 │  ─────────────────────────────────
└────────┬────────┘  python migrate_logs.py
         │           - INSERT INTO attendance_events
         │           - Validate constraints
         │           
         │           python migrate_external_work.py
         │           - INSERT INTO attendance_events
         │             (is_external=true)
         ▼
┌─────────────────┐
│  Team App DB    │  Step 5: Validate
│  (Postgres)     │  ─────────────────────────────────
└────────┬────────┘  - Count rows: MySQL vs Postgres
         │           - Spot check random records
         │           - Test queries
         │           - Compute aggregates
         ▼
┌─────────────────┐
│  Production     │  Step 6: Cutover
│  Cutover        │  ─────────────────────────────────
└─────────────────┘  - MySQL → read-only
                     - Raspberry Pi → new endpoint
                     - Teacher training
                     - Go live!
```

## Key Integration Points

### 1. Authentication & Authorization
```
Team App Auth (existing)
    ↓
JWT/Session token
    ↓
All /api/v1/attendance/* endpoints
    ↓
Role-based access:
    - Teacher: full access (CRUD, approve, export)
    - Student: own data + register external
    - Admin: everything + RFID management
```

### 2. User Resolution
```
RFID UID (ABC123)
    ↓
rfid_cards.uid → user_id
    ↓
users.id
    ↓
users.full_name, username, email, role
    ↓
courses (via user_course_enrollment)
    ↓
Display: "V4A" (class name)
```

### 3. Project Linking (Optional)
```
attendance_events.project_id (nullable)
    ↓
projects.id
    ↓
projects.name, course_id
    ↓
Filter attendance per project
Teacher: "Toon aanwezigheid voor Technasium Project 2025"
```

### 4. Real-time Updates
```
RFID scan
    ↓
Backend updates DB
    ↓
WebSocket broadcast
    ↓
Frontend (PresencePage) listens
    ↓
Live update: student X checked in
```

## Performance Considerations

### Indexes (Critical)
- `idx_rfid_cards_uid` - Voor snelle UID lookup bij scan
- `idx_attendance_user_id` - Voor user's events query
- `idx_attendance_open_sessions` - Voor realtime presence
- `idx_attendance_check_in` - Voor datum filters
- `idx_attendance_external_pending` - Voor approval workflow

### Caching
- `attendance_aggregates` tabel - Pre-computed totals
- Redis (optioneel) - Voor hot data (open sessions, stats)

### Query Optimization
- Use views voor complexe queries (open_sessions)
- Pagination altijd (max 100 per page)
- Stats queries: pre-aggregate per week/month

---

**Versie:** 1.0  
**Laatst bijgewerkt:** 2025-12-21
