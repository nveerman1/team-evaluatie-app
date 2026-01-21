# Backend Scripts

This directory contains utility and seeding scripts for the Team Evaluatie App backend.

## Seeding Scripts

### seed.py ⭐ **RECOMMENDED**

**Purpose:** Comprehensive database seeding script with two modes: base (minimal) and demo (full dataset).

**What it creates:**

**Base Mode (minimal, idempotent):**
- 1 school: "Demo School"
- 1 subject: "Onderzoek & Ontwerpen (O&O)"
- 1 academic year: Current year (e.g., 2025-2026)
- 6 competency categories: Samenwerken, Plannen, Creatief Denken, Technisch Werken, Communiceren, Reflecteren
- 1 admin user: `admin@school.nl` / `demo123`
- 1 teacher user: `docent@school.nl` / `demo123`

**Demo Mode (comprehensive dataset):**
- Everything from base mode (if --reset is used)
- 2 classes: G2a, G2b
- 24 students: 12 per class with realistic Dutch names
- 1 course: O&O with teacher assignment
- 6 teams (Groups): 4 students each
- 3 projects: Various statuses (concept, active, completed)
- ProjectTeams: Frozen team rosters for projects
- 2 rubrics: 1 peer evaluation + 1 project assessment with criteria
- 1-2 peer evaluations: With allocations, scores, and reflections
- 1-2 project assessments: With team scores and reflections
- 2 competency windows: Self-scores, goals, and teacher observations
- 5-10 learning objectives: Template objectives for O&O
- 2-3 clients: With contact logs and project links
- RFID cards: For 8 students with 5-10 attendance events each

**Usage:**

```bash
# Base mode - minimal idempotent seed (safe to run multiple times)
python -m backend.scripts.seed --mode base

# Demo mode - comprehensive dataset
python -m backend.scripts.seed --mode demo

# Demo mode with database reset (WARNING: deletes all data)
python -m backend.scripts.seed --mode demo --reset

# Demo mode with custom random seed for different data
python -m backend.scripts.seed --mode demo --seed 1234
```

**Options:**
- `--mode {base|demo}` (required): Seeding mode
- `--reset`: Reset database before seeding (demo mode only, truncates all tables)
- `--seed NUMBER`: Random seed for deterministic data generation (default: 42)

**Features:**
- ✅ Uses seed_utils for realistic, deterministic data
- ✅ Respects foreign key constraints
- ✅ Base mode is idempotent (safe to run multiple times)
- ✅ Timestamps spread over last 8 weeks
- ✅ Realistic Dutch names and scenarios
- ✅ Edge cases included (draft/published states, missing optional fields)
- ✅ Progress indicators and error handling with rollback
- ✅ No hardcoded primary keys

**Prerequisites:**
1. Database connection configured
2. Database migrations applied: `alembic upgrade head`
3. Python dependencies installed

**Login credentials (after seeding):**
- Admin: `admin@school.nl` / `demo123`
- Teacher: `docent@school.nl` / `demo123`
- Students: `<name>@school.nl` / `demo123` (auto-generated)

---

### seed_peer_evaluations.py

**Purpose:** Seeds peer evaluations with scores, feedback, and reflections for specified students.

**What it creates:**
- Multiple peer evaluations (draft, open, and closed status)
- Allocations (reviewer -> reviewee pairs) including self-assessments
- Scores with optional feedback comments for each rubric criterion
- Reflections for students (for closed evaluations)

**Target data:**
- School ID: 1
- Course ID: 1
- Student IDs: 5, 6, 7, 8, 18, 19, 20, 34, 35, 36, 37

**Prerequisites:**
1. School with ID 1 must exist
2. Course with ID 1 must exist
3. Students with the specified IDs must exist and be enrolled in school 1
4. At least one peer rubric must exist for school 1

**Usage:**
```bash
cd backend
python scripts/seed_peer_evaluations.py
```

**What it does:**
1. Validates that school, course, and students exist
2. Finds available peer rubrics for the school
3. Creates 3 peer evaluations:
   - Q1 evaluation (closed)
   - Q2 evaluation (closed)
   - Q3 evaluation (open/current)
4. For each evaluation:
   - Creates self-assessment allocations (each student reviews themselves)
   - Creates peer review allocations (each student reviews 2-3 others randomly)
   - Generates realistic scores (1-5 scale) with appropriate distribution
   - Adds optional feedback comments (60% probability)
   - Creates reflections for closed evaluations

**Score distributions:**
- Self-assessments: tend to be slightly higher (mostly 3-5)
- Peer assessments: more varied (1-5 with realistic distribution)
- Feedback quality varies based on score level (positive, neutral, constructive)

**Note:** If an evaluation with the same name already exists, it will be deleted and recreated.

---

### seed_competency_scans_with_scores.py

Seeds competency scan windows with self-scores, goals, and reflections for the same set of students.

**Target data:**
- Course ID: 1
- Student IDs: 5, 6, 7, 8, 18, 19, 20, 34, 35, 36, 37

**Usage:**
```bash
cd backend
python scripts/seed_competency_scans_with_scores.py
```

---

### seed_demo_data.py

Creates basic demo data including a demo school and admin user.

**Usage:**
```bash
cd backend
python scripts/seed_demo_data.py
```

---

### seed_3de_blok.py

Seeds test data for the 3de Blok RFID attendance module.

**Usage:**
```bash
cd backend
python scripts/seed_3de_blok.py [school_id]
```

---

### seed_external_work.py

Seeds external work assignments and submissions.

**Usage:**
```bash
cd backend
python scripts/seed_external_work.py
```

---

### seed_external_assessment_test.py

Seeds complete test data for external assessment feature at `/teacher/project-assessments/1/external`.

**What it creates:**
- School (ID 1)
- Admin and Teacher users
- 5 Students (IDs are auto-generated by database)
- Course (ID 1) with subject and academic year
- Groups (2 teams with students)
- Project (ID 1)
- ProjectTeams (frozen rosters)
- Rubric (ID 3) with scope='project' and 4 criteria (3 visible to externals, 1 internal)
- ProjectAssessment (ID 1)
- ExternalEvaluators (2 evaluators)
- ProjectTeamExternal links with invitation tokens

**Prerequisites:**
- Database connection configured
- Database migrations applied

**Usage:**
```bash
cd backend
python scripts/seed_external_assessment_test.py
```

**Test URL after seeding:**
```
http://localhost:3000/teacher/project-assessments/1/external
```

**Login credentials:**
- Teacher: `teacher@test.school` / `test123`
- Admin: `admin@test.school` / `test123`

---

## Utility Scripts

### audit_course_enrollments.py

**Purpose:** Audits CourseEnrollment coverage by comparing with GroupMember records.

**Phase:** Legacy Tables Migration - Phase 1.1

**What it does:**
- Fetches all active GroupMember records
- Identifies unique student-course pairs
- Checks for corresponding CourseEnrollment records
- Reports coverage statistics and identifies gaps

**Usage:**
```bash
cd backend
python scripts/audit_course_enrollments.py
```

**Exit codes:**
- 0: PASS - 100% coverage
- 1: WARNING - Coverage good but not 100%
- 2: FAIL - Backfill required

---

### backfill_course_enrollments.py

**Purpose:** Creates CourseEnrollment records for students missing them.

**Phase:** Legacy Tables Migration - Phase 1.2

**What it does:**
- Identifies students with active GroupMember but no CourseEnrollment
- Creates missing CourseEnrollment records
- Activates inactive CourseEnrollment records where needed
- Ensures idempotent operation (safe to run multiple times)

**Usage:**
```bash
# Dry run (preview changes without committing)
cd backend
python scripts/backfill_course_enrollments.py

# Live run (commit changes to database)
cd backend
python scripts/backfill_course_enrollments.py --commit
```

**Features:**
- Handles students in multiple groups of the same course correctly
- Prevents duplicate enrollments (unique constraint)
- Supports both new creation and reactivation
- Dry-run mode by default for safety

---

### backfill_project_teams.py

Backfills project team data for existing projects.

**Usage:**
```bash
cd backend
python scripts/backfill_project_teams.py
```

---

## General Requirements

All scripts require:
1. Database connection configured in `app/core/config.py`
2. Python dependencies installed: `pip install -r requirements.txt`
3. Database migrations applied: `alembic upgrade head`

## Running Scripts

From the repository root:
```bash
cd backend
python scripts/<script_name>.py
```

Or with virtual environment:
```bash
cd backend
source venv/bin/activate  # or `. venv/bin/activate`
python scripts/<script_name>.py
```
