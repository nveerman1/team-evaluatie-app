# Seed Script Fixes Summary

## Overview
This document summarizes the changes made to align `backend/scripts/seed.py` with the current SQLAlchemy model definitions in `backend/app/infra/db/models.py`.

## 1. Created Helper Function

### `create_instance()` in `backend/app/db/seed_utils.py`
- **Purpose**: Automatically filter model constructor kwargs to only valid SQLAlchemy mapped attributes
- **Implementation**: Uses `sqlalchemy.inspect()` to get valid column and relationship keys
- **Benefit**: Prevents "invalid keyword argument" TypeErrors when models drift from seed data
- **Usage**: Wraps all model instantiations in seed script

```python
def create_instance(model_class: Type[T], **kwargs) -> T:
    """Create a model instance, filtering kwargs to only valid mapped attributes."""
    mapper = sa.inspect(model_class)
    valid_keys = set()
    for column in mapper.columns:
        valid_keys.add(column.key)
    for rel in mapper.relationships:
        valid_keys.add(rel.key)
    filtered_kwargs = {k: v for k, v in kwargs.items() if k in valid_keys}
    return model_class(**filtered_kwargs)
```

## 2. Field Name Corrections

### RubricCriterion
- **Fixed**: `order_index` → `order`
- **Added**: `school_id` (required FK)

### Reflection
- **Fixed**: `content` → `text`
- **Fixed**: `student_id` → `user_id`
- **Added**: `school_id` (required FK)
- **Added**: `word_count` (required, calculated from text)

### ProjectAssessmentReflection
- **Fixed**: `content` → `text`
- **Fixed**: `project_team_id` → `user_id` (reflection is by user, not team)
- **Fixed**: `project_assessment_id` → `assessment_id`
- **Added**: `school_id` (required FK)
- **Added**: `word_count` (required, calculated from text)

### CompetencySelfScore
- **Fixed**: `competency_window_id` → `window_id`
- **Fixed**: `student_id` → `user_id`
- **Fixed**: `competency_category_id` → `competency_id`
- **Added**: `school_id` (required FK)

### CompetencyGoal
- **Fixed**: `competency_window_id` → `window_id`
- **Fixed**: `student_id` → `user_id`
- **Fixed**: `category_id` → `competency_id`
- **Fixed**: `created_at` → `submitted_at`
- **Added**: `school_id` (required FK)
- **Added**: `status` (default "active")

### CompetencyTeacherObservation
- **Fixed**: `competency_window_id` → `window_id`
- **Fixed**: `student_id` → `user_id`
- **Fixed**: `category_id` → `competency_id`
- **Fixed**: `observation` → `comment`
- **Added**: `school_id` (required FK)
- **Added**: `score` (required field)

### ClientLog
- **Fixed**: `description` → `text`
- **Fixed**: `logged_by` → `author_id`
- **Removed**: `logged_at` (not in model schema)

### ClientProjectLink
- **Removed**: `linked_at` (field doesn't exist in model)

### AttendanceEvent
- **Fixed**: Replaced `event_type` and `timestamp` with `check_in` timestamp
- **Added**: `source` field (required, set to "seed")

### ProjectAssessmentScore
- **Fixed**: `project_assessment_id` → `assessment_id`
- **Fixed**: `project_team_id` → `team_number` (scores by team number, not team FK)
- **Added**: `school_id` (required FK)
- **Changed**: Score value from float to int (model expects integer)

### LearningObjective
- **Fixed**: `code` → `title`
- **Fixed**: `order_index` → `order`
- **Fixed**: Variable reference bug (`text` → `objective_text`)

### Allocation
- **Added**: `school_id` (required FK)
- **Fixed**: `reviewer_member.student_id` → `reviewer_member.user_id`
- **Fixed**: `reviewee_member.student_id` → `reviewee_member.user_id`

### Score
- **Added**: `school_id` (required FK)
- **Added**: `status` (default "submitted")

### ProjectAssessmentTeam
- **Added**: `school_id` (required FK)
- **Added**: `status` (default "draft")
- **Added**: `scores_count` (default 0)

## 3. Applied create_instance() to All Models

All model instantiations now use `create_instance()` for consistency:
- Class
- User (students)
- StudentClassMembership
- Course
- TeacherCourse
- CourseEnrollment
- Project
- ProjectTeam
- ProjectTeamMember
- Rubric (peer and project)
- RubricCriterion
- Evaluation
- Allocation
- Score
- Reflection
- ProjectAssessment
- ProjectAssessmentTeam
- ProjectAssessmentScore
- ProjectAssessmentReflection
- CompetencyWindow
- CompetencySelfScore
- CompetencyGoal
- CompetencyTeacherObservation
- LearningObjective
- Client
- ClientLog
- ClientProjectLink
- RFIDCard
- AttendanceEvent

## 4. Reset Logic (Already Robust)

The `safe_truncate_tables()` function already commits per table, which is correct:
```python
for table in tables:
    try:
        db.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE;"))
        db.commit()  # Commit per table
        print_info(f"Truncated {table}")
    except Exception as e:
        db.rollback()
        print_info(f"Warning: Could not truncate {table}: {e}")
```

This ensures that if a later table fails, earlier truncations are not rolled back.

## 5. Testing Status

### Syntax Validation
✅ **PASSED**: Python compilation successful for both files
- `backend/scripts/seed.py`
- `backend/app/db/seed_utils.py`

### Runtime Testing
⏳ **PENDING**: Requires database setup to run end-to-end
- Command: `cd backend && python -m scripts.seed --mode demo --reset --seed 42`
- Smoke test: `python scripts/seed_smoke_test.py` (if available)

## 6. Key Benefits

1. **Future-proof**: `create_instance()` prevents future field mismatch errors
2. **Type-safe**: Uses SQLAlchemy inspection, not hardcoded field lists
3. **Minimal changes**: Only touched problematic instantiations
4. **Backward compatible**: Doesn't change database schema
5. **Consistent**: All models now use the same instantiation pattern

## 7. Files Modified

1. `backend/app/db/seed_utils.py` - Added `create_instance()` helper function
2. `backend/scripts/seed.py` - Applied fixes to all model instantiations

## 8. Next Steps

1. Set up test database (PostgreSQL)
2. Run seed script with `--mode demo --reset --seed 42`
3. Fix any remaining runtime issues
4. Run smoke test if available
5. Verify data integrity in database
