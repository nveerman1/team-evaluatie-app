# Architecture Documentation

## Multi-Tenant Multi-Course Architecture

This document describes the architecture of the Team Evaluatie App, which supports multiple schools (tenants) and multiple courses per school.

## Core Concepts

### Multi-Tenancy

The application is fully multi-tenant at the school level:

- Each **School** represents an educational institution
- All data is scoped to a school using `school_id`
- Users can only access data within their own school
- Queries are automatically filtered by `school_id` for security

### Data Hierarchy

The application uses a hierarchical organizational structure:

```
School
  └── Subject (optional organizational layer)
       └── Course
            └── Group/Team
                 └── Students
```

- **School**: Top-level tenant (e.g., a specific school)
- **Subject**: Optional grouping by subject area (e.g., "Biologie", "Talen")
- **Course**: Specific course offering (e.g., "O&O Periode 1 2024")
- **Group/Team**: Student groups within a course
- **Students**: Individual learners assigned to groups

### Subjects (Secties)

Each school can organize courses into **Subjects** (NL: secties):

- Subjects group related courses by subject area
- Examples: "Onderzoek & Ontwerpen", "Biologie", "Talen"
- Subjects have properties: code, name, color, icon, is_active
- Subjects are optional - courses can exist without being linked to a subject
- Useful for organizing templates, rubrics, and navigation flows

### Courses

Each school can have multiple **Courses** (vakken):

- Examples: O&O, XPLR, Biologie, Nederlands, Engels
- Courses can optionally be linked to a Subject via `subject_id`
- Courses have properties: code, period, level (onderbouw/bovenbouw), year
- Courses can be active or inactive (soft delete)

### Teacher-Course Assignment

Teachers are explicitly assigned to courses via the **TeacherCourse** junction table:

- A teacher can teach multiple courses
- A course can have multiple teachers
- One teacher can be designated as "coordinator" per course
- Assignment can be active or inactive

## Data Model

### Entity Relationship Diagram

```
┌─────────────┐
│   School    │
│─────────────│
│ id          │──┐
│ name        │  │
└─────────────┘  │
                 │
        ┌────────┴────────┬───────────────┬──────────────┬──────────────┬──────────────┐
        │                 │               │              │              │              │
        ▼                 ▼               ▼              ▼              ▼              ▼
┌─────────────┐   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│    User     │   │   Subject   │ │   Rubric    │ │  AuditLog   │ │   Client    │ │   Project   │
│─────────────│   │─────────────│ │─────────────│ │─────────────│ │─────────────│ │─────────────│
│ id          │   │ id          │ │ id          │ │ id          │ │ id          │ │ id          │
│ school_id   │   │ school_id   │ │ school_id   │ │ school_id   │ │ school_id   │ │ school_id   │
│ email       │   │ name        │ │ title       │ │ user_id     │ │ organization│ │ course_id   │
│ name        │   │ code        │ │ scope       │ │ action      │ │ contact_name│ │ title       │
│ role        │   │ color       │ │ target_level│ │ entity_type │ │ email       │ │ status      │
│ class_name  │   │ icon        │ └─────────────┘ │ entity_id   │ │ phone       │ └─────────────┘
│ team_number*│   │ is_active   │                 │ details     │ │ level       │        │
│ archived    │   └─────────────┘                 │ created_at  │ │ sector      │        │
└─────────────┘          │                        └─────────────┘ │ tags        │        │
      │                  │                                         │ active      │        │
      │                  ▼                                         └─────────────┘        │
      │          ┌─────────────┐                                          │               │
      │          │   Course    │                                  ┌───────┴────────┐      │
      │          │─────────────│                                  │                │      │
      │          │ id          │                                  ▼                ▼      │
      │          │ school_id   │                          ┌─────────────┐   ┌─────────────┐
      │          │ subject_id  │◄── Optional link         │ ClientLog   │   │ClientProject│
      │          │ name        │                          │─────────────│   │    Link     │
      │          │ code        │                          │ id          │   │─────────────│
      │          │ level       │                          │ client_id   │   │ id          │
      │          │ year        │                          │ author_id   │   │ client_id   │
      │          │ is_active   │                          │ log_type    │   │ project_id  │◄─┐
      │          └─────────────┘                          │ text        │   │ role        │  │
      │                 │                                 │ created_at  │   │ start_date  │  │
      │         ┌───────┴────────┐                        └─────────────┘   │ end_date    │  │
      │         │                │                                          └─────────────┘  │
      │         ▼                ▼                                                           │
      │  ┌─────────────┐  ┌─────────────┐                                                   │
      │  │TeacherCourse│  │   Group     │ (Legacy - mutable)                                │
      │  │─────────────│  │─────────────│                                                   │
      └─►│ teacher_id  │  │ id          │                                                   │
         │ course_id   │  │ school_id   │                                                   │
         │ role        │  │ course_id   │                                                   │
         │ is_active   │  │ name        │                                                   │
         └─────────────┘  │ team_number │                                                   │
                          └─────────────┘                                                   │
                                 │                                                           │
                                 ▼                                                           │
                          ┌─────────────┐                                                   │
                          │GroupMember  │ (Legacy - mutable)                                │
                          │─────────────│                                                   │
                          │ group_id    │                                                   │
                          │ user_id     │                                                   │
                          │ active      │                                                   │
                          └─────────────┘                                                   │
                                                                                            │
                          ┌─────────────┐                                                   │
                          │ProjectTeam  │ (New - immutable snapshots) ◄────────────────────┘
                          │─────────────│
                          │ id          │
                          │ school_id   │
                          │ project_id  │
                          │ team_id     │ (optional legacy link)
                          │ display_name│
                          │ team_number │
                          │ version     │
                          │ is_locked   │
                          │ created_at  │
                          └─────────────┘
                                 │
                                 ▼
                          ┌─────────────┐
                          │ProjectTeam  │
                          │   Member    │
                          │─────────────│
                          │ id          │
                          │ school_id   │
                          │ project     │
                          │   _team_id  │
                          │ user_id     │
                          │ role        │
                          │ created_at  │
                          └─────────────┘

* team_number in User table is DEPRECATED - use ProjectTeam instead

┌─────────────┐
│ Evaluation  │
│─────────────│
│ id          │
│ school_id   │
│ course_id   │
│ rubric_id   │
│ title       │
│ eval_type   │◄── "peer" | "project" | "competency"
│ status      │
│ settings    │
└─────────────┘
      │
      ├──────────────┐
      │              │
      ▼              ▼
┌─────────────┐ ┌─────────────┐
│ Allocation  │ │   Score     │
│─────────────│ │─────────────│
│ eval_id     │ │ alloc_id    │
│ reviewer_id │ │ criterion_id│
│ reviewee_id │ │ score       │
│ is_self     │ │ comment     │
└─────────────┘ └─────────────┘
```

## Key Tables

### School
- `id`: Primary key
- `name`: School name (unique)

### User
- `id`: Primary key
- `school_id`: Foreign key to School
- `email`: User email (unique per school)
- `name`: Full name
- `role`: "admin" | "teacher" | "student"
- `class_name`: Class designation (e.g., "4A")
- `team_number`: **DEPRECATED** - Team number within class (use ProjectTeam instead)
- `archived`: Soft delete flag
- **Unique constraint**: `(school_id, email)`
- **Note**: `team_number` is being phased out in favor of project-specific team assignments

### Subject
- `id`: Primary key
- `school_id`: Foreign key to School
- `name`: Subject name (e.g., "Onderzoek & Ontwerpen", "Biologie")
- `code`: Short code (e.g., "O&O", "BIO", "NE")
- `color`: Hex color for UI display (e.g., "#3B82F6")
- `icon`: Icon name or path for UI
- `is_active`: Active flag (soft delete)
- **Unique constraint**: `(school_id, code)`
- **Index**: `(school_id, is_active)`

### Course
- `id`: Primary key
- `school_id`: Foreign key to School
- `subject_id`: Foreign key to Subject (optional, nullable)
- `name`: Course name (e.g., "Onderzoek & Ontwerpen")
- `code`: Short code (e.g., "O&O", "XPLR")
- `level`: "onderbouw" | "bovenbouw"
- `year`: Academic year (e.g., 2024)
- `period`: Period within year (e.g., "Q1", "Semester 1")
- `description`: Course description
- `is_active`: Active flag (soft delete)
- **Unique constraints**: 
  - `(school_id, name, period)`
  - `(school_id, code)`
- **Index**: `subject_id`

### TeacherCourse
- `id`: Primary key
- `school_id`: Foreign key to School
- `teacher_id`: Foreign key to User
- `course_id`: Foreign key to Course
- `role`: "teacher" | "coordinator"
- `is_active`: Active flag
- **Unique constraint**: `(teacher_id, course_id)`

### Evaluation
- `id`: Primary key
- `school_id`: Foreign key to School
- `course_id`: Foreign key to Course (nullable)
- `project_id`: Foreign key to Project (optional - for project-based evaluations)
- `project_team_id`: Foreign key to ProjectTeam (optional - snapshots team roster)
- `rubric_id`: Foreign key to Rubric
- `title`: Evaluation title
- `evaluation_type`: "peer" | "project" | "competency"
- `status`: "draft" | "open" | "closed"
- `closed_at`: Timestamp when evaluation was closed (nullable)
- `settings`: JSON settings
- **Note**: When `project_id` is set, all teams from that project are automatically allocated
- **Note**: `project_team_id` preserves historical team composition for closed evaluations

### AuditLog
- `id`: Primary key
- `school_id`: Foreign key to School
- `user_id`: Foreign key to User (nullable)
- `user_email`: Email snapshot
- `action`: Action performed (e.g., "create_evaluation")
- `entity_type`: Type of entity (e.g., "evaluation")
- `entity_id`: ID of affected entity
- `details`: JSON details
- `ip_address`: User IP address
- `user_agent`: User agent string
- `created_at`: Timestamp

### Client
- `id`: Primary key
- `school_id`: Foreign key to School
- `organization`: Organization name
- `contact_name`: Contact person name
- `email`: Contact email
- `phone`: Contact phone number
- `level`: Educational level (e.g., "Bovenbouw", "Onderbouw")
- `sector`: Industry sector (e.g., "Vastgoed", "Zorg", "Technology")
- `tags`: Array of tags (e.g., ["Duurzaamheid", "Innovatie"])
- `active`: Active status flag
- **Indexes**: 
  - `(school_id, active)`
  - `organization`

### ClientLog
- `id`: Primary key
- `client_id`: Foreign key to Client
- `author_id`: Foreign key to User
- `log_type`: Type of log entry (e.g., "Notitie", "Mail (template)", "Telefoongesprek")
- `text`: Log entry content
- `created_at`: Timestamp
- **Indexes**: 
  - `client_id`
  - `created_at`

### ClientProjectLink
- `id`: Primary key
- `client_id`: Foreign key to Client
- `project_assessment_id`: Foreign key to ProjectAssessment
- `role`: Client role (e.g., "main", "secondary")
- `start_date`: Project start date
- `end_date`: Project end date
- **Unique constraint**: `(client_id, project_assessment_id)`

### ProjectTeam (New - Immutable Snapshots)
- `id`: Primary key
- `school_id`: Foreign key to School
- `project_id`: Foreign key to Project
- `team_id`: Foreign key to Group (optional legacy link, nullable)
- `display_name_at_time`: Team name frozen at creation (e.g., "Team 1")
- `team_number`: Team number within project
- `version`: Version number (allows multiple snapshots, default: 1)
- `is_locked`: Lock status (true when referenced by evaluation/assessment)
- `backfill_source`: Migration tracking (`null`, `'backfill'`, or `'inference'`)
- `created_at`: Timestamp
- **Unique constraint**: `(project_id, team_number, version)`
- **Indexes**: 
  - `(project_id, team_number)`
  - `(school_id, project_id)`
- **Purpose**: Immutable snapshots of team composition for historical accuracy

### ProjectTeamMember
- `id`: Primary key
- `school_id`: Foreign key to School
- `project_team_id`: Foreign key to ProjectTeam
- `user_id`: Foreign key to User
- `role`: Member role (optional, e.g., "leader", "member")
- `created_at`: Timestamp
- **Unique constraint**: `(project_team_id, user_id)`
- **Indexes**: 
  - `project_team_id`
  - `user_id`
- **Purpose**: Stores student membership in project teams

### Group (Legacy - Mutable)
- `id`: Primary key
- `school_id`: Foreign key to School
- `course_id`: Foreign key to Course
- `name`: Group name
- `team_number`: Team number
- **Note**: This table represents legacy mutable groups - new code should use ProjectTeam instead

### GroupMember (Legacy - Mutable)
- `id`: Primary key
- `group_id`: Foreign key to Group
- `user_id`: Foreign key to User
- `active`: Active status flag
- **Note**: This table represents legacy mutable group membership - new code should use ProjectTeamMember instead

## Clients (Opdrachtgevers) Module

The Clients module manages external organizations that provide projects to students, with full database integration and automation features.

### Features

#### Client Management
- Create and manage client organizations with contact information
- Classify by educational level (Bovenbouw/Onderbouw)
- Organize by sector (e.g., Vastgoed, Zorg, Technology)
- Tag-based categorization for flexible filtering
- Active/inactive status tracking

#### Client Logs
- Track all interactions with clients
- Multiple log types: Notitie, Mail (template), Telefoongesprek
- Full audit trail with timestamps and author tracking

#### Project Links
- Link clients to project assessments
- Support for main and secondary clients (hoofdopdrachtgever/nevenopdrachtgever)
- Track project timeline (start_date, end_date)

#### Automated Reminders
The system automatically generates reminders based on project phases:
- **Tussenpresentatie**: 7 days after midterm assessment is published
- **Eindpresentatie**: 7 days after final assessment is published
- **Bedankmail**: 21 days after final assessment is published
- **Project Ending**: Generated when project end_date is approaching

#### Email Templates
Five pre-configured templates with variable substitution:
1. **opvolgmail**: Follow-up for new school year
2. **tussenpresentatie**: Midterm presentation invitation
3. **eindpresentatie**: Final presentation invitation
4. **bedankmail**: Thank you after project
5. **kennismakingsmail**: Introduction to new client

Templates support variables like `{contactpersoon}`, `{project_naam}`, `{datum}`, etc.

#### Search & Export
- Real-time search with automatic debouncing (500ms)
- Filter by level, status, and search query
- CSV export with all client data
- Pagination support for large datasets

## Project-Based Team Management

The application uses a project-centric team management system that isolates team assignments per project and provides historical accuracy for evaluations.

### Key Concepts

#### Project Teams vs Groups (Legacy)

- **Groups** (`groups` table): Legacy mutable course-level teams that can change anytime
- **Project Teams** (`project_teams` table): Immutable project-scoped snapshots of team composition

New development should use Project Teams exclusively. Groups are maintained for backwards compatibility only.

#### Single Source of Truth

- `project_teams` and `project_team_members` tables are the authoritative source for team data
- `User.team_number` is **DEPRECATED** and being phased out
- Team assignments are project-specific and isolated from other projects

#### Team Number Isolation

Each project maintains its own team numbering:
- Team 1 in Project A is independent from Team 1 in Project B
- Changing team assignments in one project doesn't affect other projects
- Students can have different team numbers in different projects

### Workflow

#### 1. Class-Teams Page (`/teacher/class-teams`)

**Single Column Layout:**
- Project selector at top
- Search/filter card below
- Student table showing all course students

**When No Project Selected:**
- All course students visible
- No team numbers shown (User.team_number phased out)
- Action buttons hidden

**When Project Selected (Open):**
- All course students visible
- Team numbers editable (from `project_teams.team_number`)
- Action buttons enabled:
  - ➕ Leerling toevoegen (Add student to course)
  - ✨ Teams maken (Create teams automatically)
  - 🔄 Auto-verdeel (Distribute unassigned students)
  - 🗑️ Wis alle teams (Clear all team assignments)
  - 📥 CSV Export/Import

**When Project Selected (Closed):**
- Students visible with read-only team numbers
- 🔒 Lock indicator shown
- All action buttons hidden

#### 2. Team Assignment

**Assigning a Student:**
1. Select a project
2. Click team number cell for student
3. Enter team number (e.g., 1, 2, 3)
4. Backend automatically:
   - Creates `ProjectTeam` if team doesn't exist
   - Creates `ProjectTeamMember` linking student to team
   - Saves changes to `project_teams.team_number`

**Bulk Operations:**
- **Teams maken**: Randomly distributes all students into teams of 4
- **Auto-verdeel**: Distributes unassigned students across existing teams
- **Wis alle teams**: Removes all team assignments for the project

#### 3. Evaluation Creation (`/teacher/evaluations/create`)

**Simplified Workflow:**
- Course selection: **Required**
- Project selection: **Required** (filtered by selected course)
- Anonymity: Fixed to "pseudonym" (dropdown removed)
- Project team dropdown: **Removed**

**Automatic Allocation:**
When evaluation is created with a `project_id`:
1. Backend fetches all `ProjectTeam` records for the project
2. Collects all active student members from all teams
3. Creates allocations automatically:
   - Self-review allocation (student reviews self)
   - Peer review allocations (student reviews all other students)
4. Full peer review matrix created (everyone reviews everyone)
5. No manual auto-allocate step needed

#### 4. Frozen Rosters

**Purpose:**
Preserve historical team composition for closed evaluations

**When Evaluation Closes:**
- `status` set to "closed"
- `closed_at` timestamp recorded
- Team roster becomes immutable snapshot

**Display:**
- Shows "Team Roster (Frozen)" banner
- 🔒 icon indicates locked status
- `closed_at` timestamp displayed
- Team composition frozen at evaluation creation time

**Legacy Banner:**
If `project_team_id` is null, shows: "Legacy evaluatie — rosterinformatie kan afwijken"

### API Endpoints

#### Project Team Management

**List students with project-specific teams:**
```
GET /project-teams/projects/{project_id}/students
```
Returns all course students with their project team assignments.

**Update team assignments:**
```
PATCH /project-teams/projects/{project_id}/student-teams
Body: [{"student_id": 123, "team_number": 2}, ...]
```
Creates/updates ProjectTeam and ProjectTeamMember records.

**Get project team members:**
```
GET /project-teams/{project_team_id}/members
```
Returns members of a specific project team (read-only).

**List teams for a project:**
```
GET /project-teams/projects/{project_id}/teams
```
Returns all ProjectTeam records with metadata (member count, lock status, version).

### Data Flow

#### Creating Team Assignment

```
User Action: Assign student 123 to team 2 in project 5
                    ↓
Frontend: PATCH /project-teams/projects/5/student-teams
          Body: [{"student_id": 123, "team_number": 2}]
                    ↓
Backend Logic:
  1. Find or create ProjectTeam(project_id=5, team_number=2)
  2. Find existing ProjectTeamMember for student 123
  3. If exists: Update project_team_id
     If not: Create new ProjectTeamMember
  4. Commit changes
                    ↓
Result: Student 123 now in Team 2 of Project 5
```

#### Creating Evaluation with Auto-Allocation

```
User Action: Create evaluation for project 5
                    ↓
Frontend: POST /evaluations
          Body: {"project_id": 5, ...}
                    ↓
Backend Logic:
  1. Create Evaluation record
  2. Fetch all ProjectTeam records where project_id=5
  3. Collect unique student IDs from ProjectTeamMember
  4. For each student:
     - Create self-review allocation
     - Create peer review allocations to all other students
  5. Commit all allocations
                    ↓
Result: Evaluation ready with full allocation matrix
```

### Migration Notes

**Phase 3 Status:** ✅ **Complete**

- User.team_number fully phased out from UI
- All team operations use project_teams
- Historical data migrated and backfilled
- Legacy Groups/GroupMembers preserved for backwards compatibility

**See Also:**
- `docs/DEPRECATION-team-number.md` - Deprecation plan and timeline
- `docs/PROJECT_TEAM_ROSTERS_IMPLEMENTATION.md` - Detailed implementation guide
- `docs/PROJECT_TEAM_ROSTERS_ADR.md` - Architecture decision record

## Role-Based Access Control (RBAC)

### Roles

1. **Admin**
   - Full access to all data within their school
   - Can create/edit courses
   - Can assign teachers to courses
   - Can manage users
   - Can view audit logs

2. **Teacher**
   - Can create courses (automatically assigned as teacher)
   - Can access courses they're assigned to
   - Can create evaluations for their courses
   - Can manage groups in their courses
   - Can view/edit scores for their evaluations
   - Can export grades

3. **Student**
   - Can access courses they're enrolled in (via groups)
   - Can view evaluations they're allocated to
   - Can submit scores/feedback
   - Can view their own grades and feedback
   - Can write reflections

### Access Control Functions

Located in `app/core/rbac.py`:

- `require_role(user, allowed_roles)`: Check if user has required role
- `ensure_school_access(user, school_id)`: Verify user belongs to school
- `can_access_course(db, user, course_id)`: Check course access
- `require_course_access(db, user, course_id)`: Require course access
- `can_access_evaluation(db, user, evaluation_id)`: Check evaluation access
- `require_evaluation_access(db, user, evaluation_id)`: Require evaluation access
- `get_accessible_course_ids(db, user)`: Get list of accessible courses
- `scope_query_by_school(query, model, user)`: Scope query to user's school

### Security Rules

1. **All queries MUST be scoped by school_id**
   ```python
   # Good
   courses = db.query(Course).filter(Course.school_id == user.school_id).all()
   
   # Bad
   courses = db.query(Course).all()  # Missing school_id filter!
   ```

2. **Always verify course access before operations**
   ```python
   require_course_access(db, user, course_id)
   ```

3. **Use RBAC helpers for authorization**
   ```python
   require_role(user, ["admin", "teacher"])
   ```

## Audit Logging

All mutating operations are logged via `app/core/audit.py`:

```python
from app.core.audit import log_create, log_update, log_delete

# Log a create action
log_create(
    db=db,
    user=user,
    entity_type="course",
    entity_id=course.id,
    details={"name": course.name},
    request=request
)
```

Audit logs include:
- Who performed the action (user_id, email)
- What action was performed
- When it happened
- What entity was affected
- Additional context (details JSON)
- IP address and user agent

## API Endpoints

### Subjects API (`/api/v1/subjects`)

- `GET /subjects` - List subjects (with pagination and filters)
  - Query params: `page`, `per_page`, `is_active`, `search`
- `POST /subjects` - Create a subject (admin/teacher only)
- `GET /subjects/{id}` - Get subject details
- `PATCH /subjects/{id}` - Update subject (admin/teacher only)
- `DELETE /subjects/{id}` - Soft delete subject (admin only)
- `GET /subjects/{id}/courses` - List courses for subject
  - Query params: `is_active`

### Courses API (`/api/v1/courses`)

- `GET /courses` - List courses (with pagination and filters)
  - Query params: `page`, `per_page`, `level`, `year`, `is_active`, `search`
- `POST /courses` - Create a course
- `GET /courses/{id}` - Get course details
- `PATCH /courses/{id}` - Update course (can include `subject_id`)
- `DELETE /courses/{id}` - Soft delete course
- `GET /courses/{id}/teachers` - List teachers for course
- `POST /courses/{id}/teachers` - Assign teacher to course
- `DELETE /courses/{id}/teachers/{teacher_id}` - Remove teacher from course

### Clients API (`/api/v1/clients`)

- `GET /clients` - List clients (with pagination, filters, and search)
  - Query params: `page`, `per_page`, `level`, `status`, `search`
- `POST /clients` - Create a new client
- `GET /clients/{id}` - Get client details
- `PUT /clients/{id}` - Update client
- `DELETE /clients/{id}` - Delete client (admin only)
- `GET /clients/{id}/log` - Get client log entries
- `POST /clients/{id}/log` - Create log entry for client
- `GET /clients/{id}/projects` - Get projects linked to client
- `GET /clients/upcoming-reminders` - Get upcoming reminders based on project phases
  - Query params: `days_ahead` (default: 30)
- `GET /clients/export/csv` - Export clients to CSV
  - Query params: same as list endpoint
- `GET /clients/templates` - List available email templates
- `POST /clients/templates/{template_key}/render` - Render email template with variables

**Email Templates:**
1. `opvolgmail` - Follow-up for new school year
2. `tussenpresentatie` - Midterm presentation invitation
3. `eindpresentatie` - Final presentation invitation
4. `bedankmail` - Thank you after project
5. `kennismakingsmail` - Introduction to new client

**Template Variables:**
- `{contactpersoon}`, `{schooljaar}`, `{project_naam}`, `{datum}`, `{tijd}`, `{locatie}`, `{klas_naam}`, `{docent_naam}`, `{school_naam}`

### Somtoday Integration (`/api/v1/integrations/somtoday`)

**Note**: These endpoints are placeholders for future implementation

- `GET /status` - Check connection status
- `GET /authorize` - Start OAuth2 flow
- `GET /callback` - OAuth2 callback
- `POST /import/classes` - Import classes as groups
- `POST /import/students` - Import students
- `POST /export/grades` - Export grades to Somtoday
- `DELETE /disconnect` - Disconnect integration

## Data Migration

When upgrading existing installations:

1. A default School is created (or existing data is associated with it)
2. Existing Course data (if any labeled "O&O") is preserved
3. All existing users are associated with the default School
4. Teachers are automatically assigned to the "O&O" course
5. All evaluations are backfilled with `evaluation_type="peer"`

See `MIGRATION_NOTES.md` for detailed migration instructions.

## Future Enhancements

### Phase 1 (Completed)
- ✅ Multi-tenant schema
- ✅ Course management
- ✅ Subject (Sectie) organization layer
- ✅ Teacher-course mapping
- ✅ RBAC framework
- ✅ Audit logging
- ✅ Somtoday integration preparation
- ✅ Clients (Opdrachtgevers) module
- ✅ Email template system with variable substitution
- ✅ Automatic reminder generation for project phases
- ✅ CSV export functionality
- ✅ Real-time search with debouncing
- ✅ Subject management UI for admins/teachers

### Phase 2 (Current/Planned)
- Analytics dashboards per course and school
- Learning objective coverage tracking
- Grade export/import (CSV, Excel)
- Bulk student management
- Custom rubric templates per course
- Email notifications integration (SMTP)
- Email sending UI with template selection

### Phase 3 (Future)
- Full Somtoday integration
- Multi-school user access (teachers working at multiple schools)
- Advanced analytics with visualizations
- Mobile app support
- API rate limiting and caching
- Automated backups and data retention policies
