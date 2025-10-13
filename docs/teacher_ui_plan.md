# Teacher UI Plan — Team Evaluatie App

> Scope: docent/teacher-kant voor beheer van leerlingen, teams, rubrics en evaluaties; voortgang, inzage feedback & reflecties, en cijferpublicatie.  
> Frontend: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui.  
> Backend: FastAPI v1 (zie mapping onderaan).

---

## 1) Navigatiestructuur (Next.js routes)

```
/teacher
  ├─ /dashboard                      # Overzicht tegels + recente evaluaties
  ├─ /admin                          # Leerlingen/klassen/teams beheer
  │   ├─ /students                   # Tabel + CRUD + CSV-import/export
  │   ├─ /classes                    # Klassenlijst + teamgeneratie
  │   └─ /teams                      # Teamtabel + ledenwijzigingen
  ├─ /rubrics                        # Rubric-bibliotheek
  │   ├─ /create                     # Wizard nieuwe rubric
  │   └─ /[rubricId]/edit            # Editor bestaande rubric
  ├─ /evaluations                    # Lijst van evaluaties + filters
  │   ├─ /create                     # Wizard nieuwe evaluatie
  │   └─ /[evalId]
  │       ├─ /settings               # Instellingen (draft)
  │       ├─ /dashboard              # Voortgang, flags, heatmap
  │       ├─ /grades                 # GCF/SPR, suggesties, overrides, publish
  │       ├─ /feedback               # Inzage peer-opmerkingen (per leerling)
  │       └─ /reflections            # Inzage reflecties (per leerling)
  └─ /exports                        # Centrale plek om CSV/PDF te downloaden
```

**Router folders (app/):**
- `app/(teacher)/teacher/...` voor layout met vaste sidebar + header (Breadcrumbs, klasfilter).
- `app/(teacher)/teacher/(evaluations)/evaluations/...` voor nested routes.
- Gebruik `generateStaticParams` **niet** (alles authenticated & dynamisch).

---

## 2) UI-componenten (shadcn/ui + maatwerk)

**Layout & Navigatie**
- `TeacherShell` (sidebar, header, klas/team filters, user-menu)
- `PageHeader` (titel, sub, acties)
- `Toolbar` (SearchInput, Selects, DateRange, Buttons)

**Tabellen & Lijsten**
- `DataTable` (kolommen, sort, filter, pagination, CSV export)
- `StudentTable`, `TeamTable`, `ClassTable`
- `EvaluationCard`, `EvaluationTable`

**Forms/Wizards**
- `RubricForm` (titel, schaal, wegingen)
- `CriterionEditor` (naam, weight, descriptors per niveau)
- `EvaluationWizard` (stap 1–4)
  1) Meta: titel, klas
  2) Rubric: kiezen/dupliceren/nieuwe
  3) Instellingen: anonimiteit, peers, deadlines, min words, thresholds
  4) Review & Create

**Analytics & Cijfers**
- `KpiTiles` (gegeven/ontvangen/reflecties)
- `Heatmap` (criterium × niveau)
- `FlagsList` (SPR/GCF/outliers; klik → modal uitleg)
- `GradesTable` (peer_score, GCF, SPR, suggestie, groepscijfer, published, override-modal)

**Detail & Modals**
- `StudentDrawer` (snelle mutaties)
- `ImportCsvDialog` (mapping + preview + validatierapport)
- `ConfirmDialog` (publish, close, delete)
- `OverrideGradeDialog` (nieuw cijfer + reason, audit hint)

---

## 3) Schermschets per route (MVP)

### /teacher/dashboard
- **KPI-tiles**: % self-reviews ingediend, % peer-reviews ingediend, % reflecties ingediend.
- **Recent evaluations**: kaarten met status + snelkoppelingen (Dashboard/Grades/Feedback).

### /teacher/admin/students
- **DataTable** met kolommen: Naam, E-mail, Klas, Team, Status (actief/inactief), Acties (Bewerk/Archiveer).
- Acties: **Add student**, **CSV import**, **Export CSV**.
- **Bulk actions**: naar klas/team verplaatsen, archiveren.

### /teacher/admin/classes
- Lijst klassen + **Genereer teams** (grootte X) + **Export klaslijst**.

### /teacher/admin/teams
- Tabel teams → klik = **TeamDrawer** met leden, **Add/Remove**.

### /teacher/rubrics
- Kaarten: titel, schaal, #criteria, laatst bewerkt. Acties: **Dupliceer**, **Bewerk**.
- **Create**: `RubricForm` + `CriterionEditor` (drag/sort; descriptors per niveau).

### /teacher/evaluations
- Tabel: Titel, Klas, Rubric, Status, Deadlines (review/reflectie), Acties (Open, Dupliceer, Archiveer).
- Filter: Klas, Status, Periode.

### /teacher/evaluations/[evalId]/settings
- Alleen `status=draft` → bewerkbaar.  
- Tabs: **Algemeen** (titel/klas), **Rubric**, **Instellingen** (anonimiteit, peers, deadlines, min words, min/max CF, SPR smoothing, reviewer-rating), **Allocations** (auto/manual).

### /teacher/evaluations/[evalId]/dashboard
- **KPI-tiles**, **FlagsList**, **Heatmap** (optioneel later), **Teamtabel** met voortgang.
- CSV: dashboard.csv, flags.csv, matrix.csv.

### /teacher/evaluations/[evalId]/grades
- **GradesTable** met kolommen: Leerling | Peer score | GCF | SPR | Suggestie | **Groepscijfer** | Resultaat | Override.
- Acties: **Publish** (confirm → audit), **Export cijfers**.

### /teacher/evaluations/[evalId]/feedback
- Select **Leerling** → lijst van ontvangen comments per criterium (anoniem/pseudoniem conform instelling).
- **Export feedback** (CSV/PDF).

### /teacher/evaluations/[evalId]/reflections
- Tabel: Leerling | Words | SubmittedAt | Snippet | Actie (Bekijk).  
- **Export reflecties** (CSV).

---

## 4) State & data
- **Zustand** of React Query (aanrader) voor server-state (caching, revalidation).
- **Optimistic UI** bij eenvoudige PATCH/PUT (bv. student wijzigen).
- **URL-synced filters** (query params) voor deelbare views.
- **Klas-/team-context** (ContextProvider) boven `/teacher/*`.

---

## 5) API mapping (huidige v1 endpoints)

> Dev-auth via `X-User-Email` (MVP). SSO later.

- **Rubrics**
  - `GET /api/v1/rubrics`
  - `POST /api/v1/rubrics`
  - `PUT /api/v1/rubrics/{id}`
  - `GET /api/v1/rubrics/{id}/criteria`
  - `POST /api/v1/rubrics/{id}/criteria`

- **Evaluations**
  - `GET /api/v1/evaluations` (filters: class/course_id, status)
  - `POST /api/v1/evaluations`
  - `PUT /api/v1/evaluations/{id}`
  - `POST /api/v1/allocations/auto`

- **Scores & Dashboard**
  - `GET /api/v1/dashboard/evaluation/{id}`
  - `GET /api/v1/dashboard/evaluation/{id}/matrix`
  - `GET /api/v1/flags/evaluation/{id}`
  - `GET /api/v1/flags/explain`

- **Grades**
  - `GET /api/v1/grades?evaluation_id={id}`
  - `POST /api/v1/grades/preview?evaluation_id={id}`
  - `POST /api/v1/grades/publish` (payload met overrides, groepscijfer)
  
- **Exports (CSV)**
  - `GET /api/v1/dashboard/evaluation/{id}/export.csv`
  - `GET /api/v1/dashboard/evaluation/{id}/matrix.csv`
  - `GET /api/v1/flags/evaluation/{id}/export.csv`

> NB: Studenten/klassen/teams endpoints hangen af van jouw implementatie; voeg `/students`, `/classes`, `/groups` (CRUD) toe waar nodig.

---

## 6) RBAC & toegangscontrole
- Alleen **role=teacher/admin**: alle `/teacher/*` routes.
- API-calls bevatten `school_id` scoping.
- Frontend: hide/disable acties op basis van status (bv. settings alleen bij draft).

---

## 7) Validatie & UX-richtlijnen
- Inline form-validatie; duidelijk foutlabel + aria-describedby.
- Confirm-dialog bij **Publish**, **Close**, **Delete**.
- Autosave bij rubric/evaluation wizard (debounced).
- Loading/skeleton states voor elke tabel/pagina.
- Keyboard-navigatie + focus-states.

---

## 8) Implementatievolgorde (MVP sprint)

- [ ] **Shell & routing** (`/teacher` layout, sidebar, header)
- [ ] **Evaluations list** + filters + link naar create
- [ ] **Evaluation create wizard** (stap 1–4)
- [ ] **Evaluation dashboard** (KPI, flags, exports)
- [ ] **Grades page** (suggesties, override, publish)
- [ ] **Admin/students** (tabel + basic CRUD)
- [ ] **Feedback & reflections views** (read-only + export)
- [ ] **Rubrics list + edit/create** (basis zonder descriptors)
- [ ] **CSV import/export** (students) + validatierapport
- [ ] **Access control** (role-guard, 403 handling)

**Later (fase 2–3):**
- [ ] Heatmap per criterium
- [ ] Reviewer-kwaliteit & comment-threads
- [ ] Audio-uploads, PDF-exports
- [ ] Meertaligheid (NL/EN)
- [ ] SSO (Microsoft) + auditlog

---

## 9) Testplan (kort)
- **Unit**: helpers (weighing, GCF/SPR weergave, form validators).
- **Integration**: API-contract (schemas) met MSW of pact tests.
- **E2E (Playwright)**: docent maakt evaluatie → leerlingen vullen → docent publiceert.

---

## 10) Design hints
- Cards met `rounded-2xl`, zachte `shadow`, voldoende `p-4 / p-6`.
- Consistente **primary actions rechtsboven**; destructives in ellipsis menu.
- Tabellen met sticky header, `min-w-[900px]`, horizontale scroll op mobiel.
- Gebruik **toasts** voor succes/fout, **modals** spaarzaam.

---

### Snippets (TypeScript helpers)

```ts
// lib/grades.ts
export type GradeRow = {
  studentId: number;
  peerScore: number;
  gcf: number;
  spr: number;
  suggestion: number;
  groupGrade?: number;
  published?: number;
};

export function computeResult(row: GradeRow, groupGrade: number) {
  // Frontend-weergave; echte berekening server-side leidend
  const res = groupGrade * row.gcf * Math.max(0.9, Math.min(1.1, row.spr));
  return Math.round(res * 10) / 10;
}
```

```ts
// lib/filters.ts
export function withUrlParams<T extends Record<string, any>>(base: string, params: T) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && `${v}`.length) q.set(k, String(v));
  });
  return `${base}?${q.toString()}`;
}
```

---

## 11) Open punten / TODO API
- [ ] CRUD endpoints voor **students/classes/groups** (CSV import/export incl.).
- [ ] `GET /api/v1/evaluations/{id}/feedback` (samengevoegd comment-overzicht).
- [ ] `GET /api/v1/evaluations/{id}/reflections` (lijst + detail).
- [ ] `POST /api/v1/rubrics/{id}/duplicate`.
- [ ] `POST /api/v1/evaluations/{id}/close` en `/reopen`.
- [ ] `GET /api/v1/grades/preview?evaluation_id=...` (reeds aanwezig) — UI koppelen.
- [ ] Audit trail (server) bij publish/override (optioneel).

---

**Klaar voor implementatie.** Start met de Shell & Evaluations-list; daarna wizard en dashboard. Zodra CRUD voor students klaar is, kun je CSV-import en teambeheer toevoegen.
