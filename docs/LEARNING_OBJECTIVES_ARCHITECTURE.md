# Learning Objectives Two-Tier Architecture

This document describes the two-tier architecture for Learning Objectives (Leerdoelen/Eindtermen) in the Team Evaluatie App.

## Overview

Learning objectives are organized in a two-tier system:

1. **Central Objectives** (`is_template=True`) - Managed by admins, linked to subjects/sections
2. **Teacher-Specific Objectives** (`is_template=False`) - Owned by individual teachers

## Data Model

### LearningObjective Table

```
┌─────────────────────────────┐
│     LearningObjective       │
│─────────────────────────────│
│ id: int (PK)                │
│ school_id: int (FK)         │  Multi-tenant scope
│ subject_id: int (FK, null)  │  For central objectives
│ teacher_id: int (FK, null)  │  For teacher-specific objectives
│ course_id: int (FK, null)   │  Optional course scope for teacher objectives
│ is_template: bool           │  True = central, False = teacher-specific
│ domain: str                 │  Domain code (A, B, C, D, E)
│ title: str                  │  Learning objective title
│ description: str            │  Detailed description
│ order: int                  │  Display order within domain
│ phase: str                  │  "onderbouw" or "bovenbouw"
│ metadata_json: dict         │  Additional metadata
└─────────────────────────────┘
```

### Objective Types

| Type | `is_template` | `subject_id` | `teacher_id` | Managed By | Visible To |
|------|---------------|--------------|--------------|------------|------------|
| Central | `True` | Required | NULL | Admins only | All teachers (read-only) |
| Teacher | `False` | NULL | Required | Owner teacher | Owner only |

## API Endpoints

### List Learning Objectives

```http
GET /api/v1/learning-objectives
```

Query Parameters:
- `objective_type`: Filter by type (`template`, `teacher`, `all`)
- `include_teacher_objectives`: Include current user's teacher objectives (boolean)
- `subject_id`: Filter by subject (for central objectives)
- `phase`: Filter by phase (`onderbouw`, `bovenbouw`)
- `domain`: Filter by domain code
- `search`: Search in title/description

Default behavior: Returns only central (`template`) objectives for backward compatibility.

### Create Learning Objective

```http
POST /api/v1/learning-objectives
```

**For Central Objectives (Admin only):**
```json
{
  "is_template": true,
  "subject_id": 1,
  "domain": "D",
  "title": "Conceptontwikkeling",
  "description": "...",
  "phase": "onderbouw",
  "order": 9
}
```

**For Teacher-Specific Objectives:**
```json
{
  "is_template": false,
  "course_id": 2,  // optional
  "domain": "D",
  "title": "Mijn eigen leerdoel",
  "description": "...",
  "phase": "onderbouw"
}
```

Note: `teacher_id` is automatically set to the current user for teacher objectives.

### Update/Delete Learning Objective

- **Central objectives**: Only admins can update/delete
- **Teacher objectives**: Only the owning teacher can update/delete

## Frontend Pages

### 1. Teacher Learning Objectives Page (`/teacher/learning-objectives`)

**Purpose**: View central objectives and manage own objectives

**Features:**
- Filter pills: "Alle" / "Centrale doelen" / "Mijn eigen doelen"
- Visual badges:
  - 🏛️ Centraal (amber) - Read-only for teachers
  - 👤 Eigen doel (emerald) - Editable by owner
- Teachers can create/edit/delete their own objectives
- Import creates teacher-specific objectives
- Info banner explaining the two types

### 2. Admin Templates Page (`/teacher/admin/templates?tab=objectives`)

**Purpose**: Manage central learning objectives for a subject

**Features:**
- Only shows central objectives (`objective_type=template`)
- New objectives created with `is_template=true`
- Import creates central objectives
- Type column with "🏛️ Centraal" badge
- Info banner explaining admin management

### 3. Overview Page (`/teacher/overview?tab=leerdoelen`)

**Purpose**: View student progress on learning objectives

**Features:**
- Includes both central and teacher objectives
- Visual distinction in table headers (emoji + colored background)
- Legend explaining objective types

## Rubric Criterion Linkage

Central objectives can be linked to rubric criteria via the `RubricCriterionLearningObjective` junction table:

```
┌─────────────────────────────────────┐
│ RubricCriterionLearningObjective    │
│─────────────────────────────────────│
│ id: int (PK)                        │
│ school_id: int (FK)                 │
│ criterion_id: int (FK)              │
│ learning_objective_id: int (FK)     │
└─────────────────────────────────────┘
```

**Important**: Only central objectives (`is_template=True`) should be linked to rubric criteria. This is enforced at the application level when creating criterion linkages. Teacher-specific objectives are for personal tracking only and cannot be linked to rubric templates.

## Migration

The Alembic migration (`lo_20251130_01`) adds:

1. `teacher_id` column (FK to users)
2. `course_id` column (FK to courses)
3. `is_template` column (boolean, NOT NULL)
4. Indexes on new columns
5. Sets `is_template=True` for all existing records (backward compatible)

## Access Control Summary

| Action | Central Objectives | Teacher Objectives |
|--------|-------------------|-------------------|
| View | All users | Owner only |
| Create | Admin only | Any teacher |
| Update | Admin only | Owner only |
| Delete | Admin only | Owner only |
| Link to rubric | Yes | No |
| Show in overview | Yes | Yes (for owner) |
