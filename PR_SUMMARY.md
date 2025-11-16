# PR Summary: Wizard Enhancement - Create Proper Entity Types

## 🎯 Overview

This PR implements the requirements to make the project wizard create the correct entity types per evaluation type, rather than always creating `Evaluation` records. This ensures the wizard output aligns with how the frontend retrieves and displays data.

## 📋 Problem Statement

Previously, the wizard created `Evaluation` records for all types:
- Peer evaluations → `Evaluation` with `evaluation_type="peer"`
- Project assessments → `Evaluation` with `evaluation_type="project"` ❌
- Competency scans → `Evaluation` with `evaluation_type="competency"` ❌

But the frontend expects:
- `/teacher/project-assessments` → `ProjectAssessment` records
- `/teacher/competencies` → `CompetencyWindow` records

This mismatch caused data not to appear in the frontend.

## ✅ Solution

The wizard now creates the appropriate entity type for each evaluation:

| Evaluation Type | Database Model | Records Created | Frontend Route |
|----------------|----------------|----------------|----------------|
| Peer Evaluations | `Evaluation` | 1 per config | `/teacher/evaluations` |
| Project Assessments | `ProjectAssessment` | 1 per group | `/teacher/project-assessments` |
| Competency Scans | `CompetencyWindow` | 1 per config | `/teacher/competencies` |

## 🔑 Key Changes

### 1. Enhanced Request Schema

Added granular configuration for each evaluation type:

```typescript
// New request structure
{
  "evaluations": {
    "peer_tussen": {
      "enabled": true,
      "deadline": "2025-06-30T23:59:59",
      "rubric_id": 1,
      "title_suffix": "tussentijds"
    },
    "project_assessment": {
      "enabled": true,
      "rubric_id": 5,
      "deadline": "2025-06-30T23:59:59",
      "version": "tussentijds"
    },
    "competency_scan": {
      "enabled": true,
      "start_date": "2025-01-01T00:00:00",
      "end_date": "2025-06-30T23:59:59",
      "competency_ids": [1, 2, 3],
      "title": "Q1 Scan"
    }
  }
}
```

### 2. Mixed Entity Response

Response now includes type discriminators:

```typescript
{
  "project": {...},
  "entities": [
    {"type": "peer", "data": {...}},
    {"type": "project_assessment", "data": {...}},
    {"type": "competency_scan", "data": {...}}
  ],
  "warnings": [],
  "note": {...},
  "linked_clients": [...]
}
```

### 3. Edge Case Handling

- ⚠️ **Course without groups**: Returns warning, doesn't create project assessments
- ⚠️ **Invalid competency IDs**: Filters invalid IDs, returns warning
- ✅ **Mixed entity creation**: Supports all types in one wizard run

## 📁 Files Changed

| File | Lines | Description |
|------|-------|-------------|
| `backend/app/api/v1/schemas/projects.py` | +78 | New schemas for entity configurations |
| `backend/app/api/v1/routers/projects.py` | +185 | Wizard logic for creating proper entities |
| `backend/tests/test_wizard_new_entities.py` | +396 | Comprehensive test suite (6 tests) |
| `docs/WIZARD_API_CHANGES.md` | +296 | Migration guide for frontend |
| **Total** | **+955 lines** | |

## 🧪 Testing

All tests passing ✅

```
tests/test_projects_api.py ..................... 9 passed
tests/test_wizard_new_entities.py .............. 6 passed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: 15 passed in 0.68s
```

### Test Coverage

- ✅ Peer evaluations with deadlines
- ✅ Project assessment creation per group
- ✅ Warning when course has no groups
- ✅ Competency window creation
- ✅ Warning on invalid competency IDs
- ✅ Mixed entity creation (all types at once)

## 🔒 Security

Security scan passed ✅
- CodeQL analysis: 0 vulnerabilities found
- No security issues introduced

## 🎨 Code Quality

- ✅ Linting passed (ruff): 0 errors
- ✅ All imports verified
- ✅ Type hints maintained
- ✅ Docstrings updated
- ✅ Minimal changes to existing code

## 📚 Documentation

Comprehensive documentation added in `docs/WIZARD_API_CHANGES.md`:

- ✅ Migration guide for frontend developers
- ✅ Request/response schema examples
- ✅ Entity type mapping table
- ✅ Edge case handling guide
- ✅ TypeScript integration examples
- ✅ Testing instructions

## 🚀 Next Steps for Frontend

1. **Update wizard form UI**
   - Add deadline pickers
   - Add rubric selectors
   - Add competency framework selector

2. **Update API integration**
   - Use new nested configuration structure
   - Handle mixed entity response
   - Display warnings to users

3. **Update routing**
   - Route to correct pages based on entity type
   - Handle all three entity types

See `docs/WIZARD_API_CHANGES.md` for detailed migration guide.

## 🔄 Backward Compatibility

⚠️ **Breaking Change**: Response structure changed from `evaluations: []` to `entities: []`

The frontend must be updated to use the new structure. A mapping example is provided in the documentation for temporary backward compatibility if needed.

## ✨ Benefits

1. **Data consistency**: Wizard output now matches frontend expectations
2. **Type safety**: Clear discriminators prevent confusion
3. **Flexibility**: Supports deadlines, rubric selection, competency linking
4. **Robustness**: Edge cases handled gracefully with warnings
5. **Maintainability**: Well-tested with comprehensive documentation

## 📊 Impact

- **Backend**: 3 files modified, 955 lines added
- **Tests**: 6 new comprehensive tests
- **Documentation**: Complete migration guide
- **Breaking changes**: 1 (response structure)
- **Security issues**: 0
- **Performance impact**: Minimal (same number of DB queries)

## 👥 Review Checklist

- [x] Code follows project style guidelines
- [x] Tests added and passing
- [x] Documentation updated
- [x] Security scan passed
- [x] Linting passed
- [x] Edge cases handled
- [x] Backward compatibility considered
- [x] Migration guide provided

## 📝 Additional Notes

This implementation prioritizes **minimal changes** to existing code while adding the necessary functionality. The wizard endpoint signature remains the same - only the request and response structures have been enhanced.

The changes are **production-ready** and have been thoroughly tested. All quality checks have passed.
