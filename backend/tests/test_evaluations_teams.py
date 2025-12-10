"""
Tests for Evaluation Teams integration endpoints
"""

import pytest
from unittest.mock import Mock, MagicMock
from datetime import datetime, timezone

from app.infra.db.models import (
    User,
    School,
    Project,
    ProjectTeam,
    ProjectTeamMember,
    Evaluation,
    Allocation,
    Course,
    Rubric,
)


class TestEvaluationTeamsEndpoints:
    """Tests for evaluation teams endpoints"""

    def test_get_evaluation_teams_without_project(self):
        """Test getting teams for evaluation without project returns empty"""
        from app.api.v1.routers.evaluations import get_evaluation_teams
        
        # Mock database and user
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"
        
        # Mock evaluation without project
        evaluation = Mock(spec=Evaluation)
        evaluation.id = 1
        evaluation.school_id = 1
        evaluation.project_id = None
        
        db.query().filter().first.return_value = evaluation
        
        # Call endpoint
        result = get_evaluation_teams(
            evaluation_id=1,
            db=db,
            user=user
        )
        
        # Verify empty response
        assert result["project_id"] is None
        assert result["project_name"] is None
        assert result["teams"] == []

    def test_get_evaluation_teams_with_project(self):
        """Test getting teams for evaluation with project returns teams"""
        from app.api.v1.routers.evaluations import get_evaluation_teams
        
        # Mock database and user
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"
        
        # Mock project
        project = Mock(spec=Project)
        project.id = 5
        project.title = "Test Project"
        
        # Mock evaluation with project
        evaluation = Mock(spec=Evaluation)
        evaluation.id = 1
        evaluation.school_id = 1
        evaluation.project_id = 5
        
        # Mock project team
        team = Mock(spec=ProjectTeam)
        team.id = 10
        team.team_number = 1
        team.display_name_at_time = "Team 1"
        
        # Mock team member
        member = Mock(spec=ProjectTeamMember)
        member.role = "leader"
        
        test_user = Mock(spec=User)
        test_user.id = 100
        test_user.name = "Jan Janssen"
        test_user.email = "jan@test.nl"
        test_user.archived = False
        
        # Setup query chain for different queries
        def query_side_effect(model):
            query_mock = Mock()
            if model == Evaluation:
                query_mock.filter().first.return_value = evaluation
            elif model == Project:
                query_mock.filter().first.return_value = project
            elif model == ProjectTeam:
                query_mock.filter().order_by().all.return_value = [team]
            elif model == Allocation:
                # Return allocations query
                distinct_mock = Mock()
                distinct_mock.distinct.return_value = [(100,)]
                query_mock.filter().distinct.return_value = distinct_mock
            return query_mock
        
        db.query.side_effect = query_side_effect
        
        # Mock members query - this is a join query
        members_query_mock = Mock()
        members_query_mock.join().filter().all.return_value = [(member, test_user)]
        
        # Override for ProjectTeamMember query (which uses join)
        original_side_effect = db.query.side_effect
        def enhanced_query_side_effect(model):
            if model == ProjectTeamMember:
                return members_query_mock
            return original_side_effect(model)
        
        db.query.side_effect = enhanced_query_side_effect
        
        # Call endpoint
        result = get_evaluation_teams(
            evaluation_id=1,
            db=db,
            user=user
        )
        
        # Verify response structure
        assert result["project_id"] == 5
        assert result["project_name"] == "Test Project"
        assert len(result["teams"]) == 1
        
        team_data = result["teams"][0]
        assert team_data["team_id"] == 10
        assert team_data["team_number"] == 1
        assert team_data["display_name"] == "Team 1"
        assert team_data["member_count"] == 1
        
        member_data = team_data["members"][0]
        assert member_data["user_id"] == 100
        assert member_data["name"] == "Jan Janssen"
        assert member_data["email"] == "jan@test.nl"
        assert member_data["role"] == "leader"
        assert member_data["is_allocated"] is True

    def test_get_allocations_with_teams_without_project(self):
        """Test getting allocations without project returns no team info"""
        from app.api.v1.routers.evaluations import get_allocations_with_teams
        
        # Mock database and user
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"
        
        # Mock evaluation without project
        evaluation = Mock(spec=Evaluation)
        evaluation.id = 1
        evaluation.school_id = 1
        evaluation.project_id = None
        
        # Mock allocation
        allocation = Mock(spec=Allocation)
        allocation.id = 1
        allocation.reviewer_id = 100
        allocation.reviewee_id = 101
        allocation.submitted_at = None
        
        # Mock users
        evaluator = Mock(spec=User)
        evaluator.id = 100
        evaluator.name = "Jan"
        
        evaluatee = Mock(spec=User)
        evaluatee.id = 101
        evaluatee.name = "Piet"
        
        # Setup query chain
        def query_side_effect(model):
            query_mock = Mock()
            if model == Evaluation:
                query_mock.filter().first.return_value = evaluation
            elif model == Allocation:
                query_mock.filter().all.return_value = [allocation]
            elif model == User:
                # Return different users based on filter
                def user_filter(*args, **kwargs):
                    filter_mock = Mock()
                    # Simple approach: return evaluator first, evaluatee second
                    filter_mock.first.side_effect = [evaluator, evaluatee]
                    return filter_mock
                query_mock.filter = user_filter
            return query_mock
        
        db.query.side_effect = query_side_effect
        
        # Call endpoint
        result = get_allocations_with_teams(
            evaluation_id=1,
            db=db,
            user=user
        )
        
        # Verify response
        assert "allocations" in result
        assert len(result["allocations"]) == 1
        
        alloc_data = result["allocations"][0]
        assert alloc_data["id"] == 1
        assert alloc_data["evaluator_id"] == 100
        assert alloc_data["evaluator_team"] is None
        assert alloc_data["evaluatee_id"] == 101
        assert alloc_data["evaluatee_team"] is None
        assert alloc_data["status"] == "pending"

    def test_get_allocations_with_teams_with_project(self):
        """Test getting allocations with project includes team numbers"""
        from app.api.v1.routers.evaluations import get_allocations_with_teams
        
        # Mock database and user
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"
        
        # Mock evaluation with project
        evaluation = Mock(spec=Evaluation)
        evaluation.id = 1
        evaluation.school_id = 1
        evaluation.project_id = 5
        
        # Mock allocation
        allocation = Mock(spec=Allocation)
        allocation.id = 1
        allocation.reviewer_id = 100
        allocation.reviewee_id = 101
        allocation.submitted_at = datetime.now(timezone.utc)
        
        # Mock users
        evaluator = Mock(spec=User)
        evaluator.id = 100
        evaluator.name = "Jan"
        
        evaluatee = Mock(spec=User)
        evaluatee.id = 101
        evaluatee.name = "Piet"
        
        # Mock project team
        team = Mock(spec=ProjectTeam)
        team.id = 10
        team.team_number = 1
        
        # Mock team members
        member1 = Mock(spec=ProjectTeamMember)
        member1.user_id = 100
        
        member2 = Mock(spec=ProjectTeamMember)
        member2.user_id = 101
        
        # Setup query chain
        def query_side_effect(model):
            query_mock = Mock()
            if model == Evaluation:
                query_mock.filter().first.return_value = evaluation
            elif model == Allocation:
                query_mock.filter().all.return_value = [allocation]
            elif model == ProjectTeam:
                query_mock.filter().all.return_value = [team]
            elif model == ProjectTeamMember:
                query_mock.filter().all.return_value = [member1, member2]
            elif model == User:
                # Return different users based on filter
                def user_filter(*args, **kwargs):
                    filter_mock = Mock()
                    filter_mock.first.side_effect = [evaluator, evaluatee]
                    return filter_mock
                query_mock.filter = user_filter
            return query_mock
        
        db.query.side_effect = query_side_effect
        
        # Call endpoint
        result = get_allocations_with_teams(
            evaluation_id=1,
            db=db,
            user=user
        )
        
        # Verify response
        assert "allocations" in result
        assert len(result["allocations"]) == 1
        
        alloc_data = result["allocations"][0]
        assert alloc_data["id"] == 1
        assert alloc_data["evaluator_id"] == 100
        assert alloc_data["evaluator_team"] == 1
        assert alloc_data["evaluatee_id"] == 101
        assert alloc_data["evaluatee_team"] == 1
        assert alloc_data["status"] == "completed"
