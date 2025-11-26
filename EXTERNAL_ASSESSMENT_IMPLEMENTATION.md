# External Project Assessment Implementation Guide

This document describes the implementation of external project assessment (opdrachtgever-beoordeling) for the Team Evaluatie App.

## Overview

The implementation supports two scenarios:
1. **Bovenbouw**: Each team has its own external evaluator (opdrachtgever)
2. **Onderbouw**: One external evaluator assesses all teams in a project

External evaluators receive a unique token-based link to access the assessment interface without needing to log in.

## Architecture

### Database Schema

#### ExternalEvaluator
Stores information about external evaluators (opdrachtgevers):
- `id`: Primary key
- `school_id`: Foreign key to schools table
- `name`: Evaluator name
- `email`: Evaluator email
- `organisation`: Optional organization name
- `created_at`, `updated_at`: Timestamps

#### ProjectTeamExternal
Links teams (groups) to external evaluators with invitation tokens:
- `id`: Primary key
- `school_id`: Tenant reference
- `group_id`: Foreign key to groups (teams)
- `external_evaluator_id`: Foreign key to external_evaluators
- `project_id`: Optional foreign key to projects
- `invitation_token`: Unique 128-char token for access
- `token_expires_at`: Optional expiration date
- `status`: NOT_INVITED | INVITED | IN_PROGRESS | SUBMITTED
- `created_at`, `updated_at`, `invited_at`, `submitted_at`: Timestamps

#### ProjectAssessment Extensions
Extended to support external assessments:
- `external_evaluator_id`: Optional FK to external_evaluators
- `role`: TEACHER | EXTERNAL (who created the assessment)
- `is_advisory`: Boolean flag (true for external assessments)
- `teacher_id`: Made nullable to support external assessments

#### RubricCriterion Extension
- `visible_to_external`: Boolean flag to control criterion visibility

## API Endpoints

### Public Endpoints (No Authentication Required)

#### GET /api/v1/external-assessments/{token}
Resolves an invitation token and returns information about teams to assess.

**Response:**
```json
{
  "token": "abc123...",
  "external_evaluator": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "organisation": "Company X"
  },
  "teams": [
    {
      "team_id": 5,
      "team_name": "Team Alpha",
      "project_id": 10,
      "project_title": "Sustainability Project",
      "status": "NOT_STARTED"
    }
  ],
  "project_name": "Sustainability Project",
  "class_name": "4A",
  "single_team": false
}
```

#### GET /api/v1/external-assessments/{token}/teams/{team_id}
Gets the rubric and existing scores for a specific team.

**Response:**
```json
{
  "team_id": 5,
  "team_name": "Team Alpha",
  "rubric": {
    "id": 3,
    "title": "Project Assessment Rubric",
    "scale_min": 1,
    "scale_max": 5,
    "criteria": [
      {
        "id": 10,
        "name": "Problem Analysis",
        "weight": 1.0,
        "descriptors": {
          "1": "Insufficient analysis",
          "5": "Excellent analysis"
        }
      }
    ]
  },
  "existing_scores": [],
  "status": "NOT_STARTED"
}
```

#### POST /api/v1/external-assessments/{token}/teams/{team_id}
Submits or saves assessment scores.

**Request:**
```json
{
  "scores": [
    {
      "criterion_id": 10,
      "score": 4,
      "comment": "Good analysis of the problem"
    }
  ],
  "general_comment": "Overall strong project",
  "submit": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Assessment submitted successfully",
  "status": "SUBMITTED"
}
```

### Teacher/Admin Endpoints (Authentication Required)

#### GET /api/v1/projects/external-management/evaluators
Lists all external evaluators for the school.

#### POST /api/v1/projects/external-management/evaluators
Creates a new external evaluator (or returns existing if email matches).

#### POST /api/v1/projects/external-management/invitations/bulk
Creates invitations in bulk.

**Per-Team Mode Request:**
```json
{
  "mode": "PER_TEAM",
  "per_team_configs": [
    {
      "group_id": 5,
      "evaluator_name": "John Doe",
      "evaluator_email": "john@example.com",
      "evaluator_organisation": "Company X"
    }
  ]
}
```

**All-Teams Mode Request:**
```json
{
  "mode": "ALL_TEAMS",
  "all_teams_config": {
    "evaluator_name": "Jane Smith",
    "evaluator_email": "jane@example.com",
    "group_ids": [5, 6, 7],
    "rubric_id": 3
  }
}
```

#### GET /api/v1/projects/external-management/projects/{project_id}/external-status
Gets external assessment status for all teams in a project.

## Frontend

### External Assessment Pages

#### /external/assessment/[token]
Overview page that lists all teams the external evaluator should assess.
- Shows project and evaluator information
- Lists teams with their status (Not Started, In Progress, Submitted)
- Auto-redirects to team page if only one team
- No authentication required (token-based access)

#### /external/assessment/[token]/team/[teamId]
Detail page for assessing a specific team.
- Displays rubric with score selection (1-5 scale with descriptors)
- Allows adding comments per criterion
- General feedback text area
- Two actions: "Save as draft" (IN_PROGRESS) and "Submit" (SUBMITTED)
- Read-only mode after submission

### Services and DTOs

#### externalAssessmentService
Located in `frontend/src/services/external-assessment.service.ts`
- Public assessment methods (resolveToken, getTeamDetail, submitAssessment)
- Teacher management methods (listEvaluators, createEvaluator, createBulkInvitations, etc.)

#### DTOs
Located in `frontend/src/dtos/external-assessment.dto.ts`
- Complete TypeScript interfaces for all API request/response types
- Includes: ExternalEvaluator, ExternalAssessmentTokenInfo, ExternalAssessmentDetail, etc.

## Migration

The migration file `ext_20251124_01_add_external_assessments.py` includes:
- Creation of `external_evaluators` table
- Creation of `project_team_externals` table
- Extension of `project_assessments` with external fields
- Addition of `visible_to_external` to `rubric_criteria`
- All necessary indexes and foreign keys

To apply:
```bash
cd backend
alembic upgrade head
```

## Usage Flow

### Scenario 1: Per-Team External (Bovenbouw)

1. Teacher creates/selects project with teams
2. Teacher uses bulk invitation API with mode="PER_TEAM":
   - Specifies evaluator details per team
   - Each team gets a unique token
3. System sends invitation emails (not yet implemented)
4. External evaluator clicks link → lands on overview page
5. Evaluator sees their assigned team(s)
6. Evaluator clicks "Assess Team" → goes to detail page
7. Evaluator fills rubric, adds comments
8. Evaluator clicks "Submit" → assessment marked as SUBMITTED
9. Teacher can view external advisory scores (viewing UI not yet implemented)

### Scenario 2: One External for All Teams (Onderbouw)

1. Teacher creates/selects project with multiple teams
2. Teacher uses bulk invitation API with mode="ALL_TEAMS":
   - Specifies one evaluator
   - Specifies all team IDs
   - All teams get the SAME token
3. System sends one invitation email
4. External evaluator clicks link → lands on overview page
5. Evaluator sees all assigned teams
6. Evaluator assesses each team individually
7. System tracks status per team
8. Teacher can see which teams have been assessed

## Security Considerations

### Token Security
- Tokens are 32-byte URL-safe random strings (256 bits of entropy)
- Stored directly in database (not hashed, as they need to be usable)
- Optional expiration dates supported
- Tokens are checked on every request

### Access Control
- Public endpoints require valid token
- Token is validated against database on each request
- Expired tokens are rejected
- Teacher endpoints require authentication and check school_id

### Data Isolation
- All queries filter by school_id (multi-tenant isolation)
- External evaluators can only see teams linked to their token
- Teachers can only manage evaluators within their school

## Testing Recommendations

### Backend Unit Tests
- Test ExternalEvaluator CRUD operations
- Test ProjectTeamExternal creation and token validation
- Test bulk invitation creation (both modes)
- Test external assessment submission
- Test token expiration handling

### Integration Tests
- End-to-end flow: create invitation → resolve token → submit assessment
- Test per-team vs all-teams modes
- Test status transitions (NOT_INVITED → INVITED → IN_PROGRESS → SUBMITTED)
- Test rubric filtering (visible_to_external)

### Frontend Tests
- Component tests for overview and detail pages
- Service method tests with mocked API
- Test draft save vs final submit
- Test read-only mode after submission

## Remaining Work

### Teacher UI Integration (Phase 3)
The teacher-facing UI for configuring external assessments needs to be built:
- Add section to project wizard/settings
- Radio buttons for assessment mode (None / Per Team / All Teams)
- Per-team mode: Add evaluator fields to team table
- All-teams mode: Single form + team selection
- "Send Invitations" button functionality
- Display invitation status per team

### Email Notifications
- Email template for external invitations
- Include assessment link with token
- Reminder emails for pending assessments
- Confirmation email after submission

### Teacher Feedback View (Phase 6)
- Add "External Assessment" column to team overview
- Show external evaluator name and status
- "View External Feedback" button/panel
- Display external scores alongside teacher scores
- Clear visual distinction (advisory vs final)
- Aggregate external scores if multiple externals per team

### Rubric Selection
- Allow teachers to select which rubric externals use
- Support for "external variant" of rubrics
- UI for marking criteria as external-only or internal-only

### Additional Features
- Ability to resend invitations
- Ability to revoke/regenerate tokens
- Export external assessment data
- Analytics on external assessment completion rates

## Notes

- The implementation reuses existing `ProjectAssessment` and `ProjectAssessmentScore` models rather than creating separate external-specific tables
- The `role` field distinguishes teacher vs external assessments
- The `is_advisory` flag marks external assessments as advisory (not final grades)
- Token expiration is optional and stored in `token_expires_at`
- External assessments are always published immediately when submitted (status="published")
- The rubric filtering by `visible_to_external` ensures externals only see relevant criteria
