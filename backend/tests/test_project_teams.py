"""
Tests for Project Teams API endpoints and service
"""

import pytest
from unittest.mock import Mock, patch
from datetime import datetime, timezone
from fastapi import HTTPException

from app.infra.db.models import (
    User,
    Project,
    ProjectTeam,
    Group,
    Evaluation,
    ProjectAssessment,
)
from app.infra.services.project_team_service import ProjectTeamService


class TestProjectTeamService:
    """Tests for ProjectTeamService"""

    def test_create_project_team_with_team_id(self):
        """Test creating a project team linked to existing group"""
        db = Mock()
        school_id = 1
        project_id = 10
        team_id = 5

        # Mock project
        project = Mock(spec=Project)
        project.id = project_id
        project.school_id = school_id
        db.query().filter().first.return_value = project

        # Mock group
        group = Mock(spec=Group)
        group.id = team_id
        group.name = "Test Team"
        group.school_id = school_id
        
        # Setup query mock to return project first, then group
        def side_effect(*args, **kwargs):
            mock_obj = Mock()
            if "Project" in str(args):
                mock_obj.filter().first.return_value = project
            else:
                mock_obj.filter().first.return_value = group
            return mock_obj
        
        db.query.side_effect = side_effect

        # Create project team
        ProjectTeamService.create_project_team(
            db=db,
            project_id=project_id,
            school_id=school_id,
            team_id=team_id,
        )

        # Verify ProjectTeam was added
        assert db.add.called
        assert db.flush.called

    def test_create_project_team_requires_name_or_team_id(self):
        """Test that either team_id or team_name must be provided"""
        db = Mock()
        
        # Mock project exists
        project = Mock(spec=Project)
        db.query().filter().first.return_value = project

        with pytest.raises(HTTPException) as exc_info:
            ProjectTeamService.create_project_team(
                db=db,
                project_id=10,
                school_id=1,
                team_id=None,
                team_name=None,
            )

        assert exc_info.value.status_code == 400
        assert "team_id or team_name" in str(exc_info.value.detail)

    def test_add_members_checks_team_locked(self):
        """Test that adding members to locked team raises 409"""
        db = Mock()
        
        # Mock project team exists
        project_team = Mock(spec=ProjectTeam)
        project_team.id = 1
        project_team.school_id = 1
        db.query().filter().first.return_value = project_team

        # Mock that team has evaluations (locked)
        evaluation = Mock(spec=Evaluation)
        
        def query_side_effect(model):
            mock_query = Mock()
            if model == ProjectTeam:
                mock_query.filter().first.return_value = project_team
            elif model == Evaluation:
                mock_query.filter().first.return_value = evaluation  # Team is locked
            else:
                mock_query.filter().first.return_value = None
            return mock_query
        
        db.query.side_effect = query_side_effect

        with pytest.raises(HTTPException) as exc_info:
            ProjectTeamService.add_members(
                db=db,
                project_team_id=1,
                school_id=1,
                member_user_ids=[(100, None)],
            )

        assert exc_info.value.status_code == 409
        assert "locked" in str(exc_info.value.detail).lower()

    def test_add_members_validates_users_exist(self):
        """Test that adding members validates all user IDs exist"""
        db = Mock()
        
        # Mock project team exists
        project_team = Mock(spec=ProjectTeam)
        project_team.id = 1
        project_team.school_id = 1

        # Create proper user ID mocks that have .id attributes
        user1 = Mock()
        user1.id = 100
        user2 = Mock()
        user2.id = 101

        # Mock team is not locked
        def query_side_effect(model_or_column):
            mock_query = Mock()
            # Handle User.id column query
            if hasattr(model_or_column, 'class_'):
                # This is a column like User.id
                mock_query.filter().all.return_value = [user1, user2]
            # Use type comparison for model queries
            elif isinstance(model_or_column, type) and issubclass(model_or_column, ProjectTeam):
                mock_query.filter().first.return_value = project_team
            else:
                mock_query.filter().first.return_value = None
            return mock_query
        
        db.query.side_effect = query_side_effect

        with pytest.raises(HTTPException) as exc_info:
            ProjectTeamService.add_members(
                db=db,
                project_team_id=1,
                school_id=1,
                member_user_ids=[(100, None), (101, None), (102, None)],  # 102 doesn't exist
            )

        assert exc_info.value.status_code == 400
        assert "not found" in str(exc_info.value.detail).lower()

    def test_clone_project_teams_copies_all_teams(self):
        """Test cloning project teams from source to target"""
        db = Mock()
        
        # Mock source and target projects exist
        source_project = Mock(spec=Project)
        source_project.id = 1
        source_project.school_id = 1
        
        target_project = Mock(spec=Project)
        target_project.id = 2
        target_project.school_id = 1

        # Mock source teams
        source_team1 = Mock(spec=ProjectTeam)
        source_team1.id = 10
        source_team1.team_id = 5
        source_team1.display_name_at_time = "Team A"
        source_team1.members = [
            Mock(user_id=100, role="Leader"),
            Mock(user_id=101, role="Member"),
        ]
        
        source_teams = [source_team1]

        # Setup query mocks
        def query_side_effect(model):
            mock_query = Mock()
            if model == Project:
                # Return source then target
                results = [source_project, target_project]
                mock_query.filter().first.side_effect = results
            elif model == ProjectTeam:
                mock_query.options().filter().all.return_value = source_teams
            return mock_query
        
        db.query.side_effect = query_side_effect

        # Clone teams
        teams_cloned, members_cloned, new_ids = ProjectTeamService.clone_project_teams(
            db=db,
            source_project_id=1,
            target_project_id=2,
            school_id=1,
        )

        # Verify results
        assert teams_cloned == 1
        assert members_cloned == 2
        assert db.add.call_count >= 3  # 1 team + 2 members

    def test_is_project_team_locked_checks_all_relations(self):
        """Test that locked check considers evaluations, assessments, and notes"""
        db = Mock()
        project_team_id = 1

        # Test with evaluation - should be locked
        def query_with_eval(model):
            mock_query = Mock()
            if model == Evaluation:
                mock_query.filter().first.return_value = Mock()  # Has evaluation
            else:
                mock_query.filter().first.return_value = None
            return mock_query
        
        db.query.side_effect = query_with_eval
        assert ProjectTeamService._is_project_team_locked(db, project_team_id) is True

        # Test with assessment - should be locked
        def query_with_assessment(model):
            mock_query = Mock()
            if model == ProjectAssessment:
                mock_query.filter().first.return_value = Mock()  # Has assessment
            else:
                mock_query.filter().first.return_value = None
            return mock_query
        
        db.query.side_effect = query_with_assessment
        assert ProjectTeamService._is_project_team_locked(db, project_team_id) is True

        # Test with nothing - should not be locked
        def query_with_nothing(model):
            mock_query = Mock()
            mock_query.filter().first.return_value = None
            return mock_query
        
        db.query.side_effect = query_with_nothing
        assert ProjectTeamService._is_project_team_locked(db, project_team_id) is False


class TestEvaluationCloseEndpoint:
    """Tests for evaluation close endpoint"""

    def test_close_evaluation_sets_status_and_timestamp(self):
        """Test that closing evaluation sets status and closed_at"""
        from app.api.v1.routers.evaluations import close_evaluation
        
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"
        
        evaluation = Mock(spec=Evaluation)
        evaluation.id = 1
        evaluation.status = "open"
        evaluation.closed_at = None
        evaluation.school_id = 1
        evaluation.course_id = 1
        evaluation.project_id = 1
        evaluation.project_team_id = None
        evaluation.rubric_id = 1
        evaluation.title = "Test Evaluation"
        evaluation.evaluation_type = "peer"
        evaluation.settings = {}
        
        db.query().filter().first.return_value = evaluation

        with patch("app.core.rbac.require_role"):
            with patch("app.core.audit.log_update"):
                result = close_evaluation(
                    evaluation_id=1,
                    db=db,
                    user=user,
                )

        # Verify status was updated
        assert evaluation.status == "closed"
        assert evaluation.closed_at is not None
        assert db.commit.called
        assert result.status == "closed"
        assert result.closed_at is not None

    def test_close_evaluation_is_idempotent(self):
        """Test that closing already closed evaluation is safe"""
        from app.api.v1.routers.evaluations import close_evaluation
        
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"
        
        # Already closed evaluation
        closed_time = datetime(2025, 1, 1, 12, 0, 0)
        evaluation = Mock(spec=Evaluation)
        evaluation.id = 1
        evaluation.status = "closed"
        evaluation.closed_at = closed_time
        evaluation.school_id = 1
        evaluation.course_id = 1
        evaluation.project_id = 1
        evaluation.project_team_id = None
        evaluation.rubric_id = 1
        evaluation.title = "Test Evaluation"
        evaluation.evaluation_type = "peer"
        evaluation.settings = {}
        
        db.query().filter().first.return_value = evaluation

        with patch("app.core.rbac.require_role"):
            with patch("app.core.audit.log_update") as mock_log:
                result = close_evaluation(
                    evaluation_id=1,
                    db=db,
                    user=user,
                )

        # Verify closed_at was not changed
        assert evaluation.closed_at == closed_time
        # Log should not be called for already-closed evaluation
        assert not mock_log.called
        assert result.status == "closed"
        assert result.closed_at == closed_time


class TestProjectAssessmentCloseEndpoint:
    """Tests for project assessment close endpoint"""

    def test_close_assessment_sets_status_and_timestamp(self):
        """Test that closing assessment sets status and closed_at"""
        from app.api.v1.routers.project_assessments import close_project_assessment
        
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"
        
        assessment = Mock(spec=ProjectAssessment)
        assessment.id = 1
        assessment.status = "published"
        assessment.closed_at = None
        assessment.school_id = 1
        assessment.group_id = 5
        assessment.project_team_id = None
        assessment.rubric_id = 3
        assessment.teacher_id = 10  # Set to actual int instead of user.id
        assessment.external_evaluator_id = None
        assessment.title = "Test Assessment"
        assessment.version = "1.0"
        assessment.published_at = datetime.now(timezone.utc)
        assessment.role = "TEACHER"
        assessment.is_advisory = False
        assessment.metadata_json = {}
        
        user.id = 10  # Ensure user.id matches
        
        db.query().filter().first.return_value = assessment

        with patch("app.core.audit.log_update"):
            result = close_project_assessment(
                assessment_id=1,
                db=db,
                user=user,
            )

        # Verify status was updated
        assert assessment.status == "closed"
        assert assessment.closed_at is not None
        assert db.commit.called
        assert result.status == "closed"
        assert result.closed_at is not None

    def test_close_assessment_requires_teacher_role(self):
        """Test that only teachers/admins can close assessments"""
        from app.api.v1.routers.project_assessments import close_project_assessment
        
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "student"  # Student cannot close

        with pytest.raises(HTTPException) as exc_info:
            close_project_assessment(
                assessment_id=1,
                db=db,
                user=user,
            )

        assert exc_info.value.status_code == 403
