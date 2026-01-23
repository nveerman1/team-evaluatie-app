# Feedback en Verbeterd Plan: Inlever Feature (Link-based Submission)

## Executive Summary

Het oorspronkelijke plan is **zeer goed doordacht en gestructureerd**. Het volgt best practices voor incrementele ontwikkeling, heeft een duidelijke v1-scope, en houdt rekening met toekomstige uitbreidingen. 

Deze feedback bevat:
1. **Alignment met bestaande tabellen** (vooral `project_teams` en `project_assessments`)
2. **Verbeteringen** voor betere integratie met de huidige codebase
3. **Specifieke implementatiedetails** gebaseerd op de bestaande architectuur

---

## ✅ Sterke Punten van het Oorspronkelijke Plan

1. **Duidelijke v1-scope**: Link-inleveren zonder Graph/bestandsupload is een excellente eerste stap
2. **Audit trail**: `submission_events` vanaf v1 is verstandig
3. **Status-based workflow**: De status flow (missing → submitted → ok/access_requested/broken) is logisch
4. **Team-gecentreerd**: Inleveren per team past perfect bij de project-based team management
5. **Incremental rollout**: Sprint-based approach met duidelijke deliverables
6. **Toekomstvast**: Data model kan Graph/AI in v2/v3 ondersteunen

---

## 🔧 Aanpassingen voor Bestaande Database Schema

### 1. Data Model - Alignment met Huidige Tabellen

#### 1.1 `assignment_submissions` Table

**WIJZIGING**: De huidige codebase gebruikt al `project_teams` (niet `groups`) voor project-based evaluations. Pas het schema aan:

```sql
CREATE TABLE assignment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Multi-tenant support (consistent met andere tabellen)
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Foreign keys (aangepast aan bestaande structuur)
    project_assessment_id INTEGER NOT NULL REFERENCES project_assessments(id) ON DELETE CASCADE,
    project_team_id INTEGER NOT NULL REFERENCES project_teams(id) ON DELETE RESTRICT,
    
    -- Document type
    doc_type VARCHAR(20) NOT NULL CHECK (doc_type IN ('report', 'slides', 'attachment')),
    
    -- Submission data
    url TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'missing' 
        CHECK (status IN ('missing', 'submitted', 'ok', 'access_requested', 'broken')),
    
    -- Versioning (optioneel voor v1, maar helpt bij herinleveringen)
    version_label VARCHAR(50),
    
    -- Audit fields
    submitted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ,
    last_checked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    last_checked_at TIMESTAMPTZ,
    
    -- Timestamps (consistent met andere tabellen)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT uq_submission_per_assessment_team_doctype_version
        UNIQUE (project_assessment_id, project_team_id, doc_type, version_label)
);

-- Indices voor performance
CREATE INDEX idx_submissions_assessment ON assignment_submissions(project_assessment_id);
CREATE INDEX idx_submissions_team ON assignment_submissions(project_team_id);
CREATE INDEX idx_submissions_status ON assignment_submissions(project_assessment_id, status);
CREATE INDEX idx_submissions_school ON assignment_submissions(school_id);
```

**BELANGRIJKE WIJZIGINGEN**:
1. ✅ `school_id` toegevoegd voor multi-tenant support (alle tabellen in deze app hebben dit)
2. ✅ `project_team_id` gebruikt i.p.v. `team_id` (consistent met bestaande `project_assessments` tabel)
3. ✅ Integer FK's i.p.v. UUID's (de app gebruikt serial integers als PK's)
4. ✅ Timestamps consistent met bestaande schema (TIMESTAMPTZ met NOW() default)

#### 1.2 `submission_events` Table

```sql
CREATE TABLE submission_events (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    submission_id UUID NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
    actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    event_type VARCHAR(50) NOT NULL 
        CHECK (event_type IN ('submitted', 'status_changed', 'cleared', 'opened', 'commented')),
    
    -- Flexible payload voor event-specifieke data
    payload JSONB,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_submission_events_submission ON submission_events(submission_id);
CREATE INDEX idx_submission_events_created ON submission_events(created_at DESC);
CREATE INDEX idx_submission_events_school ON submission_events(school_id);
```

### 2. Relatie met Bestaande Tabellen

#### 2.1 Koppeling met `project_assessments`

De `project_assessments` tabel heeft al:
- ✅ `project_id` (since pa_20251208_01 migration)
- ✅ `project_team_id` (since pt_20251208_01 migration)
- ✅ `status` field (draft|open|closed|published)
- ✅ `closed_at` timestamp

**VOORDEEL**: Je kunt submissions automatisch koppelen aan open assessments:
```sql
-- Query: alleen inleveringen voor open assessments
SELECT s.* 
FROM assignment_submissions s
JOIN project_assessments pa ON s.project_assessment_id = pa.id
WHERE pa.status IN ('open', 'draft')
  AND pa.school_id = :current_school_id;
```

#### 2.2 Permissions via Bestaande `ProjectTeamMember`

De app heeft al `project_team_members` met user-team koppeling:

```python
# Permission check: kan deze user inleveren voor dit team?
def can_user_submit_for_team(user_id: int, project_team_id: int, db: Session) -> bool:
    member = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.project_team_id == project_team_id,
        ProjectTeamMember.user_id == user_id
    ).first()
    return member is not None
```

---

## 🚀 Verbeterde API Endpoints (FastAPI)

### 2.1 Student/Team Endpoints

**Aangepast aan bestaande API structuur** (`app/api/v1/routers/`):

```python
# In: app/api/v1/routers/submissions.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.api.v1.schemas.submissions import SubmissionCreate, SubmissionResponse
from app.infra.db.models import User, AssignmentSubmission, ProjectTeamMember

router = APIRouter(prefix="/api/v1/submissions", tags=["submissions"])

@router.post("/assessments/{assessment_id}/teams/{team_id}")
async def submit_link(
    assessment_id: int,
    team_id: int,
    data: SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submit or update a link for a team's assessment.
    Only team members can submit for their team.
    """
    # Permission check: is user member of this team?
    is_member = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.project_team_id == team_id,
        ProjectTeamMember.user_id == current_user.id
    ).first()
    
    if not is_member:
        raise HTTPException(403, "Je bent geen lid van dit team")
    
    # Check if assessment exists and belongs to user's school
    assessment = db.query(ProjectAssessment).filter(
        ProjectAssessment.id == assessment_id,
        ProjectAssessment.school_id == current_user.school_id
    ).first()
    
    if not assessment:
        raise HTTPException(404, "Assessment niet gevonden")
    
    # URL validation
    if not validate_sharepoint_url(data.url):
        raise HTTPException(400, "Alleen SharePoint/OneDrive links toegestaan")
    
    # Create or update submission
    submission = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.project_assessment_id == assessment_id,
        AssignmentSubmission.project_team_id == team_id,
        AssignmentSubmission.doc_type == data.doc_type,
        AssignmentSubmission.version_label == data.version_label
    ).first()
    
    if not submission:
        submission = AssignmentSubmission(
            school_id=current_user.school_id,
            project_assessment_id=assessment_id,
            project_team_id=team_id,
            doc_type=data.doc_type,
            version_label=data.version_label or "v1"
        )
        db.add(submission)
    
    submission.url = data.url.strip()
    submission.status = "submitted"
    submission.submitted_by_user_id = current_user.id
    submission.submitted_at = datetime.now(timezone.utc)
    
    # Log event
    log_submission_event(db, submission, current_user.id, "submitted")
    
    db.commit()
    db.refresh(submission)
    
    return submission


@router.delete("/submissions/{submission_id}")
async def clear_submission(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clear a submission (student or teacher can do this)"""
    submission = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.id == submission_id
    ).first()
    
    if not submission:
        raise HTTPException(404, "Inlevering niet gevonden")
    
    # Permission: team member OR teacher of assessment
    is_team_member = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.project_team_id == submission.project_team_id,
        ProjectTeamMember.user_id == current_user.id
    ).first()
    
    is_teacher = db.query(ProjectAssessment).filter(
        ProjectAssessment.id == submission.project_assessment_id,
        ProjectAssessment.teacher_id == current_user.id
    ).first()
    
    if not (is_team_member or is_teacher or current_user.role == "ADMIN"):
        raise HTTPException(403, "Geen toegang")
    
    # Clear submission
    submission.url = None
    submission.status = "missing"
    log_submission_event(db, submission, current_user.id, "cleared")
    
    db.commit()
    return {"message": "Inlevering verwijderd"}
```

### 2.2 Teacher Endpoints

```python
@router.patch("/submissions/{submission_id}/status")
async def update_submission_status(
    submission_id: str,
    data: SubmissionStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update submission status (teacher only).
    Triggers notification to students.
    """
    submission = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.id == submission_id
    ).first()
    
    if not submission:
        raise HTTPException(404, "Inlevering niet gevonden")
    
    # Permission: teacher of this assessment
    assessment = db.query(ProjectAssessment).filter(
        ProjectAssessment.id == submission.project_assessment_id,
        ProjectAssessment.teacher_id == current_user.id,
        ProjectAssessment.school_id == current_user.school_id
    ).first()
    
    if not assessment and current_user.role != "ADMIN":
        raise HTTPException(403, "Alleen de docent kan status wijzigen")
    
    old_status = submission.status
    submission.status = data.status
    submission.last_checked_by_user_id = current_user.id
    submission.last_checked_at = datetime.now(timezone.utc)
    
    # Log event
    log_submission_event(
        db, submission, current_user.id, "status_changed",
        payload={"old_status": old_status, "new_status": data.status}
    )
    
    # Create notification for team members
    create_status_notification(db, submission, old_status, data.status)
    
    db.commit()
    return submission


@router.get("/assessments/{assessment_id}/submissions")
async def list_submissions_for_assessment(
    assessment_id: int,
    doc_type: Optional[str] = None,
    status: Optional[str] = None,
    missing_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all submissions for an assessment (teacher view).
    Supports filtering by doc_type, status, and missing_only.
    """
    # Permission check
    assessment = db.query(ProjectAssessment).filter(
        ProjectAssessment.id == assessment_id,
        ProjectAssessment.school_id == current_user.school_id
    ).first()
    
    if not assessment:
        raise HTTPException(404, "Assessment niet gevonden")
    
    if assessment.teacher_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(403, "Geen toegang")
    
    # Build query
    query = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.project_assessment_id == assessment_id
    )
    
    if doc_type:
        query = query.filter(AssignmentSubmission.doc_type == doc_type)
    
    if status:
        query = query.filter(AssignmentSubmission.status == status)
    
    if missing_only:
        query = query.filter(AssignmentSubmission.status == "missing")
    
    submissions = query.all()
    
    # Enrich with team data
    result = []
    for sub in submissions:
        team = db.query(ProjectTeam).filter(ProjectTeam.id == sub.project_team_id).first()
        members = db.query(ProjectTeamMember).filter(
            ProjectTeamMember.project_team_id == team.id
        ).all()
        
        result.append({
            "submission": sub,
            "team": team,
            "members": [m.user for m in members]
        })
    
    return result
```

---

## 🎨 UI/UX Verbeteringen

### 3.1 Frontend Structuur (Next.js App Router)

De app gebruikt al Next.js App Router met deze structuur:
```
frontend/src/app/(teacher)/teacher/project-assessments/[assessmentId]/
  ├── layout.tsx                    # Shared layout met tabs
  ├── overview/page.tsx             # Bestaande tab
  ├── edit/page.tsx                 # Rubric invullen (bestaande tab)
  ├── scores/page.tsx               # Bestaande tab
  ├── reflections/page.tsx          # Bestaande tab
  ├── external/page.tsx             # Bestaande tab
  ├── settings/page.tsx             # Bestaande tab
  └── submissions/page.tsx          # ← NIEUWE TAB
```

### 3.2 Tab Toevoegen aan Bestaande Navigatie

**File**: `frontend/src/components/teacher/project-assessments/ProjectAssessmentTabs.tsx`

```typescript
const tabs = [
  { id: "overview", label: "Overzicht", href: (id: string) => `/teacher/project-assessments/${id}/overview` },
  { id: "edit", label: "Rubric invullen", href: (id: string) => `/teacher/project-assessments/${id}/edit` },
  { id: "submissions", label: "Inleveringen", href: (id: string) => `/teacher/project-assessments/${id}/submissions` }, // ← NIEUW
  { id: "scores", label: "Scores", href: (id: string) => `/teacher/project-assessments/${id}/scores` },
  { id: "reflections", label: "Reflecties", href: (id: string) => `/teacher/project-assessments/${id}/reflections` },
  { id: "external", label: "Externe beoordeling", href: (id: string) => `/teacher/project-assessments/${id}/external` },
  { id: "settings", label: "Bewerken", href: (id: string) => `/teacher/project-assessments/${id}/settings` },
];
```

### 3.3 Student View - Inleveren Card

**Locatie**: Voeg toe aan bestaande student project view

**Optie 1**: Nieuwe tab in student assessment view
**Optie 2**: Card in project overview

Aanbeveling: **Optie 1** - consistent met teacher view

```typescript
// frontend/src/app/student/project-assessments/[assessmentId]/submissions/page.tsx

export default function StudentSubmissionsPage() {
  const { assessmentId } = useParams();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Load team's submissions
  useEffect(() => {
    loadSubmissions();
  }, [assessmentId]);
  
  const handleSubmit = async (docType: string, url: string) => {
    await submissionService.submit(assessmentId, teamId, docType, url);
    loadSubmissions();
  };
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Inleveren</h2>
      
      {/* Report submission */}
      <SubmissionCard
        docType="report"
        label="Verslag"
        submission={submissions.find(s => s.doc_type === 'report')}
        onSubmit={handleSubmit}
      />
      
      {/* Slides submission */}
      <SubmissionCard
        docType="slides"
        label="Presentatie"
        submission={submissions.find(s => s.doc_type === 'slides')}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
```

### 3.4 Teacher View - Submissions Tab

```typescript
// frontend/src/app/(teacher)/teacher/project-assessments/[assessmentId]/submissions/page.tsx

export default function SubmissionsOverviewPage() {
  const { assessmentId } = useParams();
  const [submissions, setSubmissions] = useState<SubmissionWithTeam[]>([]);
  const [filters, setFilters] = useState({
    docType: null,
    status: null,
    missingOnly: false
  });
  
  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4">
        <FilterChip
          label="Alleen ontbrekend"
          active={filters.missingOnly}
          onClick={() => setFilters({...filters, missingOnly: !filters.missingOnly})}
        />
        <FilterChip
          label="Actie vereist"
          active={filters.status === 'access_requested'}
          onClick={() => setFilters({...filters, status: 'access_requested'})}
        />
      </div>
      
      {/* Submissions Table */}
      <SubmissionsTable
        submissions={submissions}
        onStatusChange={handleStatusChange}
        onOpenRubric={(teamId) => router.push(`/teacher/project-assessments/${assessmentId}/edit?team=${teamId}`)}
      />
    </div>
  );
}
```

---

## 🔐 Security & Validation Verbeteringen

### 4.1 URL Validation (Server-Side)

```python
# app/api/v1/utils/url_validation.py

import re
from urllib.parse import urlparse

ALLOWED_HOSTS = [
    "sharepoint.com",
    "onedrive.com", 
    "office.com"  # Voor embedded viewer links
]

def validate_sharepoint_url(url: str) -> bool:
    """
    Validate that URL is a SharePoint/OneDrive link.
    Blocks XSS and other malicious inputs.
    """
    if not url:
        return False
    
    # Block javascript: and data: URLs
    if re.match(r'^(javascript|data|vbscript):', url, re.IGNORECASE):
        return False
    
    # Must be HTTPS
    if not url.startswith('https://'):
        return False
    
    # Parse URL
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    
    # Check hostname
    hostname = parsed.hostname
    if not hostname:
        return False
    
    # Must end with allowed host
    for allowed in ALLOWED_HOSTS:
        if hostname.endswith(allowed):
            return True
    
    return False
```

### 4.2 RBAC Integration met Bestaande Dependency Injection

De app gebruikt al `get_current_user` en role-based checks. Extend dit:

```python
# app/api/deps.py (existing file - add to it)

from app.infra.db.models import ProjectTeamMember

def require_team_member(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Dependency: require user to be member of team"""
    member = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.project_team_id == team_id,
        ProjectTeamMember.user_id == current_user.id
    ).first()
    
    if not member and current_user.role != "ADMIN":
        raise HTTPException(403, "Je bent geen lid van dit team")
    
    return member
```

---

## 📊 Notificaties Systeem

### 5.1 Notifications Table (if not exists)

```sql
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    recipient_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    type VARCHAR(50) NOT NULL,  -- 'submission_status_changed', etc.
    title VARCHAR(200) NOT NULL,
    body TEXT,
    link VARCHAR(500),  -- Deep link
    
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_user_id, read_at);
CREATE INDEX idx_notifications_school ON notifications(school_id);
```

### 5.2 Notification Creation Logic

```python
def create_status_notification(
    db: Session,
    submission: AssignmentSubmission,
    old_status: str,
    new_status: str
):
    """Create notification for all team members when status changes"""
    
    # Get team members
    members = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.project_team_id == submission.project_team_id
    ).all()
    
    # Map status to message
    messages = {
        "ok": ("✅ Inlevering akkoord", "De docent heeft je inlevering goedgekeurd."),
        "access_requested": ("🔒 Toegang vereist", "De docent kan je document niet openen. Pas de deelrechten aan."),
        "broken": ("🔗 Link werkt niet", "De ingeleverde link werkt niet. Lever opnieuw in.")
    }
    
    if new_status not in messages:
        return
    
    title, body = messages[new_status]
    
    # Create notification for each member
    for member in members:
        notification = Notification(
            school_id=submission.school_id,
            recipient_user_id=member.user_id,
            type="submission_status_changed",
            title=title,
            body=body,
            link=f"/student/project-assessments/{submission.project_assessment_id}/submissions"
        )
        db.add(notification)
    
    db.commit()
```

---

## 🧪 Testing Strategy

### 6.1 Backend Tests

Voeg toe aan bestaande test suite (`backend/tests/`):

```python
# tests/api/v1/test_submissions.py

def test_student_can_submit_for_own_team(client, db, test_student, test_team):
    """Test that student can submit for their own team"""
    response = client.post(
        f"/api/v1/submissions/assessments/{assessment_id}/teams/{team_id}",
        json={"doc_type": "report", "url": "https://sharepoint.com/doc"},
        headers=auth_headers(test_student)
    )
    assert response.status_code == 200

def test_student_cannot_submit_for_other_team(client, db, test_student, other_team):
    """Test that student cannot submit for team they're not member of"""
    response = client.post(
        f"/api/v1/submissions/assessments/{assessment_id}/teams/{other_team_id}",
        json={"doc_type": "report", "url": "https://sharepoint.com/doc"},
        headers=auth_headers(test_student)
    )
    assert response.status_code == 403

def test_url_validation_blocks_javascript(client, db, test_student, test_team):
    """Test that malicious URLs are blocked"""
    response = client.post(
        f"/api/v1/submissions/assessments/{assessment_id}/teams/{team_id}",
        json={"doc_type": "report", "url": "javascript:alert('xss')"},
        headers=auth_headers(test_student)
    )
    assert response.status_code == 400

def test_teacher_can_update_status(client, db, test_teacher, submission):
    """Test that teacher can update submission status"""
    response = client.patch(
        f"/api/v1/submissions/{submission.id}/status",
        json={"status": "ok"},
        headers=auth_headers(test_teacher)
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
```

---

## 📋 Gedetailleerde Implementatie Roadmap

### Sprint 1: Database & Backend Basis (Week 1)
**Doel**: Data model + CRUD endpoints

- [x] Alembic migration: `assignment_submissions` table
- [x] Alembic migration: `submission_events` table  
- [x] SQLAlchemy models: `AssignmentSubmission`, `SubmissionEvent`
- [x] Pydantic schemas voor API (create, update, response)
- [x] FastAPI router: `/api/v1/submissions`
  - POST `/assessments/{id}/teams/{id}` - submit link
  - DELETE `/submissions/{id}` - clear submission
  - GET `/assessments/{id}/submissions` - list for teacher
  - PATCH `/submissions/{id}/status` - update status
- [x] URL validation utility
- [x] Permission checks (team membership, teacher ownership)
- [x] Unit tests voor endpoints
- [x] Integration tests voor permissions

**Deliverable**: Working API endpoints met tests passing

---

### Sprint 2: Student UI - Inleveren (Week 2)
**Doel**: Students kunnen links inleveren

- [x] DTO's: `SubmissionDto`, `SubmissionCreateDto`
- [x] Service: `submissionService.ts` met API calls
- [x] Component: `SubmissionCard.tsx` (URL input + submit knop)
- [x] Component: `StatusBadge.tsx` (visualiseer status)
- [x] Page: `/student/project-assessments/[id]/submissions/page.tsx`
- [x] Form validation (client-side URL check)
- [x] Loading states & error handling
- [x] Success feedback ("Ingeleverd!")

**Deliverable**: Students kunnen inleveren via UI

---

### Sprint 3: Teacher UI - Inleveringen Tab (Week 3)
**Doel**: Docenten kunnen inleveringen bekijken en status wijzigen

- [x] Component: `SubmissionsTable.tsx` (tabel met teams + statuses)
- [x] Component: `SubmissionFilters.tsx` (filter chips)
- [x] Component: `StatusDropdown.tsx` (status wijzigen)
- [x] Page: `/teacher/project-assessments/[id]/submissions/page.tsx`
- [x] Update `ProjectAssessmentTabs.tsx` (nieuwe tab)
- [x] Realtime status updates (optimistic UI)
- [x] Bulk actions: "Ping team" button

**Deliverable**: Docenten hebben volledig overzicht

---

### Sprint 4: Split View Nakijkmodus (Week 4)
**Doel**: Rubric invullen + document pane

- [x] Component: `DocumentPane.tsx` (iframe/link + controls)
- [x] Component: `DocTypeToggle.tsx` (verslag/presentatie switch)
- [x] Component: `VersionDropdown.tsx` (v1, v2, v3)
- [x] Update: `/teacher/project-assessments/[id]/edit/page.tsx`
  - Add document pane (50% width)
  - Add resizable divider (optional maar nice-to-have)
  - Load submission data per team
- [x] localStorage: save pane width preference
- [x] "Open in tab" button (new window)

**Deliverable**: Docenten kunnen nakijken met doc + rubric side-by-side

---

### Sprint 5: Notificaties + Polish (Week 5)
**Doel**: Students krijgen feedback van docent

- [x] Backend: `notifications` table migration (if needed)
- [x] Backend: notification creation bij status change
- [x] Backend: GET `/api/v1/notifications` endpoint
- [x] Frontend: `NotificationBadge.tsx` in header
- [x] Frontend: `NotificationsList.tsx` dropdown
- [x] Frontend: Deep links naar submission page
- [x] Frontend: Mark as read functionality
- [x] Polish: Animations, transitions
- [x] Polish: Mobile responsiveness
- [x] Documentation: User guide voor studenten + docenten

**Deliverable**: Volledig werkend systeem met notificaties

---

## 🎯 Critical Success Factors

### Wat moet absoluut goed

1. **Multi-tenant isolation**: ELKE query MOET `school_id` filteren
2. **Permission checks**: Studenten kunnen ALLEEN inleveren voor hun eigen team
3. **URL validation**: Geen XSS, alleen HTTPS SharePoint/OneDrive
4. **Audit trail**: ALLE wijzigingen in `submission_events`
5. **Consistent UX**: Gebruik bestaande componenten en styling patterns

### Wat kan later

1. ❌ Graph API integratie (v2)
2. ❌ Automatische link check (v2)
3. ❌ Bestand preview in app (v2)
4. ❌ AI rubric suggesties (v3)
5. ❌ Versiegeschiedenis UI (kan simpel blijven in v1)

---

## 🔍 Waarom Deze Aanpassingen Beter Zijn

| Aspect | Oorspronkelijk Plan | Aangepast Plan | Waarom Beter |
|--------|---------------------|----------------|--------------|
| Table FK's | Generic `team_id` | `project_team_id` | Consistent met bestaande schema |
| Primary Keys | UUID | Serial integers | Consistent met bestaande tables |
| Multi-tenant | Niet expliciet | `school_id` overal | Vereist voor deze app |
| API structuur | Los ontwerp | Geïntegreerd in `/api/v1/` | Past in bestaande router structure |
| UI locatie | Nieuwe nav sectie | Tab binnen assessment | Logischer voor gebruikers |
| Permissions | Nieuw systeem | Gebruik `ProjectTeamMember` | Hergebruik bestaande logic |
| Notificaties | Nieuwe implementatie | Kan bouwen op bestaand patroon | Minder duplicate code |

---

## 🚦 Go/No-Go Checklist Voordat Je Start

Voordat je begint bouwen, zorg dat je hebt:

- [x] Database backup gemaakt
- [ ] Bestaande tests draaien zonder errors (`pytest` in backend/)
- [ ] Development environment werkt (DB + Backend + Frontend)
- [ ] Branch gemaakt vanaf main: `feature/submission-links-v1`
- [ ] Alembic migrations werken: `alembic upgrade head`
- [ ] Frontend build werkt: `npm run build` in frontend/

Als alles ✅ is: **GO FOR IT!** 🚀

---

## 📚 Referenties

### Bestaande Code Om Te Bestuderen

1. **Permissions pattern**: `backend/app/api/v1/routers/project_assessments.py`
2. **Multi-tenant queries**: `backend/app/api/v1/routers/evaluations.py`
3. **Tabs component**: `frontend/src/components/teacher/project-assessments/ProjectAssessmentTabs.tsx`
4. **Service pattern**: `frontend/src/services/project-assessment.service.ts`
5. **DTO pattern**: `frontend/src/dtos/project-assessment.dto.ts`

### Dependencies Already Available

✅ FastAPI (backend framework)
✅ SQLAlchemy (ORM)
✅ Alembic (migrations)
✅ Pydantic (validation)
✅ Next.js (frontend framework)
✅ Tailwind CSS (styling)

Geen nieuwe dependencies nodig voor v1! 🎉

---

## 💬 Final Thoughts

Je oorspronkelijke plan is **excellent**. De aanpassingen hier zijn vooral:

1. **Alignment** met bestaande database schema en naming conventions
2. **Integration** met bestaande auth/permissions systemen  
3. **Consistency** met huidige UI/UX patterns
4. **Security** hardening specifiek voor deze multi-tenant context

**Succes met de implementatie!** Laat weten als je vragen hebt tijdens het bouwen. 🚀
