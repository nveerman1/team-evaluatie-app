# Submission Feature - Samenvatting & Belangrijkste Aanpassingen

## 🎯 Executive Summary

Je oorspronkelijke plan voor de inlever feature is **uitstekend doordacht**. Dit document bevat de belangrijkste aanpassingen om het perfect te laten aansluiten bij je bestaande codebase.

**Volledige feedback**: Zie `SUBMISSION_FEATURE_FEEDBACK.md`

---

## 🔑 Belangrijkste Wijzigingen

### 1. Database Schema Aanpassingen

#### ❌ Oorspronkelijk
```sql
project_team_id (fk) ← verwijst naar algemene "team"
id (uuid)
```

#### ✅ Aangepast voor Bestaande Structuur
```sql
-- Multi-tenant support toevoegen
school_id INTEGER NOT NULL REFERENCES schools(id)

-- Gebruik bestaande project_teams tabel
project_team_id INTEGER NOT NULL REFERENCES project_teams(id)

-- Gebruik integer PK's (consistent met rest van app)
id SERIAL PRIMARY KEY  -- niet UUID
```

**Waarom**: 
- Alle tabellen in je app hebben `school_id` (multi-tenant)
- Je gebruikt al `project_teams` tabel (sinds pt_20251208_01 migration)
- App gebruikt serial integers, geen UUIDs

### 2. Bestaande Relaties Hergebruiken

Je hebt al deze tabellen:
- ✅ `project_teams` - team snapshots per project
- ✅ `project_team_members` - wie zit in welk team
- ✅ `project_assessments` - heeft al `project_team_id` FK

**Voordeel**: Permissions zijn simpel:
```python
# Check: is user lid van dit team?
member = db.query(ProjectTeamMember).filter(
    ProjectTeamMember.project_team_id == team_id,
    ProjectTeamMember.user_id == current_user.id
).first()
```

### 3. Frontend Integratie

#### ❌ Oorspronkelijk Plan
Nieuwe sectie in linker navigatie

#### ✅ Beter voor Deze App
Nieuwe tab binnen bestaande assessment detail pagina

**Locatie**:
```
/teacher/project-assessments/[assessmentId]/
  ├── overview
  ├── edit (Rubric invullen)
  ├── submissions  ← NIEUW
  ├── scores
  ├── reflections
  ├── external
  └── settings
```

**Waarom**: 
- Logischer voor gebruikers (submission hoort bij assessment)
- Past in bestaande tab navigatie (`ProjectAssessmentTabs.tsx`)
- Consistent met huidige UX

### 4. API Structuur

#### Gebruik Bestaande Patterns
- ✅ Routers in `/app/api/v1/routers/submissions.py`
- ✅ Schemas in `/app/api/v1/schemas/submissions.py`
- ✅ Dependencies: `get_current_user`, `get_db` (already exists)
- ✅ Multi-tenant: filter op `current_user.school_id`

---

## 🚀 Snelle Start Checklist

Voordat je begint met implementeren:

### Database
```bash
cd backend

# 1. Maak migration aan
alembic revision --autogenerate -m "add assignment submissions"

# 2. Voeg school_id toe aan submission tables
# 3. Gebruik project_team_id FK (niet team_id)
# 4. Gebruik INTEGER primary keys (niet UUID)

# 4. Run migration
alembic upgrade head
```

### Backend API
```bash
# 1. Maak bestanden:
touch app/api/v1/routers/submissions.py
touch app/api/v1/schemas/submissions.py
touch app/api/v1/utils/url_validation.py

# 2. Voeg toe aan router registry:
# In app/api/v1/__init__.py
from app.api.v1.routers import submissions
app.include_router(submissions.router)
```

### Frontend
```bash
cd frontend

# 1. Maak bestanden:
mkdir -p src/app/\(teacher\)/teacher/project-assessments/\[assessmentId\]/submissions
touch src/app/\(teacher\)/teacher/project-assessments/\[assessmentId\]/submissions/page.tsx
touch src/services/submission.service.ts
touch src/dtos/submission.dto.ts

# 2. Update tabs component:
# Edit: src/components/teacher/project-assessments/ProjectAssessmentTabs.tsx
# Add: { id: "submissions", label: "Inleveringen", ... }
```

---

## 🔐 Security Checklist

**KRITIEK - moet geïmplementeerd**:

1. ✅ **Multi-tenant isolation**: Alle queries filteren op `school_id`
   ```python
   .filter(AssignmentSubmission.school_id == current_user.school_id)
   ```

2. ✅ **URL validation**: Alleen HTTPS SharePoint/OneDrive
   ```python
   ALLOWED_HOSTS = ["sharepoint.com", "onedrive.com", "office.com"]
   # Block: javascript:, data:, vbscript:
   ```

3. ✅ **Permission checks**: Studenten alleen voor eigen team
   ```python
   is_member = db.query(ProjectTeamMember).filter(
       ProjectTeamMember.project_team_id == team_id,
       ProjectTeamMember.user_id == current_user.id
   ).first()
   ```

4. ✅ **Audit trail**: Log ALLE wijzigingen in `submission_events`

---

## 📊 Data Model - Complete Schema

```sql
-- TABEL 1: Submissions
CREATE TABLE assignment_submissions (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Foreign keys
    project_assessment_id INTEGER NOT NULL REFERENCES project_assessments(id) ON DELETE CASCADE,
    project_team_id INTEGER NOT NULL REFERENCES project_teams(id) ON DELETE RESTRICT,
    
    -- Submission data
    doc_type VARCHAR(20) NOT NULL CHECK (doc_type IN ('report', 'slides', 'attachment')),
    url TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'missing',
    version_label VARCHAR(50),
    
    -- Audit
    submitted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ,
    last_checked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    last_checked_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE (project_assessment_id, project_team_id, doc_type, version_label)
);

-- TABEL 2: Event Log
CREATE TABLE submission_events (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    submission_id INTEGER NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
    actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABEL 3: Notifications (optioneel - check of bestaat)
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    recipient_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT,
    link VARCHAR(500),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDICES
CREATE INDEX idx_submissions_assessment ON assignment_submissions(project_assessment_id);
CREATE INDEX idx_submissions_team ON assignment_submissions(project_team_id);
CREATE INDEX idx_submissions_status ON assignment_submissions(project_assessment_id, status);
CREATE INDEX idx_submissions_school ON assignment_submissions(school_id);
CREATE INDEX idx_submission_events_submission ON submission_events(submission_id);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_user_id, read_at);
```

---

## 🎯 Implementatie Volgorde (5 Sprints)

### Sprint 1: Backend Basis ✅
- Migrations (submissions + events)
- SQLAlchemy models
- FastAPI endpoints (CRUD)
- Permissions + URL validation
- Unit tests

**Output**: Working API

### Sprint 2: Student UI ✅
- Submission service
- Submission card component
- Student submissions page
- Form validation

**Output**: Students kunnen inleveren

### Sprint 3: Teacher Overzicht ✅
- Submissions table component
- Filters (missing, actie vereist)
- Status dropdown
- Teacher submissions page
- Update tabs

**Output**: Docenten zien alle inleveringen

### Sprint 4: Split View Nakijken ✅
- Document pane component
- Update rubric invullen page
- Resizable layout
- Open in tab

**Output**: Nakijken met document + rubric

### Sprint 5: Notificaties ✅
- Notification system
- Badge in header
- Deep links
- Polish + docs

**Output**: Complete feature met notificaties

---

## 📖 Code Voorbeelden

### Backend Endpoint Voorbeeld
```python
@router.post("/assessments/{assessment_id}/teams/{team_id}")
async def submit_link(
    assessment_id: int,
    team_id: int,
    data: SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Check team membership
    is_member = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.project_team_id == team_id,
        ProjectTeamMember.user_id == current_user.id
    ).first()
    if not is_member:
        raise HTTPException(403, "Geen toegang")
    
    # 2. Validate URL
    if not validate_sharepoint_url(data.url):
        raise HTTPException(400, "Alleen SharePoint links toegestaan")
    
    # 3. Create/update submission
    submission = AssignmentSubmission(
        school_id=current_user.school_id,  # BELANGRIJK
        project_assessment_id=assessment_id,
        project_team_id=team_id,
        doc_type=data.doc_type,
        url=data.url,
        status="submitted",
        submitted_by_user_id=current_user.id,
        submitted_at=datetime.now(timezone.utc)
    )
    db.add(submission)
    
    # 4. Log event
    log_event(db, submission, current_user.id, "submitted")
    
    db.commit()
    return submission
```

### Frontend Component Voorbeeld
```typescript
// SubmissionCard.tsx
export function SubmissionCard({ 
  docType, 
  label, 
  submission, 
  onSubmit 
}: Props) {
  const [url, setUrl] = useState(submission?.url || "");
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit(docType, url);
      toast.success("Ingeleverd!");
    } catch (err) {
      toast.error("Inleveren mislukt");
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="border rounded-lg p-4 space-y-4">
      <h3 className="font-semibold">{label}</h3>
      
      {submission && (
        <StatusBadge status={submission.status} />
      )}
      
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Plak hier je SharePoint link..."
        className="w-full px-3 py-2 border rounded"
      />
      
      <button
        onClick={handleSubmit}
        disabled={loading || !url}
        className="btn btn-primary"
      >
        {loading ? "Bezig..." : "Inleveren"}
      </button>
      
      {url && (
        <a 
          href={url} 
          target="_blank" 
          className="text-sm text-blue-600"
        >
          Open link in nieuwe tab →
        </a>
      )}
    </div>
  );
}
```

---

## 🐛 Mogelijke Valkuilen

### ❌ Vergeet Niet

1. **School ID**: Elke query MOET filteren op `current_user.school_id`
2. **Updated_at trigger**: PostgreSQL trigger voor auto-update (of in SQLAlchemy)
3. **Transaction rollback**: Bij errors in notification creation
4. **Deep copy**: Bij version creation (copy URL, niet reference)

### ✅ Best Practices

1. **Optimistic UI**: Update UI meteen, rollback bij error
2. **Loading states**: Disable buttons tijdens submit
3. **Error messages**: Specifiek en actionable ("Link werkt niet" + "Wat te doen")
4. **Accessibility**: Keyboard navigation, screen reader support

---

## 📚 Referenties in Codebase

**Bestudeer deze bestanden voor patterns**:

### Backend
- `backend/app/api/v1/routers/project_assessments.py` - Permissions pattern
- `backend/app/api/v1/routers/evaluations.py` - Multi-tenant queries
- `backend/app/api/deps.py` - Dependency injection
- `backend/app/infra/db/models.py` - SQLAlchemy model patterns

### Frontend  
- `frontend/src/components/teacher/project-assessments/ProjectAssessmentTabs.tsx` - Tab navigation
- `frontend/src/services/project-assessment.service.ts` - Service pattern
- `frontend/src/dtos/project-assessment.dto.ts` - DTO pattern
- `frontend/src/app/(teacher)/teacher/project-assessments/[assessmentId]/layout.tsx` - Layout structure

---

## ✨ Wat Maakt Dit Plan Goed

1. **✅ Incrementeel**: v1 is klein en werkbaar, v2/v3 zijn uitbreidingen
2. **✅ Toekomstvast**: Data model kan Graph/AI ondersteunen
3. **✅ Duidelijke scope**: Link-inleveren, geen bestandsupload in v1
4. **✅ Audit trail**: Events vanaf dag 1
5. **✅ User feedback**: Notificaties bij status changes
6. **✅ Security**: URL validation, permissions checks

## 🎯 Belangrijkste Verschillen met Oorspronkelijk Plan

| Aspect | Oorspronkelijk | Aangepast | Impact |
|--------|---------------|-----------|--------|
| Primary keys | UUID | Integer (serial) | Consistent met codebase |
| Foreign keys | `team_id` | `project_team_id` | Correct gebruik bestaande tabel |
| Multi-tenant | Impliciet | Expliciet `school_id` | Vereist voor deze app |
| UI locatie | Nieuwe nav | Tab in assessment | Logischer voor gebruikers |
| Permissions | Nieuw systeem | Hergebruik `ProjectTeamMember` | Minder code, consistent |

---

## 🚦 Ready to Start?

Voordat je begint:

- [ ] Backup database
- [ ] Bestaande tests draaien (`pytest`)
- [ ] Dev environment werkt (DB + API + Frontend)
- [ ] Feature branch: `feature/submission-links-v1`
- [ ] Lees `SUBMISSION_FEATURE_FEEDBACK.md` volledig door

**Als alles OK**: Start met Sprint 1! 🚀

---

## 💬 Hulp Nodig?

- 📖 Volledige feedback: `SUBMISSION_FEATURE_FEEDBACK.md`
- 🏗️ Architecture: `docs/architecture.md`
- 🔐 Auth setup: `AZURE_AD_SETUP.md`
- 📚 API docs: http://localhost:8000/docs (when running)

**Succes!** 🎉
