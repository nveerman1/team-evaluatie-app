# Models Refactoring Guide

## Quick Start

### For Developers

**Nothing changes in how you import models!**

All existing code continues to work without modification:

```python
# ✅ Still works exactly as before
from app.infra.db.models import User, Course, Project, Evaluation

# ✅ Also works
from app.infra.db.models import (
    School,
    ProjectTeam,
    ProjectAssessment,
    Competency,
)
```

### What Changed

The 3,455-line `models.py` file is now organized into 18 focused modules:

```
backend/app/infra/db/
├── base.py                    # Original Base class
├── session.py                 # Database session management
├── models_backup.py          # Backup of original models.py
└── models/                    # NEW: Modular structure
    ├── __init__.py           # Re-exports all models
    ├── base.py               # Base class & helpers
    ├── user.py               # 3 models
    ├── courses.py            # 7 models
    ├── projects.py           # 5 models
    ├── project_plan.py       # 3 models
    ├── rubrics.py            # 2 models
    ├── grading.py            # 2 models
    ├── assessments.py        # 11 models
    ├── competencies.py       # 11 models
    ├── learning.py           # 2 models
    ├── templates.py          # 11 models
    ├── clients.py            # 3 models
    ├── notes.py              # 2 models
    ├── skills.py             # 3 models
    ├── attendance.py         # 2 models
    ├── submissions.py        # 2 models
    ├── external.py           # 1 model
    └── system.py             # 5 models
```

## Finding Models

### By Domain

| Need a model for... | Look in... |
|---------------------|-----------|
| Users, authentication | `user.py` |
| Courses, academic structure | `courses.py` |
| Projects, teams | `projects.py` |
| Project planning (GO/NO-GO) | `project_plan.py` |
| Rubrics, criteria | `rubrics.py` |
| Grades | `grading.py` |
| Peer evaluations, assessments | `assessments.py` |
| Competency tracking | `competencies.py` |
| Learning objectives | `learning.py` |
| Template management | `templates.py` |
| Client management | `clients.py` |
| Project notes | `notes.py` |
| Skill trainings, tasks | `skills.py` |
| Attendance tracking | `attendance.py` |
| Assignment submissions | `submissions.py` |
| External evaluators | `external.py` |
| System (notifications, audit logs) | `system.py` |

### By Model Name

<details>
<summary>Click to expand full model index</summary>

| Model | File | Domain |
|-------|------|--------|
| School | user.py | Core |
| User | user.py | Core |
| RFIDCard | user.py | Attendance |
| Subject | courses.py | Academic |
| AcademicYear | courses.py | Academic |
| Class | courses.py | Academic |
| StudentClassMembership | courses.py | Academic |
| Course | courses.py | Academic |
| TeacherCourse | courses.py | Academic |
| CourseEnrollment | courses.py | Academic |
| Project | projects.py | Projects |
| Subproject | projects.py | Projects |
| ProjectTeam | projects.py | Projects |
| ProjectTeamMember | projects.py | Projects |
| ProjectTeamExternal | projects.py | Projects |
| ProjectPlan | project_plan.py | Projects |
| ProjectPlanTeam | project_plan.py | Projects |
| ProjectPlanSection | project_plan.py | Projects |
| Rubric | rubrics.py | Assessment |
| RubricCriterion | rubrics.py | Assessment |
| Grade | grading.py | Assessment |
| PublishedGrade | grading.py | Assessment |
| Evaluation | assessments.py | Assessment |
| Allocation | assessments.py | Assessment |
| Score | assessments.py | Assessment |
| ReviewerRating | assessments.py | Assessment |
| Reflection | assessments.py | Assessment |
| ProjectAssessment | assessments.py | Assessment |
| ProjectAssessmentTeam | assessments.py | Assessment |
| ProjectAssessmentScore | assessments.py | Assessment |
| ProjectAssessmentReflection | assessments.py | Assessment |
| ProjectAssessmentSelfAssessment | assessments.py | Assessment |
| ProjectAssessmentSelfAssessmentScore | assessments.py | Assessment |
| CompetencyCategory | competencies.py | Competency |
| Competency | competencies.py | Competency |
| CompetencyRubricLevel | competencies.py | Competency |
| CompetencyWindow | competencies.py | Competency |
| CompetencySelfScore | competencies.py | Competency |
| CompetencyPeerLabel | competencies.py | Competency |
| CompetencyTeacherObservation | competencies.py | Competency |
| CompetencyGoal | competencies.py | Competency |
| CompetencyReflection | competencies.py | Competency |
| CompetencyExternalInvite | competencies.py | Competency |
| CompetencyExternalScore | competencies.py | Competency |
| LearningObjective | learning.py | Learning |
| RubricCriterionLearningObjective | learning.py | Learning |
| PeerEvaluationCriterionTemplate | templates.py | Templates |
| ProjectAssessmentCriterionTemplate | templates.py | Templates |
| ProjectRubricTemplate | templates.py | Templates |
| ProjectRubricCriterionTemplate | templates.py | Templates |
| CompetencyTemplate | templates.py | Templates |
| CompetencyLevelDescriptorTemplate | templates.py | Templates |
| CompetencyReflectionQuestionTemplate | templates.py | Templates |
| MailTemplate | templates.py | Templates |
| StandardRemark | templates.py | Templates |
| TemplateTag | templates.py | Templates |
| TemplateTagLink | templates.py | Templates |
| Client | clients.py | External |
| ClientLog | clients.py | External |
| ClientProjectLink | clients.py | External |
| ProjectNotesContext | notes.py | Projects |
| ProjectNote | notes.py | Projects |
| Task | skills.py | Tasks |
| SkillTraining | skills.py | Skills |
| SkillTrainingProgress | skills.py | Skills |
| AttendanceEvent | attendance.py | Attendance |
| AttendanceAggregate | attendance.py | Attendance |
| AssignmentSubmission | submissions.py | Submissions |
| SubmissionEvent | submissions.py | Submissions |
| ExternalEvaluator | external.py | External |
| FeedbackSummary | system.py | System |
| SummaryGenerationJob | system.py | System |
| ScheduledJob | system.py | System |
| Notification | system.py | System |
| AuditLog | system.py | System |

</details>

## Adding New Models

When adding a new model:

1. **Choose the right module** - Place it with related models
2. **Import from base** - `from .base import Base, id_pk, tenant_fk`
3. **Add to `__all__`** - Add model name to module's `__all__` list
4. **Update `__init__.py`** - Add import and re-export in `models/__init__.py`

Example:

```python
# In models/user.py
from .base import Base, id_pk

class NewUserModel(Base):
    __tablename__ = "new_user_models"
    id: Mapped[int] = id_pk()
    # ... rest of model

# Don't forget to add to __all__
__all__ = ["School", "User", "RFIDCard", "NewUserModel"]

# Then in models/__init__.py
from .user import School, User, RFIDCard, NewUserModel

__all__ = [
    # ...
    "NewUserModel",
]
```

## Migration Notes

### For Alembic

No changes needed! Alembic will continue to work:

```bash
# Generate migrations (works as before)
alembic revision --autogenerate -m "Add new field"

# Apply migrations (works as before)
alembic upgrade head
```

### For Tests

No changes needed! All imports work as before:

```python
# In tests
from app.infra.db.models import User, Course, Project
# Works exactly as it did before
```

## Benefits

### Before
```
models.py (3,455 lines)
├─ Hard to navigate
├─ Slow IDE performance
├─ Merge conflicts common
└─ Difficult to find specific models
```

### After
```
models/ (18 files, ~200 lines each)
├─ Easy to navigate by domain
├─ Fast IDE performance
├─ Fewer merge conflicts
└─ Models organized logically
```

## FAQs

**Q: Do I need to update my imports?**  
A: No! All existing imports continue to work.

**Q: Will Alembic migrations still work?**  
A: Yes! No changes needed.

**Q: Are there any breaking changes?**  
A: No! Table names, columns, and relationships are identical.

**Q: Can I import from the submodules directly?**  
A: Yes, but not recommended. Use `from app.infra.db.models import Model` for consistency.

**Q: What if I can't find a model?**  
A: Check the model index above or search in `models/__init__.py`.

## Verification

Run the verification script:

```bash
cd backend
python3 -c "
from app.infra.db.models import *
from app.infra.db.base import Base
print(f'✓ {len(__all__)} models imported')
print(f'✓ {len(Base.metadata.tables)} tables registered')
"
```

Expected output:
```
✓ 78 models imported
✓ 75 tables registered
```
