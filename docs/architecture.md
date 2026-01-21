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
  └── AcademicYear (e.g., "2025-2026")
       ├── Class (e.g., "G2a", "G3b")
       │    └── StudentClassMembership
       │         └── Students
       └── Subject (optional organizational layer)
            └── Course
                 ├── CourseEnrollment (student enrollment)
                 │    └── Students
                 └── Project
                      ├── Task (teacher tasks for client communication)
                      ├── Subproject (optional deelprojecten)
                      └── ProjectTeam
                           └── ProjectTeamMember
                                └── Students
```

- **School**: Top-level tenant (e.g., a specific school)
- **AcademicYear**: School year period (e.g., "2025-2026")
- **Class**: Fixed class within a school year (e.g., "G2a")
- **StudentClassMembership**: Links students to their class for a specific year
- **Subject**: Optional grouping by subject area (e.g., "Biologie", "Talen")
- **Course**: Specific course offering linked to an academic year
- **CourseEnrollment**: Links students to courses they are enrolled in
- **Project**: Project within a course
- **Task**: Teacher tasks for client communication and project follow-ups (auto-generated or manual)
- **Subproject**: Optional sub-tasks/sections within a main project (deelprojecten)
- **ProjectTeam**: Immutable team roster snapshot for a project
- **ProjectTeamMember**: Individual student membership in a project team

### Subjects (Secties)

Each school can organize courses into **Subjects** (NL: secties):

- Subjects group related courses by subject area
- Examples: "Onderzoek & Ontwerpen", "Biologie", "Talen"
- Subjects have properties: code, name, color, icon, is_active
- Subjects are optional - courses can exist without being linked to a subject
- Useful for organizing templates, rubrics, and navigation flows

### Academic Years (Schooljaren)

Each school can have multiple **Academic Years**:

- Represents a school year period (e.g., "2025-2026")
- Has start and end dates
- Contains Classes and Courses
- Enables year-over-year transitions and historical tracking

### Classes (Klassen)

Each academic year can have multiple **Classes**:

- Represents a fixed class within a school year (e.g., "G2a", "G3b")
- Students are linked to classes via StudentClassMembership
- One student can only be in one class per academic year
- Enables bulk operations like year transitions

### Courses

Each school can have multiple **Courses** (vakken):

- Examples: O&O, XPLR, Biologie, Nederlands, Engels
- Courses are linked to an AcademicYear via `academic_year_id`
- Courses can optionally be linked to a Subject via `subject_id`
- Students enroll in courses via CourseEnrollment
- Courses have properties: code, period, level (onderbouw/bovenbouw)
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
      ┌──────────┴────────┬───────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
      │                   │               │              │              │              │              │
      ▼                   ▼               ▼              ▼              ▼              ▼              ▼
┌─────────────┐   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│    User     │   │AcademicYear │ │   Subject   │ │  AuditLog   │ │   Client    │ │ External    │ │  RFIDCard   │
│─────────────│   │─────────────│ │─────────────│ │─────────────│ │─────────────│ │ Evaluator   │ │─────────────│
│ id          │   │ id          │ │ id          │ │ id          │ │ id          │ │─────────────│ │ id          │
│ school_id   │   │ school_id   │ │ school_id   │ │ school_id   │ │ school_id   │ │ id          │ │ user_id     │
│ email       │   │ label       │ │ name        │ │ user_id     │ │ organization│ │ school_id   │ │ uid         │
│ name        │   │ start_date  │ │ code        │ │ action      │ │ contact_name│ │ name        │ │ label       │
│ role        │   │ end_date    │ │ color       │ │ entity_type │ │ email       │ │ email       │ │ is_active   │
│ class_name  │   └─────────────┘ │ icon        │ │ entity_id   │ │ phone       │ │ organisation│ │ created_at  │
│ team_number*│          │        │ is_active   │ │ details     │ │ level       │ └─────────────┘ │ created_by  │
│ archived    │          │        └─────────────┘ │ created_at  │ │ sector      │        │        └─────────────┘
└─────────────┘          │               │        └─────────────┘ │ tags        │        │               │
      │                  │               │                         │ active      │        │               │
      │         ┌────────┴────────┐      │                         └─────────────┘        │               │
      │         │                 │      │                                │               │               │
      │         ▼                 ▼      │                        ┌───────┴────────┐      │               │
      │  ┌─────────────┐   ┌─────────────┐                       │                │      │               │
      │  │   Class     │   │   Course    │◄── Optional link      ▼                ▼      │               │
      │  │─────────────│   │─────────────│                ┌─────────────┐   ┌─────────────┐             │
      │  │ id          │   │ id          │                │ ClientLog   │   │ClientProject│             │
      │  │ school_id   │   │ school_id   │                │─────────────│   │    Link     │             │
      │  │ academic_yr │   │ subject_id  │                │ id          │   │─────────────│             │
      │  │   _id       │   │ academic_yr │                │ client_id   │   │ id          │             │
      │  │ name        │   │   _id       │                │ author_id   │   │ client_id   │             │
      │  └─────────────┘   │ name        │                │ log_type    │   │ project_id  │             │
      │         │          │ code        │                │ text        │   │ role        │             │
      │         │          │ level       │                │ created_at  │   │ start_date  │             │
      │         │          │ is_active   │                └─────────────┘   │ end_date    │             │
      │         │          └─────────────┘                                  └─────────────┘             │
      │         │                 │                                                 │                    │
      │         ▼                 │                                                 │                    │
      │  ┌─────────────┐          │                                                 │                    │
      │  │  Student    │          ├──────────────┬──────────────┐                  │                    │
      │  │   Class     │          │              │              │                  │                    │
      │  │ Membership  │          ▼              ▼              ▼                  │                    │
      └─►│─────────────│   ┌─────────────┐┌─────────────┐┌─────────────┐          │                    │
         │ id          │   │TeacherCourse││   Course    ││   Rubric    │          │                    │
         │ student_id  │   │─────────────││ Enrollment  ││─────────────│          │                    │
         │ class_id    │   │ teacher_id  ││─────────────││ id          │          │                    │
         │ academic_yr │   │ course_id   ││ course_id   ││ school_id   │          │                    │
         │   _id       │   │ role        ││ student_id  ││ title       │          │                    │
         └──────┬──────┘   │ is_active   ││ active      ││ scope       │          │                    │
                │          └─────────────┘└─────────────┘│ target_level│          │                    │
                │                 │                       └─────────────┘          │                    │
                │                 │                              │                 │                    │
                │                 ▼                              │                 │                    │
                │          ┌─────────────┐                       │                 │                    │
                │          │   Group     │ (Legacy - mutable)    │                 │                    │
                │          │─────────────│                       │                 │                    │
                │          │ id          │                       │                 │                    │
                │          │ school_id   │                       │                 │                    │
                │          │ course_id   │                       │                 │                    │
                │          │ name        │                       │                 │                    │
                │          │ team_number │                       │                 │                    │
                │          └─────────────┘                       │                 │                    │
                │                 │                              │                 │                    │
                │          ┌──────┴────────┐                     │                 │                    │
                │          │               │                     │                 │                    │
                │          ▼               ▼                     │                 │                    │
                │   ┌─────────────┐ ┌─────────────┐             │                 │                    │
                │   │GroupMember  │ │ProjectTeam  │             │                 │                    │
                │   │─────────────│ │  External   │◄────────────┘                 │                    │
                │   │ group_id    │ │─────────────│                               │                    │
                │   │ user_id     │ │ id          │                               │                    │
                │   │ active      │ │ group_id    │                               │                    │
                │   └─────────────┘ │ external_   │                               │                    │
                │                   │   evaluator │                               │                    │
                │                   │   _id       │                               │                    │
                │                   │ project_id  │                               │                    │
                │                   │ invitation  │                               │                    │
                │                   │   _token    │                               │                    │
                │                   │ status      │                               │                    │
                │                   └─────────────┘                               │                    │
                │                                                                  │                    │
                │          ┌─────────────┐                                        │                    │
                │          │   Project   │◄───────────────────────────────────────┘                    │
                │          │─────────────│                                                             │
                │          │ id          │                                                             │
                │          │ school_id   │                                                             │
                │          │ course_id   │                                                             │
                │          │ title       │                                                             │
                │          │ status      │                                                             │
                │          └─────────────┘                                                             │
                │                 │                                                                    │
                │        ┌────────┴────────┐                                                           │
                │        │                 │                                                           │
                │        ▼                 ▼                                                           │
                │ ┌─────────────┐   ┌─────────────┐                                                   │
                │ │ Subproject  │   │ProjectTeam  │ (New - immutable snapshots)                       │
                │ │─────────────│   │─────────────│                                                   │
                │ │ id          │   │ id          │                                                   │
                │ │ school_id   │   │ school_id   │                                                   │
                │ │ project_id  │   │ project_id  │                                                   │
                │ │ client_id   │   │ team_id     │ (optional legacy link)                            │
                │ │ title       │   │ display_name│                                                   │
                │ │ team_number │   │ team_number │                                                   │
                │ └─────────────┘   │ version     │                                                   │
                │                   │ created_at  │                                                   │
                │                   └─────────────┘                                                   │
                │                          │                                                           │
                │                          ▼                                                           │
                │                   ┌─────────────┐                                                   │
                │                   │ProjectTeam  │                                                   │
                │                   │   Member    │                                                   │
                │                   │─────────────│                                                   │
                │                   │ id          │                                                   │
                │                   │ school_id   │                                                   │
                │                   │ project     │                                                   │
                │                   │   _team_id  │                                                   │
                │                   │ user_id     │                                                   │
                │                   │ role        │                                                   │
                │                   │ created_at  │                                                   │
                │                   └─────────────┘                                                   │
                │                                                                                     │
                └────────────────────────────────────────────────────────────────────────────────────┘
                                   ▼
                            ┌─────────────┐
                            │ Attendance  │
                            │   Event     │
                            │─────────────│
                            │ id          │
                            │ user_id     │
                            │ project_id  │
                            │ check_in    │
                            │ check_out   │
                            │ is_external │
                            │ location    │
                            │ description │
                            │ approval_   │
                            │   status    │
                            │ source      │
                            │ created_at  │
                            └─────────────┘
                                   │
                                   ▼
                            ┌─────────────┐
                            │ Attendance  │
                            │ Aggregate   │
                            │─────────────│
                            │ user_id     │
                            │ total_school│
                            │   _seconds  │
                            │ total_ext_  │
                            │   approved  │
                            │   _seconds  │
                            │ lesson_     │
                            │   blocks    │
                            └─────────────┘

* team_number in User table is DEPRECATED - use ProjectTeam instead

┌─────────────┐
│ Evaluation  │
│─────────────│
│ id          │
│ school_id   │
│ course_id   │
│ project_id  │
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

┌────────────────────────────────────────────────────────────┐
│               Learning Objectives & Templates              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────┐         ┌─────────────────────────┐      │
│  │  Learning   │         │RubricCriterion          │      │
│  │ Objective   │◄────────│  LearningObjective      │      │
│  │─────────────│         │─────────────────────────│      │
│  │ id          │         │ criterion_id            │      │
│  │ school_id   │         │ learning_objective_id   │      │
│  │ subject_id  │         └─────────────────────────┘      │
│  │ teacher_id  │                                          │
│  │ is_template │                                          │
│  │ domain      │                                          │
│  │ title       │                                          │
│  │ description │                                          │
│  │ phase       │                                          │
│  └─────────────┘                                          │
│                                                            │
│  ┌──────────────────────────────┐                         │
│  │ PeerEvaluationCriterion      │                         │
│  │        Template              │                         │
│  │──────────────────────────────│                         │
│  │ id, school_id, subject_id    │                         │
│  │ omza_category                │                         │
│  │ title, description           │                         │
│  │ target_level                 │                         │
│  │ level_descriptors (JSON)     │                         │
│  │ learning_objective_ids       │                         │
│  └──────────────────────────────┘                         │
│                                                            │
│  ┌──────────────────────────────┐                         │
│  │ ProjectAssessmentCriterion   │                         │
│  │        Template              │                         │
│  │──────────────────────────────│                         │
│  │ id, school_id, subject_id    │                         │
│  │ category                     │                         │
│  │ title, description           │                         │
│  │ weight                       │                         │
│  │ level_descriptors (JSON)     │                         │
│  │ learning_objective_ids       │                         │
│  └──────────────────────────────┘                         │
│                                                            │
│  ┌──────────────────────────────┐                         │
│  │ ProjectRubricTemplate        │                         │
│  │──────────────────────────────│                         │
│  │ id, school_id, subject_id    │                         │
│  │ name, level                  │                         │
│  │──────────────────────────────│                         │
│  │    └─► ProjectRubric         │                         │
│  │         CriterionTemplate    │                         │
│  └──────────────────────────────┘                         │
│                                                            │
│  ┌──────────────────────────────┐                         │
│  │ CompetencyTemplate           │                         │
│  │──────────────────────────────│                         │
│  │ id, school_id, subject_id    │                         │
│  │ name, description, domain    │                         │
│  │ level, order                 │                         │
│  │──────────────────────────────│                         │
│  │    └─► Competency            │                         │
│  │         LevelDescriptor      │                         │
│  │         Template             │                         │
│  │    └─► Competency            │                         │
│  │         ReflectionQuestion   │                         │
│  │         Template             │                         │
│  └──────────────────────────────┘                         │
│                                                            │
│  ┌──────────────────────────────┐                         │
│  │ MailTemplate                 │                         │
│  │──────────────────────────────│                         │
│  │ id, school_id, subject_id    │                         │
│  │ name, type                   │                         │
│  │ subject, body                │                         │
│  │ variables_allowed (JSON)     │                         │
│  └──────────────────────────────┘                         │
│                                                            │
│  ┌──────────────────────────────┐                         │
│  │ StandardRemark               │                         │
│  │──────────────────────────────│                         │
│  │ id, school_id, subject_id    │                         │
│  │ type, category               │                         │
│  │ text, order                  │                         │
│  └──────────────────────────────┘                         │
│                                                            │
│  ┌──────────────────────────────┐                         │
│  │ TemplateTag                  │                         │
│  │──────────────────────────────│                         │
│  │ id, school_id, name, color   │                         │
│  │──────────────────────────────│                         │
│  │    └─► TemplateTagLink       │                         │
│  │         (links to templates) │                         │
│  └──────────────────────────────┘                         │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│                    Project Notes System                    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────────┐                                  │
│  │ProjectNotesContext  │                                  │
│  │─────────────────────│                                  │
│  │ id, school_id       │                                  │
│  │ title, description  │                                  │
│  │ project_id          │                                  │
│  │ course_id           │                                  │
│  │ class_name          │                                  │
│  │ evaluation_id       │                                  │
│  │ project_team_id     │                                  │
│  │ status              │                                  │
│  │ created_by          │                                  │
│  │ created_at          │                                  │
│  └─────────────────────┘                                  │
│           │                                                │
│           ▼                                                │
│  ┌─────────────────────┐                                  │
│  │   ProjectNote       │                                  │
│  │─────────────────────│                                  │
│  │ id, context_id      │                                  │
│  │ note_type           │ ("project"|"team"|"student")    │
│  │ team_id             │                                  │
│  │ student_id          │                                  │
│  │ text, tags          │                                  │
│  │ omza_category       │                                  │
│  │ learning_objective  │                                  │
│  │   _id               │                                  │
│  │ is_competency       │                                  │
│  │   _evidence         │                                  │
│  │ created_by          │                                  │
│  └─────────────────────┘                                  │
└────────────────────────────────────────────────────────────┘
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
- **Index**: `subject_id`, `academic_year_id`

### AcademicYear
- `id`: Primary key
- `school_id`: Foreign key to School
- `label`: Academic year label (e.g., "2025-2026")
- `start_date`: Year start date
- `end_date`: Year end date
- **Unique constraint**: `(school_id, label)`
- **Index**: `school_id`
- **Purpose**: Organizes classes and courses by school year, enables year transitions

### Class
- `id`: Primary key
- `school_id`: Foreign key to School
- `academic_year_id`: Foreign key to AcademicYear
- `name`: Class name (e.g., "G2a", "G3b")
- **Unique constraint**: `(school_id, academic_year_id, name)`
- **Indexes**: 
  - `school_id`
  - `academic_year_id`
- **Purpose**: Represents fixed classes within a school year

### StudentClassMembership
- `id`: Primary key
- `student_id`: Foreign key to User
- `class_id`: Foreign key to Class
- `academic_year_id`: Foreign key to AcademicYear (redundant for performance)
- **Unique constraint**: `(student_id, academic_year_id)` - ensures one student per class per year
- **Indexes**: 
  - `student_id`
  - `class_id`
  - `academic_year_id`
- **Purpose**: Links students to their class for a specific academic year

### CourseEnrollment
- `id`: Primary key
- `course_id`: Foreign key to Course
- `student_id`: Foreign key to User
- `active`: Active status flag
- **Unique constraint**: `(course_id, student_id)`
- **Indexes**: 
  - `course_id`
  - `student_id`
- **Purpose**: Links students to courses they are enrolled in

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

### Task
- `id`: Primary key
- `school_id`: Foreign key to School
- `title`: Task title (max 500 characters)
- `description`: Detailed task description (nullable)
- `due_date`: Task deadline (date, nullable)
- `status`: Task status - "open" | "done" | "dismissed" (default: "open")
- `type`: Task type - "opdrachtgever" | "docent" | "project" (default: "opdrachtgever")
- `project_id`: Foreign key to Project (nullable, CASCADE on delete)
- `client_id`: Foreign key to Client (nullable, SET NULL on delete)
- `class_id`: Foreign key to Class (nullable, SET NULL on delete)
- `auto_generated`: Boolean flag for auto-generated tasks (default: false)
- `source`: Task source - "tussenpresentatie" | "eindpresentatie" | "manual" (default: "manual")
- `email_to`: Email addresses for task (nullable, max 500 characters)
- `email_cc`: CC email addresses (nullable, max 500 characters)
- `completed_at`: Timestamp when task was marked as done (nullable)
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp
- **Indexes**: 
  - `school_id`
  - `due_date`
  - `status`
  - `project_id`
  - `client_id`
  - `(school_id, status)` - composite for dashboard queries
  - `auto_generated` - for filtering auto vs manual tasks
- **Purpose**: Teacher task management for client communications, project follow-ups, and reminders
- **Auto-generation**: Tasks are automatically created 21 days before tussenpresentatie and eindpresentatie dates when projects are created via wizard
- **Smart updates**: Auto-generated tasks update when project dates change; manual tasks are preserved
- **RBAC**: Only teachers and admins can manage tasks; students have no access

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

### ~~Group~~ (REMOVED - Migration Complete)
**Status**: ⛔ **REMOVED** in migration 20260119_drop_legacy_group_tables  
**Replaced by**: CourseEnrollment (for student-course relationships) and ProjectTeam (for project teams)  
**Migration completed**: 2026-01-19

The legacy `groups` table has been completely removed from the system. Student-course relationships are now managed via `CourseEnrollment`, and project-specific team rosters are managed via immutable `ProjectTeam` snapshots.

### ~~GroupMember~~ (REMOVED - Migration Complete)
**Status**: ⛔ **REMOVED** in migration 20260119_drop_legacy_group_tables  
**Replaced by**: CourseEnrollment (for student-course membership) and ProjectTeamMember (for project team membership)  
**Migration completed**: 2026-01-19

The legacy `group_members` table has been completely removed from the system. All team membership is now tracked via `ProjectTeamMember` for project-specific rosters.

### Subproject
- `id`: Primary key
- `school_id`: Foreign key to School
- `project_id`: Foreign key to Project
- `client_id`: Foreign key to Client (optional)
- `title`: Subproject title
- `team_number`: Team number (optional)
- **Indexes**: 
  - `school_id`
  - `project_id`
  - `client_id`
  - `(project_id, team_number)`
- **Purpose**: Sub-tasks/sections within a main project (deelprojecten), used for bovenbouw choice projects

### LearningObjective
- `id`: Primary key
- `school_id`: Foreign key to School
- `subject_id`: Foreign key to Subject (for central/template objectives, nullable)
- `teacher_id`: Foreign key to User (for teacher-specific objectives, nullable)
- `course_id`: Foreign key to Course (optional, nullable)
- `is_template`: Boolean (true for central admin-managed, false for teacher-specific)
- `domain`: Domain code (e.g., "A", "B", "C", "D - Ontwerpen", "E")
- `title`: Learning objective title
- `description`: Detailed description
- `order`: Order/number
- `phase`: "onderbouw" | "bovenbouw"
- `metadata_json`: Additional metadata (JSON)
- **Indexes**: 
  - `school_id`
  - `subject_id`
  - `teacher_id`
  - `course_id`
  - `(school_id, is_template)`
  - `(school_id, domain)`
  - `(school_id, phase)`
- **Purpose**: Eindtermen/learning objectives that can be linked to rubric criteria to track student progress

### RubricCriterionLearningObjective
- `id`: Primary key
- `school_id`: Foreign key to School
- `criterion_id`: Foreign key to RubricCriterion
- `learning_objective_id`: Foreign key to LearningObjective
- **Unique constraint**: `(criterion_id, learning_objective_id)`
- **Indexes**: 
  - `criterion_id`
  - `learning_objective_id`
- **Purpose**: Many-to-many association linking rubric criteria to learning objectives

### ProjectNotesContext
- `id`: Primary key
- `school_id`: Foreign key to School
- `title`: Context title
- `description`: Context description
- `project_id`: Foreign key to Project (optional)
- `course_id`: Foreign key to Course (optional)
- `class_name`: Class name (optional)
- `evaluation_id`: Foreign key to Evaluation (optional)
- `project_team_id`: Foreign key to ProjectTeam (frozen roster link)
- `created_by`: Foreign key to User
- `created_at`: Timestamp
- `updated_at`: Timestamp
- `status`: "draft" | "open" | "closed"
- `closed_at`: Timestamp when closed (nullable)
- `settings`: JSON settings
- **Indexes**: 
  - `(school_id, course_id)`
  - `created_by`
  - `project_team_id`
  - `status`
- **Purpose**: Container for all notes related to a specific project

### ProjectNote
- `id`: Primary key
- `context_id`: Foreign key to ProjectNotesContext
- `note_type`: "project" | "team" | "student"
- `team_id`: Foreign key to Group (optional)
- `student_id`: Foreign key to User (optional)
- `text`: Note content
- `tags`: Array of tags
- `omza_category`: OMZA category (optional)
- `learning_objective_id`: Foreign key to LearningObjective (optional)
- `is_competency_evidence`: Boolean flag
- `is_portfolio_evidence`: Boolean flag
- `metadata`: JSON metadata
- `created_by`: Foreign key to User
- `created_at`: Timestamp
- `updated_at`: Timestamp
- **Indexes**: 
  - `(context_id, note_type)`
  - `team_id`
  - `student_id`
  - `created_at`
  - `omza_category`
- **Purpose**: Individual notes/observations within a project context

### ExternalEvaluator
- `id`: Primary key
- `school_id`: Foreign key to School
- `name`: Evaluator name
- `email`: Evaluator email
- `organisation`: Organization name (optional)
- `created_at`: Timestamp
- `updated_at`: Timestamp
- **Indexes**: 
  - `(school_id, email)`
  - `email`
- **Purpose**: External evaluators (opdrachtgevers) for project assessments

### ProjectTeamExternal
- `id`: Primary key
- `school_id`: Foreign key to School
- `group_id`: Foreign key to Group
- `external_evaluator_id`: Foreign key to ExternalEvaluator
- `project_id`: Foreign key to Project (optional)
- `assessment_id`: Foreign key to ProjectAssessment (optional)
- `team_number`: Team number (optional)
- `invitation_token`: Unique 128-char token for access
- `token_expires_at`: Token expiration date (optional)
- `status`: "NOT_INVITED" | "INVITED" | "IN_PROGRESS" | "SUBMITTED"
- `created_at`: Timestamp
- `updated_at`: Timestamp
- `invited_at`: Timestamp (optional)
- `submitted_at`: Timestamp (optional)
- **Indexes**: 
  - `group_id`
  - `external_evaluator_id`
  - `project_id`
  - `assessment_id`
  - `invitation_token`
- **Purpose**: Links teams to external evaluators with invitation tokens for external assessments

### RFIDCard
- `id`: Primary key
- `user_id`: Foreign key to User
- `uid`: RFID card unique identifier (UNIQUE)
- `label`: Card label/description (e.g., "Primary Card", "Spare Card")
- `is_active`: Active status flag
- `created_at`: Timestamp
- `updated_at`: Timestamp
- `created_by`: Foreign key to User (who registered the card)
- **Unique constraint**: `uid` (globally unique across all schools)
- **Indexes**: 
  - `user_id`
  - `uid`
  - `(user_id, is_active)`
- **Purpose**: Links RFID cards to users for physical check-in/check-out via card readers

### AttendanceEvent
- `id`: Primary key
- `user_id`: Foreign key to User
- `project_id`: Foreign key to Project (optional - for project-specific attendance)
- `check_in`: Check-in timestamp (TIMESTAMPTZ)
- `check_out`: Check-out timestamp (TIMESTAMPTZ, nullable)
- `is_external`: Boolean flag (true for external work, false for school attendance)
- `location`: Location description (required for external work)
- `description`: Work description (for external work)
- `approval_status`: "pending" | "approved" | "rejected" (for external work)
- `approved_by`: Foreign key to User (teacher who approved)
- `approved_at`: Approval timestamp
- `source`: "rfid" | "manual" | "import" | "api"
- `created_at`: Timestamp
- `updated_at`: Timestamp
- `created_by`: Foreign key to User (optional)
- **Constraints**:
  - `check_out` must be after `check_in` when not NULL
  - External work requires `location` and `approval_status`
- **Indexes**: 
  - `user_id`
  - `project_id`
  - `check_in`
  - `(user_id, check_in DESC)` - for latest event queries
  - Partial index on `(user_id, check_in)` WHERE `check_out IS NULL` - for open sessions
  - Partial index on `(approval_status)` WHERE `is_external = true AND approval_status = 'pending'` - for pending approvals
- **Purpose**: Unified table for both school attendance (RFID check-ins) and external work registrations with approval workflow

### AttendanceAggregate
- `id`: Primary key
- `user_id`: Foreign key to User (UNIQUE)
- `total_school_seconds`: Total seconds spent at school (from RFID check-ins)
- `total_external_approved_seconds`: Total seconds of approved external work
- `lesson_blocks`: Computed lesson blocks (total_seconds / 4500, where 4500s = 75min)
- `last_recomputed_at`: Timestamp of last recomputation
- **Unique constraint**: `user_id`
- **Indexes**: 
  - `user_id`
- **Purpose**: Performance cache for pre-computed attendance totals, updated via database function `compute_user_attendance_totals(user_id)`

### Database Views & Functions (3de Blok)

**View: `open_sessions`**
- Shows currently present students with live duration calculation
- Filters: `check_out IS NULL`
- Joins with `users` table for student information
- Used by real-time presence dashboard

**Function: `compute_user_attendance_totals(user_id INTEGER)`**
- Calculates all attendance metrics for a specific user
- Computes total school seconds (sum of completed check-ins)
- Computes total approved external work seconds
- Calculates lesson blocks (total_seconds / 4500)
- Updates `attendance_aggregates` table
- Called after attendance event changes or on-demand

## Template System

The application includes a comprehensive template system for managing reusable content across rubrics, competencies, emails, and remarks.

### PeerEvaluationCriterionTemplate
- `id`: Primary key
- `school_id`: Foreign key to School
- `subject_id`: Foreign key to Subject
- `omza_category`: "Organiseren" | "Meedoen" | "Zelfvertrouwen" | "Autonomie"
- `title`: Criterion title
- `description`: Detailed description
- `target_level`: "onderbouw" | "bovenbouw" | NULL (for both)
- `level_descriptors`: JSON object with keys "1" to "5"
- `learning_objective_ids`: JSON array of learning objective IDs
- `created_at`: Timestamp
- `updated_at`: Timestamp
- **Indexes**: 
  - `school_id`
  - `subject_id`
  - `omza_category`
  - `target_level`
- **Purpose**: Template criteria for peer evaluations based on OMZA framework

### ProjectAssessmentCriterionTemplate
- `id`: Primary key
- `school_id`: Foreign key to School
- `subject_id`: Foreign key to Subject
- `category`: "projectproces" | "eindresultaat" | "communicatie"
- `title`: Criterion title
- `description`: Detailed description
- `weight`: Criterion weight (default 1.0)
- `level_descriptors`: JSON object with level descriptions
- `learning_objective_ids`: JSON array of learning objective IDs
- `created_at`: Timestamp
- `updated_at`: Timestamp
- **Indexes**: 
  - `school_id`
  - `subject_id`
  - `category`
- **Purpose**: Template criteria for project assessments

### ProjectRubricTemplate
- `id`: Primary key
- `school_id`: Foreign key to School
- `subject_id`: Foreign key to Subject
- `name`: Rubric template name
- `level`: "onderbouw" | "havo_bovenbouw" | "vwo_bovenbouw" | "speciaal"
- `created_at`: Timestamp
- `updated_at`: Timestamp
- **Indexes**: 
  - `school_id`
  - `subject_id`
  - `level`
- **Purpose**: Template for project rubrics with associated criteria

### ProjectRubricCriterionTemplate
- `id`: Primary key
- `school_id`: Foreign key to School
- `rubric_template_id`: Foreign key to ProjectRubricTemplate
- `category`: Criterion category
- `title`: Criterion title
- `description`: Description
- `weight`: Criterion weight
- `level_descriptors`: JSON level descriptions
- `created_at`: Timestamp
- `updated_at`: Timestamp
- **Indexes**: 
  - `rubric_template_id`
  - `category`
- **Purpose**: Individual criteria within a project rubric template

### CompetencyTemplate
- `id`: Primary key
- `school_id`: Foreign key to School
- `subject_id`: Foreign key to Subject
- `name`: Competency name
- `description`: Description
- `domain`: Domain code
- `level`: Educational level
- `order`: Order number
- `created_at`: Timestamp
- `updated_at`: Timestamp
- **Indexes**: 
  - `school_id`
  - `subject_id`
- **Purpose**: Template for competencies with level descriptors and reflection questions

### MailTemplate
- `id`: Primary key
- `school_id`: Foreign key to School
- `subject_id`: Foreign key to Subject (optional)
- `name`: Template name
- `type`: "start_opdrachtgever" | "tussenpresentatie" | "eindpresentatie" | "bedankmail" | "herinnering"
- `subject`: Email subject
- `body`: Email body (text/markdown)
- `variables_allowed`: JSON object of allowed variables
- `is_active`: Active flag
- `created_at`: Timestamp
- `updated_at`: Timestamp
- **Indexes**: 
  - `school_id`
  - `subject_id`
  - `type`
  - `is_active`
- **Purpose**: Email templates with variable substitution for client communication

### StandardRemark
- `id`: Primary key
- `school_id`: Foreign key to School
- `subject_id`: Foreign key to Subject (optional)
- `type`: "peer" | "project" | "competency" | "project_feedback" | "omza"
- `category`: "positief" | "aandachtspunt" | "aanbeveling"
- `text`: Remark text
- `order`: Order for sorting
- `created_at`: Timestamp
- `updated_at`: Timestamp
- **Indexes**: 
  - `school_id`
  - `subject_id`
  - `type`
  - `category`
- **Purpose**: Standard remarks library for quick feedback

### TemplateTag
- `id`: Primary key
- `school_id`: Foreign key to School
- `name`: Tag name
- `color`: Tag color
- `created_at`: Timestamp
- `updated_at`: Timestamp
- **Indexes**: 
  - `school_id`
- **Purpose**: Tags for categorizing templates

### TemplateTagLink
- `id`: Primary key
- `tag_id`: Foreign key to TemplateTag
- `template_type`: Template type (e.g., "peer_criterion", "project_criterion")
- `template_id`: Template entity ID
- **Indexes**: 
  - `tag_id`
  - `(template_type, template_id)`
- **Purpose**: Links tags to various template entities

## Async Job Queue System (AI Summary Generation)

The application uses an asynchronous task processing system built on RQ (Redis Queue) for AI summary generation and other long-running tasks.

### Overview

The async queue system prevents timeout errors when generating AI summaries for multiple students and provides a better user experience with:
- Real-time progress tracking
- Job cancellation capabilities  
- Priority-based processing
- Automatic retry on failure
- Webhook notifications
- Comprehensive monitoring

### Architecture Components

**Backend (FastAPI):**
- REST API endpoints for job management
- Job persistence in PostgreSQL
- Background task processing

**Redis:**
- Message broker and job queue
- Rate limiting storage
- Already configured in `ops/docker/compose.dev.yml`

**RQ Worker:**
- Background worker process for job execution
- Horizontally scalable for increased throughput
- Supports multiple priority queues

**Scheduler Daemon:**
- Processes scheduled jobs with cron expressions
- Runs independently for recurring tasks

### Database Schema

**SummaryGenerationJob Table:**
- `id`: Primary key
- `school_id`: Foreign key to School (multi-tenant)
- `evaluation_id`: Foreign key to Evaluation
- `student_id`: Foreign key to User
- `job_id`: Unique job identifier (string)
- `status`: "queued" | "processing" | "completed" | "failed" | "cancelled"
- `progress`: Integer (0-100) for real-time progress
- `priority`: "high" | "normal" | "low"
- `retry_count`: Current retry attempt
- `max_retries`: Maximum retry attempts (default: 3)
- `next_retry_at`: Timestamp for next retry
- `cancelled_at`: Cancellation timestamp
- `cancelled_by`: User who cancelled the job
- `webhook_url`: URL for completion notifications
- `webhook_delivered`: Boolean flag
- `webhook_attempts`: Number of delivery attempts
- `queue_name`: Queue name (e.g., "ai-summaries-high")
- `task_type`: Task type for extensibility
- `result`: JSONB result data
- `error_message`: Error message if failed
- `created_at`, `started_at`, `completed_at`: Timestamps
- `updated_at`: Auto-updated timestamp (tracks any job record modification)

**Note on Timestamp Fields:**
- `created_at` and `updated_at` are inherited from the Base model
- Both have `server_default=NOW()` for automatic timestamp generation
- `updated_at` has `onupdate=NOW()` for automatic updates
- All timestamps use `TIMESTAMP WITH TIME ZONE` for consistency
- See "Bug Fixes" section below for details on timestamp column fix

**ScheduledJob Table:**
- `id`: Primary key
- `school_id`: Foreign key to School
- `name`: Job name
- `task_type`: Type of task to execute
- `queue_name`: Queue to use
- `cron_expression`: Cron schedule (e.g., "0 2 * * *")
- `task_params`: JSONB task parameters
- `enabled`: Boolean flag
- `last_run_at`, `next_run_at`: Execution timestamps
- `created_at`, `updated_at`: Audit timestamps
- `created_by`: Foreign key to User

### Key Features

#### 1. Job Progress Tracking (0-100%)
- Real-time progress updates during execution
- Progress reported at key stages:
  - 10%: Job started
  - 20-40%: Data validation and retrieval
  - 50-60%: Anonymization
  - 80%: AI generation completed
  - 90%: Summary cached
  - 100%: Job completed

#### 2. Job Cancellation
- Cancel queued or processing jobs via API
- Tracked with `cancelled_at` timestamp
- `cancelled_by` links to user who cancelled

#### 3. Priority Queues
- Three priority levels: high, normal, low
- Separate queues: `ai-summaries-high`, `ai-summaries`, `ai-summaries-low`
- Workers process in priority order
- Higher priority jobs execute first

#### 4. Webhook Notifications
- HTTP POST webhooks on job completion/failure
- Automatic retry on webhook delivery failure (up to 3 attempts)
- 10-second timeout per request
- Delivery status tracked in database

**Webhook Payload Example:**
```json
{
  "event": "job.completed",
  "timestamp": "2026-01-01T10:00:00",
  "data": {
    "job_id": "summary-123-456-...",
    "status": "completed",
    "student_id": 456,
    "evaluation_id": 123,
    "result": {...}
  }
}
```

#### 5. Queue Monitoring Dashboard
- Real-time queue statistics (queued, processing, completed, failed, cancelled)
- Worker health checks
- Queue depth monitoring
- Performance metrics

#### 6. Automatic Retry with Exponential Backoff
- Failed jobs automatically retry with increasing delays
- Backoff schedule: 2min, 4min, 8min (capped at 30min)
- Configurable `max_retries` per job
- Retry status tracked in database

#### 7. Multi-Queue Support
- `queue_name` field enables different queues for different task types
- `task_type` field for extensibility
- Priority-based queue segregation

#### 8. Job Scheduling (Cron-like)
- Scheduled jobs with cron expressions
- Examples: daily, weekly, custom schedules
- Independent scheduler daemon
- Managed via admin API

#### 9. Rate Limiting
- Redis-based sliding window rate limiting
- Configurable limits per endpoint type:
  - Queue endpoints: 10 requests/minute
  - Batch endpoints: 5 requests/minute
  - Other endpoints: 100 requests/minute
- Rate limit headers in responses

### Data Flow

**Queue Summary Generation:**
```
Student visits overview page
          ↓
Frontend: POST /api/v1/feedback-summaries/evaluation/{id}/student/{id}/queue
          ↓
Backend creates SummaryGenerationJob record
Backend enqueues task in Redis (priority queue)
Returns job_id to frontend
          ↓
Frontend polls: GET /api/v1/feedback-summaries/jobs/{job_id}/status
          ↓
Worker picks up job from Redis (priority order)
Worker updates progress (10%, 20%, etc.)
Worker generates AI summary with Ollama
Worker updates status → "completed"
          ↓
Optional: Worker sends webhook notification
          ↓
Frontend receives completed status with result
Display summary to student
```

### API Endpoints

**Job Management:**
- `POST /api/v1/feedback-summaries/evaluation/{evaluation_id}/student/{student_id}/queue` - Queue job
  - Body: `{priority, webhook_url, max_retries}`
- `GET /api/v1/feedback-summaries/jobs/{job_id}/status` - Get job status
- `POST /api/v1/feedback-summaries/jobs/{job_id}/cancel` - Cancel job
- `POST /api/v1/feedback-summaries/evaluation/{evaluation_id}/batch-queue` - Batch queue
  - Body: `{student_ids, priority, webhook_url}`
- `GET /api/v1/feedback-summaries/evaluation/{evaluation_id}/jobs` - List jobs
  - Query params: `status`

**Queue Monitoring:**
- `GET /api/v1/feedback-summaries/queue/stats` - Get queue statistics
  - Returns: queued_count, processing_count, completed_count, failed_count, cancelled_count, workers_count
- `GET /api/v1/feedback-summaries/queue/health` - Health check
  - Returns: status, redis connection, workers info, queues info

**Scheduled Jobs:**
- `POST /api/v1/feedback-summaries/scheduled-jobs` - Create scheduled job
  - Body: `{name, cron_expression, task_params, enabled}`
- `GET /api/v1/feedback-summaries/scheduled-jobs` - List scheduled jobs
- `PATCH /api/v1/feedback-summaries/scheduled-jobs/{id}` - Update scheduled job
- `DELETE /api/v1/feedback-summaries/scheduled-jobs/{id}` - Delete scheduled job

### Running the System

**Start Infrastructure:**
```bash
make up  # Starts PostgreSQL and Redis
```

**Start Backend API:**
```bash
make be  # Starts FastAPI server
```

**Start Workers (Multiple Terminals for Redundancy):**
```bash
make worker  # Terminal 1
make worker  # Terminal 2
make worker  # Terminal 3
```

**Start Scheduler (For Cron Jobs):**
```bash
make scheduler
```

**Start Frontend:**
```bash
make fe
```

### Performance Tuning

**Optimal Worker Count:**
- Development: 1 worker
- Production: 2-4 workers per CPU core (I/O bound tasks)
- High load: 8-16 workers with load balancing

**Queue Configuration:**
- Job timeout: 10 minutes
- Result TTL: 24 hours
- Failure TTL: 24 hours

**Rate Limiting:**
- Prevents API abuse
- Configurable per endpoint type
- Redis-based sliding window algorithm

### Security Considerations

1. **Multi-tenancy**: All jobs scoped by `school_id`
2. **Authentication**: All endpoints require authentication
3. **Rate Limiting**: Prevents abuse and overload
4. **Webhook Validation**: Webhooks sent with proper headers
5. **Input Validation**: Cron expressions and URLs validated
6. **Cancellation Authorization**: Only authorized users can cancel jobs

### Monitoring

**Check Queue Status:**
```sql
-- Active jobs
SELECT job_id, status, progress, priority, student_id, evaluation_id
FROM summary_generation_jobs
WHERE status IN ('queued', 'processing')
ORDER BY 
  CASE priority 
    WHEN 'high' THEN 1 
    WHEN 'normal' THEN 2 
    WHEN 'low' THEN 3 
  END,
  created_at ASC;

-- Failed jobs with retries
SELECT job_id, retry_count, max_retries, next_retry_at, error_message
FROM summary_generation_jobs
WHERE status = 'queued' AND retry_count > 0
ORDER BY next_retry_at ASC;

-- Scheduled jobs
SELECT name, cron_expression, enabled, next_run_at
FROM scheduled_jobs
WHERE enabled = true
ORDER BY next_run_at ASC;
```

**Redis Queue Inspection:**
```bash
docker exec -it <redis_container> redis-cli

> LLEN rq:queue:ai-summaries-high
> LLEN rq:queue:ai-summaries
> LLEN rq:queue:ai-summaries-low
> SMEMBERS rq:workers
```

### Troubleshooting

**Jobs Stuck in Queued State:**
- Check if workers are running: `ps aux | grep worker.py`
- Check Redis connection: `docker ps | grep redis`
- Review worker logs for errors
- Restart workers: `make worker`

**Webhooks Not Delivered:**
- Check `webhook_delivered` and `webhook_attempts` in database
- Verify webhook URL is accessible
- Check webhook endpoint logs for errors

### Bug Fixes and Maintenance

#### Fixed: Missing updated_at Column (2026-01-01)

**Issue**: The `/queue/stats` endpoint was returning HTTP 500 error:
```
psycopg2.errors.UndefinedColumn: column summary_generation_jobs.updated_at does not exist
```

**Root Cause**:
- The `SummaryGenerationJob` model inherited from `Base` which defines both `created_at` and `updated_at`
- The model incorrectly overrode `created_at` without properly handling timestamp inheritance
- Initial migrations created the table without `updated_at` column and without proper server defaults
- This caused a mismatch between SQLAlchemy's expectations (model has updated_at) and actual database schema (table missing the column)

**Resolution**:

1. **Model Fix**: Removed timestamp overrides to use Base class definitions
   ```python
   # Before (INCORRECT):
   class SummaryGenerationJob(Base):
       created_at: Mapped[datetime] = mapped_column(
           default=datetime.utcnow, nullable=False  # Wrong approach
       )
       # updated_at missing but expected by Base
   
   # After (CORRECT):
   class SummaryGenerationJob(Base):
       # created_at and updated_at inherited from Base
       started_at: Mapped[Optional[datetime]] = mapped_column()
       completed_at: Mapped[Optional[datetime]] = mapped_column()
   ```

2. **Database Migrations**:
   - `queue_20260101_03`: Added `updated_at` column with `TIMESTAMP WITH TIME ZONE`, `server_default=NOW()`
   - `queue_20260101_04`: Fixed `updated_at` in `scheduled_jobs` table (made NOT NULL, added server_default)
   - `queue_20260101_05`: Fixed `created_at` in `summary_generation_jobs` (added server_default, timezone support)

3. **Testing**: Added comprehensive test suite in `tests/test_queue_stats_endpoint.py`
   - Model field validation
   - Query pattern tests
   - Regression prevention tests

**Impact**: The `/queue/stats` endpoint now works correctly, enabling queue monitoring dashboards.

**Prevention Best Practices**:
1. **Always use Base class timestamps** - Don't override created_at/updated_at unless absolutely necessary
2. **If you must override** - Override BOTH fields consistently with server_default=func.now()
3. **Use server defaults** - Prefer `server_default=func.now()` over `default=datetime.utcnow`
4. **Verify migrations** - Ensure migrations match model definitions before applying
5. **Add tests** - Include schema validation tests for critical fields

**For More Details**:
- See `backend/UPDATED_AT_FIX_DOCUMENTATION.md` for comprehensive fix documentation
- See `backend/tests/test_queue_stats_endpoint.py` for regression tests

**Verification**:
```bash
# Check schema (use .pgpass file or connection service to avoid exposing credentials)
psql -h localhost -U app -d tea -c "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='summary_generation_jobs' AND column_name IN ('created_at', 'updated_at');"

# Run tests
pytest tests/test_queue_stats_endpoint.py -v
```

**See Also:**
- `docs/ASYNC_SUMMARY_GENERATION.md` - User guide
- `backend/JOB_QUEUE_ENHANCEMENTS.md` - Technical documentation
- `backend/tests/test_job_enhancements.py` - Test suite
- `backend/UPDATED_AT_FIX_DOCUMENTATION.md` - Timestamp fix documentation

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

#### Project Teams (Modern Architecture)

**Status**: ✅ **FULLY IMPLEMENTED** (Migration completed 2026-01-19)

- **Project Teams** (`project_teams` table): Immutable project-scoped snapshots of team composition
- **CourseEnrollment** (`course_enrollments` table): Student-course relationships (replaces legacy Groups)

**Migration Complete**: The legacy `groups` and `group_members` tables have been completely removed. All team management now uses the modern immutable ProjectTeam architecture.

#### Single Source of Truth

- `project_teams` and `project_team_members` tables are the authoritative source for team data
- `course_enrollments` table is the authoritative source for student-course relationships
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

## External Project Assessment (Opdrachtgever-beoordeling)

The application supports external project assessments where external evaluators (opdrachtgevers) can assess student projects without requiring login credentials.

### Architecture

**Two Scenarios Supported:**
1. **Bovenbouw**: Each team has its own external evaluator
2. **Onderbouw**: One external evaluator assesses all teams in a project

### Key Components

**ExternalEvaluator Table:**
- Stores information about external evaluators
- Fields: name, email, organisation
- Scoped by school_id

**ProjectTeamExternal Table:**
- Links teams (groups) to external evaluators
- Contains unique invitation tokens for secure access
- Tracks assessment status: NOT_INVITED → INVITED → IN_PROGRESS → SUBMITTED
- Optional token expiration date

**ProjectAssessment Extensions:**
- `external_evaluator_id`: Links to external evaluator
- `role`: TEACHER | EXTERNAL (who created the assessment)
- `is_advisory`: Boolean flag (true for external assessments)

**RubricCriterion Extension:**
- `visible_to_external`: Boolean flag to control criterion visibility

### Workflow

1. Teacher creates external assessment and assigns external evaluators to teams
2. System generates unique invitation tokens for each team-evaluator link
3. External evaluators receive invitation links with embedded tokens
4. External evaluators access assessment interface via token (no login required)
5. Assessments are submitted and marked as SUBMITTED
6. Teachers can view external assessment results

### API Endpoints

**Public Endpoints (No Authentication Required):**
- `GET /api/v1/external-assessments/{token}` - Resolve token and get teams to assess
- `GET /api/v1/external-assessments/{token}/teams/{team_id}` - Get rubric and scores
- `POST /api/v1/external-assessments/{token}/teams/{team_id}/submit` - Submit assessment

**See Also:**
- `EXTERNAL_ASSESSMENT_IMPLEMENTATION.md` - Detailed implementation guide

## Academic Year Management and Transitions

The application provides comprehensive academic year management with support for bulk year-to-year transitions.

### Architecture

**AcademicYear Table:**
- Represents school year periods (e.g., "2025-2026")
- Contains start and end dates
- Scoped by school_id
- Archive fields:
  - `is_archived` (boolean): Marks year as read-only (default: false)
  - `archived_at` (datetime): Timestamp when year was archived
- Archived years prevent mutations but allow read access for historical data

**Class Table:**
- Fixed classes within a school year (e.g., "G2a", "G3b")
- Linked to academic_year_id
- Unique constraint: (school_id, academic_year_id, name)

**StudentClassMembership Table:**
- Links students to classes for specific academic years
- Unique constraint: (student_id, academic_year_id) - ensures one class per year
- Enables historical tracking of student class assignments

**Course Updates:**
- Courses linked to academic_year_id (replacing deprecated year field)
- Courses can be cloned to new academic years during transitions

### Year Transition Features

**Validation:**
- Verifies source and target academic years exist and are different
- Ensures all classes in mapping exist in source year
- Checks that target classes don't already exist

**Class Cloning:**
- Maps source class names to target class names (e.g., "G2a" → "G3a")
- Supports partial mapping (only specified classes are cloned)
- Creates new Class records in target academic year

**Student Membership Migration:**
- Copies student class memberships to target year
- Respects unique constraint (one student per class per year)
- Skips students who already have memberships in target year
- Only migrates students from mapped classes

**Course and Enrollment Migration (Optional):**
- Can optionally clone courses to new academic year
- Maintains subject associations
- Only copies enrollments for students in target year
- Skips duplicate enrollments

### Workflow

1. Admin selects source and target academic years
2. Admin specifies class mapping (e.g., {"G2a": "G3a", "G2b": "G3b"})
3. System validates the transition request
4. System executes transition in a single database transaction:
   - Creates new classes in target year
   - Migrates student class memberships
   - Optionally clones courses and enrollments
5. System returns detailed statistics (classes created, students moved, etc.)

### API Endpoints

**Academic Year Management:**
- `POST /api/v1/admin/academic-years/{source_year_id}/transition` - Execute year transition
- Requires admin role
- Full transaction management with rollback on error

**See Also:**
- `BULK_YEAR_TRANSITION_IMPLEMENTATION.md` - Detailed implementation guide

## 3de Blok (RFID Attendance) Module

The application includes a comprehensive RFID-based attendance tracking system for monitoring student presence at school and managing external work registrations.

### Overview

The 3de Blok module provides:
- **Physical check-in/check-out** via RFID card readers (Raspberry Pi + RC522)
- **Real-time presence dashboard** showing currently present students
- **External work registration** with teacher approval workflow
- **Attendance analytics** including lesson blocks calculation
- **Historical attendance tracking** with comprehensive reporting

### Architecture

**Unified Event Model:**
The system uses a single `attendance_events` table for both:
1. **School Attendance**: Physical check-ins via RFID (`is_external=false`, `source='rfid'`)
2. **External Work**: Student-registered hours outside school (`is_external=true`, requires approval)

**Toggle Logic:**
When an RFID card is scanned:
- If student has an open session (`check_out IS NULL`) → close it (check-out)
- Otherwise → open new session (check-in)

**Lesson Blocks Calculation:**
- 1 lesson block = 75 minutes (4500 seconds)
- `lesson_blocks = total_seconds / 4500`
- Total seconds = school attendance + approved external work

### Key Features

#### RFID Card Management
- Multiple cards per user supported
- Active/inactive status for lost or replaced cards
- Unique UIDs across all schools
- Card assignment tracking (who registered the card)

#### School Attendance (RFID)
- Raspberry Pi devices with RC522 RFID readers
- Public API endpoint for hardware integration (`POST /api/v1/attendance/scan`)
- Automatic toggle between check-in and check-out
- Real-time presence view for teachers
- Open session detection and auto-close (>24h)

#### External Work Registration
- Students register hours worked outside school
- Required fields: location, description, start/end times
- Optional project linkage
- Approval workflow: pending → approved/rejected
- Only approved hours count toward totals

#### Attendance Analytics
- Pre-computed aggregates for performance
- Real-time calculation via database function
- Total school hours, external approved hours, lesson blocks
- Per-student and per-class breakdowns
- Historical tracking and trend analysis

### Data Flow

**RFID Scan Flow:**
```
1. Student scans RFID card
2. Raspberry Pi reads UID → POST /api/v1/attendance/scan
3. Backend looks up user via rfid_cards.uid
4. Check for open session (check_out IS NULL)
5a. If open → UPDATE attendance_events SET check_out = NOW()
5b. If closed → INSERT new attendance_event with check_in = NOW()
6. Return action + user info to Raspberry Pi
7. Display feedback (LED, screen, beep)
```

**External Work Approval Flow:**
```
1. Student registers external work → status = 'pending'
2. Teacher views pending registrations
3. Teacher approves or rejects with optional reason
4. If approved → compute_user_attendance_totals() updates aggregates
5. Student sees updated totals and status
```

### API Endpoints

**RFID Hardware Integration:**
- `POST /api/v1/attendance/scan` - RFID card scan (public endpoint, to be secured with API key)
  - Input: `{"uid": "ABC123", "device_id": "rpi-workshop-1"}`
  - Returns: `{status, action, user, event}`

**Teacher Management:**
- `GET /api/v1/attendance/events` - List attendance events with filters
  - Filters: user_id, class_name, project_id, date range, is_external, approval_status
  - Pagination: page, per_page (max 100)
- `PATCH /api/v1/attendance/events/:id` - Edit event times
- `DELETE /api/v1/attendance/events/:id` - Delete event
- `POST /api/v1/attendance/events/bulk-delete` - Bulk delete events
- `GET /api/v1/attendance/presence` - Get currently present students (real-time)
- `GET /api/v1/attendance/export` - Export to CSV/PDF (planned)

**External Work:**
- `POST /api/v1/attendance/external` - Student registers external work
- `PATCH /api/v1/attendance/external/:id/approve` - Teacher approves
- `PATCH /api/v1/attendance/external/:id/reject` - Teacher rejects (with reason)
- `POST /api/v1/attendance/external/bulk-approve` - Bulk approve

**Student Dashboard:**
- `GET /api/v1/attendance/me` - Get own attendance totals
  - Returns: total_school_seconds, total_external_approved_seconds, total_external_pending_seconds, lesson_blocks

**RFID Card Management:**
- `GET /api/v1/rfid/:user_id` - List user's RFID cards
- `POST /api/v1/rfid/:user_id` - Assign new RFID card
- `PATCH /api/v1/rfid/:id` - Update card (e.g., deactivate)
- `DELETE /api/v1/rfid/:id` - Delete card

### Frontend Pages

**Teacher Portal (`/teacher/3de-blok`):**
- **Dashboard** - Overview with real-time presence
- **Events** - Full attendance log with filtering and editing
- **External Work** - Approve/reject external work registrations
- **Students** - Manage students and RFID cards
- **Stats** - Analytics and charts (planned)
- **Overview** - Per-student totals (planned)

**Student Portal (`/student/3de-blok`):**
- **Dashboard** - Own attendance summary and totals
- **Register External Work** - Submit external work hours (planned)

### Security Considerations

1. **School Scoping**: All attendance data scoped by school_id via user relationship
2. **Role-Based Access**:
   - RFID scan: Public (to be secured with API key or IP whitelist)
   - Teacher endpoints: Teacher + Admin roles only
   - Student endpoints: Own data only
3. **Approval Workflow**: External work requires explicit teacher approval
4. **Audit Trail**: All events include created_by, created_at, updated_at
5. **Data Integrity**: Database constraints ensure check_out > check_in

### Performance Optimizations

1. **Indexes**:
   - `rfid_cards.uid` - Fast UID lookup during scans
   - `attendance_events(user_id, check_in DESC)` - Latest event queries
   - Partial index on open sessions (WHERE check_out IS NULL)
   - Partial index on pending approvals (WHERE is_external = true AND approval_status = 'pending')

2. **Aggregates Cache**:
   - `attendance_aggregates` table stores pre-computed totals
   - Updated via `compute_user_attendance_totals()` function
   - Reduces query load for dashboard displays

3. **Database Views**:
   - `open_sessions` view - Currently present students with live duration
   - Pre-joins users table for efficient queries

### Hardware Integration

**Raspberry Pi Setup:**
- RC522 RFID reader module (13.56 MHz)
- Python script for card reading
- HTTPS POST to `/api/v1/attendance/scan`
- LED/display for user feedback
- Audio beep for scan confirmation

**Network Requirements:**
- Raspberry Pi must have network access to backend API
- CORS configured to allow Raspberry Pi IP addresses
- Consider VPN or IP whitelist for production

### Migration from Legacy System

The 3de Blok module was previously a standalone Flask app with MariaDB. Migration involves:

1. **User Matching**: Map legacy usernames to Team App user emails
2. **RFID Cards**: Import UID assignments to `rfid_cards` table
3. **Historical Logs**: Import to `attendance_events` with `source='import'`
4. **External Work**: Import to `attendance_events` with `is_external=true`
5. **Aggregates**: Recompute totals via `compute_user_attendance_totals()`

**See Also:**
- `docs/3de_blok/REBUILD_PLAN.md` - Detailed rebuild strategy
- `docs/3de_blok/ARCHITECTURE_DIAGRAM.md` - System architecture diagrams
- `docs/3de_blok/QUICK_START.md` - Quick start guide
- `3DE_BLOK_IMPLEMENTATION_SUMMARY.md` - Implementation summary

## Learning Objectives (Eindtermen)

The application provides comprehensive learning objective management with a two-tier architecture.

### Architecture

**Two-Tier System:**

1. **Central (Template) Objectives:**
   - `is_template=True`
   - Managed by admins via `/admin/templates`
   - Linked to subject/sectie (`subject_id IS NOT NULL`)
   - No teacher ownership (`teacher_id IS NULL`)
   - Can be linked to rubric criteria
   - Read-only for teachers

2. **Teacher-Specific Objectives:**
   - `is_template=False`
   - Managed by teachers via `/teacher/learning-objectives`
   - Owned by specific teacher (`teacher_id IS NOT NULL`)
   - Optional course linkage (`course_id`)
   - Cannot be linked to central rubric templates
   - Only visible/editable by owning teacher

### Key Features

**Domain Organization:**
- Learning objectives organized by domain (e.g., "A", "B", "C", "D - Ontwerpen", "E")
- Phase classification: "onderbouw" or "bovenbouw"
- Ordering/numbering support

**Rubric Integration:**
- Central objectives can be linked to rubric criteria via RubricCriterionLearningObjective
- Many-to-many relationship enables tracking student progress per learning goal
- Supports coverage tracking across evaluations

**Project Notes Integration:**
- Project notes can reference learning objectives
- Enables evidence collection for learning objective achievement
- Supports competency and portfolio evidence flags

### Purpose

- Track student progress against learning goals
- Enable coverage analysis across evaluations
- Support teacher planning and assessment design
- Facilitate reporting on learning objective achievement

**See Also:**
- `docs/LEARNING_OBJECTIVES_ARCHITECTURE.md` - Detailed architecture guide

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

### Tasks API (`/api/v1/teacher/tasks`)

- `GET /teacher/tasks` - List tasks with filters (teacher/admin only)
  - Query params: `status` ("open"|"done"|"dismissed"), `type` ("opdrachtgever"|"docent"|"project"), `from` (ISO date), `to` (ISO date), `project_id`, `client_id`, `page`, `per_page`
  - Returns: Paginated list with enriched context (project_name, client_name, class_name, course_name)
  - Sort: `due_date ASC, created_at DESC`
- `POST /teacher/tasks` - Create manual task (teacher/admin only)
  - Body: `{title, description?, due_date?, status?, type?, project_id?, client_id?, class_id?, email_to?, email_cc?}`
  - Sets: `auto_generated=false`, `source="manual"`
- `PATCH /teacher/tasks/{task_id}` - Update task (teacher/admin only)
  - Body: Partial task fields
  - Automatic: Sets `completed_at` when status changes to "done"
- `DELETE /teacher/tasks/{task_id}` - Delete task (teacher/admin only)
  - Only manual tasks can be deleted; auto-generated tasks are deleted when project is deleted
- `POST /teacher/tasks/{task_id}/complete` - Mark task as done (convenience endpoint)
  - Sets: `status="done"`, `completed_at=now()`

**Auto-generation:**
- Tasks are automatically created when projects are created via wizard with `project_assessment_tussen` or `project_assessment_eind` deadlines
- Tussenpresentatie task: `due_date = tussen_datum - 21 days`
- Eindpresentatie task: `due_date = eind_datum - 21 days`
- Auto-generated tasks are upserted (updated if they exist) when project dates change
- Manual tasks are preserved during project updates

**Integration:**
- **Dashboard**: Tasks shown in "Opdrachtgevers" tab with "Open in Outlook" and "Klaar" buttons
- **Calendar**: Tasks appear as calendar events with type-specific icons (📧 opdrachtgever, ✅ docent, 📌 project)
- **Email**: `generateMailtoLink()` creates mailto links with task context (project, client, deadline, description)

### Academic Years API (`/api/v1/admin/academic-years`)

- `GET /academic-years` - List academic years for school
- `POST /academic-years` - Create a new academic year
- `GET /academic-years/{id}` - Get academic year details
- `PATCH /academic-years/{id}` - Update academic year
- `DELETE /academic-years/{id}` - Delete academic year
- `POST /academic-years/{source_year_id}/transition` - Execute year transition
  - Body: `{"target_academic_year_id": int, "class_mapping": {...}, "copy_course_enrollments": bool}`
  - Returns: Statistics about classes created, students moved, courses/enrollments copied

### Classes API (`/api/v1/admin/classes`)

- `GET /classes` - List classes (with pagination and filters)
  - Query params: `academic_year_id`, `page`, `per_page`
- `POST /classes` - Create a new class
- `GET /classes/{id}` - Get class details with student memberships
- `PATCH /classes/{id}` - Update class
- `DELETE /classes/{id}` - Delete class
- `GET /classes/{id}/students` - Get students in class
- `POST /classes/{id}/students` - Add students to class
- `DELETE /classes/{id}/students/{student_id}` - Remove student from class

### Learning Objectives API (`/api/v1/learning-objectives`)

**Teacher Endpoints:**
- `GET /learning-objectives` - List learning objectives (central + teacher's own)
  - Query params: `is_template`, `subject_id`, `course_id`, `domain`, `phase`
- `POST /learning-objectives` - Create teacher-specific objective
- `GET /learning-objectives/{id}` - Get objective details
- `PATCH /learning-objectives/{id}` - Update teacher's own objective
- `DELETE /learning-objectives/{id}` - Delete teacher's own objective

**Admin Template Endpoints:**
- `GET /admin/templates/learning-objectives` - List central objectives
- `POST /admin/templates/learning-objectives` - Create central objective
- `PATCH /admin/templates/learning-objectives/{id}` - Update central objective
- `DELETE /admin/templates/learning-objectives/{id}` - Delete central objective

### External Assessment API (`/api/v1/external-assessments`)

**Public Endpoints (No Authentication):**
- `GET /external-assessments/{token}` - Resolve token and get teams to assess
- `GET /external-assessments/{token}/teams/{team_id}` - Get rubric and existing scores
- `POST /external-assessments/{token}/teams/{team_id}/submit` - Submit assessment

**Teacher Endpoints:**
- `POST /external-assessments/invitations` - Create invitation tokens for external evaluators
- `GET /external-assessments/invitations/{project_id}` - Get all invitations for a project
- `POST /external-assessments/invitations/{id}/resend` - Resend invitation email
- `PATCH /external-assessments/invitations/{id}` - Update invitation status

### Project Notes API (`/api/v1/project-notes`)

- `GET /contexts` - List project note contexts
  - Query params: `course_id`, `project_id`, `status`
- `POST /contexts` - Create a new note context
- `GET /contexts/{id}` - Get context with all notes
- `PATCH /contexts/{id}` - Update context
- `DELETE /contexts/{id}` - Delete context
- `POST /contexts/{id}/close` - Close context (freeze)
- `GET /contexts/{id}/notes` - List notes in context
- `POST /contexts/{id}/notes` - Create a note
- `GET /notes/{id}` - Get note details
- `PATCH /notes/{id}` - Update note
- `DELETE /notes/{id}` - Delete note

### Template Management API (`/api/v1/admin/templates`)

**Peer Evaluation Criterion Templates:**
- `GET /peer-criterion-templates` - List templates
- `POST /peer-criterion-templates` - Create template
- `GET /peer-criterion-templates/{id}` - Get template
- `PATCH /peer-criterion-templates/{id}` - Update template
- `DELETE /peer-criterion-templates/{id}` - Delete template

**Project Rubric Templates:**
- `GET /project-rubric-templates` - List templates
- `POST /project-rubric-templates` - Create template
- `GET /project-rubric-templates/{id}` - Get template with criteria
- `PATCH /project-rubric-templates/{id}` - Update template
- `DELETE /project-rubric-templates/{id}` - Delete template

**Mail Templates:**
- `GET /mail-templates` - List templates
- `POST /mail-templates` - Create template
- `GET /mail-templates/{id}` - Get template
- `PATCH /mail-templates/{id}` - Update template
- `DELETE /mail-templates/{id}` - Delete template
- `POST /mail-templates/{id}/render` - Render template with variables

**Standard Remarks:**
- `GET /standard-remarks` - List remarks
  - Query params: `type`, `category`, `subject_id`
- `POST /standard-remarks` - Create remark
- `PATCH /standard-remarks/{id}` - Update remark
- `DELETE /standard-remarks/{id}` - Delete remark
- `POST /standard-remarks/reorder` - Update remark ordering

### Somtoday Integration (`/api/v1/integrations/somtoday`)

**Note**: These endpoints are placeholders for future implementation

- `GET /status` - Check connection status
- `GET /authorize` - Start OAuth2 flow
- `GET /callback` - OAuth2 callback
- `POST /import/classes` - Import classes as groups
- `POST /import/students` - Import students
- `POST /export/grades` - Export grades to Somtoday
- `DELETE /disconnect` - Disconnect integration

### 3de Blok Attendance API (`/api/v1/attendance`, `/api/v1/rfid`)

**RFID Hardware Integration:**
- `POST /attendance/scan` - RFID card scan endpoint for Raspberry Pi
  - Body: `{"uid": "ABC123", "device_id": "rpi-workshop-1"}`
  - Returns: `{status, action, user, event}`
  - Public endpoint (to be secured with API key)

**Teacher Management Endpoints:**
- `GET /attendance/events` - List attendance events with filters
  - Query params: `user_id`, `class_name`, `project_id`, `start_date`, `end_date`, `is_external`, `status_open`, `approval_status`, `page`, `per_page`
- `PATCH /attendance/events/:id` - Edit event times
- `DELETE /attendance/events/:id` - Delete single event
- `POST /attendance/events/bulk-delete` - Bulk delete events
  - Body: `{"event_ids": [1, 2, 3]}`
- `GET /attendance/presence` - Get currently present students (real-time)
- `GET /attendance/export` - Export attendance data to CSV/PDF (planned)

**External Work Endpoints:**
- `POST /attendance/external` - Student registers external work
  - Body: `{check_in, check_out, location, description, project_id?}`
- `PATCH /attendance/external/:id/approve` - Teacher approves external work
- `PATCH /attendance/external/:id/reject` - Teacher rejects with reason
  - Body: `{"reason": "..."}`
- `POST /attendance/external/bulk-approve` - Bulk approve external work
  - Body: `{"event_ids": [1, 2, 3]}`

**Student Dashboard:**
- `GET /attendance/me` - Get own attendance totals
  - Returns: `{total_school_seconds, total_external_approved_seconds, total_external_pending_seconds, lesson_blocks}`

**RFID Card Management:**
- `GET /rfid/:user_id` - List user's RFID cards
- `POST /rfid/:user_id` - Assign new RFID card to user
  - Body: `{"uid": "ABC123", "label": "Primary Card"}`
- `PATCH /rfid/:id` - Update card (e.g., deactivate)
  - Body: `{"is_active": false}`
- `DELETE /rfid/:id` - Delete RFID card

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
- ✅ Academic year management with year transitions
- ✅ Class management and student class memberships
- ✅ Course enrollment system
- ✅ External project assessment (opdrachtgever-beoordeling)
- ✅ Learning objectives (eindtermen) with two-tier architecture
- ✅ Project notes system with OMZA and learning objective linkage
- ✅ Subprojects (deelprojecten) for choice projects
- ✅ Comprehensive template system (peer, project, competency, mail, remarks)
- ✅ Template tagging and categorization
- ✅ 3de Blok RFID attendance module (backend complete)
  - ✅ RFID card management
  - ✅ School attendance tracking via RFID readers
  - ✅ External work registration with approval workflow
  - ✅ Attendance aggregates and lesson blocks calculation
  - ✅ Real-time presence dashboard
  - ✅ Database schema with views and functions
- ✅ Async job queue system with RQ (Redis Queue)
  - ✅ Job progress tracking (0-100%)
  - ✅ Job cancellation
  - ✅ Priority queues (high/normal/low)
  - ✅ Webhook notifications on completion
  - ✅ Dashboard for queue monitoring
  - ✅ Automatic retry with exponential backoff
  - ✅ Multi-queue support for different task types
  - ✅ Job scheduling (cron-like)
  - ✅ Rate limiting

### Phase 2 (Current/Planned)
- Analytics dashboards per course and school
- Learning objective coverage tracking and reporting
- Grade export/import (CSV, Excel)
- Bulk student management improvements
- Email notifications integration (SMTP)
- Email sending UI with template selection from MailTemplate
- External evaluator invitation management UI
- Template library UI for browsing and applying templates
- 3de Blok attendance frontend completion
  - Full events table with editing capabilities
  - External work approval UI
  - Student dashboard with external work registration
  - Stats page with charts and analytics
  - CSV/PDF export for attendance reports

### Phase 3 (Future)
- Full Somtoday integration
- Multi-school user access (teachers working at multiple schools)
- Advanced analytics with visualizations
- Mobile app support
- API rate limiting and caching
- Automated backups and data retention policies
- Competency portfolio system
- Advanced learning objective analytics
