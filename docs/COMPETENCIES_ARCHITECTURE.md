# Competencies Two-Tier Architecture

This document describes the two-tier architecture for Competencies (Competentiemonitor) in the Team Evaluatie App.

## Overview

Competencies are organized in a two-tier system with sharing capabilities:

1. **Central Competencies** (`is_template=True`) - Managed by admins, linked to subjects/sections
2. **Teacher-Specific Competencies** (`is_template=False`) - Owned by individual teachers
3. **Shared Competencies** - Teacher-specific competencies with `course_id` set, visible to colleagues

## Data Model

### Competency Table

```
┌─────────────────────────────┐
│       Competency            │
│─────────────────────────────│
│ id: int (PK)                │
│ school_id: int (FK)         │  Multi-tenant scope
│ subject_id: int (FK, null)  │  For central competencies
│ teacher_id: int (FK, null)  │  For teacher-specific competencies
│ course_id: int (FK, null)   │  Optional course scope for teacher competencies
│ is_template: bool           │  True = central, False = teacher-specific
│ phase: str (null)           │  "onderbouw" | "bovenbouw" - like learning objectives
│ category_id: int (FK, null) │  Optional FK to CompetencyCategory
│ name: str                   │  Competency name
│ description: str            │  Detailed description
│ order: int                  │  Display order
│ active: bool                │  Whether active
│ scale_min: int              │  Minimum scale value (default 1)
│ scale_max: int              │  Maximum scale value (default 5)
│ scale_labels: dict          │  Labels for scale levels
│ metadata_json: dict         │  Additional metadata
│ created_at, updated_at      │  Timestamps
└─────────────────────────────┘
```

### Competency Types

| Type | `is_template` | `subject_id` | `teacher_id` | `course_id` | Managed By | Visible To |
|------|---------------|--------------|--------------|-------------|------------|------------|
| Central | `True` | Optional | NULL | NULL | Admins only | All teachers (read-only) |
| Teacher (Personal) | `False` | NULL | Required | NULL | Owner teacher | Owner only |
| Teacher (Course) | `False` | NULL | Required | Required | Owner teacher | Owner + other course teachers (read-only) |

**Course-linked Teacher Competencies**: When a teacher creates a competency with a `course_id`, this competency becomes visible to all other teachers who are also assigned to that course (via `TeacherCourse` table). This enables collaboration where one teacher's competencies are visible to colleagues teaching the same course.

## API Endpoints

### List Competencies (Legacy - Backward Compatible)

```http
GET /api/v1/competencies/
```

Query Parameters:
- `active_only`: Filter active competencies only (default: true)

Returns only central (`template`) competencies for backward compatibility.

### List Teacher Competencies (New Two-Tier Endpoint)

```http
GET /api/v1/competencies/teacher-list
```

Query Parameters:
- `page`: Page number for pagination (default: 1)
- `limit`: Results per page (default: 50, max: 100)
- `active_only`: Filter active competencies only (default: true)
- `competency_type`: Filter by type (`central`, `teacher`, `shared`, `all`)
- `include_teacher_competencies`: Include current user's teacher competencies (boolean)
- `include_course_competencies`: Include teacher competencies from shared courses (boolean)
- `subject_id`: Filter by subject (for central competencies)
- `category_id`: Filter by competency category
- `phase`: Filter by phase (`onderbouw` or `bovenbouw`)
- `search`: Search in name/description

**Response includes:**
- `competency_type` field with computed value: `"central"`, `"teacher"`, or `"shared"`
- `category_name` and `category_description` for inline display
- `phase` field for onderbouw/bovenbouw filtering

### Create Competency

```http
POST /api/v1/competencies/
```

**For Central Competencies (Admin only):**
```json
{
  "is_template": true,
  "subject_id": 1,
  "name": "Samenwerken",
  "description": "...",
  "phase": "onderbouw",
  "scale_min": 1,
  "scale_max": 5
}
```

**For Teacher-Specific Competencies:**
```json
{
  "is_template": false,
  "course_id": 2,  // optional - enables sharing
  "name": "Mijn eigen competentie",
  "description": "...",
  "phase": "bovenbouw",
  "scale_min": 1,
  "scale_max": 5
}
```

Note: `teacher_id` is automatically set to the current user for teacher competencies.

### Update/Delete Competency

- **Central competencies**: Only admins can update/delete
- **Teacher competencies**: Only the owning teacher can update/delete

## Frontend Pages

### 1. Teacher Competencies Management Page (`/teacher/competencies-beheer`)

**Purpose**: View central competencies and manage own competencies

**Features:**
- **"+ Eigen Competentie" button** in header for creating personal competencies
- Filter pills: "Alle" / "Centrale competenties" / "Mijn eigen competenties" / "Gedeelde competenties"
- **Phase tabs**: "Alle fasen" / "Onderbouw" / "Bovenbouw"
- **Category dropdown filter**
- Visual badges:
  - 🏛️ Centraal (amber) - Read-only for teachers
  - 👤 Eigen (emerald) - Editable by owner
  - 👥 Gedeeld (cyan) - Read-only
- **Category column** with name and description inline
- **Phase column** with Onderbouw/Bovenbouw badges
- Search filter
- Info banner explaining the three types
- Legend explaining badge meanings

### 2. Admin Templates Page (`/teacher/admin/templates?tab=competencies`)

**Purpose**: Manage central competency templates for a subject

**Features:**
- **Table per category** (like peer evaluation criteria)
- **Category dropdown filter** (instead of filter pills)
- **Level filter pills** (Alle / Onderbouw / Bovenbouw)
- Only shows central competencies (`competency_type=central`)
- New competencies created with `is_template=true`
- "+" Button in page header (not in tab content)

### 3. Competency Monitor (`/teacher/competencies`)

**Purpose**: Manage competency windows and student self-assessments

**Features:**
- Uses central competencies by default
- Can include teacher and shared competencies if configured

## Rubric Criterion Linkage

Central competencies can be linked to rubric criteria via the `RubricCriterion.competency_id` field:

```
┌─────────────────────────────┐
│      RubricCriterion        │
│─────────────────────────────│
│ ...                         │
│ competency_id: int (FK)     │  Optional link to competency
│ ...                         │
└─────────────────────────────┘
```

**Important**: Only central competencies (`is_template=True`) should be linked to rubric criteria. This is enforced at the application level. Teacher-specific competencies are for personal tracking only and cannot be linked to rubric templates.

## Migrations

### comp_20251201_01 - Two-Tier Architecture

Adds:
1. `subject_id` column (FK to subjects)
2. `teacher_id` column (FK to users)
3. `course_id` column (FK to courses)
4. `is_template` column (boolean, NOT NULL)
5. Indexes on new columns
6. Sets `is_template=True` for all existing records (backward compatible)

### comp_20251201_02 - Phase Support

Adds:
1. `phase` column (nullable string, max 20 chars)
2. Index on `school_id` + `phase` for efficient filtering

## Access Control Summary

| Action | Central Competencies | Teacher Competencies |
|--------|---------------------|---------------------|
| View | All users | Owner only (or course colleagues if shared) |
| Create | Admin only | Any teacher |
| Update | Admin only | Owner only |
| Delete | Admin only | Owner only |
| Link to rubric | Yes | No |
| Share via course | N/A | Yes (with `course_id`) |

## Computed `competency_type` Field

The `competency_type` field in the API response is computed based on:

```python
if competency.is_template:
    competency_type = "central"
elif competency.teacher_id == current_user.id:
    competency_type = "teacher"
else:
    competency_type = "shared"
```

This allows the frontend to display the correct badge without additional logic.
