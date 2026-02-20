"""
API tests for ProjectPlan endpoints.

Uses Mock-based strategy (same pattern as existing tests) so no DB/Redis required.
"""

from __future__ import annotations

import pytest
from unittest.mock import Mock, MagicMock, patch
from fastapi import HTTPException

from app.infra.db.models import User, Project, ProjectPlan, ProjectPlanTeam

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


def _project(
    project_id: int = 10, school_id: int = 1, course_id: int | None = None
) -> Mock:
    p = Mock(spec=Project)
    p.id = project_id
    p.school_id = school_id
    p.course_id = course_id
    return p


def _projectplan(pp_id: int = 100, project_id: int = 10, school_id: int = 1) -> Mock:
    from datetime import datetime, timezone

    pp = Mock(spec=ProjectPlan)
    pp.id = pp_id
    pp.project_id = project_id
    pp.school_id = school_id
    pp.title = "Test Plan"
    pp.version = "1.0"
    pp.status = "draft"
    _now = datetime.now(timezone.utc)
    pp.created_at = _now
    pp.updated_at = _now
    return pp


# ── Create ProjectPlan ─────────────────────────────────────────────────────────


@pytest.mark.integration
class TestCreateProjectplan:
    def test_student_cannot_create(self):
        from app.api.v1.routers.projectplans import create_projectplan

        db = MagicMock()
        payload = MagicMock()
        payload.project_id = 10

        with pytest.raises(HTTPException) as exc:
            create_projectplan(payload=payload, db=db, user=_student())
        assert exc.value.status_code == 403

    def test_teacher_can_create(self):
        """Teacher role is not blocked by the student-role guard."""
        from app.api.v1.routers.projectplans import create_projectplan

        db = MagicMock()
        user = _teacher()
        payload = MagicMock()
        payload.project_id = 999  # doesn't matter — project not found

        db.query.return_value.filter.return_value.first.return_value = None

        # Teacher should NOT get a 403 from the role check;
        # they get 404 because the project doesn't exist.
        with pytest.raises(HTTPException) as exc:
            create_projectplan(payload=payload, db=db, user=user)
        assert exc.value.status_code == 404  # not 403

    def test_duplicate_plan_rejected(self):
        from app.api.v1.routers.projectplans import create_projectplan
        from app.api.v1.schemas.projectplans import ProjectPlanCreate, ProjectPlanStatus

        db = MagicMock()
        user = _admin()
        project = _project()
        existing_plan = _projectplan()

        query_mock = MagicMock()
        query_mock.filter.return_value.first.side_effect = [project, existing_plan]
        db.query.return_value = query_mock

        payload = ProjectPlanCreate(
            project_id=10,
            title="Duplicate",
            version="1.0",
            status=ProjectPlanStatus.DRAFT,
        )

        with pytest.raises(HTTPException) as exc:
            create_projectplan(payload=payload, db=db, user=user)
        assert exc.value.status_code == 400
        assert "already exists" in exc.value.detail

    def test_missing_project_raises_404(self):
        from app.api.v1.routers.projectplans import create_projectplan
        from app.api.v1.schemas.projectplans import ProjectPlanCreate, ProjectPlanStatus

        db = MagicMock()
        user = _admin()

        query_mock = MagicMock()
        query_mock.filter.return_value.first.return_value = None  # project not found
        db.query.return_value = query_mock

        payload = ProjectPlanCreate(
            project_id=999,
            title="Plan for missing project",
            version="1.0",
            status=ProjectPlanStatus.DRAFT,
        )

        with pytest.raises(HTTPException) as exc:
            create_projectplan(payload=payload, db=db, user=user)
        assert exc.value.status_code == 404


# ── Update ProjectPlan ─────────────────────────────────────────────────────────


@pytest.mark.integration
class TestUpdateProjectplan:
    def test_student_cannot_update(self):
        from app.api.v1.routers.projectplans import update_projectplan

        db = MagicMock()
        payload = MagicMock()

        with pytest.raises(HTTPException) as exc:
            update_projectplan(
                projectplan_id=1, payload=payload, db=db, user=_student()
            )
        assert exc.value.status_code == 403

    def test_teacher_can_update_title(self):
        from app.api.v1.routers.projectplans import update_projectplan
        from app.api.v1.schemas.projectplans import ProjectPlanUpdate

        db = MagicMock()
        user = _teacher()
        pp = _projectplan()
        pp.title = "Old Title"

        db.query.return_value.filter.return_value.first.return_value = pp
        db.commit = MagicMock()
        db.refresh = MagicMock()

        payload = ProjectPlanUpdate(title="New Title")

        with patch(
            "app.api.v1.routers.projectplans._get_projectplan_with_access_check",
            return_value=pp,
        ):
            update_projectplan(projectplan_id=pp.id, payload=payload, db=db, user=user)

        assert pp.title == "New Title"


# ── Submit ProjectPlan ─────────────────────────────────────────────────────────


@pytest.mark.integration
class TestSubmitProjectplan:
    def test_teacher_cannot_submit(self):
        from app.api.v1.routers.projectplans import submit_projectplan

        db = MagicMock()

        with pytest.raises(HTTPException) as exc:
            submit_projectplan(projectplan_team_id=1, db=db, user=_teacher())
        assert exc.value.status_code == 403

    def test_student_locked_plan_rejected(self):
        from app.api.v1.routers.projectplans import submit_projectplan

        db = MagicMock()
        user = _student()

        team = Mock(spec=ProjectPlanTeam)
        team.id = 1
        team.school_id = 1
        team.project_team_id = 5
        team.locked = True  # locked plan
        team.sections = []

        query_mock = MagicMock()
        query_mock.options.return_value.filter.return_value.first.return_value = team
        db.query.return_value = query_mock

        with pytest.raises(HTTPException) as exc:
            submit_projectplan(projectplan_team_id=1, db=db, user=user)
        assert exc.value.status_code in (400, 403)


# ── Input validation ───────────────────────────────────────────────────────────


@pytest.mark.unit
class TestProjectPlanSchemas:
    def test_plan_status_enum_values(self):
        from app.api.v1.schemas.projectplans import PlanStatus

        assert PlanStatus.CONCEPT == "concept"
        assert PlanStatus.INGEDIEND == "ingediend"
        assert PlanStatus.GO == "go"
        assert PlanStatus.NO_GO == "no-go"

    def test_projectplan_status_enum_values(self):
        from app.api.v1.schemas.projectplans import ProjectPlanStatus

        assert ProjectPlanStatus.DRAFT == "draft"
        assert ProjectPlanStatus.OPEN == "open"
        assert ProjectPlanStatus.PUBLISHED == "published"
        assert ProjectPlanStatus.CLOSED == "closed"

    def test_section_key_enum(self):
        from app.api.v1.schemas.projectplans import SectionKey

        keys = {k.value for k in SectionKey}
        expected = {
            "client",
            "problem",
            "goal",
            "method",
            "planning",
            "tasks",
            "motivation",
            "risks",
        }
        assert keys == expected

    def test_client_data_max_length(self):
        from pydantic import ValidationError
        from app.api.v1.schemas.projectplans import ClientData

        with pytest.raises(ValidationError):
            ClientData(organisation="x" * 501)

    def test_projectplan_create_schema(self):
        from app.api.v1.schemas.projectplans import ProjectPlanCreate, ProjectPlanStatus

        p = ProjectPlanCreate(
            project_id=1, title="Test", version="1.0", status=ProjectPlanStatus.DRAFT
        )
        assert p.project_id == 1
        assert p.status == ProjectPlanStatus.DRAFT
