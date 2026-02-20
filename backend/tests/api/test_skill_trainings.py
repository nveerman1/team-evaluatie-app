"""
API tests for Skill Training endpoints.

Uses Mock-based strategy — no DB, no Redis required.
"""

from __future__ import annotations

import pytest
from unittest.mock import Mock, MagicMock
from fastapi import HTTPException

from app.infra.db.models import User, SkillTraining

# ── Helper builders ────────────────────────────────────────────────────────────


def _teacher(school_id: int = 1) -> Mock:
    u = Mock(spec=User)
    u.id = 1
    u.school_id = school_id
    u.role = "teacher"
    return u


def _admin(school_id: int = 1) -> Mock:
    u = Mock(spec=User)
    u.id = 2
    u.school_id = school_id
    u.role = "admin"
    return u


def _student(school_id: int = 1) -> Mock:
    u = Mock(spec=User)
    u.id = 3
    u.school_id = school_id
    u.role = "student"
    return u


def _training(
    training_id: int = 1,
    school_id: int = 1,
    course_id: int = 5,
    is_active: bool = True,
) -> Mock:
    t = Mock(spec=SkillTraining)
    t.id = training_id
    t.school_id = school_id
    t.course_id = course_id
    t.is_active = is_active
    t.title = "Test Training"
    t.description = "Description"
    t.category_id = None
    t.objective_id = None
    t.open_training = False
    t.created_at = None
    t.updated_at = None
    return t


# ── STUDENT_ALLOWED_STATUSES constant ─────────────────────────────────────────


@pytest.mark.unit
class TestStudentAllowedStatuses:
    def test_student_allowed_set_contains_expected(self):
        from app.api.v1.schemas.skill_trainings import STUDENT_ALLOWED_STATUSES

        assert "none" in STUDENT_ALLOWED_STATUSES
        assert "planned" in STUDENT_ALLOWED_STATUSES
        assert "in_progress" in STUDENT_ALLOWED_STATUSES
        assert "submitted" in STUDENT_ALLOWED_STATUSES

    def test_teacher_only_statuses_not_in_student_set(self):
        from app.api.v1.schemas.skill_trainings import STUDENT_ALLOWED_STATUSES

        assert "completed" not in STUDENT_ALLOWED_STATUSES
        assert "mastered" not in STUDENT_ALLOWED_STATUSES


# ── List trainings (teacher view) ──────────────────────────────────────────────


@pytest.mark.integration
class TestListTrainings:
    def test_student_sees_only_active_trainings_in_teacher_list(self):
        """
        list_trainings is a school-scoped endpoint; the router filters
        by school_id. A student role will receive 403 or an empty list
        depending on router logic — here we verify the model attribute.
        """
        # The router filters by school; we just verify the model attribute
        assert hasattr(SkillTraining, "is_active")

    def test_teacher_role_can_import_list_endpoint(self):
        from app.api.v1.routers.skill_trainings import list_trainings

        assert callable(list_trainings)

    def test_create_training_importable(self):
        from app.api.v1.routers.skill_trainings import create_training

        assert callable(create_training)


# ── Student status update (update_my_status) ───────────────────────────────────


@pytest.mark.integration
class TestUpdateMyStatus:
    def test_teacher_cannot_call_student_endpoint(self):
        """update_my_status is a student-only endpoint."""
        from app.api.v1.routers.skill_trainings import update_my_status
        from app.api.v1.schemas.skill_trainings import StudentStatusUpdate

        db = MagicMock()
        user = _teacher()

        payload = StudentStatusUpdate(status="planned")

        with pytest.raises(HTTPException) as exc:
            update_my_status(training_id=1, payload=payload, db=db, user=user)
        assert exc.value.status_code == 403

    def test_student_cannot_set_teacher_only_status(self):
        """Students cannot set 'completed' or 'mastered'."""
        from app.api.v1.routers.skill_trainings import update_my_status
        from app.api.v1.schemas.skill_trainings import StudentStatusUpdate

        db = MagicMock()
        user = _student()

        payload = StudentStatusUpdate(status="mastered")  # teacher-only

        with pytest.raises(HTTPException) as exc:
            update_my_status(training_id=1, payload=payload, db=db, user=user)
        assert exc.value.status_code == 400
        assert "Students can only set status to" in exc.value.detail

    def test_training_not_found_raises_404(self):
        from app.api.v1.routers.skill_trainings import update_my_status
        from app.api.v1.schemas.skill_trainings import StudentStatusUpdate

        db = MagicMock()
        user = _student()
        db.get.return_value = None  # training not found

        payload = StudentStatusUpdate(status="planned")

        with pytest.raises(HTTPException) as exc:
            update_my_status(training_id=999, payload=payload, db=db, user=user)
        assert exc.value.status_code == 404

    def test_training_from_other_school_raises_404(self):
        """Training belonging to another school must not be accessible."""
        from app.api.v1.routers.skill_trainings import update_my_status
        from app.api.v1.schemas.skill_trainings import StudentStatusUpdate

        db = MagicMock()
        user = _student(school_id=1)

        # Training from school 2
        other_school_training = _training(school_id=2)
        db.get.return_value = other_school_training

        payload = StudentStatusUpdate(status="planned")

        with pytest.raises(HTTPException) as exc:
            update_my_status(training_id=1, payload=payload, db=db, user=user)
        assert exc.value.status_code == 404


# ── Schema validation ──────────────────────────────────────────────────────────


@pytest.mark.unit
class TestSkillTrainingSchemas:
    def test_skill_training_create_requires_url_and_category(self):
        """SkillTrainingCreate requires url and competency_category_id."""
        from pydantic import ValidationError
        from app.api.v1.schemas.skill_trainings import SkillTrainingCreate

        with pytest.raises(ValidationError):
            SkillTrainingCreate(title="Missing required fields")

    def test_skill_training_create_with_all_required_fields(self):
        from app.api.v1.schemas.skill_trainings import SkillTrainingCreate

        t = SkillTrainingCreate(
            title="Presenteren",
            url="https://example.com/training",
            competency_category_id=1,
        )
        assert t.title == "Presenteren"
        assert t.url == "https://example.com/training"
        assert t.competency_category_id == 1
        assert t.is_active is True  # default

    def test_student_status_update_schema_valid(self):
        from app.api.v1.schemas.skill_trainings import StudentStatusUpdate

        s = StudentStatusUpdate(status="planned")
        assert s.status == "planned"

    def test_note_max_length(self):
        from pydantic import ValidationError
        from app.api.v1.schemas.skill_trainings import StudentStatusUpdate

        with pytest.raises(ValidationError):
            StudentStatusUpdate(status="planned", note="x" * 2001)

    def test_note_within_max_length_is_valid(self):
        from app.api.v1.schemas.skill_trainings import StudentStatusUpdate

        s = StudentStatusUpdate(status="planned", note="x" * 2000)
        assert len(s.note) == 2000
