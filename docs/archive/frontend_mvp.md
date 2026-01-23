# 💻 Fase 4 — Frontend MVP

**Doel:** leerlingen en docenten kunnen het systeem gebruiken via een eenvoudige maar functionele web-UI.  
Gebouwd met **Next 15 (App Router)**, **TypeScript** en **TailwindCSS**.

---

## 🚀 Overzicht

**Student UI (wizard)**
1. Inloggen (dev-header `X-User-Email`)
2. Lijst met open evaluaties
3. Vier stappen:
   - Zelfbeoordeling
   - Peer-reviews
   - Overzicht ontvangen feedback (SPR / GCF)
   - Reflectie

**Teacher UI (dashboard)**
- Lijst met evaluaties  
- Dashboard met cijfers / SPR / GCF / flags  
- CSV-export & “Publish Suggested”

---

## 📁 Structuur (belangrijke bestanden)

```
frontend/
├── .env.local
├── src/
│   ├── lib/
│   │   ├── api.ts
│   │   └── types.ts
│   └── app/
│       ├── page.tsx                     # Home + Dev-login
│       ├── student/
│       │   ├── page.tsx                 # Lijst met evaluaties
│       │   └── [evaluationId]/
│       │       └── page.tsx             # Wizard (4 stappen)
│       └── teacher/
│           ├── page.tsx                 # Evaluaties-lijst
│           └── [evaluationId]/
│               └── page.tsx             # Dashboard
```

---

## ⚙️ Configuratie

**`.env.local`**
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

**`src/lib/api.ts`**
Axios-client met `X-User-Email`-header uit `localStorage`.

**`src/lib/types.ts`**
Type-definities voor `Evaluation`, `Criterion`, `ScoreItem`, `DashboardResponse`, enz.

---

## 🧠 Routes & functionaliteit

| Route | Beschrijving | API-calls |
|-------|---------------|-----------|
| `/` | Dev-login: zet `localStorage["x_user_email"]` | — |
| `/student` | Toon open evaluaties | `GET /evaluations` |
| `/student/[id]?step=1-4` | Wizard: zelf, peers, overzicht, reflectie | `GET /allocations/my`, `GET /rubrics/{id}/criteria`, `POST /scores`, `GET /dashboard/evaluation/{id}` |
| `/teacher` | Lijst met evaluaties | `GET /evaluations` |
| `/teacher/[id]` | Dashboard + flags + grades | `GET /dashboard/evaluation/{id}`, `GET /flags/evaluation/{id}`, `GET /grades/preview`, `POST /grades/publish` |

---

## 🧩 Backend-vereisten

FastAPI-app draait op `http://localhost:8000` met:
- `/api/v1/evaluations`
- `/api/v1/allocations/my`
- `/api/v1/rubrics/{id}/criteria`
- `/api/v1/scores`
- `/api/v1/dashboard/evaluation/{id}`
- `/api/v1/flags/evaluation/{id}`
- `/api/v1/grades/preview`
- `/api/v1/grades/publish`

Zorg dat **CORS_ORIGINS=["http://localhost:3000"]** staat in `.env`.

---

## 🧪 Testprocedure

1. **Backend starten**
   ```bash
   export APP_ENV=dev
   export DATABASE_URL="postgresql+psycopg2://app:app@localhost:5432/tea"
   uvicorn app.main:app --reload --port 8000
   ```
   Test met `curl http://localhost:8000/health`

2. **Frontend starten**
   ```bash
   cd frontend
   pnpm dev
   ```
   Open <http://localhost:3000>

3. **Dev-login**  
   Zet `student1@example.com` of `docent@example.com` → klik **Opslaan**

4. **Student-flow**  
   - Student → open evaluatie → doorloop stappen 1-4  
   - `POST /scores` wordt aangeroepen bij “Inleveren”

5. **Teacher-flow**  
   - Teacher → dashboard  
   - Bekijk tabel met SPR/GCF  
   - Klik “Publish Suggested” → `POST /grades/publish`

---

## ⚠️ Bekende beperkingen (MVP)

- CSV-download geeft nu `{"detail":"X-User-Email required"}`  
  → verwacht gedrag in dev-mode (geen header bij `<a href>`).  
  Later opgelost door echte auth (JWT/SSO).

- Reflectie (stap 4) nog alleen lokaal.

- Geen validatie op schaal min/max (backend doet dat al).

---

## 📚 Volgende stappen (na MVP)

- Auth (Single Sign-On / JWT)  
- Reflecties opslaan (`/reflections`)  
- Validatie en rubric-details per criterium  
- PDF-export  
- Toegankelijke design en UX-polish  

---

**Commit-tag:**  
`git commit -m "Frontend MVP (Fase 4): student wizard + teacher dashboard"`  
`git push origin main`
