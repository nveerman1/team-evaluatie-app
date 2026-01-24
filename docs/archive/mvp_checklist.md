# ✅ MVP Checklist — Team Evaluatie App

**Doel:** volledige evaluatiecyclus laten werken met minimale interface (Fase 3).

## 1) Statusoverzicht

- [x] Seed-data + database up
- [x] Dev-auth via header `X-User-Email`
- [x] Rubrics + criteria CRUD (MVP)
- [x] Evaluations CRUD (MVP)
- [x] Allocations (auto) + self/peer
- [x] Scores indienen en ophalen
- [x] Grades preview (incl. GCF/SPR)
- [x] Grades publish (persist in DB)
- [x] Dashboard overview + CSV
- [x] Matrix reviewer×reviewee + CSV
- [x] Flags (SPR/GCF/outliers/min reviewers) + CSV
- [x] Flags explain (uitleg voor tooltips)

## 2) Snel testen (curl)

> Vervang `evaluation_id=1` etc. waar nodig. Gebruik bestaande seed users (zoals `docent@example.com`, `student1@example.com`).

### Health
```bash
curl -s http://localhost:8000/health | jq .
```

### Rubrics
```bash
curl -s http://localhost:8000/api/v1/rubrics \
  -H "X-User-Email: docent@example.com" | jq .
```

### Evaluations
```bash
curl -s http://localhost:8000/api/v1/evaluations \
  -H "X-User-Email: docent@example.com" | jq .
```

### Allocations
```bash
# auto toewijzen (1 peer + self)
curl -s -X POST http://localhost:8000/api/v1/allocations/auto \
  -H "Content-Type: application/json" -H "X-User-Email: docent@example.com" \
  -d '{"evaluation_id":1,"peers_per_student":1,"include_self":true}' | jq .

# mijn allocaties (als student)
curl -s "http://localhost:8000/api/v1/allocations/my?evaluation_id=1" \
  -H "X-User-Email: student1@example.com" | jq .
```

### Scores
```bash
# voorbeeld: scores posten voor een allocation_id
curl -s -X POST http://localhost:8000/api/v1/scores \
  -H "Content-Type: application/json" -H "X-User-Email: student1@example.com" \
  -d '{
    "allocation_id": 3,
    "items": [
      {"criterion_id": 1, "score": 4, "comment":"goed voorbereid"},
      {"criterion_id": 2, "score": 5, "comment":"trok team mee"}
    ]
  }' | jq .

# scores per allocation ophalen
curl -s http://localhost:8000/api/v1/scores/by-allocation/3 \
  -H "X-User-Email: student1@example.com" | jq .
```

### Grades (GCF/SPR en publiceren)
```bash
# preview
curl -s "http://localhost:8000/api/v1/grades/preview?evaluation_id=1" \
  -H "X-User-Email: docent@example.com" | jq .

# publish (opslaan in DB; overrides optioneel)
curl -s -X POST http://localhost:8000/api/v1/grades/publish \
  -H "Content-Type: application/json" -H "X-User-Email: docent@example.com" \
  -d '{"evaluation_id":1, "overrides":{"1":{"grade":8.5,"reason":"extra inzet"},"2":{}}}' | jq .

# gepubliceerde cijfers lezen
curl -s "http://localhost:8000/api/v1/grades?evaluation_id=1" \
  -H "X-User-Email: docent@example.com" | jq .
```

### Dashboard
```bash
# JSON
curl -s "http://localhost:8000/api/v1/dashboard/evaluation/1" \
  -H "X-User-Email: docent@example.com" | jq .

# met per-criterium breakdown
curl -s "http://localhost:8000/api/v1/dashboard/evaluation/1?include_breakdown=true" \
  -H "X-User-Email: docent@example.com" | jq .

# CSV export
curl -L "http://localhost:8000/api/v1/dashboard/evaluation/1/export.csv" \
  -H "X-User-Email: docent@example.com" -o evaluation_1_dashboard.csv
```

### Matrix
```bash
# alle criteria
curl -s "http://localhost:8000/api/v1/dashboard/evaluation/1/matrix" \
  -H "X-User-Email: docent@example.com" | jq .

# specifiek criterium + zonder self
curl -s "http://localhost:8000/api/v1/dashboard/evaluation/1/matrix?criterion_id=2&include_self=false" \
  -H "X-User-Email: docent@example.com" | jq .

# CSV
curl -sL "http://localhost:8000/api/v1/dashboard/evaluation/1/matrix.csv" \
  -H "X-User-Email: docent@example.com" -o matrix.csv
```

### Flags & Explain
```bash
# hints
curl -s "http://localhost:8000/api/v1/flags/evaluation/1" \
  -H "X-User-Email: docent@example.com" | jq .

# strengere drempels (optioneel)
curl -s "http://localhost:8000/api/v1/flags/evaluation/1?spr_high=1.2&gcf_low=0.75&zscore_abs=1.8" \
  -H "X-User-Email: docent@example.com" | jq .

# CSV
curl -sL "http://localhost:8000/api/v1/flags/evaluation/1/export.csv" \
  -H "X-User-Email: docent@example.com" -o flags.csv

# uitleg voor tooltips
curl -s "http://localhost:8000/api/v1/flags/explain" \
  -H "X-User-Email: docent@example.com" | jq .
```

## 3) DB-migraties

- [x] `alembic revision -m "add published_grades table"`
- [x] `alembic upgrade head`  
  Laatste revisie: `published_grades` aanwezig.

## 4) Notities

- Dev-auth: voeg header `X-User-Email` toe bij elke call.
- Score-bounds: gevalideerd tegen rubric scale min/max.
- Multi-tenant: queries scopen op `school_id`.
- CSV’s zijn **generated artifacts** → in `.gitignore`.

---
_Einde MVP checklist_
