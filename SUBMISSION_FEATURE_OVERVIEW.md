# Inlever Feature - Plan Review & Implementatie Gids

## 📄 Documentatie Overzicht

Dit review bevat **3 documenten** die je helpen bij de implementatie van de inlever feature:

### 1. 📋 **SUBMISSION_FEATURE_SUMMARY.md** (START HIER)
- **Quick start gids** met belangrijkste wijzigingen
- Code voorbeelden (copy-paste ready)
- Security checklist
- Implementatie volgorde (5 sprints)
- **Lees dit eerst** voor een snel overzicht

### 2. 📚 **SUBMISSION_FEATURE_FEEDBACK.md** (Diepgaande Details)
- Volledige feedback op je oorspronkelijke plan
- Gedetailleerde database schema's
- Complete API endpoint specificaties
- Frontend component architectuur
- Testing strategie
- **Lees dit als referentie** tijdens implementatie

### 3. 📖 **Dit document** (SUBMISSION_FEATURE_OVERVIEW.md)
- Overzicht van het review proces
- Belangrijkste bevindingen
- Decision log
- Next steps

---

## 🎯 Belangrijkste Bevindingen

### ✅ Wat Goed Is aan Je Oorspronkelijke Plan

Je plan is **zeer goed doordacht** en volgt industry best practices:

1. **Duidelijke v1-scope**: Link-inleveren zonder Graph is een verstandige eerste stap
2. **Toekomstvast data model**: Kan later Graph API en AI ondersteunen
3. **Audit trail vanaf dag 1**: `submission_events` is essentieel voor compliance
4. **Team-gecentreerd**: Past perfect bij je project-based architecture
5. **Incrementele rollout**: 5 sprints met concrete deliverables
6. **Status-based workflow**: Logische flow van missing → submitted → ok/broken

**Conclusie**: Dit is een **professioneel en uitvoerbaar plan** 👍

---

## 🔧 Belangrijkste Aanpassingen

### 1. Database Schema Alignment ⚡ KRITIEK

**Probleem**: Oorspronkelijk plan gebruikte generieke naming die niet matcht met je codebase.

**Oplossing**:
```sql
-- ❌ NIET (oorspronkelijk)
team_id (fk naar generic "teams")
id UUID

-- ✅ WEL (aangepast)
project_team_id INTEGER REFERENCES project_teams(id)
school_id INTEGER NOT NULL  -- Multi-tenant support
id SERIAL  -- Consistent met andere tabellen
```

**Impact**: 
- ✅ Werkt met bestaande `project_teams` tabel (sinds migration pt_20251208_01)
- ✅ Multi-tenant isolation via `school_id` (vereist!)
- ✅ Consistent met bestaande naming conventions
- ✅ Hergebruikt bestaande `ProjectTeamMember` voor permissions

### 2. Frontend Integratie 🎨

**Probleem**: Oorspronkelijk plan suggereerde nieuwe sectie in navigatie.

**Oplossing**: **Tab binnen bestaande assessment detail pagina**

```
/teacher/project-assessments/[assessmentId]/
  ├── overview
  ├── edit (Rubric invullen)
  ├── submissions  ← NIEUWE TAB (hier!)
  ├── scores
  └── ...
```

**Waarom beter**:
- ✅ Logischer: submission hoort bij een assessment
- ✅ Consistent met huidige UX patterns
- ✅ Hergebruikt bestaande `ProjectAssessmentTabs` component
- ✅ Geen nieuwe navigatie sectie nodig

### 3. Permissions & Security 🔐

**Probleem**: Oorspronkelijk plan had geen specifieke multi-tenant strategie.

**Oplossing**: Hergebruik bestaande patterns:

```python
# Permission check via bestaande ProjectTeamMember tabel
is_member = db.query(ProjectTeamMember).filter(
    ProjectTeamMember.project_team_id == team_id,
    ProjectTeamMember.user_id == current_user.id
).first()

# Multi-tenant filtering (ALTIJD!)
.filter(Model.school_id == current_user.school_id)
```

**Waarom kritiek**:
- 🔒 Voorkomt cross-school data leaks
- ✅ Consistent met bestaande security model
- ✅ Minder code (hergebruik bestaand)

### 4. API Structuur 🚀

**Aangepast**: Gebruik bestaande FastAPI router structure

```
backend/app/api/v1/
  ├── routers/
  │   └── submissions.py     ← Nieuwe router
  ├── schemas/
  │   └── submissions.py     ← Nieuwe schema's
  └── deps.py                ← Hergebruik bestaande deps
```

**Voordeel**: Past perfect in bestaande architectuur

---

## 📊 Impact Assessment

### Wijzigingen t.o.v. Oorspronkelijk Plan

| Component | Wijziging | Impact | Prioriteit |
|-----------|-----------|--------|-----------|
| Database schema | Add `school_id`, use `project_team_id` | BREAKING | 🔴 KRITIEK |
| Primary keys | UUID → Serial Integer | Medium | 🟡 Belangrijk |
| UI locatie | Nieuwe nav → Tab binnen assessment | Low | 🟢 Nice-to-have |
| Permissions | Nieuw → Hergebruik bestaand | Low | 🟢 Efficiency |
| API structure | Standalone → Geïntegreerd | Low | 🟢 Consistency |

### Wat NIET Verandert

✅ Core functionaliteit (link-inleveren)
✅ Status workflow (missing → submitted → ok/broken)
✅ Audit trail (`submission_events`)
✅ Notificaties systeem
✅ v1 scope (geen Graph, geen bestandsupload)
✅ 5 sprint rollout plan

**Conclusie**: Wijzigingen zijn vooral **technische alignment**, niet scope changes.

---

## 🚀 Implementatie Roadmap (Aangepast)

### Sprint 1: Database & Backend Basis (Week 1) ⭐
**Doel**: Werkende API met correcte schema

**Deliverables**:
- [x] Alembic migration met `school_id` + `project_team_id`
- [x] SQLAlchemy models (AssignmentSubmission, SubmissionEvent)
- [x] Pydantic schemas (SubmissionCreate, SubmissionResponse)
- [x] FastAPI router `/api/v1/submissions`
  - POST submit link (with team membership check)
  - DELETE clear submission
  - GET list for assessment
  - PATCH update status
- [x] URL validation (alleen HTTPS SharePoint/OneDrive)
- [x] Unit tests (permissions, validation, CRUD)

**Acceptatie criteria**:
- ✅ Student kan inleveren voor eigen team via API
- ✅ Student kan NIET inleveren voor ander team
- ✅ Docent kan status wijzigen
- ✅ Alle queries filteren op `school_id`
- ✅ Tests passen (>90% coverage)

---

### Sprint 2: Student UI (Week 2)
**Doel**: Students kunnen via UI inleveren

**Deliverables**:
- [x] DTO's (`SubmissionDto`, `SubmissionCreateDto`)
- [x] Service (`submissionService.ts`)
- [x] Component `SubmissionCard.tsx`
- [x] Component `StatusBadge.tsx`
- [x] Page `/student/project-assessments/[id]/submissions/page.tsx`
- [x] Client-side validation (URL format)
- [x] Loading & error states
- [x] Success feedback (toast)

**Acceptatie criteria**:
- ✅ Student ziet inlever card per doc_type (verslag, presentatie)
- ✅ Student kan URL plakken en inleveren
- ✅ Student ziet status (missing, submitted, ok, broken)
- ✅ Error handling werkt (403, 400, etc.)

---

### Sprint 3: Teacher Overzicht (Week 3)
**Doel**: Docenten hebben volledig overzicht

**Deliverables**:
- [x] Component `SubmissionsTable.tsx`
- [x] Component `SubmissionFilters.tsx`
- [x] Component `StatusDropdown.tsx`
- [x] Page `/teacher/project-assessments/[id]/submissions/page.tsx`
- [x] Update `ProjectAssessmentTabs.tsx` (add tab)
- [x] Realtime status updates (optimistic UI)

**Acceptatie criteria**:
- ✅ Docent ziet tabel met alle teams + statuses
- ✅ Filters werken (missing only, action required)
- ✅ Status wijzigen werkt en update meteen UI
- ✅ CTA "Nakijken" → gaat naar edit tab

---

### Sprint 4: Split View Nakijkmodus (Week 4)
**Doel**: Rubric invullen + document naast elkaar

**Deliverables**:
- [x] Component `DocumentPane.tsx`
- [x] Component `DocTypeToggle.tsx` (verslag/presentatie)
- [x] Component `VersionDropdown.tsx` (v1, v2, v3)
- [x] Update `/teacher/project-assessments/[id]/edit/page.tsx`
  - Add document pane (50% width)
  - Load submission per team
  - Resizable divider (optioneel)
- [x] localStorage: save pane width

**Acceptatie criteria**:
- ✅ Split view: document 50% | rubric 50%
- ✅ Document pane toont ingeleverde URL (iframe/link)
- ✅ Toggle tussen verslag/presentatie werkt
- ✅ "Open in tab" button werkt
- ✅ Pane width bewaard in localStorage

---

### Sprint 5: Notificaties & Polish (Week 5)
**Doel**: Complete feature met feedback loop

**Deliverables**:
- [x] Migration `notifications` (if not exists)
- [x] Endpoint `GET /api/v1/notifications`
- [x] Notification creation bij status change
- [x] Component `NotificationBadge.tsx`
- [x] Component `NotificationsList.tsx`
- [x] Deep links naar submission page
- [x] Mark as read
- [x] Polish: animations, mobile responsive
- [x] Docs: user guide

**Acceptatie criteria**:
- ✅ Student krijgt notificatie bij status change
- ✅ Badge in header toont unread count
- ✅ Klikken op notificatie → deep link werkt
- ✅ Mark as read werkt
- ✅ Mobile layout OK

---

## 🔒 Security Requirements (MUST-HAVE)

### 1. Multi-Tenant Isolation ⚡ KRITIEK
```python
# ALTIJD filteren op school_id
.filter(AssignmentSubmission.school_id == current_user.school_id)
```

**Waarom**: Voorkomt data leaks tussen scholen.

### 2. URL Validation
```python
# Alleen HTTPS SharePoint/OneDrive
ALLOWED_HOSTS = ["sharepoint.com", "onedrive.com", "office.com"]

# Block XSS
if re.match(r'^(javascript|data|vbscript):', url):
    raise HTTPException(400, "Invalid URL")
```

**Waarom**: Voorkomt XSS en malicious links.

### 3. Permission Checks
```python
# Student: alleen eigen team
is_member = db.query(ProjectTeamMember).filter(...).first()

# Docent: alleen eigen assessments
is_teacher = assessment.teacher_id == current_user.id
```

**Waarom**: Voorkomt unauthorized access.

### 4. Audit Trail
```python
# Log ALLE wijzigingen
log_submission_event(db, submission, user_id, "submitted")
log_submission_event(db, submission, user_id, "status_changed", 
    payload={"old": old_status, "new": new_status})
```

**Waarom**: Compliance, debugging, support.

---

## 🧪 Testing Strategie

### Backend Tests (pytest)

**Must-have tests**:
```python
def test_student_can_submit_for_own_team()
def test_student_cannot_submit_for_other_team()
def test_url_validation_blocks_javascript()
def test_url_validation_allows_sharepoint()
def test_teacher_can_update_status()
def test_student_cannot_update_status()
def test_multi_tenant_isolation()  # KRITIEK!
def test_audit_trail_created()
```

**Run**:
```bash
cd backend
pytest tests/api/v1/test_submissions.py -v
```

### Frontend Tests (optioneel voor v1)

**Als je wil**:
- Jest unit tests voor components
- Playwright E2E tests voor happy path

**Maar**: Manual testing is OK voor v1.

---

## 📚 Referentie Bestanden

**Bestudeer deze bestanden voor patterns**:

### Backend
| File | Waarom |
|------|--------|
| `app/api/v1/routers/project_assessments.py` | Permissions pattern |
| `app/api/v1/routers/evaluations.py` | Multi-tenant queries |
| `app/api/deps.py` | Dependency injection |
| `app/infra/db/models.py` | SQLAlchemy model patterns |

### Frontend
| File | Waarom |
|------|--------|
| `src/components/teacher/project-assessments/ProjectAssessmentTabs.tsx` | Tab navigation |
| `src/services/project-assessment.service.ts` | Service pattern |
| `src/dtos/project-assessment.dto.ts` | DTO pattern |
| `src/app/(teacher)/teacher/project-assessments/[assessmentId]/layout.tsx` | Layout structure |

---

## 🎓 Lessons Learned & Best Practices

### 1. Multi-Tenant Apps
**Lesson**: Elke tabel MOET `school_id` hebben.
**Waarom**: Data isolation is niet optioneel.
**Actie**: Add to migration, add to models, add to queries.

### 2. Hergebruik Bestaande Tabellen
**Lesson**: `project_teams` bestaat al, gebruik het!
**Waarom**: Minder complexity, minder migraties.
**Actie**: Check bestaande schema VOORDAT je nieuwe tabellen maakt.

### 3. Consistent Naming
**Lesson**: App gebruikt `integer` PK's, niet UUIDs.
**Waarom**: Consistency maakt code voorspelbaar.
**Actie**: Volg bestaande conventions.

### 4. Security First
**Lesson**: URL validation is GEEN nice-to-have.
**Waarom**: XSS is reëel risico.
**Actie**: Validatie in backend (niet alleen frontend).

### 5. Audit Trail
**Lesson**: Events table is goud waard.
**Waarom**: Debugging, compliance, support.
**Actie**: Log ALLE state changes vanaf dag 1.

---

## 🚦 Go/No-Go Checklist

Voordat je Sprint 1 start:

**Environment**:
- [ ] Database draait (PostgreSQL 14+)
- [ ] Backend draait (`uvicorn app.main:app --reload`)
- [ ] Frontend draait (`npm run dev`)
- [ ] Bestaande tests passen (`pytest` in backend/)

**Setup**:
- [ ] Branch gemaakt: `feature/submission-links-v1`
- [ ] Migrations draaien: `alembic upgrade head`
- [ ] Dev data geseed: `python scripts/seed_demo_data.py`

**Documentatie gelezen**:
- [ ] `SUBMISSION_FEATURE_SUMMARY.md` - Quick start
- [ ] `SUBMISSION_FEATURE_FEEDBACK.md` - Diepgaande details
- [ ] Database schema begrijpen (vooral `project_teams`)

**Als alles ✅**: **START SPRINT 1!** 🚀

---

## 📞 Hulp Nodig?

### Documentatie
- 📋 Quick start: `SUBMISSION_FEATURE_SUMMARY.md`
- 📚 Diepgaande details: `SUBMISSION_FEATURE_FEEDBACK.md`
- 🏗️ Architecture: `docs/architecture.md`
- 🔐 Auth: `AZURE_AD_SETUP.md`

### API Docs
- Interactive: http://localhost:8000/docs (when running)
- ReDoc: http://localhost:8000/redoc

### Troubleshooting
**Q: Migration failed?**
A: Check `alembic current`, rollback met `alembic downgrade -1`

**Q: CORS errors?**
A: Check `CORS_ORIGINS` in `backend/app/core/config.py`

**Q: Tests falen?**
A: Run `pytest -v --tb=short` voor details

**Q: Frontend build errors?**
A: Clear `.next` folder: `rm -rf .next && npm run dev`

---

## ✨ Samenvatting

### Wat Je Hebt
- ✅ Excellent oorspronkelijk plan
- ✅ Duidelijke v1-scope (link-inleveren)
- ✅ Toekomstvast data model
- ✅ Incrementele rollout (5 sprints)

### Wat Dit Review Toevoegt
- ✅ Alignment met bestaande database schema
- ✅ Multi-tenant security hardening
- ✅ Integration met bestaande UI patterns
- ✅ Code voorbeelden (copy-paste ready)
- ✅ Security & testing checklists

### Next Steps
1. Lees `SUBMISSION_FEATURE_SUMMARY.md` (15 min)
2. Check Go/No-Go checklist
3. Start Sprint 1: Database & Backend
4. Use `SUBMISSION_FEATURE_FEEDBACK.md` als referentie

**Succes met de implementatie!** 🚀🎉

---

**Documentatie versie**: 1.0  
**Laatste update**: 2024-12-18  
**Auteur**: Copilot Code Review  
**Status**: Ready for Implementation ✅
