"""
Tests for external assessments router - specifically testing that
_get_member_names uses the correct ProjectTeamMember fields.

The bug was that _get_member_names used:
  - ProjectTeamMember.team_id (non-existent field; should be project_team_id)
  - ProjectTeamMember.active  (non-existent field; ProjectTeamMember has no active column)

Both of these caused AttributeError at runtime, making every invitation link
return a 500 error and appear broken ("Ongeldige of verlopen uitnodiging").
"""

from unittest.mock import MagicMock, patch
import pytest


class TestGetMemberNames:
    """Tests for the _get_member_names helper in external_assessments router."""

    def test_uses_project_team_id_not_team_id(self):
        """
        ProjectTeamMember has a 'project_team_id' column, not 'team_id'.
        Accessing .team_id raises AttributeError, which breaks the endpoint.
        Verify the fixed code uses .project_team_id.
        """
        from app.infra.db.models import ProjectTeamMember

        # project_team_id must exist as a mapped attribute
        assert hasattr(
            ProjectTeamMember, "project_team_id"
        ), "ProjectTeamMember must have a 'project_team_id' mapped column"

        # team_id must NOT exist as a mapped attribute
        assert not hasattr(
            ProjectTeamMember, "team_id"
        ), "ProjectTeamMember must NOT have a 'team_id' attribute"

    def test_no_active_field_on_project_team_member(self):
        """
        ProjectTeamMember has no 'active' column.
        Accessing .active raises AttributeError, which breaks the endpoint.
        Verify that the model does not have this field and we no longer use it.
        """
        from app.infra.db.models import ProjectTeamMember

        assert not hasattr(
            ProjectTeamMember, "active"
        ), "ProjectTeamMember must NOT have an 'active' attribute"

    def test_get_member_names_returns_empty_when_no_team(self):
        """
        When no ProjectTeam is found for the given project_id + team_number,
        _get_member_names must return '' without hitting the ProjectTeamMember query.
        """
        from app.api.v1.routers.external_assessments import _get_member_names

        mock_db = MagicMock()
        # Make the ProjectTeam query return None (no team found)
        mock_db.query.return_value.filter.return_value.first.return_value = None

        result = _get_member_names(mock_db, project_id=1, team_number=1)

        assert result == ""

    def test_get_member_names_uses_correct_filter_field(self):
        """
        When a ProjectTeam IS found, the subsequent User query must filter
        by ProjectTeamMember.project_team_id (not .team_id) and must NOT
        reference ProjectTeamMember.active.

        This test verifies the query can be constructed without AttributeError.
        """
        from app.api.v1.routers.external_assessments import _get_member_names
        from app.infra.db.models import ProjectTeam, User

        # Build mock objects
        mock_team = MagicMock(spec=ProjectTeam)
        mock_team.id = 42

        mock_user = MagicMock(spec=User)
        mock_user.name = "Test Student"
        mock_user.archived = False

        mock_db = MagicMock()

        # First query (ProjectTeam lookup) returns our mock team
        # Second query chain (User + join + filter) returns a list with one user
        def query_side_effect(model):
            q = MagicMock()
            if model is ProjectTeam:
                q.filter.return_value.first.return_value = mock_team
            else:
                # User query chain
                q.join.return_value.filter.return_value.all.return_value = [mock_user]
            return q

        mock_db.query.side_effect = query_side_effect

        # Must not raise AttributeError – that would mean team_id or active was used
        result = _get_member_names(mock_db, project_id=1, team_number=1)

        assert result == "Test Student"
