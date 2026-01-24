# Per-Goal Reflection Implementation

## Summary

Successfully implemented per-learning-goal reflections for the student competency reflection page. Students can now write a separate reflection for each of their learning goals within a competency window, instead of being limited to one reflection for the entire period.

## Changes Made

### Backend Changes

#### 1. Database Migration (`refl_20260107_01_per_goal_reflections.py`)
- **Changed constraint**: Removed `uq_competency_reflection_once` (window_id, user_id)
- **Added constraint**: Created `uq_competency_reflection_per_goal` (window_id, user_id, goal_id)
- **Made goal_id required**: Changed from nullable to NOT NULL
- **Data migration**: Existing reflections with NULL goal_id are automatically assigned to the first goal for that user/window
- **Cleanup**: Reflections without any goals are deleted

#### 2. Database Model (`app/infra/db/models.py`)
- Updated `CompetencyReflection` model:
  - Changed `goal_id` from `Optional[int]` to `int` (required)
  - Updated foreign key to use `ondelete="CASCADE"` instead of `SET NULL`
  - Changed unique constraint name to `uq_competency_reflection_per_goal`

#### 3. API Schemas (`app/api/v1/schemas/competencies.py`)
- Updated `CompetencyReflectionBase`: `goal_id` is now required (int instead of Optional[int])
- Updated `CompetencyReflectionCreate`: Requires goal_id
- Added `CompetencyReflectionBulkCreate`: New schema for bulk submission
  - Contains `window_id` and list of `reflections`
- Added `CompetencyReflectionItemCreate`: Schema for individual reflection in bulk request
  - Requires `goal_id`, `text`, optional `goal_achieved` and `evidence`
- Updated `StudentCompetencyOverview`: Changed `reflection` (singular) to `reflections` (list)
- Updated `TeacherReflectionItem`: Made `goal_id` required

#### 4. API Endpoints (`app/api/v1/routers/competencies.py`)
- **Updated POST `/reflections/`**: Now validates goal ownership and updates per goal
- **Added POST `/reflections/bulk`**: New endpoint for submitting multiple reflections at once
  - Validates all goals belong to the user
  - Upserts each reflection (creates or updates existing)
  - Returns all submitted reflections
- **Updated GET `/windows/{window_id}/overview`**: Returns list of reflections instead of single
- **Updated GET `/windows/{window_id}/student/{user_id}/overview`**: Returns list of reflections

#### 5. Tests (`tests/test_per_goal_reflections.py`)
- Added schema validation tests
- Tests that goal_id is required in all new schemas
- Tests bulk reflection creation

### Frontend Changes

#### 1. DTOs (`frontend/src/dtos/competency.dto.ts`)
- Updated `CompetencyReflection`: Made `goal_id` required (removed optional)
- Updated `CompetencyReflectionCreate`: Made `goal_id` required
- Added `CompetencyReflectionBulkCreate`: Interface for bulk submission
- Added `CompetencyReflectionItemCreate`: Interface for individual reflection item
- Updated `StudentCompetencyOverview`: Changed `reflection?` to `reflections?` (array)

#### 2. Service (`frontend/src/services/competency.service.ts`)
- Added `createReflectionsBulk()`: New method for bulk reflection submission
- Updated imports to include `CompetencyReflectionBulkCreate`

#### 3. Reflection Page (`frontend/src/app/student/competency/reflection/[windowId]/page.tsx`)
Complete rewrite with new features:

**State Management:**
- `GoalReflectionDraft` type: Tracks draft state per goal
  - `goalId`, `text`, `goalAchieved`, `evidence`, `isDirty`
- `drafts`: Dictionary keyed by goal ID containing all draft reflections
- `activeGoalId`: Currently selected goal for editing
- `existingReflections`: Array of submitted reflections from server

**UI Components:**
- **Learning Goals List**: Shows all goals with status badges
  - Click to select a goal for editing
  - Status indicators: "Leeg", "Concept", "Ingediend"
  - Active goal highlighted with border and ring
- **Reflection Form**: Bound to active goal's draft
  - Auto-switches content when selecting different goals
  - Preserves unsaved changes in memory
- **No Goals State**: Friendly message when student has no goals

**Key Functions:**
- `handleGoalSelect()`: Switches active goal
- `updateDraft()`: Updates draft for active goal and marks as dirty
- `getReflectionStatus()`: Determines status badge for each goal
- `handleSubmit()`: Submits all drafted reflections via bulk endpoint

#### 4. Monitor Service (`frontend/src/services/competency-monitor.service.ts`)
- Updated `getStudentDetail()`: Uses `data.reflections` array instead of single `data.reflection`

## UX Flow

1. **Student opens reflection page**: All learning goals are displayed with status badges
2. **First goal auto-selected**: First goal is automatically selected for editing
3. **Goal selection**: Click any goal card to switch to editing that goal
4. **Draft preservation**: Switching between goals preserves unsaved edits in memory
5. **Status tracking**: 
   - "Leeg" = No content yet
   - "Concept" = Has unsaved or saved draft content
   - "Ingediend" = Submitted reflection
6. **Submit all**: One button submits all goals that have content

## Migration Path

### For Existing Data
The migration handles existing single reflections:
1. If a reflection has a goal_id already, it's kept as-is
2. If a reflection has NULL goal_id:
   - Tries to assign it to the first goal for that user/window
   - If no goals exist, deletes the orphaned reflection

### For New Data
All new reflections MUST have a goal_id. The UI enforces this by only allowing reflection creation when goals exist.

## API Usage Examples

### Single Reflection (still supported)
```http
POST /api/v1/competencies/reflections/
Content-Type: application/json

{
  "window_id": 123,
  "goal_id": 456,
  "text": "My reflection text",
  "goal_achieved": true,
  "evidence": "Examples of my work"
}
```

### Bulk Reflections (new)
```http
POST /api/v1/competencies/reflections/bulk
Content-Type: application/json

{
  "window_id": 123,
  "reflections": [
    {
      "goal_id": 456,
      "text": "Reflection for goal 1",
      "goal_achieved": true,
      "evidence": "Evidence 1"
    },
    {
      "goal_id": 457,
      "text": "Reflection for goal 2",
      "goal_achieved": false
    }
  ]
}
```

### Get Reflections
```http
GET /api/v1/competencies/reflections/?window_id=123
```
Returns array of all reflections for the window.

## Testing Checklist

To fully test this implementation, you need a running environment:

### Backend Testing
- [ ] Run `alembic upgrade head` to apply migration
- [ ] Verify existing reflections are migrated correctly
- [ ] Test POST `/reflections/` with goal_id
- [ ] Test POST `/reflections/bulk` with multiple reflections
- [ ] Test GET `/reflections/` returns array
- [ ] Test constraint prevents duplicate (window, user, goal) reflections
- [ ] Run `pytest tests/test_per_goal_reflections.py`

### Frontend Testing
- [ ] Open reflection page with multiple goals
- [ ] Verify first goal is auto-selected
- [ ] Click different goals and verify form content switches
- [ ] Type in one goal, switch to another, switch back - verify text preserved
- [ ] Verify status badges update correctly
- [ ] Submit reflections and verify all are saved
- [ ] Reload page and verify saved reflections load correctly

### Edge Cases
- [ ] No goals exist - shows appropriate message
- [ ] Only one goal - still works correctly
- [ ] Existing single reflection - migrated to first goal
- [ ] Network error during bulk submit - proper error handling

## Files Changed

### Backend (7 files)
1. `backend/migrations/versions/refl_20260107_01_per_goal_reflections.py` (NEW)
2. `backend/app/infra/db/models.py` (MODIFIED)
3. `backend/app/api/v1/schemas/competencies.py` (MODIFIED)
4. `backend/app/api/v1/routers/competencies.py` (MODIFIED)
5. `backend/tests/test_per_goal_reflections.py` (NEW)

### Frontend (4 files)
1. `frontend/src/dtos/competency.dto.ts` (MODIFIED)
2. `frontend/src/services/competency.service.ts` (MODIFIED)
3. `frontend/src/services/competency-monitor.service.ts` (MODIFIED)
4. `frontend/src/app/student/competency/reflection/[windowId]/page.tsx` (REWRITTEN)

## Rollback Plan

If issues are found:
1. Rollback migration: `alembic downgrade -1`
   - Note: This will fail if multiple reflections per user/window exist
   - You'd need to manually consolidate or delete excess reflections first
2. Revert code changes: `git revert <commit-hash>`
3. Redeploy previous version

## Future Enhancements

Possible improvements:
- Auto-save drafts to localStorage or backend
- Show word count per reflection
- Add "Save Draft" button for individual goals
- Teacher view: See all reflections per student per goal
- Export reflections as PDF with goal context
- AI-powered reflection prompts based on goal text
