# TeamFilter Duplicate Key Error Fix

## Problem Description

The `/teacher/evaluations/[id]/dashboard` page was generating a React console error:

```
Encountered two children with the same key, `null`. Keys should be unique so that 
components maintain their identity across updates. Non-unique keys may cause children 
to be duplicated and/or omitted — the behavior is unsupported and could change in a 
future version.
```

Error occurred in:
- `TeamFilter` component at line 37
- `EvaluationDashboardPage` at line 323

## Root Cause

The `ProjectTeam` database model has a `team_number` field defined as `Optional[int]`, meaning it can be `null`:

```python
team_number: Mapped[Optional[int]] = mapped_column(
    Integer, nullable=True, index=True
)
```

When multiple teams have `null` as their `team_number`, React's reconciliation algorithm encounters duplicate keys (`null`), causing the error.

## Solution

Changed the React key from `team.teamNumber` (which can be `null`) to `team.teamId` (which is always unique and non-null).

### Changes Made

#### 1. `frontend/src/components/TeamFilter.tsx`

**Before:**
```typescript
interface TeamInfo {
  teamNumber: number;
  displayName: string;
  memberCount: number;
}

// ...
{teams.map((team) => (
  <option key={team.teamNumber} value={team.teamNumber}>
    Team {team.teamNumber} · {team.memberCount} leden
  </option>
))}
```

**After:**
```typescript
interface TeamInfo {
  teamId: number;           // Added: unique, non-null identifier
  teamNumber: number | null; // Changed: now nullable
  displayName: string;
  memberCount: number;
}

// ...
{teams.map((team) => (
  <option key={team.teamId} value={team.teamNumber ?? ""}>
    Team {team.teamNumber ?? "?"} · {team.memberCount} leden
  </option>
))}
```

#### 2. `frontend/src/app/(teacher)/teacher/evaluations/[evalId]/dashboard/page.tsx`

**Before:**
```typescript
<TeamFilter
  teams={teamContext.teams.map(t => ({
    teamNumber: t.team_number,
    displayName: t.display_name,
    memberCount: t.member_count,
  }))}
  selectedTeam={selectedTeamFilter}
  onTeamChange={setSelectedTeamFilter}
/>
```

**After:**
```typescript
<TeamFilter
  teams={teamContext.teams.map(t => ({
    teamId: t.team_id,        // Added: pass the unique team_id
    teamNumber: t.team_number,
    displayName: t.display_name,
    memberCount: t.member_count,
  }))}
  selectedTeam={selectedTeamFilter}
  onTeamChange={setSelectedTeamFilter}
/>
```

## Impact

- **Fixes:** React console error about duplicate keys
- **Maintains:** All existing functionality - filtering still works on `teamNumber`
- **Improves:** Null-safe display - shows "Team ?" for teams without a number
- **No breaking changes:** The `value` and filtering logic remains unchanged

## Data Flow

1. Backend returns `team_id` (always unique, non-null) and `team_number` (can be null)
2. Frontend maps to `teamId` and `teamNumber` respectively
3. React uses `teamId` for unique keys (no duplicates possible)
4. Display and filtering still use `teamNumber` (user-facing team identifier)

## Testing

- TypeScript compilation passes without errors
- Changes are minimal and surgical
- No new dependencies required
- Compatible with existing data structures

## Related Issues

Similar potential issues exist in other files using `team_number` as keys:
- `src/app/(teacher)/teacher/projects/page.tsx:311`
- `src/app/(teacher)/teacher/project-assessments/[assessmentId]/scores/_inner.tsx`
- Other project assessment pages

These should be reviewed if similar errors occur, though they may use different data sources (legacy `User.team_number` vs `ProjectTeam.team_number`).
