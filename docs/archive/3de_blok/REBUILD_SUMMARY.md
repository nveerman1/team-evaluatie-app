# 3de Blok → Team Evaluatie App: Samenvatting

## Executive Summary

Dit document bevat een **complete rebuild-strategie** om de 3de Blok RFID attendance app te migreren naar de Team Evaluatie App als native module.

**Huidige situatie:**
- **3de Blok App**: Flask + MariaDB, standalone systeem met eigen users/klassen/login
- **Team Evaluatie App**: React (TypeScript) + Postgres, bestaande users/courses/projects

**Doel:**
- Native integratie (niet als service, maar volledig hergebouwd binnen Team App)
- Hergebruik bestaande users/courses/projects uit Team App
- Behoud alle functionaliteit (RFID scans, externe werk registraties, statistieken, rapporten)
- Unified UI in Team App design system

## Wat zit er in REBUILD_PLAN.md?

Het volledige rebuild plan (1140 regels) bevat:

### 1. **Feature Map (Legacy Analyse)**
- Complete database schema (4 tabellen: students, logs, external_work, admins)
- Alle 9 Flask blueprints met routes en endpoints
- Business rules en edge cases
- Services en cron scripts
- Hardware integratie (Raspberry Pi RFID)

### 2. **Entity Mapping**
- students → users + rfid_cards (nieuwe tabel)
- logs + external_work → attendance_events (unified tabel)
- admins → users (merge met role=teacher)
- Mapping strategie met quarantine voor unmatched records

### 3. **Nieuw Postgres Datamodel**
- Volledige DDL voor 3 nieuwe tabellen
- Views en functions (compute_user_attendance_totals)
- Indexes voor performance
- MySQL→Postgres conversie tips

### 4. **REST API Specificatie**
- POST /api/v1/attendance/scan (RFID endpoint)
- Teacher endpoints (events CRUD, filters, bulk actions)
- External work endpoints (approve/reject workflow)
- Student endpoints (eigen data)
- Export endpoints (CSV/PDF)
- Complete request/response voorbeelden

### 5. **React UI Rebuild**
- Route structuur (/app/3de-blok/*)
- 8 pagina's met component trees:
  - AttendanceDashboardPage
  - PresencePage (realtime)
  - ExternalWorkManagementPage
  - StudentAdminPage (+ RFID management)
  - StatsPage (charts)
  - OverviewPage
  - StudentDashboardPage
  - Student extern registratie
- Design system hergebruik
- State management strategie
- Loading/error states

### 6. **Migratieplan**
- Export strategie (MySQL→CSV)
- 3 transformatie scripts (students, logs, external_work)
- Quarantine systeem voor unmatched records
- Manual mapping UI voor docenten
- Dry run checklist (pre/during/post)
- Rollback plan

### 7. **Implementatie Roadmap**
- 5 milestones over 9 weken
- M1: Foundation (schema + scan endpoint)
- M2: Teacher features (CRUD + filters)
- M3: Advanced (stats + realtime + student portal)
- M4: Migration + polish
- M5: Deployment + training
- Concrete deliverables per milestone

### 8. **Risico's & Mitigaties**
- 8 geïdentificeerde risico's (mapping mismatch, timezone bugs, performance, etc.)
- Edge cases (open sessies, concurrent scans, permissions, etc.)
- Mitigatie strategieën

### 9. **Assumptions & Verificaties**
- 8 assumptions over Team App (users tabel, auth systeem, courses, etc.)
- Checklist met te verifiëren punten

### 10. **Volgende Stappen**
- Kick-off meeting agenda
- Schema inspection
- Design review
- Prototype endpoint
- Dry-run migratie
- Refinement

## Key Highlights

### Technisch
- **Database**: 3 nieuwe tabellen, 2 views, 1 function
- **Backend**: 15+ REST endpoints (Node.js/Express aangenomen)
- **Frontend**: 8 pagina's, ~30 components
- **Migratie**: 3 scripts + quarantine systeem + manual UI

### Business
- **Geen downtime**: Phased cutover strategie
- **Data behoud**: Alle logs + externe registraties worden gemigreerd
- **Backwards compatible**: Raspberry Pi blijft werken met nieuwe endpoint
- **Approval workflow**: Docenten kunnen externe registraties goedkeuren/afwijzen
- **Real-time**: WebSocket voor live presence updates
- **Rapportages**: PDF exports blijven werken (via scheduled job)

### Voordelen vs Legacy
✅ Geen dubbele users (hergebruik Team App accounts)
✅ Projecten koppeling (attendance aan specifieke projecten)
✅ Unified design (zelfde look & feel als Team App)
✅ Betere performance (Postgres + indexes + caching)
✅ Modern stack (React + TypeScript vs Jinja2)
✅ Mobile responsive (legacy is desktop-only)
✅ Betere security (bestaande Team App auth + RBAC)

## Scope & Effort

**Geschatte effort:** 9 weken (1 full-stack developer)

**Breakdown:**
- Backend (schema + API): 3 weken
- Frontend (8 pages): 3 weken
- Migratie (scripts + dry-run + uitvoering): 2 weken
- Testing + deployment + training: 1 week

**Critical path:**
1. Schema + scan endpoint (week 1-2)
2. Teacher dashboard (week 3-4)
3. Migratie (week 7-8)

## Decision Points

Voordat je start, moet je beslissen over:

1. **Project koppeling**: Verplicht of optioneel? (aangenomen: optioneel in plan)
2. **Klassen mapping**: Hoe mappen "V4A" naar Team App courses/classes?
3. **Permissions**: Mogen docenten elkaars klassen zien/editen?
4. **RFID beheer**: Wie mag RFID kaarten toewijzen? (aangenomen: docenten via admin panel)
5. **External work**: Wie mag goedkeuren? (aangenomen: alle docenten)
6. **Raspberry Pi**: IP whitelist of API key auth?
7. **Charts library**: Recharts of Chart.js? (moet matchen met Team App)

## Success Criteria

✅ Raspberry Pi scan werkt (check-in/out binnen 2 sec)
✅ Alle legacy data gemigreerd (>95% matched)
✅ Docenten kunnen logs filteren/editen/exporteren
✅ Studenten kunnen eigen data zien + extern registreren
✅ Stats dashboard toont realtime metrics
✅ Externe registraties goedkeuren binnen 1 klik
✅ Weekly PDF rapporten automatisch gegenereerd
✅ Performance: dashboard laadt <2 sec (10k+ events)
✅ Mobile responsive (tablet + phone)
✅ Zero data loss tijdens migratie

## Contact & Next Steps

**Voor vragen over dit plan:**
1. Review REBUILD_PLAN.md (complete details)
2. Schedule kick-off meeting met Team App developers
3. Verify assumptions (section 9 in plan)
4. Run schema inspection (section 10.2)
5. Start met Milestone 1 (foundation)

**Prioriteit volgende week:**
1. ✅ Verify Team App heeft users/courses/projects tabellen
2. ✅ Export Team App schema (inspect exact fields)
3. ✅ Confirm mapping strategie (username vs email vs student_number)
4. ✅ Setup development environment (local Postgres + Team App clone)
5. ✅ Prototype scan endpoint (standalone test)

---

**Gemaakt:** 2025-12-21  
**Versie:** 1.0  
**Auteur:** GitHub Copilot (repository analyse)  
**Review:** Pending
