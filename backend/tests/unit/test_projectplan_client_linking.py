"""
Unit tests for projectplan client-linking and subproject auto-creation (Feature A & B).

Pure-function / mock-based tests — no real DB required.
"""

from __future__ import annotations

from unittest.mock import MagicMock, Mock, patch, call
import pytest

from app.infra.db.models import (
    Client,
    ProjectPlan,
    ProjectPlanTeam,
    ProjectPlanSection,
    ProjectTeam,
    Subproject,
    User,
)
from app.api.v1.schemas.projectplans import (
    LinkClientAction,
    LinkClientRequest,
    ProjectPlanTeamUpdate,
)
from app.api.v1.routers.projectplans import (
    suggest_client,
    link_client,
    update_team_status,
)
from fastapi import HTTPException

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_user(role: str = "teacher", school_id: int = 1) -> Mock:
    u = Mock(spec=User)
    u.id = 99
    u.school_id = school_id
    u.role = role
    return u


def _make_db() -> MagicMock:
    return MagicMock()


def _make_pp(project_id: int = 10) -> Mock:
    pp = Mock(spec=ProjectPlan)
    pp.id = 1
    pp.project_id = project_id
    pp.school_id = 1
    return pp


def _make_ppt(plan_id: int = 1, team_id: int = 5) -> Mock:
    ppt = Mock(spec=ProjectPlanTeam)
    ppt.id = 2
    ppt.project_plan_id = plan_id
    ppt.project_team_id = team_id
    ppt.school_id = 1
    ppt.status = "ingediend"
    ppt.locked = False
    ppt.title = None
    ppt.global_teacher_note = None
    ppt.sections = []
    return ppt


def _make_client_section(org: str = "ACME BV", email: str = "info@acme.nl") -> Mock:
    s = Mock(spec=ProjectPlanSection)
    s.id = 3
    s.key = "client"
    s.school_id = 1
    s.client_organisation = org
    s.client_email = email
    s.client_contact = "Jan Jansen"
    s.client_phone = "0612345678"
    s.client_description = None
    s.client_id = None
    return s


# ---------------------------------------------------------------------------
# suggest_client
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestSuggestClient:
    """Tests for GET suggest-client endpoint."""

    def _setup_db(self, db, ppt, client_section, candidates):
        """Wire db.query() calls for suggest_client."""
        # query(ProjectPlanTeam) → ppt
        # query(ProjectPlanSection) → client_section
        # query(Client) → candidates

        def query_side_effect(model):
            q = MagicMock()
            q.filter.return_value = q
            q.limit.return_value = q
            if model is ProjectPlanTeam:
                q.first.return_value = ppt
            elif model is ProjectPlanSection:
                q.first.return_value = client_section
            elif model is Client:
                q.all.return_value = candidates
            else:
                q.first.return_value = None
                q.all.return_value = []
            return q

        db.query.side_effect = query_side_effect

    def test_returns_empty_list_when_no_org_name(self):
        db = _make_db()
        user = _make_user()
        ppt = _make_ppt()
        section = _make_client_section()
        section.client_organisation = None

        def query_side_effect(model):
            q = MagicMock()
            q.filter.return_value = q
            if model is ProjectPlanTeam:
                q.first.return_value = ppt
            elif model is ProjectPlanSection:
                q.first.return_value = section
            else:
                q.first.return_value = None
            return q

        db.query.side_effect = query_side_effect

        with patch(
            "app.api.v1.routers.projectplans._get_projectplan_with_access_check",
            return_value=_make_pp(),
        ):
            result = suggest_client(projectplan_id=1, team_id=2, db=db, user=user)

        assert result == []

    def test_returns_exact_match_with_score_1(self):
        db = _make_db()
        user = _make_user()
        ppt = _make_ppt()
        section = _make_client_section(org="ACME BV")

        mock_client = Mock(spec=Client)
        mock_client.id = 42
        mock_client.organization = "ACME BV"
        mock_client.contact_name = "Jan"
        mock_client.email = "info@acme.nl"
        mock_client.phone = "0612"

        self._setup_db(db, ppt, section, [mock_client])

        with patch(
            "app.api.v1.routers.projectplans._get_projectplan_with_access_check",
            return_value=_make_pp(),
        ):
            result = suggest_client(projectplan_id=1, team_id=2, db=db, user=user)

        assert len(result) == 1
        assert result[0].match_score == 1.0
        assert result[0].id == 42

    def test_partial_match_has_lower_score(self):
        db = _make_db()
        user = _make_user()
        ppt = _make_ppt()
        section = _make_client_section(org="ACME")

        mock_client = Mock(spec=Client)
        mock_client.id = 7
        mock_client.organization = "ACME Holding BV"
        mock_client.contact_name = None
        mock_client.email = None
        mock_client.phone = None

        self._setup_db(db, ppt, section, [mock_client])

        with patch(
            "app.api.v1.routers.projectplans._get_projectplan_with_access_check",
            return_value=_make_pp(),
        ):
            result = suggest_client(projectplan_id=1, team_id=2, db=db, user=user)

        assert len(result) == 1
        assert result[0].match_score < 1.0

    def test_email_match_boosts_partial_score(self):
        db = _make_db()
        user = _make_user()
        ppt = _make_ppt()
        section = _make_client_section(org="ACME", email="info@acme.nl")

        client_with_email = Mock(spec=Client)
        client_with_email.id = 10
        client_with_email.organization = "ACME International"
        client_with_email.contact_name = None
        client_with_email.email = "info@acme.nl"
        client_with_email.phone = None

        client_no_email = Mock(spec=Client)
        client_no_email.id = 11
        client_no_email.organization = "ACME Local"
        client_no_email.contact_name = None
        client_no_email.email = None
        client_no_email.phone = None

        self._setup_db(db, ppt, section, [client_no_email, client_with_email])

        with patch(
            "app.api.v1.routers.projectplans._get_projectplan_with_access_check",
            return_value=_make_pp(),
        ):
            result = suggest_client(projectplan_id=1, team_id=2, db=db, user=user)

        # Both are partial matches (startswith-type). client_with_email should rank higher
        assert result[0].id == client_with_email.id
        assert result[0].match_score > result[1].match_score

    def test_raises_403_for_students(self):
        db = _make_db()
        user = _make_user(role="student")

        with pytest.raises(HTTPException) as exc:
            suggest_client(projectplan_id=1, team_id=2, db=db, user=user)

        assert exc.value.status_code == 403

    def test_wildcards_in_org_name_do_not_cause_errors(self):
        """A % or _ in the org name should not crash the suggest endpoint."""
        db = _make_db()
        user = _make_user()
        ppt = _make_ppt()
        section = _make_client_section(org="100% BV")

        self._setup_db(db, ppt, section, [])

        with patch(
            "app.api.v1.routers.projectplans._get_projectplan_with_access_check",
            return_value=_make_pp(),
        ):
            # Should not raise; wildcards are escaped so query runs normally
            result = suggest_client(projectplan_id=1, team_id=2, db=db, user=user)

        assert result == []
        assert db.query.called


# ---------------------------------------------------------------------------
# link_client
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestLinkClient:
    """Tests for POST link-client endpoint."""

    def _setup_db(self, db, ppt, client_section, existing_client=None):
        def query_side_effect(model):
            q = MagicMock()
            q.filter.return_value = q
            q.first.return_value = None
            if model is ProjectPlanTeam:
                q.first.return_value = ppt
            elif model is ProjectPlanSection:
                q.first.return_value = client_section
            elif model is Client and existing_client:
                q.first.return_value = existing_client
            return q

        db.query.side_effect = query_side_effect

    def test_match_existing_links_client(self):
        db = _make_db()
        user = _make_user()
        ppt = _make_ppt()
        section = _make_client_section()

        mock_client = Mock(spec=Client)
        mock_client.id = 55
        mock_client.school_id = 1
        mock_client.organization = "ACME BV"
        mock_client.contact_name = "Piet"
        mock_client.email = "piet@acme.nl"
        mock_client.phone = None

        self._setup_db(db, ppt, section, existing_client=mock_client)

        payload = LinkClientRequest(
            action=LinkClientAction.MATCH_EXISTING, client_id=55
        )

        with patch(
            "app.api.v1.routers.projectplans._get_projectplan_with_access_check",
            return_value=_make_pp(),
        ):
            result = link_client(
                projectplan_id=1, team_id=2, payload=payload, db=db, user=user
            )

        assert result.client_id == 55
        assert section.client_id == 55
        db.commit.assert_called_once()

    def test_match_existing_missing_client_id_raises_400(self):
        db = _make_db()
        user = _make_user()
        ppt = _make_ppt()
        section = _make_client_section()
        self._setup_db(db, ppt, section)

        payload = LinkClientRequest(action=LinkClientAction.MATCH_EXISTING)

        with patch(
            "app.api.v1.routers.projectplans._get_projectplan_with_access_check",
            return_value=_make_pp(),
        ):
            with pytest.raises(HTTPException) as exc:
                link_client(
                    projectplan_id=1, team_id=2, payload=payload, db=db, user=user
                )

        assert exc.value.status_code == 400

    def test_create_new_missing_org_name_raises_400(self):
        db = _make_db()
        user = _make_user()
        ppt = _make_ppt()
        section = _make_client_section()
        section.client_organisation = None
        self._setup_db(db, ppt, section)

        payload = LinkClientRequest(action=LinkClientAction.CREATE_NEW)

        with patch(
            "app.api.v1.routers.projectplans._get_projectplan_with_access_check",
            return_value=_make_pp(),
        ):
            with pytest.raises(HTTPException) as exc:
                link_client(
                    projectplan_id=1, team_id=2, payload=payload, db=db, user=user
                )

        assert exc.value.status_code == 400

    def test_create_new_duplicate_raises_409(self):
        db = _make_db()
        user = _make_user()
        ppt = _make_ppt()
        section = _make_client_section()

        duplicate = Mock(spec=Client)
        duplicate.id = 77
        duplicate.organization = "ACME BV"

        self._setup_db(db, ppt, section, existing_client=duplicate)

        payload = LinkClientRequest(action=LinkClientAction.CREATE_NEW)

        with patch(
            "app.api.v1.routers.projectplans._get_projectplan_with_access_check",
            return_value=_make_pp(),
        ):
            with pytest.raises(HTTPException) as exc:
                link_client(
                    projectplan_id=1, team_id=2, payload=payload, db=db, user=user
                )

        assert exc.value.status_code == 409

    def test_raises_403_for_students(self):
        db = _make_db()
        user = _make_user(role="student")
        payload = LinkClientRequest(action=LinkClientAction.CREATE_NEW)

        with pytest.raises(HTTPException) as exc:
            link_client(projectplan_id=1, team_id=2, payload=payload, db=db, user=user)

        assert exc.value.status_code == 403


# ---------------------------------------------------------------------------
# update_team_status — subproject auto-creation (Feature B)
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestUpdateTeamStatusSubproject:
    """Tests for auto-create Subproject on GO status."""

    def _make_section(self, key: str, status: str = "submitted", client_id=None):
        s = Mock(spec=ProjectPlanSection)
        s.key = key
        s.status = status
        s.client_id = client_id
        return s

    def _build_db(self, pp, ppt, project_team, existing_subproject=None):
        db = MagicMock()

        def query_side_effect(model):
            q = MagicMock()
            q.filter.return_value = q
            q.options.return_value = q
            q.first.return_value = None
            q.all.return_value = []
            if model is ProjectPlan:
                q.first.return_value = pp
            elif model is ProjectPlanTeam:
                q.first.return_value = ppt
            elif model is ProjectTeam:
                q.first.return_value = project_team
            elif model is Subproject:
                q.first.return_value = existing_subproject
            return q

        db.query.side_effect = query_side_effect
        return db

    def test_go_status_creates_subproject(self):
        user = _make_user()
        pp = _make_pp(project_id=10)

        client_s = self._make_section("client", "submitted", client_id=42)
        ppt = _make_ppt()
        ppt.status = "ingediend"
        ppt.sections = [client_s, self._make_section("problem")]

        project_team = Mock(spec=ProjectTeam)
        project_team.id = 5
        project_team.team_number = 3
        project_team.school_id = 1

        db = self._build_db(pp, ppt, project_team, existing_subproject=None)

        payload = ProjectPlanTeamUpdate(status="go")

        with patch(
            "app.api.v1.routers.projectplans._get_projectplan_with_access_check",
            return_value=pp,
        ), patch("app.api.v1.routers.projectplans._team_to_out", return_value=Mock()):
            update_team_status(
                projectplan_id=1, team_id=2, payload=payload, db=db, user=user
            )

        # Subproject should have been added to the session
        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, Subproject)
        assert added.project_id == 10
        assert added.team_number == 3
        assert added.client_id == 42
        assert added.school_id == 1

    def test_go_status_does_not_duplicate_subproject(self):
        user = _make_user()
        pp = _make_pp(project_id=10)

        ppt = _make_ppt()
        ppt.status = "ingediend"
        ppt.sections = []

        project_team = Mock(spec=ProjectTeam)
        project_team.id = 5
        project_team.team_number = 3
        project_team.school_id = 1

        existing_sp = Mock(spec=Subproject)
        existing_sp.id = 99

        db = self._build_db(pp, ppt, project_team, existing_subproject=existing_sp)

        payload = ProjectPlanTeamUpdate(status="go")

        with patch(
            "app.api.v1.routers.projectplans._get_projectplan_with_access_check",
            return_value=pp,
        ), patch("app.api.v1.routers.projectplans._team_to_out", return_value=Mock()):
            update_team_status(
                projectplan_id=1, team_id=2, payload=payload, db=db, user=user
            )

        # db.add should NOT have been called for a Subproject
        for add_call in db.add.call_args_list:
            assert not isinstance(add_call[0][0], Subproject)

    def test_subproject_title_falls_back_to_team_number(self):
        user = _make_user()
        pp = _make_pp()

        ppt = _make_ppt()
        ppt.status = "ingediend"
        ppt.title = None  # No title set
        ppt.sections = []

        project_team = Mock(spec=ProjectTeam)
        project_team.id = 5
        project_team.team_number = 7
        project_team.school_id = 1

        db = self._build_db(pp, ppt, project_team, existing_subproject=None)

        payload = ProjectPlanTeamUpdate(status="go")

        with patch(
            "app.api.v1.routers.projectplans._get_projectplan_with_access_check",
            return_value=pp,
        ), patch("app.api.v1.routers.projectplans._team_to_out", return_value=Mock()):
            update_team_status(
                projectplan_id=1, team_id=2, payload=payload, db=db, user=user
            )

        added = db.add.call_args[0][0]
        assert "7" in added.title  # Should contain team number
