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
