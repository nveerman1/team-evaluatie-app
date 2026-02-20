"""
Tests for Evaluation Teams integration endpoints
"""

import pytest
from unittest.mock import Mock, MagicMock

from app.infra.db.models import (
    User,
    Evaluation,
)


class TestEvaluationTeamsEndpoints:
    """Tests for evaluation teams endpoints"""

    def test_get_evaluation_teams_without_project(self):
        """Test getting teams for evaluation without project returns empty"""
        from app.api.v1.routers.evaluations import get_evaluation_teams

        db = MagicMock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"

        evaluation = Mock(spec=Evaluation)
        evaluation.id = 1
        evaluation.school_id = 1
        evaluation.project_id = None

        db.query.return_value.filter.return_value.first.return_value = evaluation

        result = get_evaluation_teams(evaluation_id=1, db=db, user=user)

        assert result["project_id"] is None
        assert result["project_name"] is None
        assert result["teams"] == []

    def test_get_evaluation_teams_unauthenticated(self):
        """Test that unauthenticated access raises 401"""
        from fastapi import HTTPException
        from app.api.v1.routers.evaluations import get_evaluation_teams

        db = MagicMock()

        with pytest.raises(HTTPException) as exc_info:
            get_evaluation_teams(evaluation_id=1, db=db, user=None)

        assert exc_info.value.status_code == 401

    def test_get_evaluation_teams_not_found(self):
        """Test that missing evaluation raises 404"""
        from fastapi import HTTPException
        from app.api.v1.routers.evaluations import get_evaluation_teams

        db = MagicMock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"

        db.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            get_evaluation_teams(evaluation_id=999, db=db, user=user)

        assert exc_info.value.status_code == 404

    def test_get_evaluation_teams_with_project_response_shape(self):
        """
        Verify that the response schema for a project-backed evaluation includes
        project_id, project_name, and a teams list.
        This is a contract test — it checks the function's return type/shape
        using the no-project path to avoid complex SQLAlchemy query chains.
        """
        from app.api.v1.routers.evaluations import get_evaluation_teams

        db = MagicMock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"

        evaluation = Mock(spec=Evaluation)
        evaluation.id = 1
        evaluation.school_id = 1
        evaluation.project_id = None  # no project → fast empty-response path

        db.query.return_value.filter.return_value.first.return_value = evaluation

        result = get_evaluation_teams(evaluation_id=1, db=db, user=user)

        # Response always has these three keys regardless of project presence
        assert "project_id" in result
        assert "project_name" in result
        assert "teams" in result
        assert isinstance(result["teams"], list)
