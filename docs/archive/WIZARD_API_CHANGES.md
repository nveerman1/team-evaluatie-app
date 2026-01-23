# Project Wizard API Changes

## Overview

The project wizard endpoint (`POST /api/v1/projects/wizard-create`) has been enhanced to create the correct entity types per evaluation type, rather than always creating `Evaluation` records.

## Motivation

Previously, the wizard created `Evaluation` records for all evaluation types (peer, project, competency), which didn't align with how the frontend displays data:
- `/teacher/project-assessments` expects `ProjectAssessment` records
- `/teacher/competencies` expects `CompetencyWindow` records
- Peer evaluations continue to use `Evaluation` records

## Changes

### 1. Request Schema

The `EvaluationConfig` schema has been restructured to use nested configuration objects:

**Old Schema:**
```json
{
  "evaluations": {
    "create_peer_tussen": true,
    "create_peer_eind": true,
    "create_project_assessment": true,
    "create_competency_scan": true
  }
}
```

**New Schema:**
```json
{
  "evaluations": {
    "peer_tussen": {
      "enabled": true,
      "deadline": "2025-06-30T23:59:59",
      "rubric_id": 1,
      "title_suffix": "tussentijds"
    },
    "peer_eind": {
      "enabled": true,
      "deadline": "2025-12-31T23:59:59",
      "title_suffix": "eind"
    },
    "project_assessment": {
      "enabled": true,
      "rubric_id": 5,
      "deadline": "2025-06-30T23:59:59",
      "version": "tussentijds"
    },
    "competency_scan": {
      "enabled": true,
      "start_date": "2025-01-01T00:00:00",
      "end_date": "2025-06-30T23:59:59",
      "deadline": "2025-06-30T23:59:59",
      "competency_ids": [1, 2, 3],
      "title": "Q1 Competentiescan"
    }
  }
}
```

### 2. Response Schema

The response now includes mixed entity types with type discriminators:

**Old Response:**
```json
{
  "project": {...},
  "evaluations": [
    {"id": 1, "title": "...", "evaluation_type": "peer"},
    {"id": 2, "title": "...", "evaluation_type": "project"},
    {"id": 3, "title": "...", "evaluation_type": "competency"}
  ]
}
```

**New Response:**
```json
{
  "project": {...},
  "entities": [
    {
      "type": "peer",
      "data": {
        "id": 1,
        "title": "Project – Peerevaluatie (tussentijds)",
        "evaluation_type": "peer",
        "status": "draft",
        "deadline": "2025-06-30T23:59:59"
      }
    },
    {
      "type": "project_assessment",
      "data": {
        "id": 2,
        "title": "Project – Team 1",
        "group_id": 1,
        "group_name": "Team 1",
        "rubric_id": 5,
        "version": "tussentijds",
        "status": "draft",
        "deadline": "2025-06-30T23:59:59"
      }
    },
    {
      "type": "competency_scan",
      "data": {
        "id": 3,
        "title": "Q1 Competentiescan",
        "start_date": "2025-01-01T00:00:00",
        "end_date": "2025-06-30T23:59:59",
        "deadline": "2025-06-30T23:59:59",
        "status": "draft",
        "competency_ids": [1, 2, 3]
      }
    }
  ],
  "warnings": [],
  "note": {...},
  "linked_clients": [...]
}
```

### 3. Entity Types Created

| Evaluation Type | Database Model | Records Created | Notes |
|----------------|---------------|----------------|-------|
| Peer Evaluations | `Evaluation` | 1 per config (peer_tussen, peer_eind) | Same as before, now with deadline support |
| Project Assessments | `ProjectAssessment` | 1 per group in course | **NEW**: Creates proper ProjectAssessment records |
| Competency Scans | `CompetencyWindow` | 1 per config | **NEW**: Creates CompetencyWindow with linked competencies |

## Edge Cases

### 1. Course Without Groups

When creating project assessments for a course without groups:

**Behavior:**
- No `ProjectAssessment` records are created
- A warning is added to the response
- The wizard completes successfully

**Warning Message:**
```
"Course {course_id} has no groups. Please create groups before creating project assessments, or create them manually after wizard completion."
```

**Frontend Action:**
Display the warning to the user and suggest creating groups first.

### 2. Invalid Competency IDs

When invalid competency IDs are provided:

**Behavior:**
- Only valid competencies are linked
- A warning is added to the response
- The wizard completes successfully

**Warning Message:**
```
"Some competency IDs were invalid and were skipped"
```

### 3. Missing Competency IDs

When no competency IDs are provided for a competency scan:

**Behavior:**
- CompetencyWindow is created without linked competencies
- A warning is added to the response

**Warning Message:**
```
"No competencies selected for competency scan"
```

## Migration Guide for Frontend

### 1. Update Request Structure

Replace boolean flags with configuration objects:

```typescript
// Old
const payload = {
  evaluations: {
    create_peer_tussen: true,
    create_project_assessment: true,
  }
};

// New
const payload = {
  evaluations: {
    peer_tussen: {
      enabled: true,
      deadline: new Date('2025-06-30'),
      title_suffix: 'tussentijds'
    },
    project_assessment: {
      enabled: true,
      rubric_id: selectedRubricId,
      deadline: new Date('2025-06-30'),
      version: 'tussentijds'
    }
  }
};
```

### 2. Handle Mixed Entity Response

Process entities based on their type:

```typescript
response.entities.forEach(entity => {
  switch (entity.type) {
    case 'peer':
      // Route to /teacher/evaluations/{entity.data.id}
      break;
    case 'project_assessment':
      // Route to /teacher/project-assessments/{entity.data.id}
      break;
    case 'competency_scan':
      // Route to /teacher/competencies/{entity.data.id}
      break;
  }
});
```

### 3. Display Warnings

Show warnings to the user:

```typescript
if (response.warnings.length > 0) {
  response.warnings.forEach(warning => {
    toast.warning(warning);
  });
}
```

### 4. Update Wizard Form

Add new input fields:
- Deadline picker for each evaluation type
- Rubric selector for peer evaluations and project assessments
- Competency framework/competency selector for competency scans
- Date range picker for competency scans

## Backward Compatibility

⚠️ **Breaking Change**: The response structure has changed from `evaluations: []` to `entities: []`.

If you need to maintain backward compatibility, you can map the old structure:

```typescript
// Map new response to old structure
const evaluations = response.entities
  .filter(e => e.type === 'peer')
  .map(e => ({
    id: e.data.id,
    title: e.data.title,
    evaluation_type: e.data.evaluation_type,
    status: e.data.status
  }));
```

However, this loses the benefit of the new structure. It's recommended to update the frontend to use the new structure.

## Testing

New test suite available in `backend/tests/test_wizard_new_entities.py` covering:
- Peer evaluations with deadlines
- Project assessment creation per group
- Competency window creation
- Edge cases (no groups, invalid competency IDs)
- Mixed entity creation

Run tests:
```bash
cd backend
pytest tests/test_wizard_new_entities.py -v
```

## API Documentation

Updated OpenAPI/Swagger documentation available at:
- Development: `http://localhost:8000/docs`
- Production: `{API_BASE_URL}/docs`

Look for the `POST /api/v1/projects/wizard-create` endpoint for interactive testing.
