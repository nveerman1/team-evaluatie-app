# ADR: Project-Specific Team Rosters

**Status:** Implemented  
**Date:** 2025-12-08  
**Authors:** Development Team  

## Context

The team evaluation application needs to preserve historical team composition for evaluations. When teachers review past evaluations, they need to see exactly which students were in each team at the time the evaluation was conducted, even if team membership has changed since then.

### Problem Statement

Currently, teams are managed through the `groups` and `group_members` tables. These tables are mutable - students can be added, removed, or moved between teams. This creates several issues:

1. **Loss of Historical Context**: When viewing an old evaluation, the current team composition is shown, not the composition at evaluation time
2. **Data Integrity**: If a team is deleted, all related evaluations may lose context
3. **Auditability**: No way to track when team changes occurred relative to evaluations
4. **Compliance**: Educational institutions may require preservation of evaluation contexts for auditing

### Requirements

1. Freeze team composition when evaluations/assessments are created or linked to a project
2. Allow teachers to manage project-specific team rosters
3. Support cloning teams from previous projects
4. Prevent modification of team rosters after evaluations are created (lock mechanism)
5. Backfill historical data to preserve existing evaluation contexts

## Decision

We implement a **project-scoped team roster system** with the following components:

### 1. New Database Tables

#### `project_teams`
Represents a frozen snapshot of a team for a specific project.

- `id`: Primary key
- `school_id`: Multi-tenant isolation
- `project_id`: Links to projects table (CASCADE delete)
- `team_id`: Optional link to source group (SET NULL on delete)
- `display_name_at_time`: Team name frozen at creation time
- `version`: Integer version for handling team changes (default: 1)
- `backfill_source`: Nullable string marking backfilled records
- `created_at`: Timestamp

**Key Design Decisions:**
- `team_id` is nullable and uses SET NULL to preserve historical data even if source team is deleted
- `version` allows creating new snapshots if team composition needs to change mid-project
- `backfill_source` distinguishes manually created vs. migrated data

#### `project_team_members`
Individual members within a project team snapshot.

- `id`: Primary key
- `school_id`: Multi-tenant isolation
- `project_team_id`: Links to project_teams (CASCADE delete)
- `user_id`: Links to users (CASCADE delete - student deletion should cascade)
- `role`: Optional role within the team
- `created_at`: Timestamp
- Unique constraint on `(project_team_id, user_id)`

### 2. Evaluation/Assessment Updates

Add to `evaluations`, `project_assessments`, and `project_notes_contexts`:
- `project_team_id`: Foreign key to project_teams (RESTRICT on delete)
- `status`: Enum field (draft|open|closed) - extended from current status values
- `closed_at`: Timestamp when evaluation was closed

**Key Design Decisions:**
- RESTRICT on delete prevents accidental data loss
- `closed_at` provides audit trail
- Status field standardized across evaluation types

### 3. Business Logic Rules

#### Team Locking
A project team becomes **locked** (read-only) when:
1. Any evaluation links to the project_team_id
2. Any assessment links to the project_team_id
3. Any note context links to the project_team_id

Attempting to add/remove members from a locked team returns HTTP 409 Conflict.

#### Team Versioning
If team composition needs to change after locking:
1. Create a new project_team with `version = current_version + 1`
2. Copy members from previous version
3. Make modifications
4. New evaluations link to the new version

This preserves historical accuracy while allowing flexibility.

#### Closing Evaluations
POST `/evaluations/{id}/close` endpoint:
- Sets `status = 'closed'`
- Sets `closed_at = now()`
- Idempotent (safe to call multiple times)
- Requires teacher/admin role

Similar endpoint for assessments: POST `/project-assessments/{id}/close`

### 4. API Design

#### Creating Project Teams
```
POST /project-teams/projects/{projectId}/teams
{
  "team_id": 123,              // Optional: link to existing group
  "team_name": "Team Alpha"    // Optional: provide name if not linking
}
```

If `team_id` provided, members are automatically copied from the group.

#### Adding Members (Bulk)
```
POST /project-teams/{projectTeamId}/members
{
  "members": [
    {"user_id": 100, "role": "Leader"},
    {"user_id": 101, "role": "Member"}
  ]
}
```

Returns 409 if team is locked.

#### Cloning Teams
```
POST /project-teams/projects/{projectId}/teams/clone-from/{sourceProjectId}
```

Clones all project teams and their members from source to target project.

#### Listing Teams
```
GET /project-teams/projects/{projectId}/teams
```

Returns all project teams for a project with member counts.

#### Getting Members (Read-Only)
```
GET /project-teams/{projectTeamId}/members
```

Returns detailed member list (always read-only via this endpoint).

### 5. Migration Strategy

#### Schema Migration
1. Apply migration `pt_20251208_01_add_project_team_rosters.py`
2. Creates new tables and adds columns to existing tables
3. All new fields are nullable to allow gradual backfill

#### Data Backfill
Script: `scripts/backfill_project_teams.py`

**Process:**
1. Find all distinct `(project_id, group_id)` from evaluations via allocations
2. Find all distinct `(project_id, group_id)` from project_assessments
3. Create `project_team` record for each combination
4. Populate `project_team_members` from `group_members` where available
5. If no `group_members`, infer from evaluation allocations (mark with `backfill_source='inference'`)
6. Link evaluations and assessments to their project_teams
7. Link project_notes_contexts via evaluation relationships

**Backfill Source Values:**
- `null`: Manually created (normal operation)
- `'backfill'`: Backfilled from group_members (high confidence)
- `'inference'`: Inferred from evaluation participants (lower confidence)

This allows administrators to identify and review inferred data.

### 6. Frontend Integration

#### Teacher Class Teams Page
- Add project selector dropdown
- Display project-specific teams (not just course groups)
- "Clone from Previous Project" button
- Team editing only allowed before evaluations created

#### Evaluation Detail Pages
- Display project team name and frozen member list
- Show "Closed" badge if status is closed
- "Close and Archive" button for open evaluations

## Consequences

### Positive

1. **Data Integrity**: Historical evaluation contexts preserved permanently
2. **Auditability**: Clear audit trail of team compositions and changes
3. **Flexibility**: Teachers can manage project-specific teams independently of course groups
4. **Reusability**: Easy cloning of team structures across projects
5. **Safety**: Lock mechanism prevents accidental modifications
6. **Compliance**: Supports educational data retention requirements

### Negative

1. **Complexity**: Additional tables and relationships to manage
2. **Storage**: Some data duplication (team names, member lists)
3. **Migration Risk**: Backfill script must handle edge cases
4. **Learning Curve**: Teachers need to understand project teams vs. groups

### Neutral

1. **Backward Compatibility**: Existing `groups` system unchanged, can coexist
2. **Performance**: Additional joins required for evaluation queries (mitigated by indices)
3. **Flexibility vs. Constraints**: Lock mechanism prevents changes but version system provides escape hatch

## Implementation Notes

### Key Indices
```sql
-- Project teams lookup
CREATE INDEX ix_project_team_project ON project_teams(project_id);
CREATE INDEX ix_project_team_team ON project_teams(team_id);
CREATE INDEX ix_project_team_project_version ON project_teams(project_id, team_id, version);

-- Member lookups
CREATE INDEX ix_project_team_member_project_team ON project_team_members(project_team_id);
CREATE INDEX ix_project_team_member_composite ON project_team_members(project_team_id, user_id);

-- Evaluation lookups with status
CREATE INDEX ix_eval_project_team_status ON evaluations(project_team_id, status);
CREATE INDEX ix_project_assessment_project_team_status ON project_assessments(project_team_id, status);
```

### Service Layer Patterns

The `ProjectTeamService` follows these patterns:
- **Validation First**: Check existence and permissions before mutations
- **Atomic Operations**: All-or-nothing with explicit flush points
- **Lock Checking**: Query for related evaluations/assessments before modifications
- **Idempotency**: Duplicate member additions are silently ignored
- **Error Clarity**: Specific HTTP status codes and messages

### Testing Strategy

1. **Unit Tests**: Service methods and business logic (see `tests/test_project_teams.py`)
2. **Integration Tests**: End-to-end flows with real database
3. **Migration Tests**: Run backfill on snapshot data and verify correctness
4. **Performance Tests**: Query performance with realistic data volumes

## Alternatives Considered

### Alternative 1: Soft Delete Groups
**Approach**: Add `deleted_at` to groups, keep historical records

**Rejected Because:**
- Still allows member modifications before deletion
- Doesn't solve the "team change over time" problem
- Makes group queries more complex (need to filter deleted)

### Alternative 2: Event Sourcing
**Approach**: Store all group membership changes as events, reconstruct state

**Rejected Because:**
- Significant architectural complexity
- Queries become expensive (need to replay events)
- Overhead not justified for this single use case

### Alternative 3: Evaluation-Time Snapshots Only
**Approach**: Store team snapshot directly in evaluation metadata JSON

**Rejected Because:**
- Data duplication per evaluation (storage inefficient)
- No reusability across evaluations
- No central management UI
- Hard to query and report on team structures

## Future Enhancements

### Phase 2 (Potential)
1. **Team Comparison View**: Show differences between team versions
2. **Bulk Operations**: Copy teams across multiple projects at once
3. **Team Templates**: Pre-defined team structures for common scenarios
4. **Automated Version Creation**: Detect group changes and suggest new version
5. **Analytics**: Team composition trends over time

### Phase 3 (Potential)
1. **Team Member History**: Track individual student's team participation across projects
2. **Team Performance Correlation**: Analyze team compositions vs. evaluation outcomes
3. **Recommendation Engine**: Suggest team compositions based on historical data

## References

- Migration: `migrations/versions/pt_20251208_01_add_project_team_rosters.py`
- Service: `app/infra/services/project_team_service.py`
- API Router: `app/api/v1/routers/project_teams.py`
- Schemas: `app/api/v1/schemas/project_teams.py`
- Backfill Script: `scripts/backfill_project_teams.py`
- Tests: `tests/test_project_teams.py`

## Revision History

- 2025-12-08: Initial version implemented
