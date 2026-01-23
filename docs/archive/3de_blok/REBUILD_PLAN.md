# 3de Blok App → Team Evaluatie App: Rebuild Plan

**Datum:** 2025-12-21  
**Doel:** Native integratie van RFID attendance functionaliteit in bestaande Team Evaluatie App (React + Postgres)

---

## 1. Feature Map (Legacy 3de Blok App)

### 1.1 Database Schema (MariaDB/MySQL)

#### Tabel: `students`
**Locatie:** Afgeleid uit `/home/runner/work/rfid_app/rfid_app/blueprints/admin/routes.py`, `/home/runner/work/rfid_app/rfid_app/blueprints/api/routes.py`

**Kolommen:**
- `id` (INT, AUTO_INCREMENT, PK)
- `uid` (VARCHAR(50), UNIQUE) - RFID kaart UID
- `username` (VARCHAR, UNIQUE) - Voor inlog
- `password_hash` (VARCHAR) - Bcrypt hash
- `name` (VARCHAR) - Volledige naam
- `class` (VARCHAR) - Klas (bijv. "V4A", "V5B")
- `role` (ENUM: 'student', 'admin')
- `total_time` (TIME) - Geaccumuleerde tijd (denormalized)
- `is_active` (BOOLEAN, optioneel)

**Business rules:**
- UID kan beginnen als placeholder "PEND-{username}-{random}" als nog geen fysieke kaart
- Username is lowercase, geen spaties
- Password minimaal 8 tekens

#### Tabel: `logs`
**Locatie:** `/home/runner/work/rfid_app/rfid_app/blueprints/api/routes.py`, `/home/runner/work/rfid_app/rfid_app/blueprints/dashboard/routes.py`

**Kolommen:**
- `id` (INT, AUTO_INCREMENT, PK)
- `uid` (VARCHAR(50), FK → students.uid)
- `check_in` (DATETIME)
- `check_out` (DATETIME, NULL)
- `duration` (TIME, computed/cached, optioneel)

**Business rules:**
- Check-in zonder check-out = "open sessie" (student is aanwezig)
- Check-out moet > check_in
- Duration berekend als TIMESTAMPDIFF(SECOND, check_in, check_out)
- Na wijziging logs: `recompute_total_time(uid)` wordt aangeroepen

#### Tabel: `external_work`
**Locatie:** `/home/runner/work/rfid_app/rfid_app/blueprints/extern/routes.py`

**Kolommen:**
- `id` (INT, AUTO_INCREMENT, PK)
- `student_uid` (VARCHAR(50), FK → students.uid)
- `name` (VARCHAR) - Student naam (denormalized)
- `class` (VARCHAR) - Klas (denormalized)
- `location` (VARCHAR) - Locatie extern werk
- `description` (TEXT) - Omschrijving
- `start_time` (DATETIME)
- `end_time` (DATETIME)
- `status` (ENUM: 'pending', 'approved', 'rejected')

**Business rules:**
- Student registreert externe werkuren (buiten school)
- Status 'pending' = wacht op docent goedkeuring
- Alleen 'approved' telt mee voor totale tijd
- Duration berekend als TIMESTAMPDIFF(SECOND, start_time, end_time)

#### Tabel: `admins`
**Locatie:** `/home/runner/work/rfid_app/rfid_app/blueprints/core/routes.py`

**Kolommen:**
- `id` (INT, AUTO_INCREMENT, PK)
- `username` (VARCHAR, UNIQUE)
- `password_hash` (VARCHAR)
- `is_active` (BOOLEAN)

**Business rules:**
- Apart van students tabel
- Aparte login op `/` route


### 1.2 Routes & Endpoints (Flask Blueprints)

#### Blueprint: `core` - Admin Login
**File:** `blueprints/core/routes.py`
- `GET/POST /` - Admin/docent login
- `GET /logout` - Logout  
- `GET /healthz` - Health check (DB ping)

#### Blueprint: `api` - RFID Hardware Integration  
**File:** `blueprints/api/routes.py`
- `POST /api/scan` - **KRITIEK: RFID scan endpoint voor Raspberry Pi**
  - Input: `{"uid": "ABC123"}`
  - Logic: Zoek student → check laatste log → toggle check-in/check-out
  - Output: `{status, action, student, log}`
  - CSRF exempt
  
**Business logic:**
- Als laatste log heeft check_out=NULL → doe check-out (sluit sessie)
- Anders → doe check-in (open nieuwe sessie)

#### Blueprint: `dashboard` - Logs Management
**File:** `blueprints/dashboard/routes.py`
- `GET/POST /dashboard` - Overzicht alle logs met filters
- `POST /delete_log` - Verwijder één log
- `POST /dashboard/edit_log` - Edit check-in/out tijden
- `GET /dashboard/export` - CSV export

**Filters:** name (LIKE), class (LIKE), date (exact)
**Bulk actions:** Delete selected → recompute_total_time per UID

#### Blueprint: `admin` - Student CRUD
**File:** `blueprints/admin/routes.py`
- `GET/POST /admin` - CRUD students (add, edit, delete, password reset)
- `GET /admin/export` - Export students CSV  
- `GET /download_import_template` - Download CSV template
- `POST /admin/import_students` - Bulk import via CSV (calls script)

**Features:**
- Genereer tijdelijk wachtwoord (14 chars random)
- Username altijd lowercase zonder spaties
- Role: student of admin


#### Blueprint: `extern` - External Work
**File:** `blueprints/extern/routes.py`
- `GET/POST /extern` - Student: registreer externe werkuren
- `GET/POST /extern_beheer` - Docent: beheer externe registraties  
- `POST /extern_verwijder` - Delete extern werk
- `GET /extern/export` - CSV export

**Bulk actions:**
- approve_selected / reject_selected / delete_selected
- approve_filtered_pending (goedkeur ALLE pending binnen filter)

**Filters:** name, class, status (pending/approved/rejected)

#### Blueprint: `student` - Student Portal
**File:** `blueprints/student/routes.py`
- `GET/POST /student_login` - Student login (username + password)
- `GET /student_dashboard` - Eigen logs + externe registraties + totalen
- `GET /student_logout` - Logout

**Dashboard toont:**
- School tijd (via logs)
- Externe tijd (approved external_work)
- Combined tijd + lesblokken (totaal / 75 min)
- Lijst externe registraties met status

#### Blueprint: `overview` - Total Overview
**File:** `blueprints/overview/routes.py`
- `GET /overview` - Totaaloverzicht per student
- `GET /overview/export` - CSV export

**Berekeningen:**
- school_time: SUM(TIMESTAMPDIFF logs WHERE check_out NOT NULL)
- external_time: SUM(TIMESTAMPDIFF external_work WHERE status='approved')
- lesson_blocks: (school + external) / (75*60)

#### Blueprint: `stats` - Analytics Dashboard
**File:** `blueprints/stats/routes.py`
- `GET /stats` - Dashboard met grafieken en statistieken

**Filters:** class, month

**Metrics:**
- Top 5 students (meeste uren)
- Attendance per dag (COUNT DISTINCT uid per DATE)
- Trend per week (SUM hours per YEARWEEK)
- Total school vs external seconds
- No activity last 14 days list
- Alerts: >50% daling t.o.v. vorige maand
- Heatmap: WEEKDAY x HOUR attendance counts (laatste 14 dagen)

#### Blueprint: `presence` - Real-time Presence
**File:** `blueprints/presence/routes.py`
- `GET /aanwezig` - Realtime: wie is nu aanwezig

**Query:** Alle logs WHERE check_out IS NULL
**Output:** naam, klas, check_in tijd


### 1.3 Services & Business Logic

#### `services/attendance.py`
**Functie:** `recompute_total_time(uid: str)`
- Herbereken students.total_time op basis van alle geldige logs
- SUM(TIMESTAMPDIFF WHERE check_out NOT NULL AND check_out > check_in)
- UPDATE students SET total_time = SEC_TO_TIME(total_secs)
- Called na delete/edit logs

#### `services/exports.py`
**Functie:** `stream_csv(filename, header, rows_iterable)`
- Streaming CSV response met UTF-8 BOM (Excel compatibility)
- Timestamp in filename: YYYYMMDD_HHMMSS
- Error handling in stream

#### `services/utils.py`
**Functie:** `gen_temp_password(n=14)`
- Genereer random password (ascii letters + digits)
- Voor nieuwe students

### 1.4 Cron Scripts & Automation

#### `scripts/weekly_class_reports.py`
**Doel:** Automatische wekelijkse PDF rapporten per klas
**Schedule:** Cron weekly (maandag ochtend)

**Logic:**
1. Bepaal vorige week (maandag-zondag)
2. Per klas: haal alle students
3. Per student berekeningen:
   - School tijd deze week (via logs.duration)
   - Extern goedgekeurd deze week
   - Extern pending deze week  
   - Totaal blokken (all-time)
4. Genereer PDF met fpdf (tabel met 8 kolommen)
5. Upload naar OneDrive (rclone)
6. Cleanup: verwijder PDFs > 8 weken oud

**Output:** `/home/rfiduser/backups/klasoverzichten/aanwezigheid_{klas}_{date}.pdf`

#### `scripts/import_students.py`
**Doel:** Bulk import students via CSV  
**Trigger:** Manual / Web UI POST /admin/import_students

**CSV format:** uid, username, name, class, role, password
- Upsert logic op username (primary key voor matching)
- Placeholder UIDs als UID leeg: "PEND-{username}-{random}"
- ensure_unique_uid check
- Genereer passwords voor nieuwe students zonder password
- Output credentials CSV naar /tmp

**Validatie:**
- Username lowercase, no spaces
- Role in ['student', 'admin']
- Check UID conflicts

#### `scripts/generate_passwords.py`
**Doel:** Genereer nieuwe wachtwoorden voor students  
**Trigger:** Manual

#### `scripts/set_password.py`
**Doel:** Zet/reset wachtwoord voor specifieke student  
**Trigger:** Manual

#### `scripts/fix_usernames.py`
**Doel:** Cleanup usernames (lowercase, geen spaties)  
**Trigger:** Manual


### 1.5 UI Flows & Templates (Jinja2)

**Templates gebruikt:**
- `_base.html` - Base layout met nav
- `login.html` - Admin login
- `student_login.html` - Student login
- `dashboard.html` - Logs overzicht (filters, tabel, bulk actions)
- `admin.html` - Student CRUD (toevoegen, bewerken, wachtwoorden, import)
- `extern_beheer.html` - External work management
- `external_form.html` - Student: registreer extern werk
- `student_dashboard.html` - Student eigen overzicht
- `overview.html` - Totaaloverzicht per student
- `stats.html` - Stats dashboard met charts (Chart.js?)
- `aanwezig.html` - Realtime presence list

**Admin flows:**
1. Login → Dashboard (logs) → Filters/edit/delete
2. Admin panel → CRUD students → Import CSV
3. Extern beheer → Approve/reject
4. Stats → Visualisaties
5. Overview → Totalen per student
6. Aanwezig → Realtime

**Student flows:**
1. Student login → Dashboard (eigen logs + extern)
2. Registreer extern werk → Pending status

### 1.6 Hardware Integration (RFID)

**Raspberry Pi setup:**
- RC522 RFID reader
- Python script leest kaart UID
- POST naar `/api/scan` met `{"uid": "..."}`
- Response: student naam + actie (check_in/check_out) + timestamps
- Feedback: LED/display/beep

**Endpoint details:**
- No auth required (trusted network / optional IP whitelist)
- CSRF exempt
- JSON response

**Edge case:** Herhaalde scan binnen X seconden = idempotent (zelfde actie)

### 1.7 Edge Cases & Business Rules

**Open sessies:**
- Vergeten uitchecken → blijft open tot handmatige correctie
- Nieuwe check-in terwijl vorige open → handmatige interventie nodig (NOT auto-closed)

**Time calculations:**
- check_out < check_in → duration = 0 (invalid)
- NULL check_out → duration = 0 (ongoing)
- Max duration cap: 3020399 seconden (~35 dagen)

**Externe registraties:**
- Alleen 'approved' telt mee voor totaal
- Student ziet eigen pending maar kan niet wijzigen status
- Docent kan bulk goedkeuren

**Blokken berekening:**
- 1 blok = 75 minuten
- Afgerond op 1 decimaal

**Timezone:**
- Europe/Amsterdam (SET time_zone in MySQL connection)
- Fallback offset: +02:00

**Session management:**
- Flask session cookies (HttpOnly, SameSite=Lax, Secure in prod)
- Separate sessions: admin vs student (verschillende login routes)


---

## 2. Mapping: Legacy → Team Evaluatie App

### 2.1 Entity Mapping Table

| Legacy (3de Blok)       | Team App Entity        | Mapping Strategy                                      |
|-------------------------|------------------------|-------------------------------------------------------|
| `students.username`     | `users.username`       | Direct match (lowercase)                              |
| `students.name`         | `users.full_name`      | Direct match                                          |
| `students.class`        | `courses.name` or `classes.name` | Via lookup / manual mapping UI                  |
| `students.uid` (RFID)   | **NEW: `rfid_cards`**  | New table, FK to users.id                             |
| `students.role`         | `users.role`           | Map 'student'→'student', 'admin'→'teacher'            |
| `students.password_hash`| `users.password_hash`  | Direct copy (if compatible hash, else re-hash)        |
| `logs`                  | **NEW: `attendance_events`** | New table, FK to users.id + optional project_id |
| `external_work`         | **NEW: `attendance_events`** | Same table, flag `is_external=true`             |
| `admins`                | `users` (role=teacher) | Merge into users table                                |

### 2.2 Nieuwe Entiteiten in Team App (Postgres)

1. **`rfid_cards`** - Koppeling RFID UID aan user
   - Kolommen: id, user_id, uid, label, is_active, created_at
   
2. **`attendance_events`** - Unified check-in/out + external work
   - Kolommen: id, user_id, project_id (nullable), check_in, check_out, is_external, location, description, approval_status, source, created_at

3. **`attendance_aggregates`** (optioneel) - Cached totals
   - Kolommen: user_id, total_school_seconds, total_external_approved_seconds, lesson_blocks, last_recomputed_at

### 2.3 Herbruikbare Entiteiten (bestaand in Team App)

**Assumptions:**
- `users` (id, username, email, full_name, role, password_hash)
- `courses` or `classes` (id, name, year)
- `projects` (id, name, course_id, start_date, end_date)
- `user_course_enrollment` (users ↔ courses)
- `project_members` (users ↔ projects)
- Auth system (JWT/session) bestaand

### 2.4 Ontbrekende Data

**Moet toegevoegd:**
1. RFID UID per user (tabel `rfid_cards`)
2. Attendance events (timestamps)
3. External work met approval flow
4. Aggregates (optional caching)

**Te verifiëren:**
- Welke user identifier? (username, email, student_number?)
- Hoe zijn klassen georganiseerd? (courses vs classes vs groups?)
- Projecten: verplicht of optioneel koppelen?


---

## 3. Nieuw Datamodel (Postgres)

### 3.1 Schema DDL

```sql
-- Tabel: rfid_cards
CREATE TABLE rfid_cards (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    uid VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id)
);

CREATE INDEX idx_rfid_cards_user_id ON rfid_cards(user_id);
CREATE INDEX idx_rfid_cards_uid ON rfid_cards(uid) WHERE is_active = true;

-- Tabel: attendance_events (unified: school + external)
CREATE TABLE attendance_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    
    check_in TIMESTAMPTZ NOT NULL,
    check_out TIMESTAMPTZ,
    
    is_external BOOLEAN NOT NULL DEFAULT false,
    location VARCHAR(200),
    description TEXT,
    approval_status VARCHAR(20) CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    
    source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('rfid', 'manual', 'import', 'api')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id),
    
    CONSTRAINT check_valid_times CHECK (check_out IS NULL OR check_out > check_in),
    CONSTRAINT check_external_fields CHECK (
        (is_external = false) OR 
        (is_external = true AND location IS NOT NULL AND approval_status IS NOT NULL)
    )
);

CREATE INDEX idx_attendance_user_id ON attendance_events(user_id);
CREATE INDEX idx_attendance_project_id ON attendance_events(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_attendance_check_in ON attendance_events(check_in);
CREATE INDEX idx_attendance_open_sessions ON attendance_events(user_id, check_in) WHERE check_out IS NULL;
CREATE INDEX idx_attendance_external_pending ON attendance_events(user_id, approval_status) 
  WHERE is_external = true AND approval_status = 'pending';

-- Tabel: attendance_aggregates (denormalized cache, optioneel)
CREATE TABLE attendance_aggregates (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    total_school_seconds INTEGER NOT NULL DEFAULT 0,
    total_external_approved_seconds INTEGER NOT NULL DEFAULT 0,
    lesson_blocks DECIMAL(10,1) NOT NULL DEFAULT 0,
    last_recomputed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attendance_aggregates_user_id ON attendance_aggregates(user_id);
```

### 3.2 Views & Functions

```sql
-- View: open_sessions
CREATE VIEW open_sessions AS
SELECT 
    ae.id,
    ae.user_id,
    u.full_name,
    u.username,
    ae.check_in,
    ae.project_id,
    p.name AS project_name,
    EXTRACT(EPOCH FROM (NOW() - ae.check_in))::INTEGER AS duration_seconds
FROM attendance_events ae
JOIN users u ON ae.user_id = u.id
LEFT JOIN projects p ON ae.project_id = p.id
WHERE ae.check_out IS NULL AND ae.is_external = false;

-- Function: compute_user_attendance_totals
CREATE OR REPLACE FUNCTION compute_user_attendance_totals(p_user_id INTEGER)
RETURNS TABLE(
    total_school_seconds INTEGER,
    total_external_approved_seconds INTEGER,
    lesson_blocks DECIMAL(10,1)
) AS $$
DECLARE
    school_secs INTEGER;
    external_secs INTEGER;
BEGIN
    SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (check_out - check_in))::INTEGER), 0)
    INTO school_secs
    FROM attendance_events
    WHERE user_id = p_user_id 
      AND is_external = false 
      AND check_out IS NOT NULL
      AND check_out > check_in;
    
    SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (check_out - check_in))::INTEGER), 0)
    INTO external_secs
    FROM attendance_events
    WHERE user_id = p_user_id 
      AND is_external = true 
      AND approval_status = 'approved'
      AND check_out IS NOT NULL
      AND check_out > check_in;
    
    RETURN QUERY SELECT 
        school_secs,
        external_secs,
        ROUND(((school_secs + external_secs)::DECIMAL / (75 * 60)), 1);
END;
$$ LANGUAGE plpgsql;
```

### 3.3 Migratie Overwegingen

**MySQL → Postgres differences:**
- `TIMESTAMPDIFF(SECOND, a, b)` → `EXTRACT(EPOCH FROM (b - a))::INTEGER`
- `SEC_TO_TIME(seconds)` → `(seconds || ' seconds')::INTERVAL` (of format in app layer)
- `TIME` type → Gebruik INTEGER seconds of INTERVAL
- Timezone: TIMESTAMPTZ (UTC storage, auto-convert based on connection timezone)

**Connection setup:**
- `SET TIME ZONE 'Europe/Amsterdam'`


---

## 4. API Ontwerp (REST)

### 4.1 RFID Scan Endpoint

**POST /api/v1/attendance/scan**

**Auth:** API key (voor Raspberry Pi) of IP whitelist

**Request:**
```json
{
  "uid": "ABC123DEF",
  "device_id": "rpi-workshop-1"
}
```

**Response (Check-in):**
```json
{
  "status": "ok",
  "action": "check_in",
  "user": {
    "id": 42,
    "username": "jdoe",
    "full_name": "John Doe",
    "class": "V4A"
  },
  "event": {
    "id": 1234,
    "check_in": "2025-12-21T10:30:00Z",
    "check_out": null
  }
}
```

**Response (Check-out):**
```json
{
  "status": "ok",
  "action": "check_out",
  "user": {...},
  "event": {
    "id": 1234,
    "check_in": "2025-12-21T10:30:00Z",
    "check_out": "2025-12-21T12:45:00Z",
    "duration_seconds": 8100
  }
}
```

**Errors:**
```json
// UID not found
{"status": "not_found", "error": "uid_not_found", "message": "Geen gebruiker gevonden"}

// UID missing
{"status": "error", "error": "uid_missing", "message": "Body moet JSON bevatten met 'uid'"}

// Server error  
{"status": "error", "error": "server_error", "message": "Onverwachte fout"}
```

### 4.2 Teacher Endpoints

**GET /api/v1/attendance/events**
- Query params: user_id, project_id, class, start_date, end_date, is_external, status_open, page, per_page
- Response: {events: [...], pagination: {...}}

**PATCH /api/v1/attendance/events/:id** - Edit event
**DELETE /api/v1/attendance/events/:id** - Delete event
**POST /api/v1/attendance/events/bulk-delete** - Bulk delete

### 4.3 External Work Endpoints

**POST /api/v1/attendance/external** - Student registreert extern werk
**GET /api/v1/attendance/external** - List (filters: status, user_id, class, project_id)
**PATCH /api/v1/attendance/external/:id/approve** - Goedkeuren
**PATCH /api/v1/attendance/external/:id/reject** - Afwijzen
**POST /api/v1/attendance/external/bulk-approve** - Bulk approve met filters

### 4.4 Student Endpoints

**GET /api/v1/attendance/me** - Eigen historie + totalen

Response:
```json
{
  "school_time_seconds": 180000,
  "external_approved_seconds": 72000,
  "external_pending_seconds": 14400,
  "lesson_blocks": 56.0,
  "events": [...]
}
```

### 4.5 Export Endpoints

**GET /api/v1/attendance/export?format=csv|pdf** - Export met filters


---

## 5. UI Rebuild Plan (React + TypeScript)

### 5.1 Route Structuur

```
/app/3de-blok                     ← Nieuw nav item
  /dashboard                      ← Teacher: logs overzicht
  /aanwezig                       ← Realtime presence
  /extern                         ← Teacher: extern werk beheer
  /admin                          ← Teacher: student/RFID beheer
  /stats                          ← Teacher: statistieken
  /overview                       ← Teacher: totaaloverzicht
  /student/dashboard              ← Student: eigen overzicht
  /student/extern                 ← Student: registreer extern werk
```

### 5.2 Component Trees

#### AttendanceDashboardPage (Teacher)
```
AttendanceDashboardPage
├─ PageHeader (title: "Aanwezigheid Dashboard")
├─ AttendanceFilters
│  ├─ Input (name search)
│  ├─ Select (class filter)
│  ├─ DatePicker (date filter)
│  └─ Checkbox (alleen open sessies)
├─ AttendanceTable
│  ├─ Table (sortable columns)
│  │  └─ AttendanceRow
│  │     ├─ Checkbox (bulk select)
│  │     ├─ Data cells (name, class, check_in, check_out, duration)
│  │     ├─ EditButton → EditAttendanceModal
│  │     └─ DeleteButton → ConfirmDialog
│  └─ BulkActions
│     ├─ BulkDeleteButton
│     └─ ExportButton (CSV)
└─ Pagination
```

**State:** events[], filters{}, selectedIds[], loading, error
**API:** React Query hook `useAttendanceEvents(filters, page)`

#### PresencePage (Teacher)
```
PresencePage
├─ PageHeader (aantal aanwezig badge)
└─ PresenceGrid
   └─ PresenceCard (naam, klas, check-in tijd, live duration)
```

**State:** openSessions[] (WebSocket real-time)
**Real-time:** WebSocket connection voor updates

#### ExternalWorkManagementPage (Teacher)
```
ExternalWorkManagementPage
├─ PageHeader
├─ ExternalWorkFilters (name, class, status, project)
├─ ExternalWorkTable
│  └─ ExternalWorkRow
│     ├─ Data (location, description, times, status badge)
│     ├─ ApproveButton
│     ├─ RejectButton → RejectReasonModal
│     └─ DeleteButton
├─ BulkActions (approve selected, reject selected, delete selected)
└─ BulkApproveFilteredButton (approve ALL pending binnen filter)
```

#### StudentAdminPage (Teacher)
```
StudentAdminPage
├─ PageHeader
├─ StudentFilters (name, class, username)
├─ ActionButtons
│  ├─ AddStudentButton → AddStudentModal
│  ├─ ImportStudentsButton → ImportCSVModal
│  └─ ExportButton
└─ StudentTable
   └─ StudentRow
      ├─ Data (username, name, class, role, total_time)
      ├─ EditButton → EditStudentModal
      ├─ DeleteButton
      ├─ PasswordResetButton → PasswordResetModal
      └─ ManageRFIDButton → RFIDManagementModal
```

**RFIDManagementModal:**
- List current UIDs (active/inactive)
- Add new UID form
- Deactivate UID button

#### StatsPage (Teacher)
```
StatsPage
├─ PageHeader
├─ StatsFilters (class, month)
├─ MetricsGrid
│  ├─ Card (total school time)
│  ├─ Card (total external time)
│  ├─ Card (avg per student)
│  └─ Card (active students today)
├─ ChartsGrid
│  ├─ Top5StudentsChart (bar chart)
│  ├─ TrendPerWeekChart (line chart)
│  ├─ AttendancePerDayChart (bar chart)
│  └─ HeatmapChart (weekday x hour grid)
├─ AlertsList
│  ├─ NoActivityStudents
│  └─ BigDropAlerts (>50% daling)
```

**Charts:** Recharts or Chart.js (match Team App convention)

#### StudentDashboardPage (Student)
```
StudentDashboardPage
├─ PageHeader (Welkom {name})
├─ SummaryCards
│  ├─ Card (total tijd)
│  ├─ Card (lesblokken)
│  ├─ Card (school tijd)
│  └─ Card (externe tijd)
├─ Tabs
│  ├─ Tab (Mijn aanwezigheid)
│  │  └─ MyAttendanceTable (check-ins/outs)
│  └─ Tab (Extern werk)
│     ├─ RegisterExternalButton → ExternalWorkFormModal
│     └─ MyExternalWorkTable (met status badges)
```

### 5.3 Design System Hergebruik

**Assumptie Team App components:**
- `<Button variant="primary|secondary|ghost|danger">`
- `<Input>`, `<Select>`, `<DatePicker>`, `<Checkbox>`
- `<Table>`, `<Pagination>`
- `<Modal>`, `<ConfirmDialog>`
- `<Card>`, `<Badge>`, `<Tag>`
- `<Loader>`, `<ErrorBoundary>`
- `<PageHeader>`, `<Filters>`, `<ContentWrapper>`

**State management:**  
- React Query / SWR voor data fetching
- Zustand / Redux voor global state (optioneel)

### 5.4 Loading & Error States

**Loading:**
- Skeleton loaders voor tables
- Button spinners tijdens submit
- Progressive loading (infinite scroll of pagination)

**Error:**
- Toast notifications (react-hot-toast / antd notifications)
- Inline error messages in forms
- Empty states ("Geen resultaten")
- Retry buttons

**Optimistic updates:**
- Approve/reject → update UI direct → rollback on error


---

## 6. Migratieplan (MariaDB → Postgres)

### 6.1 Export Strategie

**Stap 1: Export MySQL naar CSV**

```bash
mysql -u rfid_user -p attendance -e "
  SELECT id, uid, username, name, \`class\`, role, is_active
  INTO OUTFILE '/tmp/students_export.csv'
  FIELDS TERMINATED BY ',' ENCLOSED BY '"'
  LINES TERMINATED BY '\n'
  FROM students;"

mysql -u rfid_user -p attendance -e "
  SELECT id, uid, check_in, check_out
  INTO OUTFILE '/tmp/logs_export.csv'
  FIELDS TERMINATED BY ',' ENCLOSED BY '"'
  LINES TERMINATED BY '\n'
  FROM logs;"

mysql -u rfid_user -p attendance -e "
  SELECT id, student_uid, location, description, start_time, end_time, status
  INTO OUTFILE '/tmp/external_work_export.csv'
  FIELDS TERMINATED BY ',' ENCLOSED BY '"'
  LINES TERMINATED BY '\n'
  FROM external_work;"
```

**Stap 2: Validatie**
- Count rows: `wc -l /tmp/*.csv`
- Check duplicates
- Check data quality

### 6.2 Transformatie Scripts

**Script: migrate_students.py**
```python
# 1. Lees students CSV
# 2. Voor elke student:
#    - Match op username → Team App users.username
#    - Fallback: email match
#    - Als niet gevonden: add to quarantine
# 3. Voor matched students:
#    - INSERT INTO rfid_cards (user_id, uid)
# 4. Rapport: matched, unmatched, errors
```

**Script: migrate_logs.py**
```python
# 1. Lees logs CSV
# 2. Voor elke log:
#    - Resolve uid → user_id (via rfid_cards)
#    - INSERT INTO attendance_events (is_external=false, source='import')
# 3. Valideer: geen overlaps, check_out > check_in
# 4. Rapport
```

**Script: migrate_external_work.py**
```python
# 1. Lees external_work CSV
# 2. Voor elke entry:
#    - Resolve student_uid → user_id
#    - INSERT INTO attendance_events (is_external=true, source='import')
# 3. Rapport
```

### 6.3 Quarantine & Manual Mapping

**Quarantine tabel:**
```sql
CREATE TABLE migration_quarantine (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50),
    legacy_uid VARCHAR(50),
    legacy_username VARCHAR(100),
    legacy_name VARCHAR(200),
    legacy_class VARCHAR(50),
    resolved_user_id INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Manual Mapping UI:**
- Teacher portal: lijst unresolved entries
- Fuzzy match suggestions (naam similarity)
- Link button → resolve
- Skip button → markeer als skipped

### 6.4 Dry Run Checklist

**Pre-migration:**
- [ ] Backup Team App DB
- [ ] Test Postgres connection
- [ ] Verify users/courses exist in Team App
- [ ] Export MySQL to CSV
- [ ] Validate CSV encoding/format
- [ ] Count rows

**Dry run:**
- [ ] Run scripts with --dry-run
- [ ] Check mapping success rate (target >95%)
- [ ] Review quarantine
- [ ] Validate no overlapping sessions
- [ ] Check duration calculations
- [ ] Verify timezone conversions

**Post-migration:**
- [ ] Compare counts MySQL vs Postgres
- [ ] Spot check random records
- [ ] Test queries performance
- [ ] Run compute_user_attendance_totals
- [ ] Validate lesson_blocks
- [ ] Test API endpoints

**Rollback:**
- Keep MySQL read-only for 2 weeks
- Postgres in separate schema initially
- Cutover after validation


---

## 7. Implementatie Roadmap

### Milestone 1: Foundation (Week 1-2)

**Backend:**
- [ ] Create Postgres schema (tables, indexes, functions)
- [ ] Implement POST /api/v1/attendance/scan
- [ ] Write migration scripts (dry-run mode)

**Frontend:**
- [ ] Add "3de Blok" to nav
- [ ] Create route structure
- [ ] Build AttendanceDashboardPage (basic list)
- [ ] Build PresencePage

**Testing:**
- Unit: scan endpoint logic
- Integration: database functions
- Manual: RFID scan

**Deliverable:** Working scan endpoint + basic teacher view

### Milestone 2: Teacher Features (Week 3-4)

**Backend:**
- [ ] GET /api/v1/attendance/events (filters, pagination)
- [ ] PATCH/DELETE events
- [ ] External work endpoints (POST, GET, approve/reject)
- [ ] Bulk actions

**Frontend:**
- [ ] Complete AttendanceDashboardPage (filters, edit, delete, bulk)
- [ ] Build ExternalWorkManagementPage
- [ ] Build StudentAdminPage (CRUD + RFID management)
- [ ] CSV export

**Testing:**
- E2E: filter + pagination
- Unit: bulk actions
- Manual: edit/delete, approve

**Deliverable:** Full teacher dashboard + external work workflow

### Milestone 3: Advanced Features (Week 5-6)

**Backend:**
- [ ] Stats endpoints (aggregates, charts data)
- [ ] Overview endpoint
- [ ] WebSocket for realtime presence
- [ ] Scheduled job: weekly reports

**Frontend:**
- [ ] StatsPage met charts
- [ ] OverviewPage
- [ ] Realtime updates (WebSocket)
- [ ] StudentDashboardPage

**Testing:**
- Performance: stats queries
- Load: concurrent scans
- Manual: charts, realtime

**Deliverable:** Stats, realtime presence, student portal

### Milestone 4: Migration & Polish (Week 7-8)

**Migration:**
- [ ] Dry-run migration
- [ ] Build manual mapping UI
- [ ] Resolve quarantine
- [ ] Execute full migration
- [ ] Validate data

**Polish:**
- [ ] CSV/PDF exports (all pages)
- [ ] Loading skeletons + error boundaries
- [ ] Aggregates recompute trigger
- [ ] Audit logging
- [ ] Performance optimizations

**Testing:**
- UAT
- Cross-browser
- Mobile responsive
- Performance benchmarks

**Deliverable:** Migrated data + production-ready

### Milestone 5: Deployment (Week 9)

**Deployment:**
- [ ] Deploy backend (blue-green)
- [ ] Deploy frontend (CDN)
- [ ] Configure Raspberry Pi
- [ ] Setup monitoring (Sentry/Datadog)

**Training:**
- [ ] Docent training
- [ ] Student instructies
- [ ] Admin guide

**Handover:**
- [ ] API docs
- [ ] Runbook
- [ ] Backup procedures
- [ ] Cutover plan

**Deliverable:** Live production system + trained users


---

## 8. Risico's & Edge Cases

### 8.1 Risico's

| Risico | Impact | Mitigatie |
|--------|--------|-----------|
| Mapping mismatch (students niet vindbaar) | HIGH | Quarantine + manual mapping UI |
| Timezone bugs (MySQL vs Postgres) | MEDIUM | Extensive testing, store UTC |
| Performance (stats queries traag) | MEDIUM | Indexes, aggregates, caching |
| Concurrent scans (race condition) | LOW | Transaction isolation, optimistic locking |
| Open session vergeten (niet uitchecken) | LOW | Nightly job: auto-close >24h |
| RFID duplicaat (2 studenten zelfde UID) | LOW | Unique constraint, admin alert |
| External work misbruik (fake uren) | MEDIUM | Approval workflow, >8h/dag alert |
| Data loss tijdens migratie | HIGH | Dry-run, backups, rollback plan |

### 8.2 Edge Cases

**Open sessies:**
- Vergeten check-out → Nightly job close na 24h + notificatie
- Dubbele check-in (oude open) → Auto-close oude + open nieuwe (of error)

**Externe registraties:**
- Overlappende tijd (school + extern) → Validatie + warning
- Start_time toekomst → Max 1 week vooruit
- >12h duur → Extra approval niveau

**RFID:**
- UID niet gekoppeld → 404 + "Vraag docent om kaart te activeren"
- Kaart verloren → Admin deactivate + nieuwe toewijzen

**Project koppeling:**
- Event zonder project → project_id=NULL allowed
- Project archived → Soft delete, keep FK

**Permissions:**
- Student edit andermans log → Backend authz check
- Teacher andere klas → Optional: restrict by enrollment

**Performance:**
- 100+ concurrent scans → Connection pooling, queue
- Stats timeout bij 50k+ events → Pre-aggregate, caching


---

## 9. Assumptions & Verificaties

### Assumptions

1. **Team App heeft users tabel** met username, email, full_name, role
   - *Verify:* Check schema

2. **Team App heeft courses/classes** die mapped kunnen worden
   - *Verify:* Inspect courses tabel

3. **Team App gebruikt JWT/sessie auth** die hergebruikt kan
   - *Verify:* Review auth middleware

4. **Raspberry Pi kan HTTPS calls** naar Team App
   - *Verify:* Test connectivity

5. **Frontend is React + TypeScript** met component library
   - *Verify:* Check package.json

6. **Geen bestaande attendance module** (geen conflicts)
   - *Verify:* Scan routes + schema

7. **Docenten hebben role 'teacher'**
   - *Verify:* Check users.role values

8. **Project koppeling optioneel**
   - *Verify:* Confirm with product owner

### Te Verifiëren

- [ ] Welke user identifier voor matching? (username/email/student_number?)
- [ ] Hoe zijn klassen georganiseerd? (courses/classes/groups?)
- [ ] Bestaande projecten voor attendance koppeling?
- [ ] Wie mag external work goedkeuren?
- [ ] Wat met oude 3de Blok app na migratie?
- [ ] Max concurrent scans voor performance planning?
- [ ] Voorkeur charting library?

---

## 10. Volgende Stappen

1. **Kick-off meeting** met Team App developers
   - Review dit plan
   - Verify assumptions
   - Align milestones

2. **Team App schema inspection**
   - Export schema
   - Identify exact mapping
   - Confirm fields

3. **Design review** met UX/UI
   - Wireframes
   - Component reuse
   - Navigation integration

4. **Prototype scan endpoint**
   - Standalone test
   - Raspberry Pi test
   - Validate response

5. **Dry-run migratie**
   - Export MySQL (anonymized)
   - Run mapping scripts
   - Review quarantine
   - Estimate manual effort

6. **Refinement**
   - Update plan
   - Break down tasks
   - Assign resources

---

**Einde Rebuild Plan**

