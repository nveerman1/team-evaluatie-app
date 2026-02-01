# Projectplan (GO/NO-GO) Implementation Plan

**Version:** 2.0 - Correct Architecture  
**Date:** 2026-02-01  
**Status:** Ready for Implementation

---

## Executive Summary

This document provides a complete implementation plan for the Projectplan (GO/NO-GO) feature for bovenbouw (upper-level) projects. The architecture follows the existing `ProjectAssessment` pattern where ONE projectplan component is created per project and applies to ALL teams within that project.

### Key Concept
- **ProjectPlan** = Template/Component (like ProjectAssessment)
- **ProjectPlanTeam** = Individual team's instance (like ProjectAssessmentTeam)
- Teacher creates ONE projectplan that all teams can fill out
- Each team has their own sections, status, and progress

---

## Architecture Overview

### Data Model Hierarchy
```
Project (bovenbouw)
  └── ProjectPlan (1 per project - the "component")
       └── ProjectPlanTeam (1 per team in project)
            └── ProjectPlanSection (8 sections per team)
```

### Similar Pattern Reference
Study `ProjectAssessment` implementation:
- Models: `ProjectAssessment` → `ProjectAssessmentTeam` 
- Routes: `/teacher/project-assessments` → `/teacher/project-assessments/{id}/overview`
- The overview tab shows all teams and their progress

---

## Phase 1: Database Models & Migration

### 1.1 Update Models (backend/app/infra/db/models.py)

#### A) ProjectPlan Model (Template/Component)
```python
class ProjectPlan(Base):
    __tablename__ = "project_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Component metadata
    title = Column(String(200), nullable=True)  # Teacher-defined title
    version = Column(String(50), nullable=True)  # e.g., "v1", "2024-Q1"
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    school = relationship("School", back_populates="project_plans")
    project = relationship("Project", back_populates="project_plans")
    teams = relationship("ProjectPlanTeam", back_populates="project_plan", cascade="all, delete-orphan")
    
    # NO status, NO locked - those are per team!
```

#### B) ProjectPlanTeam Model (Team Instance)
```python
class ProjectPlanTeam(Base):
    __tablename__ = "project_plan_teams"
    
    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False, index=True)
    project_plan_id = Column(Integer, ForeignKey("project_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    project_team_id = Column(Integer, ForeignKey("project_teams.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Team-specific data
    title = Column(String(200), nullable=True)  # Student-defined title
    status = Column(String(20), nullable=False, default="concept", index=True)  # concept/ingediend/go/no-go
    locked = Column(Boolean, default=False, nullable=False)  # Locked after GO
    global_teacher_note = Column(Text, nullable=True)  # Overall feedback
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    school = relationship("School", back_populates="project_plan_teams")
    project_plan = relationship("ProjectPlan", back_populates="teams")
    project_team = relationship("ProjectTeam", back_populates="project_plan_teams")
    sections = relationship("ProjectPlanSection", back_populates="project_plan_team", cascade="all, delete-orphan")
    
    __table_args__ = (
        UniqueConstraint('project_plan_id', 'project_team_id', name='uq_project_plan_team'),
    )
```

#### C) ProjectPlanSection Model (Section Content)
```python
class ProjectPlanSection(Base):
    __tablename__ = "project_plan_sections"
    
    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False, index=True)
    project_plan_team_id = Column(Integer, ForeignKey("project_plan_teams.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Section identification
    key = Column(String(50), nullable=False)  # client/problem/goal/method/planning/tasks/motivation/risks
    status = Column(String(20), nullable=False, default="empty", index=True)  # empty/draft/submitted/approved/revision
    
    # Content (for non-client sections)
    text = Column(Text, nullable=True)
    
    # Client section fields (only used when key="client")
    client_organisation = Column(String(200), nullable=True)
    client_contact = Column(String(200), nullable=True)
    client_email = Column(String(320), nullable=True)
    client_phone = Column(String(50), nullable=True)
    client_description = Column(Text, nullable=True)
    
    # Teacher feedback
    teacher_note = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    school = relationship("School", back_populates="project_plan_sections")
    project_plan_team = relationship("ProjectPlanTeam", back_populates="sections")
    
    __table_args__ = (
        UniqueConstraint('project_plan_team_id', 'key', name='uq_project_plan_team_section_key'),
    )
```

#### D) Update Project Model
Add relationship:
```python
project_plans = relationship("ProjectPlan", back_populates="project", cascade="all, delete-orphan")
```

#### E) Update School Model
Add relationships:
```python
project_plans = relationship("ProjectPlan", back_populates="school", cascade="all, delete-orphan")
project_plan_teams = relationship("ProjectPlanTeam", back_populates="school", cascade="all, delete-orphan")
project_plan_sections = relationship("ProjectPlanSection", back_populates="school", cascade="all, delete-orphan")
```

#### F) Update ProjectTeam Model
Add relationship:
```python
project_plan_teams = relationship("ProjectPlanTeam", back_populates="project_team", cascade="all, delete-orphan")
```

### 1.2 Create Migration

**File:** `backend/migrations/versions/XXXXXX_refactor_projectplan_multi_team.py`

Key operations:
1. Create `project_plan_teams` table
2. Migrate existing `project_plans` data:
   - Create `ProjectPlanTeam` for each existing `ProjectPlan`
   - Move status/locked/global_teacher_note to team level
3. Update `project_plan_sections` to reference `project_plan_team_id`
4. Remove old columns from `project_plans` (status, locked, global_teacher_note)
5. Remove unique constraint on `project_plans.project_id` (allow multiple versions)

**Important:** Test migration with backup database first!

---

## Phase 2: Backend Schemas

### 2.1 Create Pydantic Schemas (backend/app/api/v1/schemas/projectplans.py)

#### Base Schemas
```python
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from enum import Enum

class PlanStatus(str, Enum):
    CONCEPT = "concept"
    INGEDIEND = "ingediend"
    GO = "go"
    NO_GO = "no-go"

class SectionKey(str, Enum):
    CLIENT = "client"
    PROBLEM = "problem"
    GOAL = "goal"
    METHOD = "method"
    PLANNING = "planning"
    TASKS = "tasks"
    MOTIVATION = "motivation"
    RISKS = "risks"

class SectionStatus(str, Enum):
    EMPTY = "empty"
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REVISION = "revision"

class ClientData(BaseModel):
    organisation: Optional[str] = None
    contact: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    description: Optional[str] = None

class ProjectPlanSectionBase(BaseModel):
    key: SectionKey
    status: SectionStatus
    text: Optional[str] = None
    client: Optional[ClientData] = None
    teacher_note: Optional[str] = None

class ProjectPlanSectionResponse(ProjectPlanSectionBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ProjectPlanTeamBase(BaseModel):
    title: Optional[str] = None
    status: PlanStatus
    locked: bool

class ProjectPlanTeamDetail(ProjectPlanTeamBase):
    id: int
    project_team_id: int
    team_number: int
    team_members: List[str]
    sections: List[ProjectPlanSectionResponse]
    global_teacher_note: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ProjectPlanBase(BaseModel):
    title: Optional[str] = None
    version: Optional[str] = None

class ProjectPlanCreate(ProjectPlanBase):
    project_id: int

class ProjectPlanResponse(ProjectPlanBase):
    id: int
    project_id: int
    project_name: str
    course_id: int
    course_name: str
    team_count: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ProjectPlanDetail(ProjectPlanResponse):
    teams: List[ProjectPlanTeamDetail]

class ProjectPlanListItem(BaseModel):
    id: int
    title: Optional[str]
    version: Optional[str]
    project_id: int
    project_name: str
    course_id: int
    course_name: str
    team_count: int
    teams_summary: dict  # {concept: 2, ingediend: 1, go: 0, no_go: 1}
    created_at: datetime
    updated_at: datetime

# Update/Patch schemas
class ProjectPlanUpdate(BaseModel):
    title: Optional[str] = None
    version: Optional[str] = None

class ProjectPlanTeamUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[PlanStatus] = None
    locked: Optional[bool] = None
    global_teacher_note: Optional[str] = None

class ProjectPlanSectionUpdate(BaseModel):
    text: Optional[str] = None
    client: Optional[ClientData] = None
    status: Optional[SectionStatus] = None
    teacher_note: Optional[str] = None
```

### 2.2 Add to Project Schema
Update `backend/app/api/v1/schemas/projects.py`:
```python
level: Optional[str] = None  # "onderbouw" or "bovenbouw"
```

---

## Phase 3: Backend API Endpoints

### 3.1 Teacher Routes (backend/app/api/v1/routers/projectplans.py)

#### List ProjectPlans
```python
@router.get("/", response_model=List[ProjectPlanListItem])
def list_projectplans(
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher),
    search: Optional[str] = None,
    course_id: Optional[int] = None,
    status: Optional[str] = None,
):
    """List all projectplan components for teacher's school, grouped by course."""
    # Query projectplans with team counts and status summaries
    # Filter by course_id if provided
    # Search in project name, title
    # Apply RBAC (school_id matches)
```

#### Create ProjectPlan Component
```python
@router.post("/", response_model=ProjectPlanResponse, status_code=201)
def create_projectplan(
    data: ProjectPlanCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher),
):
    """
    Create a projectplan component for a project.
    Automatically creates ProjectPlanTeam for each team in the project.
    Each team gets 8 empty sections initialized.
    """
    # Validate project exists and teacher has access
    # Check project level is "bovenbouw"
    # Create ProjectPlan
    # For each ProjectTeam in project:
    #   Create ProjectPlanTeam
    #   Create 8 ProjectPlanSection (empty status)
    # Log action
    # Return created projectplan
```

#### Get ProjectPlan Detail
```python
@router.get("/{projectplan_id}", response_model=ProjectPlanDetail)
def get_projectplan(
    projectplan_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher),
):
    """Get projectplan with all teams and their sections."""
    # Query with eager loading
    # Verify RBAC
```

#### Get Overview (All Teams)
```python
@router.get("/{projectplan_id}/overview", response_model=List[ProjectPlanTeamDetail])
def get_projectplan_overview(
    projectplan_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher),
    search: Optional[str] = None,
    status: Optional[str] = None,
):
    """
    Get overview of all teams for this projectplan.
    Used in the "Overzicht" tab.
    """
    # Query all ProjectPlanTeam for this projectplan
    # Include team members, section counts
    # Filter by status if provided
    # Search in team members, title
    # Sort by status priority: ingediend > no-go > concept > go
```

#### Update ProjectPlan Component
```python
@router.patch("/{projectplan_id}", response_model=ProjectPlanResponse)
def update_projectplan(
    projectplan_id: int,
    data: ProjectPlanUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher),
):
    """Update component metadata (title, version)."""
```

#### Update Team Status (GO/NO-GO)
```python
@router.patch("/{projectplan_id}/teams/{team_id}", response_model=ProjectPlanTeamDetail)
def update_team_status(
    projectplan_id: int,
    team_id: int,
    data: ProjectPlanTeamUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher),
):
    """
    Update team's overall status and feedback.
    - Setting status=GO locks the plan
    - Setting status=NO_GO unlocks the plan
    """
    # Validate projectplan_team exists
    # If status=GO: set locked=True, optionally mark submitted sections as approved
    # If status=NO_GO: set locked=False
    # Log action
```

#### Update Section Feedback
```python
@router.patch("/{projectplan_id}/teams/{team_id}/sections/{section_key}")
def update_section_feedback(
    projectplan_id: int,
    team_id: int,
    section_key: SectionKey,
    data: ProjectPlanSectionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher),
):
    """
    Teacher provides feedback on a specific section.
    - Can set status to 'approved' or 'revision'
    - If setting to 'revision', teacher_note must be non-empty
    """
    # Validate section exists
    # If status=revision and teacher_note empty: raise 400
    # Update section
    # Log action
```

#### Delete ProjectPlan Component
```python
@router.delete("/{projectplan_id}", status_code=204)
def delete_projectplan(
    projectplan_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_teacher),
):
    """Delete projectplan component (cascades to all teams and sections)."""
    # Verify RBAC
    # Delete (cascade handles teams and sections)
    # Log action
```

### 3.2 Student Routes

#### List My ProjectPlans
```python
@router.get("/me/projectplans", response_model=List[ProjectPlanResponse])
def list_my_projectplans(
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    """List all projectplans for projects where student is a team member."""
    # Query via: User → ProjectTeamMember → ProjectTeam → ProjectPlanTeam → ProjectPlan
    # Return unique projectplans
```

#### Get My Team's ProjectPlan
```python
@router.get("/me/projectplans/{projectplan_id}", response_model=ProjectPlanTeamDetail)
def get_my_projectplan(
    projectplan_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    """Get student's team projectplan with sections."""
    # Find ProjectPlanTeam for this projectplan and student's team
    # Verify student is team member
```

#### Update Team Title
```python
@router.patch("/me/projectplans/{projectplan_team_id}")
def update_my_projectplan_title(
    projectplan_team_id: int,
    data: ProjectPlanTeamUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    """Student updates their team's projectplan title."""
    # Verify not locked
    # Verify student is team member
```

#### Update Section Content
```python
@router.patch("/me/projectplans/{projectplan_team_id}/sections/{section_key}")
def update_my_section(
    projectplan_team_id: int,
    section_key: SectionKey,
    data: ProjectPlanSectionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    """Student updates section content."""
    # Verify not locked
    # Verify student is team member
    # Update section text or client fields
    # Auto-set status to draft if content added
```

#### Submit for Review
```python
@router.post("/me/projectplans/{projectplan_team_id}/submit")
def submit_projectplan(
    projectplan_team_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    """
    Submit projectplan for teacher review.
    - Validates required sections are filled
    - Sets status to 'ingediend'
    - Marks filled required sections as 'submitted'
    """
    # Verify not locked
    # Verify student is team member
    # Check required sections filled:
    #   - client: org + contact + email
    #   - problem, goal, method, planning: text non-empty
    # Set team status to 'ingediend'
    # Update required sections to 'submitted' if filled
```

---

## Phase 4: Frontend - DTOs & Services

### 4.1 DTOs (frontend/src/dtos/projectplan.dto.ts)
```typescript
export enum PlanStatus {
  CONCEPT = 'concept',
  INGEDIEND = 'ingediend',
  GO = 'go',
  NO_GO = 'no-go',
}

export enum SectionKey {
  CLIENT = 'client',
  PROBLEM = 'problem',
  GOAL = 'goal',
  METHOD = 'method',
  PLANNING = 'planning',
  TASKS = 'tasks',
  MOTIVATION = 'motivation',
  RISKS = 'risks',
}

export enum SectionStatus {
  EMPTY = 'empty',
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  REVISION = 'revision',
}

export interface ClientData {
  organisation?: string;
  contact?: string;
  email?: string;
  phone?: string;
  description?: string;
}

export interface ProjectPlanSection {
  id: number;
  key: SectionKey;
  status: SectionStatus;
  text?: string;
  client?: ClientData;
  teacher_note?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectPlanTeam {
  id: number;
  project_team_id: number;
  team_number: number;
  team_members: string[];
  title?: string;
  status: PlanStatus;
  locked: boolean;
  sections: ProjectPlanSection[];
  global_teacher_note?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectPlan {
  id: number;
  project_id: number;
  project_name: string;
  course_id: number;
  course_name: string;
  title?: string;
  version?: string;
  team_count: number;
  teams?: ProjectPlanTeam[];
  created_at: string;
  updated_at: string;
}

export interface ProjectPlanListItem {
  id: number;
  title?: string;
  version?: string;
  project_id: number;
  project_name: string;
  course_id: number;
  course_name: string;
  team_count: number;
  teams_summary: Record<PlanStatus, number>;
  created_at: string;
  updated_at: string;
}

export interface ProjectPlanCreate {
  project_id: number;
  title?: string;
  version?: string;
}

export interface ProjectPlanUpdate {
  title?: string;
  version?: string;
}

export interface ProjectPlanTeamUpdate {
  title?: string;
  status?: PlanStatus;
  locked?: boolean;
  global_teacher_note?: string;
}

export interface ProjectPlanSectionUpdate {
  text?: string;
  client?: ClientData;
  status?: SectionStatus;
  teacher_note?: string;
}
```

### 4.2 Service (frontend/src/services/projectplan.service.ts)
```typescript
import api from '@/lib/api';
import {
  ProjectPlan,
  ProjectPlanListItem,
  ProjectPlanTeam,
  ProjectPlanCreate,
  ProjectPlanUpdate,
  ProjectPlanTeamUpdate,
  ProjectPlanSectionUpdate,
  SectionKey,
} from '@/dtos/projectplan.dto';

export const projectPlanService = {
  // Teacher endpoints
  async listProjectPlans(params?: {
    search?: string;
    course_id?: number;
    status?: string;
  }): Promise<ProjectPlanListItem[]> {
    const { data } = await api.get('/teacher/projectplans', { params });
    return data;
  },

  async createProjectPlan(payload: ProjectPlanCreate): Promise<ProjectPlan> {
    const { data } = await api.post('/teacher/projectplans', payload);
    return data;
  },

  async getProjectPlan(id: number): Promise<ProjectPlan> {
    const { data } = await api.get(`/teacher/projectplans/${id}`);
    return data;
  },

  async getProjectPlanOverview(
    id: number,
    params?: { search?: string; status?: string }
  ): Promise<ProjectPlanTeam[]> {
    const { data } = await api.get(`/teacher/projectplans/${id}/overview`, { params });
    return data;
  },

  async updateProjectPlan(id: number, payload: ProjectPlanUpdate): Promise<ProjectPlan> {
    const { data } = await api.patch(`/teacher/projectplans/${id}`, payload);
    return data;
  },

  async updateTeamStatus(
    projectPlanId: number,
    teamId: number,
    payload: ProjectPlanTeamUpdate
  ): Promise<ProjectPlanTeam> {
    const { data } = await api.patch(
      `/teacher/projectplans/${projectPlanId}/teams/${teamId}`,
      payload
    );
    return data;
  },

  async updateSectionFeedback(
    projectPlanId: number,
    teamId: number,
    sectionKey: SectionKey,
    payload: ProjectPlanSectionUpdate
  ): Promise<void> {
    await api.patch(
      `/teacher/projectplans/${projectPlanId}/teams/${teamId}/sections/${sectionKey}`,
      payload
    );
  },

  async deleteProjectPlan(id: number): Promise<void> {
    await api.delete(`/teacher/projectplans/${id}`);
  },

  // Student endpoints
  async listMyProjectPlans(): Promise<ProjectPlan[]> {
    const { data } = await api.get('/me/projectplans');
    return data;
  },

  async getMyProjectPlan(id: number): Promise<ProjectPlanTeam> {
    const { data } = await api.get(`/me/projectplans/${id}`);
    return data;
  },

  async updateMyProjectPlanTitle(
    id: number,
    payload: ProjectPlanTeamUpdate
  ): Promise<void> {
    await api.patch(`/me/projectplans/${id}`, payload);
  },

  async updateMySection(
    projectPlanTeamId: number,
    sectionKey: SectionKey,
    payload: ProjectPlanSectionUpdate
  ): Promise<void> {
    await api.patch(
      `/me/projectplans/${projectPlanTeamId}/sections/${sectionKey}`,
      payload
    );
  },

  async submitProjectPlan(projectPlanTeamId: number): Promise<void> {
    await api.post(`/me/projectplans/${projectPlanTeamId}/submit`);
  },
};
```

---

## Phase 5: Frontend - Teacher Pages

### 5.1 List Page (frontend/src/app/(teacher)/teacher/projectplans/page.tsx)

**Purpose:** Show all projectplan components, grouped by course

**UI Structure:**
- Page header: "Projectplannen" + "Nieuw projectplan" button
- Search bar: "Zoek op vak, project…"
- Filter dropdowns: Course, Status
- Cards grouped by course name (like project-assessments)

**Each Card Shows:**
- Title (or fallback)
- Project name
- Version (if set)
- Team count
- Status summary badges (e.g., "2 In review, 1 NO-GO, 3 Concept")
- Action buttons (right side):
  - "Overzicht" → navigate to overview tab
  - "Projectplannen" → navigate to projectplan tab  
  - Delete button (trash icon)

**Reference:** Copy structure from `/teacher/project-assessments/page.tsx`

### 5.2 Create Page (frontend/src/app/(teacher)/teacher/projectplans/create/_inner.tsx)

**Form Fields:**
1. Title (optional text input)
2. Course (required dropdown)
3. Project (required dropdown, filtered by course)
4. Version (optional text input)

**On Submit:**
- Call `createProjectPlan` service
- Navigate to `/teacher/projectplans/{id}?tab=overzicht`

**Reference:** Copy structure from `/teacher/project-assessments/create/_inner.tsx`

### 5.3 Detail Page (frontend/src/app/(teacher)/teacher/projectplans/[id]/page.tsx)

**Two Tabs:**

#### Tab 1: Overzicht
**Purpose:** Show all teams and their progress

**UI:**
- Search bar: "Zoek op team, leerling…"
- Status filter dropdown
- Table/List of teams:
  - Team number + member names
  - Projectplan title (student-defined, with fallback)
  - Status badge
  - Lock indicator if locked
  - Progress bar (required sections: X/5)
  - Last updated
- Clicking row → navigate to Tab 2 with that team selected

**Reference:** `/teacher/project-assessments/{id}/overview`

#### Tab 2: Projectplannen
**Purpose:** Review specific team's sections

**UI:**
- Team selector dropdown (sticky top)
- Accordion of 8 sections
- Each section expanded view shows:
  - **Left side:** Teacher feedback textarea + "Akkoord" / "Aanpassen" buttons
  - **Right side:** Student content (read-only)
- Bottom sticky bar: GO / NO-GO buttons

**Reference:** Current implementation (keep this part)

### 5.4 Navigation
Add "Projectplan" to teacher sidebar navigation under "Projecten"

---

## Phase 6: Frontend - Student Pages

### 6.1 Dashboard Tab (frontend/src/components/student/dashboard/ProjectplannenTab.tsx)

**Purpose:** Show student's projectplans

**UI:**
- List of projectplans (cards)
- Each card shows:
  - Project name
  - Projectplan title (component title + team title)
  - Status badge
  - Lock indicator
  - Progress bar
- Clicking card → navigate to editor

**Keep current implementation, just update service calls**

### 6.2 Editor Page (frontend/src/app/student/projects/[projectId]/projectplan/page.tsx)

**Purpose:** Edit team's projectplan sections

**UI:**
- Title input (team's custom title)
- Accordion of 8 sections
- Each section:
  - Client: multiple fields (org, contact, email, phone, description)
  - Others: large textarea
- Section status indicators
- Teacher feedback display (if present)
- Action buttons: "Opslaan als concept" / "Markeer als klaar"
- Submit button when all required sections filled
- Lock indicator when GO status

**Keep current implementation, update service calls to use ProjectPlanTeam ID**

---

## Phase 7: Testing

### 7.1 Backend Tests
Create `backend/tests/api/v1/test_projectplans.py`:

Test scenarios:
- Teacher creates projectplan for bovenbouw project
- All teams automatically get projectplan instances
- Each team has 8 empty sections
- Student can edit their team's sections
- Student cannot edit when locked
- Teacher can provide feedback per section
- Teacher "Aanpassen" requires teacher_note
- GO status locks the plan
- NO-GO unlocks the plan
- Required sections validation on submit

### 7.2 Frontend Tests
Manual testing checklist:
- [ ] Teacher can create projectplan
- [ ] Projectplan appears in list
- [ ] Cards grouped by course
- [ ] Overview tab shows all teams
- [ ] Can filter and search teams
- [ ] Clicking team navigates to projectplan tab
- [ ] Teacher can provide feedback
- [ ] GO/NO-GO buttons work correctly
- [ ] Student sees projectplan in dashboard
- [ ] Student can edit sections
- [ ] Student cannot edit when locked
- [ ] Submit validation works
- [ ] Status updates reflect in UI

---

## Implementation Order

### Week 1: Backend Foundation
1. **Day 1-2:** Database models + migration
   - Update models.py
   - Create migration file
   - Test migration on dev database
   - Verify data integrity

2. **Day 3:** Pydantic schemas
   - Create projectplans.py schemas
   - Update project.py schemas

3. **Day 4-5:** Teacher API endpoints
   - List, create, get, update, delete
   - Overview endpoint
   - Team status update
   - Section feedback update

4. **Day 6:** Student API endpoints
   - List, get, update, submit
   - Section update

5. **Day 7:** Backend testing
   - Write unit tests
   - Manual API testing with Postman/Insomnia

### Week 2: Frontend Implementation
6. **Day 8:** DTOs and services
   - Create projectplan.dto.ts
   - Create projectplan.service.ts

7. **Day 9:** Teacher list page
   - page.tsx with cards grouped by course

8. **Day 10:** Teacher create page
   - Form with validation

9. **Day 11:** Teacher detail - Overview tab
   - Team list with search/filter

10. **Day 12:** Teacher detail - Projectplan tab
    - Team selector
    - Section accordion with feedback UI

11. **Day 13:** Student dashboard tab
    - Projectplannen list

12. **Day 14:** Student editor page
    - Section editor with validation

### Week 3: Polish & Testing
13. **Day 15-16:** Manual testing
    - End-to-end flows
    - Edge cases
    - Error handling

14. **Day 17:** Bug fixes and refinements

15. **Day 18:** Documentation updates

16. **Day 19-20:** Final review and deployment prep

---

## Key Learnings from Previous Attempt

### ❌ What Went Wrong
1. **Architecture mismatch:** Created one ProjectPlan per project (unique constraint on project_id) instead of one per project that applies to all teams
2. **No team tracking:** Missing ProjectPlanTeam intermediary table
3. **Sections tied to wrong entity:** Sections linked directly to ProjectPlan instead of ProjectPlanTeam
4. **Incomplete understanding:** Didn't study ProjectAssessment pattern first

### ✅ What to Do Differently
1. **Study existing patterns:** Spend 1-2 hours analyzing ProjectAssessment architecture before coding
2. **Database first:** Get the model relationships correct before building APIs
3. **Test migration:** Use backup database and test data migration thoroughly
4. **Incremental development:** Complete backend fully before starting frontend
5. **Reference existing code:** Copy and adapt from project-assessments wherever possible

---

## Success Criteria

### Must Have
- [ ] Teacher can create one projectplan component for a project
- [ ] All teams in that project automatically get their own instance
- [ ] Each team has 8 sections (client, problem, goal, method, planning, tasks, motivation, risks)
- [ ] Teacher sees overview of all teams' progress
- [ ] Teacher can review each team's sections individually
- [ ] Teacher can provide per-section feedback
- [ ] Teacher can approve/reject sections
- [ ] Teacher can set GO/NO-GO for each team
- [ ] GO locks that team's plan
- [ ] Students can edit their team's sections
- [ ] Students cannot edit when locked
- [ ] Submit validates required sections filled
- [ ] UI matches existing teacher/student page styles

### Nice to Have
- [ ] Version history tracking
- [ ] Export to PDF
- [ ] Email notifications
- [ ] Bulk actions for teachers
- [ ] Section templates

---

## Support & Resources

### Reference Files to Study
- `backend/app/infra/db/models.py` - ProjectAssessment, ProjectAssessmentTeam models
- `backend/app/api/v1/routers/project_assessments.py` - API patterns
- `frontend/src/app/(teacher)/teacher/project-assessments/` - UI patterns
- `backend/migrations/versions/118f1aa65586_initial_migration.py` - Migration syntax

### Helpful Commands
```bash
# Backend
cd backend
source venv/bin/activate
alembic revision --autogenerate -m "message"
alembic upgrade head
pytest tests/api/v1/test_projectplans.py -v

# Frontend
cd frontend
npm run dev
npm run build
npm run lint
```

### Common Pitfalls
1. Forgetting cascade deletes on foreign keys
2. Not adding proper indexes (performance issues)
3. Missing RBAC checks in endpoints
4. Hardcoding school_id instead of using user.school_id
5. Not handling timezone-aware datetimes consistently
6. Forgetting to log actions for audit trail

---

## Questions to Answer Before Starting

1. Should projectplans be automatically created for all bovenbouw projects, or only when teacher explicitly creates one?
2. Can a project have multiple projectplan versions, or only one active at a time?
3. Should students see teacher feedback before GO/NO-GO decision, or only after?
4. What happens to projectplan data when a team member is removed from the project?
5. Should there be notifications when teacher provides feedback?

---

## Appendix: Status Badge Styling

Match existing badge styling from project-assessments:

```tsx
const STATUS_STYLES = {
  concept: 'bg-slate-100 text-slate-700 border-slate-200',
  ingediend: 'bg-blue-100 text-blue-700 border-blue-200',
  go: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'no-go': 'bg-rose-100 text-rose-700 border-rose-200',
};
```

---

**End of Implementation Plan**

This document should be used as the authoritative guide for implementing the Projectplan feature with the correct multi-team architecture. Update this document as requirements evolve or new edge cases are discovered.
