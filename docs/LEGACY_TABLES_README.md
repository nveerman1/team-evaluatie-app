# Legacy Tables Phase-Out Documentation

This directory contains the complete investigation and migration plan for phasing out the legacy `groups` and `group_members` tables in favor of the modern `project_teams` architecture.

## Quick Links

### 📊 For Stakeholders & Tech Leads

Start here: **[LEGACY_TABLES_EXECUTIVE_SUMMARY.md](./LEGACY_TABLES_EXECUTIVE_SUMMARY.md)**
- 5-minute read
- Decision framework
- Resource requirements
- Risk summary

### 📝 For Engineering Team

**Investigation Results:** [LEGACY_TABLES_INVESTIGATION_SUMMARY.md](./LEGACY_TABLES_INVESTIGATION_SUMMARY.md)
- Current state analysis
- All dependencies mapped
- Quick reference for what needs changing

**Detailed Migration Plan:** [LEGACY_TABLES_MIGRATION_PLAN.md](./LEGACY_TABLES_MIGRATION_PLAN.md)
- Complete 6-phase plan
- Technical specifications
- Code examples for each phase
- Testing strategies
- Timeline: 15 weeks

### 🏗️ Architecture Context

**Current Architecture:** [architecture.md](./architecture.md)
- See "Project-Based Team Management" section
- Legacy vs. Modern system comparison
- Lines 649-663, 165-189 (ERD diagrams)

**ProjectTeam Implementation:** [PROJECT_TEAM_ROSTERS_IMPLEMENTATION.md](./PROJECT_TEAM_ROSTERS_IMPLEMENTATION.md)
- How the modern system works
- Why it was introduced

**Architectural Decision:** [PROJECT_TEAM_ROSTERS_ADR.md](./PROJECT_TEAM_ROSTERS_ADR.md)
- Original decision to introduce ProjectTeam
- Design rationale

## Document Structure

```
docs/
├── LEGACY_TABLES_EXECUTIVE_SUMMARY.md      ← START HERE (stakeholders)
├── LEGACY_TABLES_INVESTIGATION_SUMMARY.md  ← Quick reference (engineers)
├── LEGACY_TABLES_MIGRATION_PLAN.md         ← Detailed plan (31 pages)
├── THIS_README.md                          ← You are here
├── architecture.md                         ← Background context
├── PROJECT_TEAM_ROSTERS_ADR.md            ← Why ProjectTeam exists
└── PROJECT_TEAM_ROSTERS_IMPLEMENTATION.md ← How ProjectTeam works
```

## The Problem in One Sentence

**We have two parallel team management systems (legacy Group vs. modern ProjectTeam) and need to fully migrate to the modern system to reduce technical debt and enable future features.**

## Key Metrics

| Metric | Value |
|--------|-------|
| **Files affected** | ~50+ |
| **API routers** | 15+ |
| **Database queries** | ~100+ |
| **Estimated effort** | 450 engineer hours |
| **Timeline** | 15 weeks (6 phases) |
| **Risk level** | Medium-High (manageable with mitigation) |

## Current Status

- ✅ **Phase 0: Investigation** - Complete (2026-01-18)
- ⏸️ **Awaiting Decision** - Option A (full migration) vs. Option B (postpone) vs. Option C (do nothing)
- 🔜 **Next Steps** - Stakeholder review and go/no-go decision

## Decision Needed

**Read the Executive Summary and decide:**
- **Option A:** Approve full migration (start Q1 2026, complete Q2 2026)
- **Option B:** Postpone 6-12 months
- **Option C:** Do nothing (not recommended)

## Questions?

Contact the engineering team or open an issue in the repository.

---

**Last Updated:** 2026-01-18  
**Prepared By:** Engineering Team  
**Related Issue:** Onderzoek wat nog gebruik maakt van de legacy tabellen
