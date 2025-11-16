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

### Courses

Each school can have multiple **Courses** (vakken):

- Examples: O&O, XPLR, Biologie, Nederlands, Engels
- Courses can have properties: code, period, level (onderbouw/bovenbouw), year
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
        ┌────────┴────────┬───────────────┬──────────────┬──────────────┐
        │                 │               │              │              │
        ▼                 ▼               ▼              ▼              ▼
┌─────────────┐   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│    User     │   │   Course    │ │   Rubric    │ │  AuditLog   │ │   Client    │
│─────────────│   │─────────────│ │─────────────│ │─────────────│ │─────────────│
│ id          │   │ id          │ │ id          │ │ id          │ │ id          │
│ school_id   │◄──┤ school_id   │ │ school_id   │ │ school_id   │ │ school_id   │
│ email       │   │ name        │ │ title       │ │ user_id     │ │ organization│
│ name        │   │ code        │ │ scope       │ │ action      │ │ contact_name│
│ role        │   │ level       │ │ target_level│ │ entity_type │ │ email       │
│ class_name  │   │ year        │ └─────────────┘ │ entity_id   │ │ phone       │
│ team_number │   │ is_active   │                 │ details     │ │ level       │
│ archived    │   └─────────────┘                 │ created_at  │ │ sector      │
└─────────────┘          │                        └─────────────┘ │ tags        │
      │                  │                                         │ active      │
      │          ┌───────┴────────┐                                └─────────────┘
      │          │                │                                       │
      │          ▼                ▼                              ┌────────┴────────┐
      │   ┌─────────────┐  ┌─────────────┐                      │                 │
      │   │TeacherCourse│  │   Group     │                      ▼                 ▼
      │   │─────────────│  │─────────────│              ┌─────────────┐   ┌─────────────┐
      └──►│ teacher_id  │  │ id          │              │ ClientLog   │   │ClientProject│
          │ course_id   │  │ school_id   │              │─────────────│   │    Link     │
          │ role        │  │ course_id   │              │ id          │   │─────────────│
          │ is_active   │  │ name        │              │ client_id   │   │ id          │
          └─────────────┘  │ team_number │              │ author_id   │   │ client_id   │
                           └─────────────┘              │ log_type    │   │ project_id  │
                                  │                     │ text        │   │ role        │
                                  ▼                     │ created_at  │   │ start_date  │
                           ┌─────────────┐              └─────────────┘   │ end_date    │
                           │GroupMember  │                                └─────────────┘
                           │─────────────│
                           │ group_id    │
                           │ user_id     │
                           │ active      │
                           └─────────────┘

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
- `team_number`: Team number within class
- `archived`: Soft delete flag
- **Unique constraint**: `(school_id, email)`

### Course
- `id`: Primary key
- `school_id`: Foreign key to School
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
- `rubric_id`: Foreign key to Rubric
- `title`: Evaluation title
- `evaluation_type`: "peer" | "project" | "competency"
- `status`: "draft" | "open" | "closed"
- `settings`: JSON settings

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

### Courses API (`/api/v1/courses`)

- `GET /courses` - List courses (with pagination and filters)
- `POST /courses` - Create a course
- `GET /courses/{id}` - Get course details
- `PATCH /courses/{id}` - Update course
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
- ✅ Teacher-course mapping
- ✅ RBAC framework
- ✅ Audit logging
- ✅ Somtoday integration preparation
- ✅ Clients (Opdrachtgevers) module
- ✅ Email template system with variable substitution
- ✅ Automatic reminder generation for project phases
- ✅ CSV export functionality
- ✅ Real-time search with debouncing

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
