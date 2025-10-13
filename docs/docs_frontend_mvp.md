# Frontend MVP — Snapshot (Fase 4)

**Project:** Team Evaluatie App  
**Scope:** Student wizard + Teacher dashboard (Next.js 15, Tailwind 4, React 19)  
**Status:** MVP werkt end‑to‑end tegen backend (dev-auth via `X-User-Email`).

---

## Snel starten

```bash
cd frontend
pnpm i
cp .env.local.example .env.local   # of maak .env.local zelf aan
pnpm dev                           # http://localhost:3000
```

**.env.local**
```ini
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

---

## Dev-auth (tijdelijk)

Op de homepage vul je een e‑mail in (bijv. `student1@example.com` of `docent@example.com`).  
Deze wordt in `localStorage.x_user_email` bewaard en als `X-User-Email` header meegestuurd.

---

## Mappen & bestanden

```
src/
  app/
    page.tsx                # Home + dev-login
    student/
      page.tsx              # Evaluatie kiezen
      [evaluationId]/
        page.tsx            # Wizard (stap 1-4)
    teacher/
      page.tsx              # Evaluatie-overzicht (docent)
      [evaluationId]/
        page.tsx            # Dashboard + Flags + Publish
  lib/
    api.ts                  # Axios client + header injector
    types.ts                # Shared types (subset backend)
```

---

## Student UI — Wizard (4 stappen)

1. **Zelfbeoordeling**: sliders per criterium (+ optionele opmerking), submit naar `/scores`.
2. **Peer-reviews**: idem voor toegewezen peers (via `/allocations/my`).
3. **Overzicht ontvangen feedback**: samenvatting uit `/dashboard/evaluation/{id}` (peer-avg, self, SPR, GCF).
4. **Reflectie**: MVP = lokaal opslaan (later backend endpoint).

**Gebruikte endpoints**
- `GET /allocations/my?evaluation_id=`
- `GET /rubrics/{rubric_id}/criteria`
- `POST /scores`
- `GET /dashboard/evaluation/{id}` (voor stap 3 samenvatting)

---

## Teacher UI — Dashboard

- **Tabel**: per leerling peer/self/SPR/GCF + suggested grade.
- **Flags**: lijst met waarschuwingen (severity badge).
- **Exports**: CSV van dashboard en flags.
- **Publish**: Suggested grades publiceren (`POST /grades/publish`).

**Gebruikte endpoints**
- `GET /evaluations`
- `GET /dashboard/evaluation/{id}`
- `GET /flags/evaluation/{id}` (+ `/export.csv` variants)
- `GET /grades/preview?evaluation_id=`
- `POST /grades/publish` (met lege overrides → neem suggested over)

---

## UX-notes (MVP)

- Sliders default op middenwaarde (3/5).  
- Basic styling met Tailwind; minimalistische knoppen/navigatie.  
- Meldingen via `alert()` (MVP).

---

## Checklist (MVP)

**Core**
- [x] Next.js app router + Tailwind
- [x] Dev-auth via `localStorage` → `X-User-Email` header
- [x] Student: evaluatie kiezen (open evaluaties)
- [x] Student: stap 1 zelfbeoordeling → `/scores`
- [x] Student: stap 2 peer-reviews → `/scores`
- [x] Student: stap 3 samenvatting (peer/self/SPR/GCF) → `/dashboard/evaluation/{id}`
- [x] Student: stap 4 reflectie (lokaal)
- [x] Teacher: lijst evaluaties
- [x] Teacher: dashboard tabel (peer/self/SPR/GCF/suggested)
- [x] Teacher: flags lijst
- [x] Teacher: export CSV’s
- [x] Teacher: publish suggested

**Tech**
- [x] Axios client met header-injector
- [x] Types voor responses (subset backend)
- [x] .env voor API URL

**Nice-to-have (volgende iteratie)**
- [ ] Toaster i.p.v. `alert()` (bv. sonner of radix + custom)
- [ ] Autorange/labels per criterium (toon schaal min/max uit backend)
- [ ] Reflectie opslaan in backend (`POST /reflections`)
- [ ] Guard rails: disable submit als niets veranderd is
- [ ] Loading/skeletons en error states
- [ ] Echte SSO (OAuth/OIDC) i.p.v. dev-auth
- [ ] PDF-export vanuit frontend (nu CSV via backend)
- [ ] E2E tests (Playwright) + mocks voor API

---

## Testscript (handmatig)

1. Start backend (`uvicorn ...`) en frontend (`pnpm dev`).
2. Op `/` → zet `X-User-Email` op `student1@example.com`.
3. Ga naar **/student** → kies open evaluatie → voer **Stap 1** (submit).
4. **Stap 2** → beoordeel peer(s) (submit).
5. **Stap 3** → controleer tabelwaarden (peer-avg, SPR/GCF).
6. Set `X-User-Email` op `docent@example.com` → **/teacher** → open dashboard.
7. Download CSV’s; klik **Publish suggested** → controleer backend respons.
8. Terug naar Student Stap 3 → zie geüpdatete aggregaties (indien van toepassing).

---

## Bekende aannames / beperkingen

- Evaluaties worden gefilterd op `status === "open"` in Student UI.
- Geen persistente opslag voor reflectie (nog lokaal).
- Geen server-side auth/route protection (dev-stand).

---

© Team Evaluatie App — Fase 4 (Frontend MVP)
