# 🧭 Student Flow — MVP Issues

Milestone: **Student Flow (MVP)**  
Doel: Dashboard, open evaluaties, wizard (self → peer → overzicht → reflectie), resultaten (overzicht + detail).  
Gereed als: alle AC’s van issues 1–20 ✅

---

## A. Backend (FastAPI)

### 1) API — GET /student/evaluations/open
**Omschrijving:** Geef alle open evaluaties voor de ingelogde student, met voortgang.
**Acceptance Criteria**
- Alleen evaluaties waar student aan is toegewezen.
- Velden: `{id, title, deadline, status, progress{self, peer_done, peer_required, reflection}}`.
- Deadline en status filteren server-side (alleen `open`).
**Checklist**
- [ ] Router: `student.py`
- [ ] Service/query met joins op allocations/teams
- [ ] Pydantic schema’s
- [ ] 403 als niet ingelogd / ontbrekende header
- [ ] Tests

---

### 2) API — GET /student/evaluations/{id}
**Omschrijving:** Detail voor wizard: titel, rubric, peers, policy.
**Acceptance Criteria**
- 404 als niet toegewezen; 403 als gesloten.
**Checklist**
- [ ] Query rubric + criteria + peers
- [ ] Schema’s
- [ ] Tests

---

### 3) API — GET /student/evaluations/{id}/progress
**Omschrijving:** Geeft huidige stap + completions.
**Acceptance Criteria**
- Correcte step `'self'|'peer'|'summary'|'reflection'`.
**Checklist**
- [ ] Aggregaties
- [ ] Tests

---

### 4) API — POST /student/evaluations/{id}/self
**Omschrijving:** Slaat scores + comments per criterium op.
**Acceptance Criteria**
- Validatie: verplichte criteria, score 1–5.
- Idempotent.
**Checklist**
- [ ] Model/CRUD
- [ ] Transactie + upsert
- [ ] Tests

---

### 5) API — POST /student/evaluations/{id}/peer/{to_student_id}
**Omschrijving:** Scores + comments voor 1 peer.
**Acceptance Criteria**
- 400 bij niet-toegewezen peer.
- 409 als gesloten.
**Checklist**
- [ ] Authorisatie
- [ ] Upsert per criterium
- [ ] Tests

---

### 6) API — POST /student/evaluations/{id}/reflect
**Omschrijving:** Vrije tekst (min/max woorden optioneel).
**Acceptance Criteria**
- 400 als te kort/te lang.
- Meerdere saves overschrijven versie.
**Checklist**
- [ ] Validaties
- [ ] Tests

---

### 7) API — GET /student/results
**Omschrijving:** Lijst publiceerde resultaten per evaluatie.
**Acceptance Criteria**
- Velden: `{evaluation_id, title, published, final_grade, feedback_count, reflection_submitted}`.
- `final_grade` exact zoals grades-tabel (geen “-”).
**Checklist**
- [ ] Join met grades
- [ ] Tests

---

### 8) API — GET /student/results/{evaluation_id}
**Omschrijving:** Detail met cijfer, feedback, reflectie.
**Acceptance Criteria**
- Feedback gegroepeerd per criterium; labels self/peer.
- Alleen feedback bestemd voor student.
**Checklist**
- [ ] Query + group by criterium
- [ ] Tests

---

## B. Frontend (Next.js)

### 9) /student Dashboard
**Omschrijving:** Tegels: Open evaluaties, Laatste feedback, Laatste cijfer.
**Acceptance Criteria**
- Lege staten met duidelijke tekst.
- Links werken.
**Checklist**
- [ ] Page + server component
- [ ] Skeletons
- [ ] Componenten
- [ ] Tests

---

### 10) /student/evaluations lijst
**Omschrijving:** Kaarten met titel, deadline, status, voortgang.
**Acceptance Criteria**
- Filter “Alleen open”, “Deze week”.
**Checklist**
- [ ] Page + filters
- [ ] `EvaluationCard`
- [ ] Tests

---

### 11) Wizard layout + progress
**Omschrijving:** Progress indicator, route-guards per stap.
**Acceptance Criteria**
- Niet door naar peer zonder self compleet.
**Checklist**
- [ ] Layout + `useStepGuard`
- [ ] Persist stap
- [ ] Toasts

---

### 12) Wizard — Zelfbeoordeling
**Omschrijving:** Per criterium: score 1–5, toelichting, autosave.
**Acceptance Criteria**
- Validatiefouten inline.
**Checklist**
- [ ] `CriterionScoreList`
- [ ] Autosave
- [ ] API hooks
- [ ] Tests

---

### 13) Wizard — Peer-reviews
**Omschrijving:** Lijst peers; per peer rubric; status per peer.
**Acceptance Criteria**
- Duidelijke state “Nog X te doen”.
**Checklist**
- [ ] `PeerTabs`
- [ ] Save per peer
- [ ] Lock closed evals
- [ ] Tests

---

### 14) Wizard — Overzicht
**Omschrijving:** Samenvatting self + peer invoer.
**Acceptance Criteria**
- “Terug om te wijzigen” en “Verder naar reflectie”.
**Checklist**
- [ ] Read-only samenvatting
- [ ] Navigatieknoppen

---

### 15) Wizard — Reflectie
**Omschrijving:** Tekstveld met woordenteller, opslaan, indienen.
**Acceptance Criteria**
- Validatie min/max woorden.
**Checklist**
- [ ] `ReflectionEditor`
- [ ] Word count
- [ ] Tests

---

### 16) Resultaten — Overzicht + Detail
**Omschrijving:** Overzicht: titel, cijfer, feedbackcount. Detail: cijfer, feedback, reflectie.
**Acceptance Criteria**
- Eindcijfer exact zoals grades-tabel.
**Checklist**
- [ ] Overzichtstabel
- [ ] Detailweergave
- [ ] Tests

---

## C. Shared / Infra

### 17) Student API client
**Omschrijving:** Centraliseer fetchers met header-injectie.
**Acceptance Criteria**
- 401/403 nette melding.
**Checklist**
- [ ] `src/lib/api/student.ts`
- [ ] Error boundary
- [ ] Tests

---

### 18) Policies (status/deadline/allocations)
**Omschrijving:** Reusable checks voor open/closed/toegewezen.
**Checklist**
- [ ] `services/policy.py`
- [ ] Unit tests

---

### 19) Consistente eindcijferbron
**Omschrijving:** Resultaten gebruiken 1 bron.
**Acceptance Criteria**
- Nooit “-”; null ⇒ `published=false`.
**Checklist**
- [ ] Query herzien
- [ ] Tests

---

### 20) E2E — Student happy path
**Omschrijving:** Login, start evaluatie → self → peer → overzicht → reflectie → resultaten.
**Acceptance Criteria**
- Test draait headless en groen.
**Checklist**
- [ ] Playwright test
- [ ] Seed script
- [ ] CI job
