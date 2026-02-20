# ADR: Project-Specific Team Rosters

## Status
Accepted - Implementation In Progress

## Context
The current system uses `student.team_number` to track which team a student belongs to. This approach has several limitations:

1. **No Historical Context**: When team compositions change, there's no way to know which students were in a team during a specific evaluation or project.
2. **Cross-Project Issues**: Students may be in different teams for different projects, but the single `team_number` field can't represent this.
3. **No Roster Locking**: When evaluations are created, team memberships can still be modified, potentially breaking the integrity of peer evaluations.
4. **Limited Versioning**: There's no way to track changes in team composition over time.

## Decision
We will implement project-specific team rosters using two new tables:

### Data Model

#### project_teams
Represents a frozen snapshot of a team at a specific point in time, tied to a project.

```sql
CREATE TABLE project_teams (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    display_name_at_time VARCHAR(200) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    backfill_source VARCHAR(50),  -- 'inference' for migrated data
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

#### project_team_members
Stores the individual members of a project team at that point in time.

```sql
CREATE TABLE project_team_members (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL,
    project_team_id INTEGER NOT NULL REFERENCES project_teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_project_team_member_once UNIQUE (project_team_id, user_id)
);
```

### Key Features

1. **Roster Freezing**: Once an evaluation, assessment, or notes context is created for a project team, that team's roster becomes read-only.

2. **Versioning**: If team composition needs to change after an evaluation, a new project_team record is created with `version + 1`.

3. **Backfill Support**: Existing data is migrated with `backfill_source = 'inference'` to distinguish it from manually created teams.

4. **Status Tracking**: Evaluations, assessments, and notes contexts gain `status` and `closed_at` fields to track lifecycle.

## Integration Points

### Affected Tables
- **evaluations**: Add `project_team_id` (FK), `closed_at`
- **project_assessments**: Add `project_team_id` (FK), `closed_at`
- **project_notes_contexts**: Add `project_team_id` (FK), `status`, `closed_at`

### API Endpoints
New and enhanced endpoints:
- `POST /projects/{projectId}/teams` - Create or link project team
- `POST /project-teams/{projectTeamId}/members` - Bulk add/remove members (409 if locked)
- `GET /projects/{projectId}/teams` - List project teams with member info
- `GET /project-teams/{projectTeamId}/members` - List members
- `POST /projects/{projectId}/teams/clone-from/{sourceProjectId}` - Clone teams
- `POST /evaluations/{id}/close` - Close evaluation and lock roster
- `POST /project-assessments/{id}/close` - Close assessment and lock roster
- `POST /project-notes/contexts/{id}/close` - Close notes context and lock roster

## Migration Strategy

### Phase 1: Schema Creation
Create new tables and add foreign keys to existing tables. All changes are non-breaking as columns are nullable.

### Phase 2: Backfill
Infer project teams from existing data:
1. From `evaluations` with `project_id`
2. From `project_assessments` with `project_id` and `group_id`
3. Populate `project_team_members` from `group_members` where `team_id` exists

All backfilled records are marked with `backfill_source = 'inference'`.

### Phase 3: UI Updates
Frontend will transition to use project teams:
1. Show project team selection in evaluation/assessment creation
2. Display frozen rosters for closed evaluations
3. Allow team management only for open projects
4. Deprecate `team_number` editing in UI

### Phase 4: Deprecation of team_number
`student.team_number` will remain in the database for backwards compatibility but will:
- Be set to NULL during migration where replaced
- Not be editable in the UI
- Eventually be removed in a future release after a grace period

## Consequences

### Positive
- **Data Integrity**: Historical team compositions are preserved
- **Audit Trail**: Clear record of team changes over time
- **Flexibility**: Students can be in different teams per project
- **Safety**: Locked rosters prevent accidental data corruption
- **Scalability**: Versioning supports complex team evolution

### Negative
- **Migration Complexity**: Backfilling requires inference which may not be 100% accurate
- **Database Size**: More tables and rows increase storage requirements
- **Query Complexity**: Some queries become more complex with additional joins
- **Transition Period**: Both old and new systems coexist temporarily

### Neutral
- **API Changes**: New required field `project_team_id` for evaluation creation
- **UI Changes**: Users must adapt to project-team-based workflow

## Rollback Plan
Migrations include full downgrade paths:
1. Remove all `project_team_id` foreign key constraints
2. Delete `project_team_members` table
3. Delete `project_teams` table
4. Remove `closed_at` and `status` columns from affected tables

SQL fallback scripts are provided for manual migration if Alembic is unavailable.

## Implementation Notes

### Locking Mechanism
A project team is considered "locked" if any of the following exist referencing it:
- An evaluation with `status != 'draft'`
- A project assessment with `status != 'draft'`
- A project notes context with `status != 'draft'`

When locked, attempts to modify members return `HTTP 409 Conflict`.

### Backfill Accuracy
The backfill migration makes best-effort inferences:
- Links evaluations to project teams via `project_id`
- Links assessments to project teams via `project_id` + `group_id`
- Copies members from `group_members` when `team_id` is available
- Marks all inferred data with `backfill_source = 'inference'`

Manual correction may be needed for edge cases.

## References
- Database models: `backend/app/infra/db/models.py`
- Migrations: `backend/migrations/versions/pt_20251208_*`
- Service layer: `backend/app/infra/services/project_team_service.py`
- API endpoints: `backend/app/api/v1/routers/project_teams.py`

## Decision Date
2025-12-08

## Stakeholders
- Development Team
- Teachers (primary users)
- Students (indirect impact)
- School Administrators
