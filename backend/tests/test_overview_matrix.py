"""
Tests for overview matrix endpoint
"""

import pytest
from unittest.mock import Mock, MagicMock
from datetime import datetime, timezone
from fastapi import HTTPException

from app.infra.db.models import (
    User,
    Course,
    ProjectAssessment,
    ProjectAssessmentTeam,
    ProjectTeam,
    ProjectTeamMember,
    Project,
    CourseEnrollment,
)
from app.api.v1.routers.overview import get_overview_matrix


class TestOverviewMatrix:
    """Tests for get_overview_matrix endpoint"""

    def test_get_overview_matrix_validates_course_exists(self):
        """Test that invalid course_id returns 404"""
        db = Mock()
        current_user = Mock(spec=User)
        current_user.school_id = 1
        
        # Mock empty course query (course not found)
        mock_query = Mock()
        db.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None
        
        with pytest.raises(HTTPException) as exc_info:
            get_overview_matrix(
                course_id=999,
                db=db,
                current_user=current_user
            )
        
        assert exc_info.value.status_code == 404
        assert "Course 999 not found" in str(exc_info.value.detail)

    def test_get_overview_matrix_returns_empty_matrix_no_data(self):
        """Test that endpoint returns empty matrix when no data exists"""
        db = Mock()
        current_user = Mock(spec=User)
        current_user.school_id = 1
        
        # Setup mock to return empty results for all queries
        mock_query = Mock()
        db.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None
        mock_query.all.return_value = []
        mock_query.distinct.return_value = mock_query
        mock_query.join.return_value = mock_query
        mock_query.outerjoin.return_value = mock_query
        
        result = get_overview_matrix(
            course_id=None,
            db=db,
            current_user=current_user
        )
        
        assert result.total_students == 0
        assert len(result.columns) == 0
        assert len(result.rows) == 0

    def test_get_overview_matrix_uses_correct_project_team_member_fields(self):
        """Test that query uses project_team_id not team_id"""
        db = Mock()
        current_user = Mock(spec=User)
        current_user.school_id = 1
        
        # Create mock course
        course = Mock(spec=Course)
        course.id = 1
        course.school_id = 1
        
        # Create mock project assessment and team
        assessment = Mock(spec=ProjectAssessment)
        assessment.id = 1
        assessment.title = "Test Project"
        assessment.status = "published"
        assessment.published_at = datetime(2024, 1, 15, tzinfo=timezone.utc)
        assessment.teacher_id = 1
        assessment.rubric_id = None
        assessment.is_advisory = False
        
        project = Mock(spec=Project)
        project.id = 1
        project.course_id = 1
        
        team = Mock(spec=ProjectTeam)
        team.id = 1
        team.project_id = 1
        
        # Mock student user
        student = Mock(spec=User)
        student.id = 100
        student.name = "Test Student"
        student.class_name = "Class A"
        student.archived = False
        student.role = "student"
        student.team_number = 1
        
        teacher = Mock(spec=User)
        teacher.id = 1
        teacher.name = "Test Teacher"
        
        # Setup complex query chain
        query_counter = {"count": 0}
        
        def query_side_effect(model_or_column):
            mock_query = Mock()
            mock_query.filter.return_value = mock_query
            mock_query.join.return_value = mock_query
            mock_query.outerjoin.return_value = mock_query
            mock_query.distinct.return_value = mock_query
            
            query_counter["count"] += 1
            
            # First query: course validation
            if query_counter["count"] == 1:
                mock_query.first.return_value = course
            # Second query: student IDs for course enrollment
            elif query_counter["count"] == 2:
                mock_query.all.return_value = [(student.id,)]
            # Third query: project assessments
            elif query_counter["count"] == 3:
                mock_query.all.return_value = [(assessment, course, team)]
            # Fourth query: get teacher
            elif query_counter["count"] == 4:
                mock_query.first.return_value = teacher
            # Fifth query: get team members - THIS IS THE CRITICAL ONE
            elif query_counter["count"] == 5:
                mock_query.all.return_value = [student]
            # Remaining queries: competency/peer evaluations (empty)
            else:
                mock_query.all.return_value = []
                mock_query.first.return_value = None
            
            return mock_query
        
        db.query.side_effect = query_side_effect
        
        # Call the endpoint - should not raise AttributeError anymore
        try:
            result = get_overview_matrix(
                course_id=1,
                db=db,
                current_user=current_user
            )
            # If we get here, the fix worked
            assert True
        except AttributeError as e:
            # If we get AttributeError, the fix didn't work
            pytest.fail(f"AttributeError still raised: {str(e)}")

    def test_get_overview_matrix_with_valid_course_and_data(self):
        """Test happy path with valid course and project data"""
        db = Mock()
        current_user = Mock(spec=User)
        current_user.school_id = 1
        
        # Create mock course
        course = Mock(spec=Course)
        course.id = 1
        course.school_id = 1
        
        # Setup query chain to return valid data structure
        query_counter = {"count": 0}
        
        def query_side_effect(model_or_column):
            mock_query = Mock()
            mock_query.filter.return_value = mock_query
            mock_query.join.return_value = mock_query
            mock_query.outerjoin.return_value = mock_query
            mock_query.distinct.return_value = mock_query
            
            query_counter["count"] += 1
            
            # Course validation
            if query_counter["count"] == 1:
                mock_query.first.return_value = course
            # All other queries return empty
            else:
                mock_query.all.return_value = []
                mock_query.first.return_value = None
            
            return mock_query
        
        db.query.side_effect = query_side_effect
        
        result = get_overview_matrix(
            course_id=1,
            db=db,
            current_user=current_user
        )
        
        # Should return valid response structure even with no evaluations
        assert hasattr(result, 'columns')
        assert hasattr(result, 'rows')
        assert hasattr(result, 'total_students')
        assert hasattr(result, 'column_averages')
