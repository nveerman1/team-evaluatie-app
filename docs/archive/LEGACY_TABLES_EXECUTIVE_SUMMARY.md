# Executive Summary: Legacy Tables Phase-Out Plan

**Date:** 2026-01-18  
**Prepared for:** Tech Leads & Stakeholders  
**Issue:** Complete migration from Group/GroupMember to ProjectTeam architecture

---

## The Problem

The codebase has **two parallel team management systems**:

1. **Legacy:** `groups` and `group_members` tables (mutable, course-scoped)
2. **Modern:** `project_teams` and `project_team_members` tables (immutable, project-scoped)

The modern system was introduced but the legacy system was never fully removed. This creates:
- **Technical debt** (maintaining 2 systems)
- **Developer confusion** (which system to use?)
- **Data inconsistency risks**
- **Blocks future features** (versioned rosters, historical accuracy)

---

## Investigation Results

### Scope of Legacy Usage

| Metric | Count |
|--------|-------|
| **Files affected** | ~50+ |
| **API routers using legacy tables** | 15+ |
| **Database queries** | ~100+ |
| **Frontend components** | 20+ |

### Critical Dependencies

1. **ProjectAssessment model** - Uses `group_id` as primary FK (should be `project_team_id`)
2. **Student authorization (RBAC)** - All student access checks use `GroupMember` table
3. **External assessments** - Team rosters query `GroupMember`
4. **Multiple API endpoints** - Direct queries to Group/GroupMember

---

## Recommendation: Full Migration (Option A)

### Why Migrate?

✅ **Benefits:**
- Removes technical debt completely
- Single, clear team management system
- Enables versioned rosters (historical accuracy for evaluations)
- Simplifies onboarding for new developers
- Improves maintainability

❌ **Cost:**
- **15 weeks** engineering effort
- **~450 engineer hours** (1-2 backend + 1 frontend + QA)
- **High-risk phases** during authorization refactoring

### Alternative: Do Nothing (Option B)

Keep both systems indefinitely.

**Consequences:**
- Ongoing maintenance burden
- Technical debt grows over time
- New features may add more dependencies to legacy system
- Migration becomes progressively harder

---

## Proposed Migration Plan

### 6-Phase Approach

| Phase | Focus | Duration | Risk |
|-------|-------|----------|------|
| **1** | Establish CourseEnrollment as source of truth | 2 weeks | Medium |
| **2** | Migrate ProjectAssessment to project_team_id | 3 weeks | **High** ⚠️ |
| **3** | Update RBAC authorization logic | 2 weeks | **High** ⚠️ |
| **4** | Refactor all API endpoints | 4 weeks | Medium |
| **5** | Deprecate frontend group APIs | 2 weeks | Low |
| **6** | Remove legacy tables & code | 1 week | Low |

**Total Timeline:** 14 weeks (3.5 months) + 1 week buffer

### Risk Mitigation

- **Dual-write pattern** during transition (write to both systems)
- **Feature flags** for instant rollback
- **Comprehensive testing** (unit, integration, E2E, security)
- **Gradual rollout** (staging → 10% prod → 100%)
- **Full backups** before each phase

---

## Resource Requirements

### Team Composition

- **1-2 Backend Engineers** (SQL, Python, FastAPI, authorization logic)
- **1 Frontend Engineer** (TypeScript, React, API integration)
- **1 QA Engineer** (Testing, validation, regression checks)

### Timeline

- **Start:** Q1 2026 (as soon as approved)
- **Completion:** Q2 2026 (mid-year)
- **Total Effort:** ~450 engineer hours

### Budget

No additional costs beyond engineer time. Infrastructure (database, servers) remains unchanged.

---

## Success Criteria

### Technical Metrics

- [ ] Zero Group/GroupMember references in codebase (except migrations)
- [ ] All tests passing (>95% coverage)
- [ ] No performance degradation (≤5% query slowdown acceptable)
- [ ] Zero authorization bugs

### Business Metrics

- [ ] No user-facing errors
- [ ] No increase in support tickets
- [ ] All features work as before (functional parity)

---

## Decision Required

**Choose one:**

### ✅ Option A: Approve Full Migration (Recommended)

- Allocate resources for Q1-Q2 2026
- Begin Phase 1 within 2 weeks
- Expected completion: Mid-2026

**Action Items:**
1. Assign engineering team
2. Create JIRA epic
3. Schedule kickoff meeting

---

### 🟡 Option B: Postpone 6-12 Months

- Revisit after [specific milestone/feature]
- Technical debt remains but won't block current work

**Action Items:**
1. Set review date
2. Document decision rationale
3. Add to Q3/Q4 roadmap

---

### ❌ Option C: Do Nothing (Not Recommended)

- Keep both systems indefinitely
- Accept ongoing maintenance burden

**Consequences:**
- Debt grows
- Migration becomes harder
- May block future features

---

## Questions & Concerns

### "Is this necessary? Can't we just leave it?"

Technically yes, but:
- New features will likely add more dependencies on the wrong system
- Developer confusion leads to bugs
- Every month we wait, the migration gets harder
- This is a one-time effort to clean up the architecture

### "What if the migration breaks something critical?"

We have extensive safeguards:
- Dual-write pattern (both systems work during transition)
- Feature flags (instant rollback without deployment)
- Comprehensive testing at every step
- Gradual rollout (catch issues early)
- Full database backups

### "Why 15 weeks? Can't we go faster?"

The timeline includes:
- Thorough testing at each phase
- Gradual rollout and monitoring
- Buffer for unexpected issues
- Phases 2-3 are high-risk (authorization logic) and can't be rushed

We could cut corners and do it in 8-10 weeks, but the risk of authorization bugs or data loss isn't worth it.

---

## Detailed Documentation

For technical details, see:

- **Quick Reference:** `docs/LEGACY_TABLES_INVESTIGATION_SUMMARY.md`
- **Full Plan:** `docs/LEGACY_TABLES_MIGRATION_PLAN.md` (31 pages, comprehensive)
- **Architecture:** `docs/architecture.md`

---

## Recommendation

**We recommend Option A: Full Migration**

**Rationale:**
- Technical debt will only grow
- Clear architectural vision (single team system)
- Enables future features
- One-time effort with lasting benefits
- Risk is manageable with our mitigation strategies

**Next Step:** Schedule 30-min stakeholder meeting to review and decide.

---

**Prepared by:** Engineering Team  
**Contact:** [your-email]  
**Date:** 2026-01-18
