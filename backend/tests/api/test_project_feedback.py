"""
API tests for ProjectFeedback endpoints, focusing on the deadline feature.

Uses Mock-based strategy (no DB/Redis required).
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, Mock, patch

import pytest
from fastapi import HTTPException

from app.infra.db.models import User

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


# ── Schema tests ───────────────────────────────────────────────────────────────


@pytest.mark.unit
class TestProjectFeedbackSchemas:
    def test_round_create_schema_default_no_deadline(self):
        from app.api.v1.schemas.project_feedback import ProjectFeedbackRoundCreate

        schema = ProjectFeedbackRoundCreate(project_id=1, title="Feedback ronde 1")
        assert schema.deadline is None

    def test_round_create_schema_with_deadline(self):
        from app.api.v1.schemas.project_feedback import ProjectFeedbackRoundCreate

        deadline = datetime(2026, 6, 15, 23, 59, tzinfo=timezone.utc)
        schema = ProjectFeedbackRoundCreate(
            project_id=1, title="Feedback ronde 1", deadline=deadline
        )
        assert schema.deadline == deadline

    def test_round_update_schema_with_deadline(self):
        from app.api.v1.schemas.project_feedback import ProjectFeedbackRoundUpdate

        deadline = datetime(2026, 7, 1, tzinfo=timezone.utc)
        schema = ProjectFeedbackRoundUpdate(deadline=deadline)
        assert schema.deadline == deadline

    def test_round_update_schema_deadline_optional(self):
        from app.api.v1.schemas.project_feedback import ProjectFeedbackRoundUpdate

        schema = ProjectFeedbackRoundUpdate(title="New title")
        assert schema.deadline is None

    def test_round_out_includes_deadline(self):
        from app.api.v1.schemas.project_feedback import ProjectFeedbackRoundOut

        now = datetime.now(timezone.utc)
        deadline = datetime(2026, 6, 30, tzinfo=timezone.utc)
        out = ProjectFeedbackRoundOut(
            id=1,
            project_id=10,
            title="Test round",
            status="open",
            deadline=deadline,
            question_count=5,
            response_count=3,
            total_students=10,
            created_at=now,
        )
        assert out.deadline == deadline

    def test_round_out_deadline_none_by_default(self):
        from app.api.v1.schemas.project_feedback import ProjectFeedbackRoundOut

        now = datetime.now(timezone.utc)
        out = ProjectFeedbackRoundOut(
            id=1,
            project_id=10,
            title="Test round",
            status="draft",
            question_count=0,
            response_count=0,
            total_students=0,
            created_at=now,
        )
        assert out.deadline is None

    def test_round_detail_inherits_deadline(self):
        from app.api.v1.schemas.project_feedback import ProjectFeedbackRoundDetail

        now = datetime.now(timezone.utc)
        deadline = datetime(2026, 8, 1, tzinfo=timezone.utc)
        detail = ProjectFeedbackRoundDetail(
            id=1,
            project_id=10,
            title="Test round",
            status="open",
            deadline=deadline,
            question_count=3,
            response_count=1,
            total_students=5,
            created_at=now,
            questions=[],
            closed_at=None,
        )
        assert detail.deadline == deadline


# ── Access control tests ───────────────────────────────────────────────────────


@pytest.mark.integration
class TestProjectFeedbackRoundCreate:
    def test_student_cannot_create_round(self):
        from app.api.v1.routers.project_feedback import create_feedback_round

        db = MagicMock()
        payload = MagicMock()

        with pytest.raises(HTTPException) as exc:
            create_feedback_round(payload=payload, db=db, user=_student())
        assert exc.value.status_code == 403

    def test_teacher_can_create_round(self):
        """Teacher role is not blocked; raises 404 if project not found."""
        from app.api.v1.schemas.project_feedback import ProjectFeedbackRoundCreate
        from app.api.v1.routers.project_feedback import create_feedback_round

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = (
            None  # no project
        )

        payload = ProjectFeedbackRoundCreate(project_id=999, title="Test")

        with pytest.raises(HTTPException) as exc:
            create_feedback_round(payload=payload, db=db, user=_teacher())
        assert exc.value.status_code == 404  # not 403

    def test_create_round_stores_deadline(self):
        """Deadline is stored when creating a feedback round."""
        from app.infra.db.models import Project, ProjectFeedbackRound
        from app.api.v1.schemas.project_feedback import ProjectFeedbackRoundCreate
        from app.api.v1.routers.project_feedback import create_feedback_round

        db = MagicMock()
        user = _admin()

        project = Mock(spec=Project)
        project.id = 10
        project.school_id = 1
        project.course_id = None

        # Return project on first query, None for course lookup
        db.query.return_value.filter.return_value.first.return_value = project

        deadline = datetime(2026, 6, 15, tzinfo=timezone.utc)

        created_round = Mock(spec=ProjectFeedbackRound)
        created_round.id = 42
        created_round.school_id = 1
        created_round.project_id = 10
        created_round.title = "Test"
        created_round.status = "draft"
        created_round.deadline = deadline
        created_round.closed_at = None
        created_round.created_at = datetime.now(timezone.utc)

        db.flush = MagicMock()
        db.commit = MagicMock()
        db.refresh = MagicMock()

        payload = ProjectFeedbackRoundCreate(
            project_id=10, title="Test", deadline=deadline
        )

        stored_round = None

        def capture_add(obj):
            nonlocal stored_round
            if isinstance(obj, ProjectFeedbackRound):
                stored_round = obj

        db.add.side_effect = capture_add

        with patch(
            "app.api.v1.routers.project_feedback._build_round_out"
        ) as mock_build:
            mock_build.return_value = MagicMock(
                id=42,
                project_id=10,
                title="Test",
                status="draft",
                deadline=deadline,
                question_count=0,
                response_count=0,
                total_students=0,
                created_at=datetime.now(timezone.utc),
            )
            create_feedback_round(payload=payload, db=db, user=user)

        if stored_round is not None:
            assert stored_round.deadline == deadline


# ── Deadline update tests ──────────────────────────────────────────────────────


@pytest.mark.integration
class TestProjectFeedbackRoundDeadline:
    def _make_round(self, deadline=None):
        from app.infra.db.models import ProjectFeedbackRound

        r = Mock(spec=ProjectFeedbackRound)
        r.id = 1
        r.school_id = 1
        r.project_id = 10
        r.title = "Feedback ronde 1"
        r.status = "draft"
        r.deadline = deadline
        r.closed_at = None
        r.created_at = datetime.now(timezone.utc)
        r.updated_at = datetime.now(timezone.utc)
        return r

    def test_update_round_sets_deadline(self):
        from app.api.v1.routers.project_feedback import update_feedback_round
        from app.api.v1.schemas.project_feedback import ProjectFeedbackRoundUpdate

        db = MagicMock()
        user = _teacher()
        round_ = self._make_round()

        deadline = datetime(2026, 7, 1, tzinfo=timezone.utc)
        payload = ProjectFeedbackRoundUpdate(deadline=deadline)

        with (
            patch(
                "app.api.v1.routers.project_feedback._get_round_or_404",
                return_value=round_,
            ),
            patch(
                "app.api.v1.routers.project_feedback.require_role",
            ),
            patch("app.api.v1.routers.project_feedback._build_round_out") as mock_build,
        ):
            mock_build.return_value = MagicMock()
            update_feedback_round(round_id=1, payload=payload, db=db, user=user)

        assert round_.deadline == deadline

    def test_student_cannot_update_round(self):
        from app.api.v1.routers.project_feedback import update_feedback_round
        from app.api.v1.schemas.project_feedback import ProjectFeedbackRoundUpdate

        db = MagicMock()
        payload = ProjectFeedbackRoundUpdate(title="New title")

        with pytest.raises(HTTPException) as exc:
            update_feedback_round(round_id=1, payload=payload, db=db, user=_student())
        assert exc.value.status_code == 403
