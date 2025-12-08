# Project Team Rosters - Implementation Guide

## Overview

The Project Team Rosters feature preserves historical team composition for evaluations. When viewing past evaluations, you see exactly which students were in each team at that time, even if team membership has changed since.

## Key Concepts

### Project Teams vs. Groups

- **Groups** (`groups` table): Mutable course-level teams that can change anytime
- **Project Teams** (`project_teams` table): Immutable project-scoped snapshots of team composition

When you create or link a project team, it captures the team membership at that moment. This snapshot is used for all evaluations within that project.

### Team Locking

A project team becomes **locked** (read-only) when:
- Any evaluation links to it
- Any assessment links to it  
- Any note context links to it

Once locked, members cannot be added or removed. This ensures evaluation contexts remain accurate.

### Versioning

If you need to change a team after it's locked:
1. Create a new version of the project team
2. Future evaluations use the new version
3. Past evaluations still reference the old version

## Database Schema

### New Tables

#### `project_teams`
```sql
CREATE TABLE project_teams (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    display_name_at_time VARCHAR(200) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    backfill_source VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

**Fields:**
- `team_id`: Optional link to source group (preserves data if group deleted)
- `display_name_at_time`: Team name frozen at creation
- `version`: Allows multiple snapshots of same team
- `backfill_source`: Marks migrated data (`null`, `'backfill'`, or `'inference'`)

#### `project_team_members`
```sql
CREATE TABLE project_team_members (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL,
    project_team_id INTEGER NOT NULL REFERENCES project_teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE(project_team_id, user_id)
);
```

### Updated Tables

Added to `evaluations`, `project_assessments`, and `project_notes_contexts`:
```sql
ALTER TABLE evaluations 
    ADD COLUMN project_team_id INTEGER REFERENCES project_teams(id) ON DELETE RESTRICT,
    ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'draft',
    ADD COLUMN closed_at TIMESTAMP;

ALTER TABLE project_assessments
    ADD COLUMN project_team_id INTEGER REFERENCES project_teams(id) ON DELETE RESTRICT,
    ADD COLUMN closed_at TIMESTAMP;

ALTER TABLE project_notes_contexts
    ADD COLUMN project_team_id INTEGER REFERENCES project_teams(id) ON DELETE RESTRICT,
    ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'draft',
    ADD COLUMN closed_at TIMESTAMP;
```

## API Endpoints

### Create Project Team
```bash
POST /api/v1/project-teams/projects/{projectId}/teams
Content-Type: application/json

{
  "team_id": 123,           # Optional: link to existing group
  "team_name": "Team Alpha" # Optional: provide name if not linking
}
```

Response:
```json
{
  "id": 456,
  "project_id": 10,
  "team_id": 123,
  "display_name_at_time": "Team Alpha",
  "version": 1,
  "members": [...],
  "member_count": 4,
  "created_at": "2025-12-08T10:30:00Z"
}
```

### Add Members (Bulk)
```bash
POST /api/v1/project-teams/{projectTeamId}/members
Content-Type: application/json

{
  "members": [
    {"user_id": 100, "role": "Leader"},
    {"user_id": 101, "role": "Member"},
    {"user_id": 102, "role": null}
  ]
}
```

Returns `409 Conflict` if team is locked.

### List Project Teams
```bash
GET /api/v1/project-teams/projects/{projectId}/teams
```

Response:
```json
{
  "teams": [...],
  "total": 3
}
```

### Get Team Members
```bash
GET /api/v1/project-teams/{projectTeamId}/members
```

Always read-only. Returns list of members with user details.

### Clone Teams from Another Project
```bash
POST /api/v1/project-teams/projects/{targetProjectId}/teams/clone-from/{sourceProjectId}
```

Response:
```json
{
  "teams_cloned": 3,
  "members_cloned": 12,
  "project_team_ids": [456, 457, 458]
}
```

### Close Evaluation
```bash
POST /api/v1/evaluations/{evaluationId}/close
```

Sets `status = 'closed'` and `closed_at = now()`. Idempotent.

### Close Assessment
```bash
POST /api/v1/project-assessments/{assessmentId}/close
```

Similar to close evaluation.

## Migration & Backfill

### Apply Schema Migration

```bash
cd backend
alembic upgrade head
```

This creates the new tables and adds columns to existing tables.

### Run Backfill Script

```bash
cd backend
python scripts/backfill_project_teams.py
```

The script:
1. Finds all distinct `(project_id, team_id)` combinations from existing evaluations/assessments
2. Creates `project_team` records
3. Populates members from `group_members` or infers from evaluation participants
4. Links evaluations/assessments to their project teams
5. Marks inferred records with `backfill_source='inference'`

**Output:**
```
==============================================================================
BACKFILLING PROJECT TEAMS
==============================================================================
[1/6] Finding distinct project-group combinations from evaluations...
  Found 42 evaluation-group combinations
[2/6] Finding distinct project-group combinations from project assessments...
  Found 18 assessment-group combinations
[3/6] Creating project_team records...
  Found 45 unique project-group combinations
  Created 45 project_team records
  Added 180 team member records
  Used inference for 3 teams (no group_members found)
[4/6] Linking evaluations to project_teams...
  Linked 42 evaluations
[5/6] Linking project_assessments to project_teams...
  Linked 18 project assessments
[6/6] Linking project_notes_contexts to project_teams...
  Linked 5 project notes contexts
==============================================================================
BACKFILL COMPLETE
==============================================================================
```

### Verify Backfill

Check for inferred teams:
```sql
SELECT pt.id, pt.display_name_at_time, COUNT(ptm.id) as member_count
FROM project_teams pt
LEFT JOIN project_team_members ptm ON ptm.project_team_id = pt.id
WHERE pt.backfill_source = 'inference'
GROUP BY pt.id, pt.display_name_at_time;
```

Review these teams and verify member lists are correct.

## Usage Patterns

### Pattern 1: New Project with Existing Teams

```python
# Teacher creates project
project = create_project(title="Q2 Project", course_id=5)

# Link existing teams to project
for group_id in [10, 11, 12]:
    create_project_team(
        project_id=project.id,
        team_id=group_id
    )
    # Members automatically copied from group

# Create evaluation linked to project team
evaluation = create_evaluation(
    project_id=project.id,
    project_team_id=find_project_team(project.id, group_id).id
)
```

### Pattern 2: Clone Teams from Previous Project

```python
# Teacher creates new project
new_project = create_project(title="Q3 Project", course_id=5)

# Clone all teams from previous project
clone_project_teams(
    source_project_id=old_project.id,
    target_project_id=new_project.id
)

# All team structures now available in new project
```

### Pattern 3: Custom Team for One-Off Project

```python
# Create project-specific team not based on course groups
project_team = create_project_team(
    project_id=project.id,
    team_name="Special Research Group"
)

# Manually add members
add_members(
    project_team_id=project_team.id,
    members=[
        {"user_id": 100, "role": "Lead Researcher"},
        {"user_id": 101, "role": "Analyst"},
        {"user_id": 102, "role": "Writer"}
    ]
)
```

### Pattern 4: Handle Team Changes Mid-Project

```python
# Team is locked (has evaluations)
try:
    add_members(project_team_id=123, members=[...])
except HTTPException:  # 409 Conflict
    # Create new version
    new_team = create_project_team(
        project_id=project.id,
        team_id=old_team.team_id
    )
    # Modify members
    add_members(new_team.id, updated_members)
    
    # Future evaluations use new version
    # Old evaluations still reference original
```

## Frontend Integration

### Teacher Class Teams Page

**New UI Elements:**
- Project selector dropdown (shows all projects in course)
- "Clone from Previous Project" button
- Team status indicator (unlocked/locked)
- Member editing disabled for locked teams

**Workflow:**
1. Teacher selects project from dropdown
2. Page shows project teams (not just course groups)
3. Teacher can add/edit teams if no evaluations yet
4. "Clone" button copies structure from another project

### Evaluation Detail Page

**Display:**
- Project team name (frozen snapshot)
- Full member list as it was at evaluation time
- "Closed" badge if evaluation is closed
- "Close and Archive" button (if not closed)

**Close Button:**
- Calls `/evaluations/{id}/close` endpoint
- Sets status to closed
- Shows confirmation: "Evaluation archived. Team roster is now permanently locked."

## Testing

### Unit Tests

```bash
cd backend
pytest tests/test_project_teams.py -v
```

Tests cover:
- Project team creation with/without team_id
- Member addition validation
- Lock checking logic
- Clone operations
- Close endpoint idempotency

### Integration Tests

```bash
pytest tests/ -k "project_team" --integration
```

End-to-end scenarios:
1. Create project team, add members, create evaluation, verify lock
2. Clone teams across projects
3. Close evaluation, verify team becomes read-only

### Manual Testing

1. **Create and Link Teams:**
   - Create project
   - Link existing groups
   - Verify members copied correctly

2. **Test Locking:**
   - Create evaluation with project team
   - Try to add member → should fail with 409
   - Verify error message explains lock

3. **Test Cloning:**
   - Create project with teams
   - Clone to new project
   - Verify all teams and members copied

4. **Test Close:**
   - Open evaluation detail
   - Click "Close and Archive"
   - Verify status changes
   - Call close again → should be idempotent

## Troubleshooting

### Members Not Copied When Linking Team

**Cause:** `team_id` provided but group has no active members

**Solution:** Manually add members via bulk add endpoint

### Cannot Modify Team

**Error:** `409 Conflict - team is locked`

**Cause:** Team has evaluations/assessments

**Solution:** Create new version:
1. Create new project team with version+1
2. Copy members from old version
3. Make modifications
4. Use new version for future evaluations

### Backfill Script Fails

**Error:** Foreign key constraint violations

**Cause:** Referenced users or groups deleted

**Solution:** 
1. Check logs for specific IDs
2. Option A: Restore missing records temporarily
3. Option B: Skip those records (modify script)

### Inferred Teams Have Wrong Members

**Cause:** Backfill used evaluation allocations, not group_members

**Solution:**
1. Query inferred teams: `WHERE backfill_source='inference'`
2. Review member lists
3. Manually correct via SQL or admin UI

## Performance Considerations

### Query Optimization

Always use the provided indices:
- `ix_project_team_project` for listing teams by project
- `ix_project_team_member_composite` for member lookups
- `ix_eval_project_team_status` for evaluation queries with filters

### Bulk Operations

When processing many teams:
```python
# Good: Batch query
project_teams = get_project_teams(project_id)

# Bad: N+1 queries
for team_id in team_ids:
    team = get_project_team(team_id)  # Separate query each time
```

### Caching

Consider caching:
- Project team lists (cache key: `project_teams:{project_id}`)
- Team member lists (cache key: `team_members:{project_team_id}`)
- Lock status (cache key: `team_locked:{project_team_id}`)

Invalidate on:
- New evaluation/assessment created
- Team closed
- Members modified

## Security Considerations

### Access Control

- Only teachers/admins can create/modify project teams
- Students can view teams they're part of (via evaluations)
- Cross-school isolation enforced via `school_id` checks

### Audit Trail

All mutations logged via `audit_log`:
- Project team creation
- Member additions
- Team cloning
- Evaluation closure

Query audit log:
```sql
SELECT * FROM audit_log 
WHERE entity_type IN ('project_team', 'project_team_members')
ORDER BY created_at DESC;
```

## Related Documentation

- [ADR: Project Team Rosters](./PROJECT_TEAM_ROSTERS_ADR.md) - Architecture decision record
- [Architecture Overview](./architecture.md) - System architecture
- [Migration Notes](../MIGRATION_NOTES.md) - General migration guide

## Support

For issues or questions:
1. Check this guide and the ADR
2. Review test cases in `tests/test_project_teams.py`
3. Check database logs for errors
4. Create issue in repository with:
   - Error message
   - Steps to reproduce
   - Expected vs. actual behavior
