# Team Number Deprecation Plan

## Overview
The `users.team_number` field is being phased out in favor of project-specific team rosters (`project_teams` and `project_team_members`).

## Timeline

### Phase 1: Database Migration (Current Release)
**Status**: ✅ Complete

- New tables `project_teams` and `project_team_members` created
- Existing data backfilled from evaluations and assessments
- `team_number` column remains but is no longer used for new data
- During migration, `team_number` is set to NULL where replaced by project teams

### Phase 2: API Transition (Current Release)
**Status**: ✅ Complete

- All evaluation/assessment creation now requires `project_team_id`
- Team management APIs use project teams exclusively
- `team_number` still readable via API for backwards compatibility
- Roster locking implemented for closed evaluations

### Phase 3: UI Transition (Next Release)
**Status**: 🔄 In Progress

- [ ] Remove team_number editing from class-teams UI
- [ ] Add project team selection to evaluation creation
- [ ] Show frozen rosters for closed evaluations
- [ ] Update CSV import/export to use project teams
- [ ] Display `team_number` read-only for informational purposes

### Phase 4: Deprecation Warning (Release + 2 versions)
**Status**: ⏳ Planned

- Add deprecation warnings in API responses when `team_number` is used
- Log usage of `team_number` for analytics
- Documentation updates highlighting new system

### Phase 5: Removal (Release + 6 months minimum)
**Status**: ⏳ Planned

- Remove `team_number` column from database
- Remove all API references to `team_number`
- Complete transition to project teams

## Migration Path for Existing Data

### Automated
The migration script automatically:
1. Creates project teams from existing evaluations
2. Populates members from group_members
3. Links evaluations to project teams
4. Sets `team_number` to NULL where replaced

### Manual (if needed)
For special cases:
```sql
-- Check students still using team_number
SELECT id, name, email, team_number 
FROM users 
WHERE team_number IS NOT NULL 
  AND school_id = ?;

-- Verify they're not in project_team_members
SELECT u.id, u.name, u.team_number, ptm.project_team_id
FROM users u
LEFT JOIN project_team_members ptm ON u.id = ptm.user_id
WHERE u.team_number IS NOT NULL
  AND ptm.id IS NULL;
```

## Backwards Compatibility

### Current (Phase 1-3)
- `team_number` column exists and is readable
- Old code can still read `team_number` values
- New code ignores `team_number` for team membership

### Future (Phase 4)
- API returns deprecation warnings
- `team_number` values may be stale
- All writes go to project teams only

### End State (Phase 5)
- `team_number` column removed
- API endpoints updated
- Only project teams used

## Communication Plan

### For Developers
- ✅ ADR document created: `docs/ADR-project-team-rosters.md`
- ✅ Migration guide created: `docs/MIGRATION-project-team-rosters.md`
- ✅ API documentation updated
- ⏳ Code comments added to deprecated functions
- ⏳ Changelog entries for each phase

### For Users (Teachers)
- ⏳ Release notes explaining new team management
- ⏳ UI tooltips showing changes
- ⏳ Training materials/videos for new workflow
- ⏳ FAQ document for common questions

### For Administrators
- ✅ Migration instructions in docs
- ✅ SQL fallback scripts provided
- ⏳ Monitoring recommendations
- ⏳ Rollback procedures documented

## Risk Mitigation

### Data Loss Prevention
- ✅ Migration preserves all existing team assignments
- ✅ Backfill marks inferred data for review
- ✅ Rollback procedures documented
- ✅ `team_number` not deleted immediately

### Performance Impact
- ✅ Indexes created for new tables
- ✅ Foreign keys use RESTRICT to prevent orphans
- ⏳ Query performance monitored
- ⏳ Optimize slow queries if needed

### User Confusion
- ⏳ UI clearly shows project-based teams
- ⏳ Help text explains new system
- ⏳ Gradual rollout with user training
- ⏳ Support documentation available

## Rollback Strategy

If issues arise:

### Before Phase 4
- Relatively easy rollback
- SQL scripts provided
- Data preserved in both systems

### After Phase 4
- Rollback becomes difficult
- May require data reconstruction
- Extended testing period before Phase 4

### After Phase 5
- No rollback possible
- Full migration must succeed
- Extensive validation required

## Success Metrics

### Technical
- [ ] All evaluations have valid `project_team_id`
- [ ] No orphaned records in project_team_members
- [ ] Query performance maintained or improved
- [ ] No database errors related to migration

### User Adoption
- [ ] Teachers successfully create project teams
- [ ] Evaluation creation uses new system
- [ ] No support tickets related to team assignment confusion
- [ ] CSV import/export works with new system

### Data Quality
- [ ] Historical evaluations show correct rosters
- [ ] Team changes tracked with versions
- [ ] No data loss from migration
- [ ] Backfill accuracy > 95%

## Decision Points

### Can we proceed to Phase 4?
✅ When:
- All UI updates complete
- No critical bugs for 2 releases
- User adoption > 80%
- Support ticket volume normal

### Can we proceed to Phase 5?
✅ When:
- Phase 4 complete for 6+ months
- Zero usage of `team_number` in logs
- All stakeholders agree
- Comprehensive testing passed

## Status: Phase 2 Complete
Last Updated: 2025-12-08

Next Steps:
1. Complete UI transition (Phase 3)
2. Update all evaluation creation forms
3. Add project team management UI
4. Monitor adoption and gather feedback
