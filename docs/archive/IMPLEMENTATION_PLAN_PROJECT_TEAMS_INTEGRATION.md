# Implementation Plan: Project Teams Integration in Evaluations & Project Notes

**Status**: 📋 Planning Phase  
**Created**: 2025-12-10  
**Target**: Phase 4 - Full Project Teams Integration

---

## Executive Summary

This document outlines the implementation plan for fully integrating project teams into evaluations and project notes. The goal is to automatically link project teams to evaluations, display team information throughout all evaluation and project note pages, and ensure consistent team-based workflows.

### Current State
- ✅ Project teams (`project_teams` table) implemented with team_number per project
- ✅ Evaluations can be created with `project_id` (automatic allocation)
- ✅ Class-teams page uses project-specific team management
- ✅ `FrozenRoster` component exists for displaying team rosters
- ⚠️ Evaluations display allocated students but not their team assignments
- ⚠️ Project notes exist but don't show team context

### Target State
- ✅ All evaluation pages show student team assignments from project teams
- ✅ Project notes display and filter by teams
- ✅ Teacher can view/filter students by team in evaluation dashboards
- ✅ Student evaluation views show their team members
- ✅ Team-based analytics and reporting

---

## Phase 1: Backend Schema & API Updates

### 1.1 Database Schema Review
**Status**: ✅ Already Complete

Current schema:
```sql
-- Evaluations already have project_id
evaluations (
  id, school_id, course_id, project_id, rubric_id, 
  title, evaluation_type, status, closed_at, settings
)

-- ProjectTeam with team numbers
project_teams (
  id, school_id, project_id, team_id, 
  display_name_at_time, team_number, version, 
  is_locked, created_at
)

-- ProjectTeamMember links students to teams
project_team_members (
  id, school_id, project_team_id, user_id, 
  role, created_at
)

-- Allocations link students to evaluations
allocations (
  id, evaluation_id, evaluator_id, evaluatee_id,
  evaluation_type, ...
)
```

**Action Items**:
- [ ] ✅ No schema changes needed - existing structure supports team integration

### 1.2 New API Endpoints

#### Evaluation Team Context
**Endpoint**: `GET /evaluations/{evaluation_id}/teams`
**Purpose**: Get all teams and their members for an evaluation's project
**Response**:
```json
{
  "project_id": 5,
  "project_name": "Duurzaam Schoolgebouw",
  "teams": [
    {
      "team_id": 12,
      "team_number": 1,
      "display_name": "Team 1",
      "member_count": 4,
      "members": [
        {
          "user_id": 101,
          "name": "Jan Janssen",
          "email": "jan@example.com",
          "role": "leader",
          "is_allocated": true
        }
      ]
    }
  ]
}
```

**Implementation**:
```python
# backend/app/api/v1/routers/evaluations.py

@router.get("/{evaluation_id}/teams")
def get_evaluation_teams(
    evaluation_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get all teams for an evaluation's project."""
    evaluation = db.query(Evaluation).filter_by(id=evaluation_id).first()
    if not evaluation:
        raise HTTPException(404, "Evaluation not found")
    
    require_evaluation_access(db, user, evaluation_id)
    
    if not evaluation.project_id:
        return {"project_id": None, "teams": []}
    
    # Get all teams for the project
    teams = (
        db.query(ProjectTeam)
        .filter_by(project_id=evaluation.project_id)
        .order_by(ProjectTeam.team_number)
        .all()
    )
    
    result = []
    for team in teams:
        members = (
            db.query(ProjectTeamMember, User)
            .join(User, ProjectTeamMember.user_id == User.id)
            .filter(ProjectTeamMember.project_team_id == team.id)
            .all()
        )
        
        # Check which members are allocated to this evaluation
        allocated_user_ids = {
            a.evaluatee_id
            for a in db.query(Allocation.evaluatee_id)
            .filter_by(evaluation_id=evaluation_id)
            .distinct()
        }
        
        result.append({
            "team_id": team.id,
            "team_number": team.team_number,
            "display_name": team.display_name_at_time,
            "member_count": len(members),
            "members": [
                {
                    "user_id": user.id,
                    "name": user.name,
                    "email": user.email,
                    "role": member.role,
                    "is_allocated": user.id in allocated_user_ids,
                }
                for member, user in members
            ],
        })
    
    return {
        "project_id": evaluation.project_id,
        "project_name": evaluation.project.name if evaluation.project else None,
        "teams": result,
    }
```

#### Allocation with Team Info
**Endpoint**: `GET /evaluations/{evaluation_id}/allocations-with-teams`
**Purpose**: Get allocations enriched with team information
**Response**:
```json
{
  "allocations": [
    {
      "id": 1,
      "evaluator_id": 101,
      "evaluator_name": "Jan Janssen",
      "evaluator_team": 1,
      "evaluatee_id": 102,
      "evaluatee_name": "Piet Pietersen",
      "evaluatee_team": 1,
      "status": "completed"
    }
  ]
}
```

#### Project Notes with Teams
**Endpoint**: `GET /project-notes/{context_id}/notes`
**Query Params**: `?team_number=1` (optional filter)
**Purpose**: Get project notes filtered by team

**Endpoint**: `POST /project-notes/{context_id}/notes`
**Body**: 
```json
{
  "content": "Team 1 is making great progress",
  "note_type": "observation",
  "team_number": 1,
  "student_id": null
}
```

---

## Phase 2: Frontend DTO & Service Updates

### 2.1 Update DTOs

**File**: `frontend/src/dtos/evaluation.dto.ts`

```typescript
// Add team context to evaluation DTO
export interface EvaluationTeamContext {
  projectId: number | null;
  projectName: string | null;
  teams: EvaluationTeam[];
}

export interface EvaluationTeam {
  teamId: number;
  teamNumber: number;
  displayName: string;
  memberCount: number;
  members: EvaluationTeamMember[];
}

export interface EvaluationTeamMember {
  userId: number;
  name: string;
  email: string;
  role: string | null;
  isAllocated: boolean;
}

// Extend existing allocation DTO
export interface AllocationWithTeam extends Allocation {
  evaluatorTeam: number | null;
  evaluateeTeam: number | null;
}
```

**File**: `frontend/src/dtos/project-notes.dto.ts` (create if doesn't exist)

```typescript
export interface ProjectNoteContext {
  id: number;
  schoolId: number;
  title: string;
  description: string | null;
  courseId: number | null;
  className: string | null;
  evaluationId: number | null;
  projectId: number | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectNote {
  id: number;
  contextId: number;
  content: string;
  noteType: 'observation' | 'feedback' | 'milestone' | 'general';
  teamNumber: number | null;
  studentId: number | null;
  authorId: number;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}
```

### 2.2 Update Services

**File**: `frontend/src/services/evaluation.service.ts`

```typescript
export const evaluationService = {
  // ... existing methods ...
  
  async getEvaluationTeams(
    evaluationId: number,
    signal?: AbortSignal
  ): Promise<EvaluationTeamContext> {
    const response = await apiClient.get(
      `/evaluations/${evaluationId}/teams`,
      { signal }
    );
    return camelcaseKeys(response.data, { deep: true });
  },
  
  async getAllocationsWithTeams(
    evaluationId: number,
    signal?: AbortSignal
  ): Promise<AllocationWithTeam[]> {
    const response = await apiClient.get(
      `/evaluations/${evaluationId}/allocations-with-teams`,
      { signal }
    );
    return camelcaseKeys(response.data.allocations, { deep: true });
  },
};
```

**File**: `frontend/src/services/project-notes.service.ts` (create)

```typescript
import { apiClient } from './api-client';
import camelcaseKeys from 'camelcase-keys';
import snakecaseKeys from 'snakecase-keys';
import type { ProjectNoteContext, ProjectNote } from '@/dtos/project-notes.dto';

export const projectNotesService = {
  async getContext(contextId: number, signal?: AbortSignal): Promise<ProjectNoteContext> {
    const response = await apiClient.get(`/project-notes/contexts/${contextId}`, { signal });
    return camelcaseKeys(response.data, { deep: true });
  },
  
  async getNotes(
    contextId: number,
    filters?: { teamNumber?: number; studentId?: number },
    signal?: AbortSignal
  ): Promise<ProjectNote[]> {
    const params = snakecaseKeys(filters || {});
    const response = await apiClient.get(`/project-notes/${contextId}/notes`, {
      params,
      signal,
    });
    return camelcaseKeys(response.data, { deep: true });
  },
  
  async createNote(
    contextId: number,
    data: Partial<ProjectNote>,
    signal?: AbortSignal
  ): Promise<ProjectNote> {
    const payload = snakecaseKeys(data);
    const response = await apiClient.post(`/project-notes/${contextId}/notes`, payload, {
      signal,
    });
    return camelcaseKeys(response.data, { deep: true });
  },
};
```

---

## Phase 3: UI Components - Shared Team Display

### 3.1 TeamBadge Component

**File**: `frontend/src/components/TeamBadge.tsx` (create)

```typescript
interface TeamBadgeProps {
  teamNumber: number;
  displayName?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outlined';
}

export function TeamBadge({ teamNumber, displayName, size = 'md', variant = 'default' }: TeamBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md font-medium',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-2.5 py-1 text-sm',
        size === 'lg' && 'px-3 py-1.5 text-base',
        variant === 'default' && 'bg-blue-100 text-blue-800',
        variant === 'outlined' && 'border border-blue-300 text-blue-700'
      )}
      title={displayName || `Team ${teamNumber}`}
    >
      👥 {teamNumber}
    </span>
  );
}
```

### 3.2 TeamMembersList Component

**File**: `frontend/src/components/TeamMembersList.tsx` (create)

```typescript
interface TeamMembersListProps {
  members: EvaluationTeamMember[];
  showAllocatedStatus?: boolean;
}

export function TeamMembersList({ members, showAllocatedStatus = false }: TeamMembersListProps) {
  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div key={member.userId} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-medium">
              {member.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-medium text-sm">{member.name}</div>
              <div className="text-xs text-gray-500">{member.email}</div>
            </div>
          </div>
          {showAllocatedStatus && (
            <div>
              {member.isAllocated ? (
                <span className="text-xs text-green-600">✓ Toegewezen</span>
              ) : (
                <span className="text-xs text-gray-400">Niet toegewezen</span>
              )}
            </div>
          )}
          {member.role && (
            <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
              {member.role}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
```

### 3.3 TeamFilter Component

**File**: `frontend/src/components/TeamFilter.tsx` (create)

```typescript
interface TeamFilterProps {
  teams: { teamNumber: number; displayName: string; memberCount: number }[];
  selectedTeam: number | null;
  onTeamChange: (teamNumber: number | null) => void;
}

export function TeamFilter({ teams, selectedTeam, onTeamChange }: TeamFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium">Filter op team:</label>
      <select
        value={selectedTeam ?? ''}
        onChange={(e) => onTeamChange(e.target.value ? Number(e.target.value) : null)}
        className="px-3 py-2 border rounded-lg text-sm"
      >
        <option value="">Alle teams</option>
        {teams.map((team) => (
          <option key={team.teamNumber} value={team.teamNumber}>
            Team {team.teamNumber} · {team.memberCount} leden
          </option>
        ))}
      </select>
    </div>
  );
}
```

---

## Phase 4: Evaluation Pages Integration

### 4.1 Teacher Evaluation Dashboard

**File**: `frontend/src/app/(teacher)/teacher/evaluations/[evalId]/dashboard/page.tsx`

**Changes**:
1. Add team context loading
2. Display teams overview card
3. Show team-based completion statistics
4. Add team filter to student list

```typescript
// Add to component state
const [teamContext, setTeamContext] = useState<EvaluationTeamContext | null>(null);
const [selectedTeamFilter, setSelectedTeamFilter] = useState<number | null>(null);

// Load team context
useEffect(() => {
  const controller = new AbortController();
  
  async function loadTeams() {
    try {
      const context = await evaluationService.getEvaluationTeams(
        Number(evalId),
        controller.signal
      );
      setTeamContext(context);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Failed to load team context:', error);
      }
    }
  }
  
  if (evalId) {
    loadTeams();
  }
  
  return () => controller.abort();
}, [evalId]);

// Add Teams Overview Card
<Card>
  <CardHeader>
    <CardTitle>Teams Overzicht</CardTitle>
  </CardHeader>
  <CardContent>
    {teamContext && teamContext.teams.length > 0 ? (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {teamContext.teams.map((team) => (
          <div key={team.teamId} className="p-4 border rounded-lg">
            <TeamBadge teamNumber={team.teamNumber} displayName={team.displayName} />
            <div className="mt-2 text-sm text-gray-600">
              {team.memberCount} leden
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {team.members.filter(m => m.isAllocated).length} toegewezen
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-gray-500">Geen teams gekoppeld aan deze evaluatie</p>
    )}
  </CardContent>
</Card>

// Add team filter to student table
{teamContext && teamContext.teams.length > 0 && (
  <TeamFilter
    teams={teamContext.teams}
    selectedTeam={selectedTeamFilter}
    onTeamChange={setSelectedTeamFilter}
  />
)}
```

### 4.2 Teacher Evaluation Students Table

**File**: `frontend/src/app/(teacher)/teacher/evaluations/[evalId]/_inner.tsx`

**Changes**:
1. Add team column to student table
2. Filter students by selected team
3. Show team badge in student row

```typescript
// Add team column to table headers
<TableHead>Team</TableHead>

// Add team data to table rows
<TableCell>
  {student.teamNumber ? (
    <TeamBadge teamNumber={student.teamNumber} size="sm" />
  ) : (
    <span className="text-gray-400 text-xs">Geen team</span>
  )}
</TableCell>
```

### 4.3 Student Evaluation View

**File**: `frontend/src/app/student/evaluation/[evaluationId]/overzicht/page.tsx`

**Changes**:
1. Show "Jouw Team" section
2. Display team members
3. Highlight team-based peer reviews

```typescript
// Add Team Section
{teamContext && myTeam && (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <TeamBadge teamNumber={myTeam.teamNumber} displayName={myTeam.displayName} />
        Jouw Teamleden
      </CardTitle>
    </CardHeader>
    <CardContent>
      <TeamMembersList members={myTeam.members} />
    </CardContent>
  </Card>
)}
```

### 4.4 Evaluation Feedback Page

**File**: `frontend/src/app/(teacher)/teacher/evaluations/[evalId]/feedback/_inner.tsx`

**Changes**:
1. Group feedback by team
2. Add team context to feedback display
3. Show team-based insights

```typescript
// Group feedback by team
const feedbackByTeam = useMemo(() => {
  if (!teamContext || !feedback) return null;
  
  const grouped = new Map<number, typeof feedback>();
  
  feedback.forEach((item) => {
    const team = findTeamForStudent(item.studentId);
    if (team) {
      if (!grouped.has(team.teamNumber)) {
        grouped.set(team.teamNumber, []);
      }
      grouped.get(team.teamNumber)!.push(item);
    }
  });
  
  return grouped;
}, [teamContext, feedback]);

// Display grouped feedback
{feedbackByTeam && (
  <Tabs defaultValue="all">
    <TabsList>
      <TabsTrigger value="all">Alle feedback</TabsTrigger>
      {Array.from(feedbackByTeam.keys()).map((teamNum) => (
        <TabsTrigger key={teamNum} value={`team-${teamNum}`}>
          Team {teamNum}
        </TabsTrigger>
      ))}
    </TabsList>
    {/* Tab content for each team */}
  </Tabs>
)}
```

---

## Phase 5: Project Notes Integration

### 5.1 Project Notes Context Page

**File**: `frontend/src/app/(teacher)/teacher/project-notes/[projectId]/page.tsx`

**Changes**:
1. Load project teams
2. Add team filter to notes
3. Display team context in note cards
4. Allow filtering/creating notes per team

```typescript
export default function ProjectNotesPage({ params }: { params: { projectId: string } }) {
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [teams, setTeams] = useState<EvaluationTeam[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  
  // Load teams for project
  useEffect(() => {
    async function loadTeams() {
      const projectTeams = await projectTeamService.listProjectTeams(Number(projectId));
      setTeams(projectTeams);
    }
    loadTeams();
  }, [projectId]);
  
  // Load notes with team filter
  useEffect(() => {
    async function loadNotes() {
      const loadedNotes = await projectNotesService.getNotes(
        Number(contextId),
        { teamNumber: selectedTeam || undefined }
      );
      setNotes(loadedNotes);
    }
    loadNotes();
  }, [contextId, selectedTeam]);
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Projectaantekeningen</CardTitle>
          <CardDescription>
            Maak notities per team of individuele student
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Team filter */}
          {teams.length > 0 && (
            <TeamFilter
              teams={teams}
              selectedTeam={selectedTeam}
              onTeamChange={setSelectedTeam}
            />
          )}
          
          {/* Notes list */}
          <div className="mt-4 space-y-4">
            {notes.map((note) => (
              <Card key={note.id}>
                <CardContent className="pt-4">
                  {note.teamNumber && (
                    <TeamBadge teamNumber={note.teamNumber} size="sm" />
                  )}
                  <p className="mt-2">{note.content}</p>
                  <div className="mt-2 text-xs text-gray-500">
                    {note.authorName} · {formatDate(note.createdAt)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 5.2 Create Note Modal

**Component**: Add team selector to note creation

```typescript
<FormField
  control={form.control}
  name="teamNumber"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Team (optioneel)</FormLabel>
      <Select onValueChange={(value) => field.onChange(value ? Number(value) : null)}>
        <SelectTrigger>
          <SelectValue placeholder="Selecteer een team" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Geen specifiek team</SelectItem>
          {teams.map((team) => (
            <SelectItem key={team.teamNumber} value={String(team.teamNumber)}>
              Team {team.teamNumber} · {team.memberCount} leden
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormItem>
  )}
/>
```

---

## Phase 6: Testing & Validation

### 6.1 Backend Tests

**File**: `backend/tests/test_evaluations_teams.py` (create)

```python
def test_get_evaluation_teams(client, db_session, sample_evaluation_with_project):
    """Test retrieving teams for an evaluation."""
    response = client.get(f"/api/v1/evaluations/{sample_evaluation_with_project.id}/teams")
    assert response.status_code == 200
    data = response.json()
    assert "teams" in data
    assert len(data["teams"]) > 0

def test_evaluation_teams_require_project(client, db_session, sample_evaluation_no_project):
    """Test that evaluations without project return empty teams."""
    response = client.get(f"/api/v1/evaluations/{sample_evaluation_no_project.id}/teams")
    assert response.status_code == 200
    data = response.json()
    assert data["project_id"] is None
    assert data["teams"] == []
```

### 6.2 Frontend Tests

**File**: `frontend/src/components/__tests__/TeamBadge.test.tsx` (create)

```typescript
import { render, screen } from '@testing-library/react';
import { TeamBadge } from '../TeamBadge';

describe('TeamBadge', () => {
  it('renders team number', () => {
    render(<TeamBadge teamNumber={1} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });
  
  it('shows display name in title', () => {
    render(<TeamBadge teamNumber={1} displayName="Team Alpha" />);
    expect(screen.getByTitle('Team Alpha')).toBeInTheDocument();
  });
});
```

### 6.3 Integration Tests

**Scenarios to test**:
1. Create evaluation with project → verify teams are loaded
2. Filter students by team → verify correct students shown
3. Create project note for team → verify team context saved
4. View student evaluation → verify team members displayed
5. Close evaluation → verify team roster frozen

---

## Phase 7: Migration & Rollout

### 7.1 Data Validation

**Before rollout**:
- [ ] Verify all existing evaluations with `project_id` have corresponding project teams
- [ ] Check for orphaned allocations (students in allocations but not in project teams)
- [ ] Validate team_number consistency across project_teams table

**Script**: `backend/scripts/validate_team_data.py`

```python
def validate_evaluation_teams(db: Session):
    """Validate team data for all evaluations."""
    evaluations = db.query(Evaluation).filter(Evaluation.project_id.isnot(None)).all()
    
    issues = []
    for eval in evaluations:
        teams = db.query(ProjectTeam).filter_by(project_id=eval.project_id).count()
        if teams == 0:
            issues.append(f"Evaluation {eval.id}: No teams found for project {eval.project_id}")
    
    return issues
```

### 7.2 Rollout Plan

**Phase 7a: Backend Deployment** (Week 1)
- [ ] Deploy new API endpoints
- [ ] Run validation scripts
- [ ] Monitor error logs

**Phase 7b: Frontend Deployment** (Week 2)
- [ ] Deploy updated DTOs and services
- [ ] Deploy shared team components
- [ ] Feature flag: enable team display in evaluations

**Phase 7c: Full Integration** (Week 3)
- [ ] Enable team filtering
- [ ] Enable project notes team context
- [ ] Full user testing

**Phase 7d: Monitoring** (Week 4)
- [ ] Monitor usage analytics
- [ ] Collect user feedback
- [ ] Address bugs and issues

---

## Phase 8: Documentation & Training

### 8.1 User Documentation

**File**: `docs/USER_GUIDE_PROJECT_TEAMS.md` (create)

Topics to cover:
- How to view team assignments in evaluations
- How to filter by team
- How to create team-specific project notes
- Understanding frozen team rosters

### 8.2 Developer Documentation

Update existing docs:
- `docs/architecture.md` - Add team integration workflows
- `docs/API.md` - Document new endpoints
- `README.md` - Update feature list

### 8.3 Training Materials

Create:
- [ ] Video walkthrough of team-based evaluation workflow
- [ ] Screenshots for documentation
- [ ] FAQ document

---

## Success Metrics

### Quantitative
- [ ] 100% of evaluations with projects show team context
- [ ] < 500ms load time for team data
- [ ] 0 errors in team data validation
- [ ] 90% adoption rate within 1 month

### Qualitative
- [ ] Teachers can easily identify which students are in which teams
- [ ] Students understand their team context in evaluations
- [ ] Project notes are more organized with team filtering
- [ ] Reduced confusion about team assignments

---

## Risk Assessment

### High Risk
1. **Performance**: Loading team data for large projects (50+ teams)
   - Mitigation: Implement pagination, caching
   
2. **Data inconsistency**: Students in allocations but not in project teams
   - Mitigation: Validation scripts, data cleanup before rollout

### Medium Risk
1. **UI complexity**: Too much information overwhelming users
   - Mitigation: Progressive disclosure, collapsible sections
   
2. **Legacy evaluations**: Evaluations without projects showing incomplete data
   - Mitigation: Clear messaging, legacy badges

### Low Risk
1. **API breaking changes**: New endpoints affecting existing code
   - Mitigation: Backward compatibility, versioned endpoints

---

## Open Questions

1. **Q**: Should we backfill team data for old evaluations without projects?
   **A**: TBD - Discuss with stakeholders

2. **Q**: How to handle students who change teams mid-evaluation?
   **A**: Use frozen roster at evaluation creation time (already implemented)

3. **Q**: Should project notes support multiple teams per note?
   **A**: TBD - Start with single team, expand if needed

4. **Q**: Export/reporting - include team data in CSV exports?
   **A**: Yes - add team_number column to all student exports

---

## Timeline

| Phase | Duration | Target Date | Status |
|-------|----------|-------------|--------|
| Phase 1: Backend | 1 week | Week 1 | 📋 Planned |
| Phase 2: DTOs/Services | 2 days | Week 2 | 📋 Planned |
| Phase 3: Components | 3 days | Week 2 | 📋 Planned |
| Phase 4: Evaluations | 1 week | Week 3 | 📋 Planned |
| Phase 5: Project Notes | 3 days | Week 4 | 📋 Planned |
| Phase 6: Testing | 1 week | Week 5 | 📋 Planned |
| Phase 7: Rollout | 2 weeks | Week 6-7 | 📋 Planned |
| Phase 8: Documentation | Ongoing | Week 6-8 | 📋 Planned |

**Total Estimated Time**: 7-8 weeks

---

## Next Steps

1. **Immediate**:
   - [ ] Review and approve this plan
   - [ ] Assign developers to phases
   - [ ] Set up project tracking (Jira/GitHub Projects)

2. **Week 1**:
   - [ ] Start Phase 1 (Backend endpoints)
   - [ ] Create test data for development
   - [ ] Set up staging environment

3. **Ongoing**:
   - [ ] Weekly progress reviews
   - [ ] Update this document with learnings
   - [ ] Track blockers and risks

---

## Appendix A: Example API Responses

### GET /evaluations/123/teams

```json
{
  "project_id": 5,
  "project_name": "Duurzaam Schoolgebouw",
  "teams": [
    {
      "team_id": 12,
      "team_number": 1,
      "display_name": "Team 1",
      "member_count": 4,
      "members": [
        {
          "user_id": 101,
          "name": "Jan Janssen",
          "email": "jan@school.nl",
          "role": "leader",
          "is_allocated": true
        },
        {
          "user_id": 102,
          "name": "Piet Pietersen",
          "email": "piet@school.nl",
          "role": null,
          "is_allocated": true
        }
      ]
    },
    {
      "team_id": 13,
      "team_number": 2,
      "display_name": "Team 2",
      "member_count": 3,
      "members": [...]
    }
  ]
}
```

---

## Appendix B: Database Queries

### Get all teams for an evaluation
```sql
SELECT 
  pt.id,
  pt.team_number,
  pt.display_name_at_time,
  COUNT(ptm.id) as member_count
FROM project_teams pt
INNER JOIN evaluations e ON pt.project_id = e.project_id
LEFT JOIN project_team_members ptm ON pt.id = ptm.project_team_id
WHERE e.id = ?
GROUP BY pt.id, pt.team_number, pt.display_name_at_time
ORDER BY pt.team_number;
```

### Get allocations with team info
```sql
SELECT 
  a.id,
  a.evaluator_id,
  u1.name as evaluator_name,
  pt1.team_number as evaluator_team,
  a.evaluatee_id,
  u2.name as evaluatee_name,
  pt2.team_number as evaluatee_team,
  a.status
FROM allocations a
INNER JOIN users u1 ON a.evaluator_id = u1.id
INNER JOIN users u2 ON a.evaluatee_id = u2.id
LEFT JOIN project_team_members ptm1 ON u1.id = ptm1.user_id
LEFT JOIN project_teams pt1 ON ptm1.project_team_id = pt1.id
LEFT JOIN project_team_members ptm2 ON u2.id = ptm2.user_id
LEFT JOIN project_teams pt2 ON ptm2.project_team_id = pt2.id
WHERE a.evaluation_id = ?;
```

---

**Document Version**: 1.0  
**Last Updated**: 2025-12-10  
**Next Review**: After Phase 1 completion
