# Projectplan → CMS Koppeling & Deelproject Aanmaken

**Feature:** Connect projectplan opdrachtgever data to the CMS and auto-create subprojects on GO  
**Date:** 2026-02-20  
**Migration:** `f3a9c1d2e4b6_add_client_link_to_sections`

---

## Overzicht

Dit document beschrijft twee samenhangende features die de kloof overbruggen tussen de door studenten ingevulde projectplannen en het CMS van de docent:

- **Feature A** — Een docent kan de opdrachtgever die studenten invullen in hun projectplan koppelen aan een bestaand CMS `Client`-record, of er direct een nieuw record van aanmaken.
- **Feature B** — Zodra een team een GO-status krijgt, wordt automatisch een `Subproject` (deelproject) aangemaakt dat zichtbaar is op de Projecten-pagina van de docent.

### Overzicht datavloeien

```
Student vult projectplan in
  └── Sectie "Opdrachtgever": organisatie, contact, e-mail, telefoon
          │
          ▼ (docent bekijkt het projectplan)
  Koppelbanner verschijnt:
  ├── Overeenkomst gevonden  →  "Koppelen aan [naam]?"  →  client_id opslaan
  └── Geen overeenkomst      →  "Nieuwe opdrachtgever aanmaken?"  →  Client aanmaken + client_id opslaan
          │
          ▼ (docent geeft GO)
  Subproject wordt automatisch aangemaakt
  └── Zichtbaar op Projecten-pagina → Bovenbouw-tab → Deelprojecten-tabel
```

---

## Feature A: Opdrachtgever koppelen

### Datahmodel

Het `ProjectPlanSection`-model heeft nu een nieuw nullable foreign-key veld:

```
ProjectPlanSection
├── key = "client"
├── client_organisation  (tekst ingevuld door student)
├── client_contact
├── client_email
├── client_phone
├── client_description
└── client_id → clients.id   ← NIEUW: koppeling naar CMS-record
```

Het `Client`-model heeft nu een unique constraint op `(school_id, organization)` om exacte duplicaten per school te voorkomen.

### API-eindpunten

#### 1. Overeenkomsten ophalen

```http
GET /api/v1/projectplans/{projectplan_id}/teams/{team_id}/suggest-client
```

Leest de organisatienaam en het e-mailadres uit de "client"-sectie van het team en zoekt naar overeenkomende CMS-klanten via een hoofdletterongevoelige LIKE-zoekopdracht.

**Respons:**
```json
[
  {
    "id": 42,
    "organization": "ACME BV",
    "contact_name": "Jan Jansen",
    "email": "info@acme.nl",
    "phone": "0612345678",
    "match_score": 1.0
  },
  {
    "id": 17,
    "organization": "ACME International",
    "email": "hello@acme.nl",
    "match_score": 0.8
  }
]
```

**Scoreberekening:**

| Situatie | Score |
|----------|-------|
| Exacte naam (hoofdletterongevoelig) | 1,0 |
| Naam begint met of bevat zoeknaam | 0,9 |
| Gedeeltelijke naam-overeenkomst | 0,7 |
| + e-mailadres komt ook overeen (niet-exacte naam) | +0,1 (max 1,0) |

**Toegang:** Alleen docenten en admins. Retourneert een lege lijst als de sectie geen organisatienaam bevat of als de koppeling al is gemaakt.

#### 2. Opdrachtgever koppelen of aanmaken

```http
POST /api/v1/projectplans/{projectplan_id}/teams/{team_id}/link-client
Content-Type: application/json
```

**Koppelen aan bestaande klant:**
```json
{
  "action": "match_existing",
  "client_id": 42
}
```

**Nieuwe klant aanmaken:**
```json
{
  "action": "create_new"
}
```

Bij `create_new` worden de gegevens uit de sectie als volgt overgezet naar het Client-model:

| Sectieveld | Client-veld |
|------------|-------------|
| `client_organisation` | `organization` |
| `client_contact` | `contact_name` |
| `client_email` | `email` |
| `client_phone` | `phone` |

**Respons (beide acties):**
```json
{
  "client_id": 42,
  "organization": "ACME BV",
  "contact_name": "Jan Jansen",
  "email": "info@acme.nl",
  "phone": "0612345678"
}
```

**Foutgevallen:**

| HTTP-code | Situatie |
|-----------|----------|
| 400 | `match_existing` zonder `client_id`, of `create_new` zonder organisatienaam |
| 404 | Projectplan, team, sectie, of klant niet gevonden |
| 409 | `create_new` maar er bestaat al een klant met dezelfde naam in deze school |

> **Opmerking over gelijktijdigheid:** De 409-fout bij `create_new` wordt ook correct afgehandeld als twee gelijktijdige verzoeken de duplicaatcontrole doorkomen — de database unique constraint gooit een `IntegrityError` die netjes wordt opgevangen.

### UI-gedrag (projectplanpagina)

Wanneer een docent de detail-pagina van een projectplan bekijkt (`/teacher/projectplans/{id}?tab=projectplannen`), en er een team is geselecteerd waarvan de opdrachtgever-sectie is ingevuld:

**Nog niet gekoppeld:**
```
┌─────────────────────────────────────────────────────────┐
│ ⚠ Opdrachtgever koppelen aan CMS?                       │
│                                                         │
│  ACME BV · info@acme.nl  (100%)  [Koppelen]             │
│  ACME International      (80%)   [Koppelen]             │
│                                                         │
│  Toch als nieuwe opdrachtgever aanmaken                 │
└─────────────────────────────────────────────────────────┘
```

Als er geen overeenkomst is gevonden:
```
┌─────────────────────────────────────────────────────────┐
│ ⚠ Opdrachtgever koppelen aan CMS?                       │
│                                                         │
│  Geen overeenkomst gevonden.                            │
│  [Nieuwe opdrachtgever aanmaken in CMS]                 │
└─────────────────────────────────────────────────────────┘
```

**Na koppeling:**
```
┌─────────────────────────────────────────────────────────┐
│ ✓ Gekoppeld aan CMS opdrachtgever (ID: 42)              │
└─────────────────────────────────────────────────────────┘
```

De koppelstatus wordt automatisch geladen als het team verandert. De suggesties worden opnieuw opgehaald via `GET suggest-client` telkens wanneer het geselecteerde team of de tab verandert.

---

## Feature B: Deelproject automatisch aanmaken bij GO

### Wanneer dit plaatsvindt

Elke keer dat een docent of admin een team-status wijzigt naar `"go"` via:

```http
PATCH /api/v1/projectplans/{projectplan_id}/teams/{team_id}
{
  "status": "go"
}
```

### Wat er aangemaakt wordt

Een `Subproject`-record met:

| Veld | Waarde |
|------|--------|
| `school_id` | school van de ingelogde gebruiker |
| `project_id` | project van het projectplan |
| `client_id` | `client_id` uit de opdrachtgever-sectie (null als nog niet gekoppeld) |
| `title` | teamtitel als ingesteld, anders `"Deelproject Team {team_number}"` |
| `team_number` | teamnummer van het projectteam |

### Idempotentie

Als er al een `Subproject` bestaat voor dezelfde combinatie van `project_id` + `team_number`, wordt er geen nieuw record aangemaakt. Het is daardoor veilig om een team meerdere keren op GO te zetten (bijv. na een heroverweging van no-go → go).

### Zichtbaarheid in de UI

Automatisch aangemaakte deelprojecten verschijnen direct in de bestaande Deelprojecten-tabel op de Projecten-pagina (`/teacher/projects` → Bovenbouw-tab → deelprojecten-rij in de uitklapbare tabel). Er zijn geen extra frontend-wijzigingen nodig.

### `client_id` bijwerken na GO

Als een docent Feature A uitvoert *nadat* het team al op GO staat (bijv. de klant wordt later gekoppeld), wordt het bestaande `Subproject`-record **niet** automatisch bijgewerkt. In dat geval kan het subproject handmatig worden bijgewerkt via de bestaande `SubprojectModal` op de Projecten-pagina.

---

## Databasewijzigingen

### Migratie: `f3a9c1d2e4b6`

```sql
-- Nieuw veld op project_plan_sections
ALTER TABLE project_plan_sections
    ADD COLUMN client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX ix_pps_client_id ON project_plan_sections (client_id);

-- Unieke beperking op clients om exacte duplicaten per school te voorkomen
ALTER TABLE clients
    ADD CONSTRAINT uq_client_school_org UNIQUE (school_id, organization);
```

**Terugdraaien:**
```sql
ALTER TABLE clients DROP CONSTRAINT uq_client_school_org;
DROP INDEX ix_pps_client_id;
ALTER TABLE project_plan_sections DROP COLUMN client_id;
```

> **Let op bij het terugdraaien:** Als er al klanten in de database staan met dezelfde `(school_id, organization)`-combinatie, zal het opnieuw toepassen van de migratie mislukken. Verwijder duplicaten handmatig vóór het toepassen.

---

## Frontend-bestanden gewijzigd

| Bestand | Wijziging |
|---------|-----------|
| `frontend/src/dtos/projectplan.dto.ts` | `client_id` toegevoegd aan `ProjectPlanSection`; `LinkClientRequest`, `SuggestClientItem`, `LinkedClientResponse` typen toegevoegd |
| `frontend/src/services/projectplan.service.ts` | `suggestClient()` en `linkClient()` methoden toegevoegd |
| `frontend/src/app/(teacher)/teacher/projectplans/[id]/page.tsx` | Koppelbanner in de opdrachtgever-sectie toegevoegd |

---

## Backend-bestanden gewijzigd

| Bestand | Wijziging |
|---------|-----------|
| `backend/app/infra/db/models/project_plan.py` | `client_id` FK en `linked_client` relatie op `ProjectPlanSection` |
| `backend/app/infra/db/models/clients.py` | `uq_client_school_org` unique constraint |
| `backend/app/api/v1/schemas/projectplans.py` | `client_id` op `ProjectPlanSectionOut`; nieuwe schema's voor koppeling |
| `backend/app/api/v1/routers/projectplans.py` | Twee nieuwe eindpunten; GO-logica uitgebreid; `IntegrityError` afhandeling |
| `backend/migrations/versions/f3a9c1d2e4b6_add_client_link_to_sections.py` | Migratie |

---

## Tests

Unit tests staan in `backend/tests/unit/test_projectplan_client_linking.py`:

```
TestSuggestClient
  ✓ retourneert lege lijst als er geen organisatienaam is
  ✓ exacte overeenkomst geeft score 1,0
  ✓ gedeeltelijke overeenkomst geeft lagere score
  ✓ e-mailovereenkomst vergroot de score bij niet-exacte naam
  ✓ geeft 403 voor studenten
  ✓ jokertekens in organisatienaam veroorzaken geen fouten

TestLinkClient
  ✓ koppelt bestaande klant aan sectie
  ✓ ontbrekende client_id bij match_existing → 400
  ✓ ontbrekende organisatienaam bij create_new → 400
  ✓ duplicaat bij create_new → 409
  ✓ geeft 403 voor studenten

TestUpdateTeamStatusSubproject
  ✓ aanmaken van subproject bij GO
  ✓ geen duplicaat aangemaakt als subproject al bestaat
  ✓ terugvalltitel bevat teamnummer
```

Uitvoeren:
```bash
cd backend
python -m pytest tests/unit/test_projectplan_client_linking.py -v
```
