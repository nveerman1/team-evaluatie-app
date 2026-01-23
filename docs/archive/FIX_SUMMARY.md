# Fix Summary: Project Teams for Wizard-Created Project Assessments

## Problem Statement (Dutch)
"Ik heb via de wizzard een nieuw project aangemaakt met een project beoordeling. Bij het aanmaken zijn er natuurlijk nog geen projectteams ingesteld. De project-assessment heeft de legacy teams, niet de project_teams met project_teams.team_number"

## Translation
"I created a new project via the wizard with a project assessment. When creating it, there are naturally no project teams set up yet. The project assessment has the legacy teams, not the project_teams with project_teams.team_number"

## Root Cause
When creating a project via the wizard with project assessments enabled, the system was:
1. Creating `ProjectAssessment` records
2. NOT creating `ProjectTeam` records for the groups
3. NOT linking assessments to projects or project teams
4. Storing project_id only in metadata_json instead of the project_id field
5. Falling back to legacy `user.team_number` instead of `project_teams.team_number`

## Solution Implemented

### Code Changes
File: `backend/app/api/v1/routers/projects.py`

1. **Added Import**
   - Imported `ProjectTeamService` to handle project team creation

2. **Modified Wizard Project Assessment Creation** (lines 933-995)
   - For each group in the course:
     a. Create a `ProjectTeam` using `ProjectTeamService.create_project_team()`
     b. Copy `team_number` from group to project_team
     c. Copy members from group to project_team using `copy_members_from_group()`
     d. Create `ProjectAssessment` with:
        - `project_id` set on the model (not just metadata)
        - `project_team_id` linking to the created project team
        - `metadata_json` containing only deadline (not project_id)

3. **Fixed Project Detail Query** (line 545-554)
   - Changed from: `cast(ProjectAssessment.metadata_json.op('->>') ('project_id'), Integer) == project_id`
   - Changed to: `ProjectAssessment.project_id == project_id`
   - Benefits: More efficient (uses index), more reliable (uses FK)

### Flow Diagram
```
Wizard Create Project with Project Assessment
    ↓
For each group in course:
    ↓
    Create ProjectTeam
        - Link to project (project_id)
        - Link to group (team_id)
        - Snapshot group name (display_name_at_time)
    ↓
    Set team_number
        - Copy from group.team_number to project_team.team_number
    ↓
    Copy members
        - Query active GroupMembers
        - Create ProjectTeamMembers with same user_id and role
    ↓
    db.flush() — Generate IDs for linking
    ↓
    Create ProjectAssessment
        - project_id: link to project
        - group_id: link to group
        - project_team_id: link to frozen team roster
        - metadata_json: {deadline: ...}
    ↓
    db.flush() — Generate assessment ID
```

## Testing Checklist

### Manual Testing
1. **Create a new project via wizard with project assessment:**
   - Ensure course has groups with team_number set
   - Ensure groups have active members
   - Enable project assessment in wizard
   - Submit wizard

2. **Verify project teams were created:**
   ```sql
   SELECT pt.id, pt.project_id, pt.team_number, pt.display_name_at_time,
          COUNT(ptm.id) as member_count
   FROM project_teams pt
   LEFT JOIN project_team_members ptm ON pt.id = ptm.project_team_id
   WHERE pt.project_id = [YOUR_PROJECT_ID]
   GROUP BY pt.id, pt.project_id, pt.team_number, pt.display_name_at_time;
   ```

3. **Verify project assessments were linked:**
   ```sql
   SELECT pa.id, pa.title, pa.project_id, pa.group_id, pa.project_team_id,
          pt.team_number, pt.display_name_at_time
   FROM project_assessments pa
   LEFT JOIN project_teams pt ON pa.project_team_id = pt.id
   WHERE pa.project_id = [YOUR_PROJECT_ID];
   ```

4. **Verify team members were copied:**
   ```sql
   SELECT pt.id as team_id, pt.display_name_at_time,
          u.id as user_id, u.name, ptm.role
   FROM project_teams pt
   JOIN project_team_members ptm ON pt.id = ptm.project_team_id
   JOIN users u ON ptm.user_id = u.id
   WHERE pt.project_id = [YOUR_PROJECT_ID]
   ORDER BY pt.id, u.name;
   ```

### Expected Results
- ✅ One ProjectTeam per group in the course
- ✅ Each ProjectTeam has team_number from the group
- ✅ Each ProjectTeam has all active members from the group
- ✅ Each ProjectAssessment has project_id set
- ✅ Each ProjectAssessment has project_team_id set
- ✅ Project detail page shows correct assessment count

### Edge Cases Handled
1. **Course with no groups**: Warning message added to wizard response
2. **Group with no team_number**: project_team.team_number is NULL (acceptable)
3. **Group with no members**: project_team created but has 0 members
4. **Project without course_id**: Warning message, no assessments created

## Impact Assessment

### Before Fix
- ❌ Project assessments not linked to project_id
- ❌ Project assessments not linked to project_team_id
- ❌ No project teams created → no team roster preservation
- ❌ System falls back to legacy user.team_number
- ❌ Team composition not frozen at project creation time
- ❌ Inefficient JSON parsing for project queries

### After Fix
- ✅ Project assessments properly linked to project_id
- ✅ Project assessments properly linked to project_team_id
- ✅ Project teams created automatically by wizard
- ✅ Team roster frozen at project creation time
- ✅ System uses project_teams.team_number
- ✅ Historical accuracy maintained
- ✅ Efficient indexed queries

## Migration Notes

### Existing Data
This fix only affects **new** projects created via the wizard after this change is deployed. 

**Existing project assessments** created before this fix:
- Will continue to work as before
- Will have `project_id = NULL` or stored in metadata_json
- Will have `project_team_id = NULL`
- May need backfill if historical accuracy is required

### Backfill Script (if needed)
If you need to backfill existing assessments:
```python
# This is a conceptual script - test thoroughly before running
from app.infra.db.models import ProjectAssessment, ProjectTeam, Group
from app.infra.services.project_team_service import ProjectTeamService

# For each assessment without project_team_id
assessments = db.query(ProjectAssessment).filter(
    ProjectAssessment.project_team_id.is_(None),
    ProjectAssessment.project_id.isnot(None)
).all()

for assessment in assessments:
    # Create project team from group
    project_team = ProjectTeamService.create_project_team(
        db=db,
        project_id=assessment.project_id,
        school_id=assessment.school_id,
        team_id=assessment.group_id,
    )
    
    # Set team_number if available
    group = db.query(Group).get(assessment.group_id)
    if group and group.team_number:
        project_team.team_number = group.team_number
    
    # Copy members
    ProjectTeamService.copy_members_from_group(
        db=db,
        project_team_id=project_team.id,
        group_id=assessment.group_id,
        school_id=assessment.school_id,
    )
    
    # Link assessment to project team
    assessment.project_team_id = project_team.id
    
    db.flush()

db.commit()
```

## Security Review
✅ **No security vulnerabilities found** (CodeQL scan passed)

## Files Changed
1. `backend/app/api/v1/routers/projects.py` - Main implementation
2. `backend/tests/test_wizard_project_teams_fix.py` - Test documentation

## Related Documentation
- `/docs/PROJECT_TEAM_ROSTERS_IMPLEMENTATION.md` - Project team architecture
- `/docs/MIGRATION-project-team-rosters.md` - Migration guide
- `/docs/ADR-project-team-rosters.md` - Architecture decision record
