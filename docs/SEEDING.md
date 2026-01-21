# Database Seeding Guide

This guide explains how to use the comprehensive database seeding system for the Team Evaluatie App.

## Overview

The seeding system provides two modes:

1. **Base Seed** - Minimal, idempotent seed for required system records
2. **Demo Seed** - Complete realistic dataset for testing the full application

## Quick Start

### Base Seed (Production-Safe)

Create minimal required records. Safe to run multiple times.

```bash
cd backend
python -m backend.scripts.seed --mode base
```

This creates:
- 1 School: "Demo School"
- 1 Subject: "Onderzoek & Ontwerpen (O&O)"
- 1 Academic Year: 2025-2026
- 6 Competency Categories
- 2 Users: admin@school.nl and docent@school.nl (password: demo123)

### Demo Seed (Development/Testing)

Create comprehensive test dataset.

```bash
cd backend
python -m backend.scripts.seed --mode demo --reset --seed 42
```

This creates:
- Everything from base seed
- 2 Classes (G2a, G2b)
- 24 Students
- 6 Teams
- 3 Projects
- Peer evaluations and project assessments
- Competency scans and goals
- Learning objectives
- Clients and project links
- RFID cards and attendance events
- And much more...

## Command Line Options

### `--mode {base|demo}` (Required)

Specifies the seeding mode:
- `base`: Minimal, idempotent seed
- `demo`: Comprehensive test dataset

### `--reset` (Optional, demo mode only)

Safely truncates all tables before seeding. Respects foreign key constraints by truncating in reverse dependency order.

⚠️ **Warning**: This will delete ALL data from the database!

```bash
python -m scripts.seed --mode demo --reset
```

### `--seed NUMBER` (Optional)

Sets the random seed for deterministic data generation. Use the same seed to generate identical data across runs.

Default: 42

```bash
# Generate with seed 1234
python -m scripts.seed --mode demo --seed 1234

# Run again with same seed - data will be identical
python -m scripts.seed --mode demo --reset --seed 1234

# Different seed = different names, dates, etc.
python -m scripts.seed --mode demo --reset --seed 9999
```

## Usage Examples

### Development Setup

```bash
# First time setup - create base records
python -m backend.scripts.seed --mode base

# Add demo data for testing
python -m backend.scripts.seed --mode demo
```

### Reset and Reseed

```bash
# Completely reset and recreate demo data
python -m backend.scripts.seed --mode demo --reset
```

### Reproducible Testing

```bash
# Create test data with specific seed
python -m backend.scripts.seed --mode demo --reset --seed 42

# Later, recreate exact same data
python -m backend.scripts.seed --mode demo --reset --seed 42
```

### Update Base Records Only

```bash
# Update/create required system records without affecting user data
python -m backend.scripts.seed --mode base
```

## What Gets Created

### Base Seed

| Entity | Count | Description |
|--------|-------|-------------|
| Schools | 1 | Demo School |
| Subjects | 1 | Onderzoek & Ontwerpen (O&O) |
| Academic Years | 1 | 2025-2026 |
| Competency Categories | 6 | Samenwerken, Plannen, Creatief Denken, etc. |
| Users (admin) | 1 | admin@school.nl / demo123 |
| Users (teacher) | 1 | docent@school.nl / demo123 |

### Demo Seed

In addition to base seed:

| Entity | Count | Description |
|--------|-------|-------------|
| Classes | 2 | G2a, G2b |
| Students | 24 | 12 per class, realistic Dutch names |
| Student Class Memberships | 24 | Link students to classes |
| Courses | 1 | O&O course |
| Teacher-Course Assignments | 2 | Both teachers assigned to course |
| Course Enrollments | 24 | All students enrolled |
| Groups (Teams) | 6 | 4 students per team |
| Group Members | 24 | Team assignments |
| Projects | 3 | Varied status (concept, active, completed) |
| Project Teams | 6 | Frozen team rosters per project |
| Project Team Members | 24 | Historical team membership |
| Rubrics | 2 | 1 peer, 1 project assessment |
| Rubric Criteria | 8+ | Criteria with descriptors |
| Evaluations | 1-2 | Peer evaluation rounds |
| Allocations | Multiple | Who reviews whom |
| Scores | Multiple | Scores on criteria with comments |
| Reflections | Multiple | Student reflections |
| Project Assessments | 1-2 | Teacher assessments |
| Project Assessment Scores | Multiple | Team/student scores |
| Self-Assessments | Multiple | Student self-assessments |
| Competencies | 6 | Template competencies |
| Competency Levels | 30 | 5 levels per competency |
| Competency Windows | 2 | Startscan, Midscan |
| Competency Self-Scores | Multiple | Student self-assessments |
| Competency Goals | Multiple | Student learning goals |
| Competency Reflections | Multiple | Goal reflections |
| Teacher Observations | Multiple | Teacher competency scores |
| Learning Objectives | 8 | Template learning goals |
| Criterion-Objective Links | Multiple | Link criteria to objectives |
| Clients | 3 | External opdrachtgevers |
| Client Logs | 3+ | Communication logs |
| Client-Project Links | 3 | Link clients to projects |
| RFID Cards | 8 | Student RFID tags |
| Attendance Events | 40-80 | Check-in/out and external work |

## Smoke Test

After seeding, verify data integrity:

```bash
python -m backend.scripts.seed_smoke_test
```

The smoke test checks:
- ✅ All entity counts meet minimum expectations
- ✅ No null score fields where UI expects numbers
- ✅ All foreign key relationships are valid
- ✅ All unique constraints are respected
- ✅ Business rules are satisfied

## Data Characteristics

### Timestamps

All timestamps are spread realistically over the last 8 weeks, with appropriate sequencing (e.g., projects created before evaluations).

### Names

Dutch names are used for realistic testing:
- Students: Emma, Daan, Sophie, Lucas, etc.
- Teachers: Dhr. Vermeulen, Mevr. Scholten, etc.

### Statuses

Various statuses are included to test all UI states:
- Projects: concept, active, completed
- Evaluations: draft, open, closed
- Assessments: draft, open, published
- Attendance: pending, approved

### Edge Cases

The demo seed includes realistic edge cases:
- Some students without complete competency scans
- Some evaluations still in draft
- Some project assessments unpublished
- Some attendance events pending approval
- Some optional fields left empty

## Idempotency (Base Mode)

The base seed mode is idempotent - running it multiple times will:
- Create records if they don't exist
- Update existing records to ensure correct values
- Never delete or duplicate data

This makes it safe to run base seed in production to ensure system records exist.

## Database Reset (Demo Mode with --reset)

The `--reset` flag safely truncates tables in reverse dependency order:

1. Disable foreign key checks
2. Truncate tables from most dependent to least dependent
3. Re-enable foreign key checks
4. Reseed data

This ensures:
- No foreign key violations
- Complete database cleanup
- Fresh start for demo data

## Troubleshooting

### Permission Errors

Ensure you're running from the `backend` directory:

```bash
cd backend
python -m backend.scripts.seed --mode demo
```

### Import Errors

If you see import errors, ensure the backend directory is in your Python path:

```bash
cd backend
PYTHONPATH=/home/runner/work/team-evaluatie-app/team-evaluatie-app/backend python -m scripts.seed --mode demo
```

### Database Connection Errors

Ensure your `.env` file has the correct `DATABASE_URL`:

```
DATABASE_URL=postgresql://user:password@localhost/dbname
```

### Foreign Key Violations

If you see foreign key violations, use `--reset` to clean the database first:

```bash
python -m scripts.seed --mode demo --reset
```

## Integration with CI/CD

### Development Environment

```bash
# Setup script for new developer
python -m backend.scripts.seed --mode base
python -m backend.scripts.seed --mode demo
python -m backend.scripts.seed_smoke_test
```

### Testing Pipeline

```bash
# Automated testing with consistent data
python -m backend.scripts.seed --mode demo --reset --seed 42
pytest
```

### Production Deployment

```bash
# Only run base seed in production
python -m backend.scripts.seed --mode base
```

## Files

- `backend/scripts/seed.py` - Main seeding script
- `backend/scripts/seed_smoke_test.py` - Data integrity tests
- `backend/app/db/seed_utils.py` - Seeding utilities (factories, helpers)

## Support

For issues or questions:
1. Check the smoke test output for specific errors
2. Review seed script logs for detailed progress
3. Consult the model documentation in `backend/app/infra/db/models.py`
