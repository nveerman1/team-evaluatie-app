"""
Tests for teacher course filtering functionality

Verifies that teachers can only see evaluations, project assessments,
competency windows, and project notes for courses they are assigned to.
"""

import pytest
from unittest.mock import Mock, MagicMock
from sqlalchemy import select

from app.infra.db.models import (
    User,
    Course,
    TeacherCourse,
    Evaluation,
    ProjectAssessment,
    CompetencyWindow,
    ProjectNotesContext,
    Group,
)


class TestTeacherCourseFiltering:
    """Test teacher course filtering across all endpoints"""

    def test_get_teacher_course_ids_for_teacher(self):
        """Test that _get_teacher_course_ids returns courses for teacher"""
        from app.api.v1.routers.evaluations import _get_teacher_course_ids
        
        # Mock database
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"
        user.id = 10
        
        # Mock execute to return course IDs
        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = [101, 102]
        db.execute.return_value = mock_result
        
        # Call function
        result = _get_teacher_course_ids(db, user)
        
        # Verify
        assert result == [101, 102]
        assert db.execute.called

    def test_get_teacher_course_ids_for_admin(self):
        """Test that _get_teacher_course_ids returns empty list for admin (no filtering)"""
        from app.api.v1.routers.evaluations import _get_teacher_course_ids
        
        # Mock database
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "admin"
        user.id = 10
        
        # Call function
        result = _get_teacher_course_ids(db, user)
        
        # Verify - admins get empty list (no filtering)
        assert result == []
        assert not db.execute.called

    def test_get_teacher_course_ids_for_student(self):
        """Test that _get_teacher_course_ids returns empty list for student"""
        from app.api.v1.routers.evaluations import _get_teacher_course_ids
        
        # Mock database
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "student"
        user.id = 10
        
        # Call function
        result = _get_teacher_course_ids(db, user)
        
        # Verify
        assert result == []
        assert not db.execute.called

    def test_get_evaluation_checks_teacher_course_access(self):
        """Test that get_evaluation checks if teacher has access to evaluation's course"""
        from app.api.v1.routers.evaluations import get_evaluation
        from fastapi import HTTPException
        
        # Mock database
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"
        user.id = 10
        
        # Mock evaluation with course_id 999
        evaluation = Mock(spec=Evaluation)
        evaluation.id = 1
        evaluation.school_id = 1
        evaluation.course_id = 999
        
        # Mock query result
        db.query.return_value.filter.return_value.first.return_value = evaluation
        
        # Mock teacher courses (doesn't include 999)
        mock_teacher_result = Mock()
        mock_teacher_result.scalars.return_value.all.return_value = [101, 102]
        db.execute.return_value = mock_teacher_result
        
        # Call function and expect 404
        with pytest.raises(HTTPException) as exc_info:
            get_evaluation(evaluation_id=1, db=db, user=user)
        
        assert exc_info.value.status_code == 404

    def test_get_evaluation_allows_teacher_with_course_access(self):
        """Test that get_evaluation allows teacher with access to evaluation's course"""
        from app.api.v1.routers.evaluations import get_evaluation
        from datetime import datetime
        
        # Mock database
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"
        user.id = 10
        
        # Mock course
        course = Mock()
        course.name = "Test Course"
        
        # Mock evaluation with course_id 101 (which teacher has access to)
        evaluation = Mock(spec=Evaluation)
        evaluation.id = 1
        evaluation.school_id = 1
        evaluation.course_id = 101
        evaluation.project_id = None
        evaluation.project_team_id = None
        evaluation.rubric_id = 1
        evaluation.title = "Test Evaluation"
        evaluation.evaluation_type = "peer"
        evaluation.status = "open"
        evaluation.closed_at = None
        evaluation.created_at = datetime.now()
        evaluation.settings = {}
        evaluation.course = course
        
        # Mock query result
        db.query.return_value.filter.return_value.first.return_value = evaluation
        
        # Mock teacher courses (includes 101)
        mock_teacher_result = Mock()
        mock_teacher_result.scalars.return_value.all.return_value = [101, 102]
        db.execute.return_value = mock_teacher_result
        
        # Call function - should not raise exception
        result = get_evaluation(evaluation_id=1, db=db, user=user)
        
        # Verify result is the mocked evaluation (after _to_out conversion)
        assert result is not None

    def test_get_evaluation_allows_admin_full_access(self):
        """Test that get_evaluation allows admin to access any evaluation"""
        from app.api.v1.routers.evaluations import get_evaluation
        from datetime import datetime
        
        # Mock database
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "admin"
        user.id = 10
        
        # Mock course
        course = Mock()
        course.name = "Test Course"
        
        # Mock evaluation with any course_id
        evaluation = Mock(spec=Evaluation)
        evaluation.id = 1
        evaluation.school_id = 1
        evaluation.course_id = 999
        evaluation.project_id = None
        evaluation.project_team_id = None
        evaluation.rubric_id = 1
        evaluation.title = "Test Evaluation"
        evaluation.evaluation_type = "peer"
        evaluation.status = "open"
        evaluation.closed_at = None
        evaluation.created_at = datetime.now()
        evaluation.settings = {}
        evaluation.course = course
        
        # Mock query result
        db.query.return_value.filter.return_value.first.return_value = evaluation
        
        # Call function - should not raise exception (no course check for admin)
        result = get_evaluation(evaluation_id=1, db=db, user=user)
        
        # Verify result is returned
        assert result is not None

    def test_competencies_get_user_course_ids_consistent(self):
        """Test that competencies._get_user_course_ids has same behavior"""
        from app.api.v1.routers.competencies import _get_user_course_ids
        
        # Test teacher
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"
        user.id = 10
        
        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = [101, 102]
        db.execute.return_value = mock_result
        
        result = _get_user_course_ids(db, user)
        assert result == [101, 102]
        
        # Test admin
        user.role = "admin"
        result = _get_user_course_ids(db, user)
        assert result == []

    def test_project_assessments_get_teacher_course_ids_consistent(self):
        """Test that project_assessments._get_teacher_course_ids has same behavior"""
        from app.api.v1.routers.project_assessments import _get_teacher_course_ids
        
        # Test teacher
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"
        user.id = 10
        
        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = [101, 102]
        db.execute.return_value = mock_result
        
        result = _get_teacher_course_ids(db, user)
        assert result == [101, 102]
        
        # Test admin
        user.role = "admin"
        result = _get_teacher_course_ids(db, user)
        assert result == []

    def test_project_notes_get_teacher_course_ids_consistent(self):
        """Test that project_notes._get_teacher_course_ids has same behavior"""
        from app.api.v1.routers.project_notes import _get_teacher_course_ids
        
        # Test teacher
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"
        user.id = 10
        
        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = [101, 102]
        db.execute.return_value = mock_result
        
        result = _get_teacher_course_ids(db, user)
        assert result == [101, 102]
        
        # Test admin
        user.role = "admin"
        result = _get_teacher_course_ids(db, user)
        assert result == []


class TestTeacherCourseAccessChecks:
    """Test individual access checks for get endpoints"""

    def test_get_window_checks_teacher_course_access(self):
        """Test that get_window checks if teacher has access to window's course"""
        from app.api.v1.routers.competencies import get_window
        from fastapi import HTTPException
        
        # Mock database
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"
        user.id = 10
        
        # Mock window with course_id 999
        window = Mock(spec=CompetencyWindow)
        window.id = 1
        window.school_id = 1
        window.course_id = 999
        
        # Mock get to return window
        db.get.return_value = window
        
        # Mock teacher courses (doesn't include 999)
        mock_teacher_result = Mock()
        mock_teacher_result.scalars.return_value.all.return_value = [101, 102]
        db.execute.return_value = mock_teacher_result
        
        # Call function and expect 404
        with pytest.raises(HTTPException) as exc_info:
            get_window(window_id=1, db=db, current_user=user)
        
        assert exc_info.value.status_code == 404

    def test_get_project_assessment_checks_teacher_course_access(self):
        """Test that get_project_assessment checks if teacher has access to assessment's course"""
        from app.api.v1.routers.project_assessments import get_project_assessment
        from fastapi import HTTPException
        
        # Mock database
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"
        user.id = 10
        
        # Mock assessment
        assessment = Mock(spec=ProjectAssessment)
        assessment.id = 1
        assessment.school_id = 1
        assessment.group_id = 50
        assessment.rubric_id = 1
        
        # Mock group with course_id 999
        group = Mock(spec=Group)
        group.id = 50
        group.course_id = 999
        
        # Mock queries
        db.query.return_value.filter.return_value.first.side_effect = [assessment, group]
        
        # Mock teacher courses (doesn't include 999)
        mock_teacher_result = Mock()
        mock_teacher_result.scalars.return_value.all.return_value = [101, 102]
        db.execute.return_value = mock_teacher_result
        
        # Call function and expect 403
        with pytest.raises(HTTPException) as exc_info:
            get_project_assessment(assessment_id=1, db=db, user=user)
        
        assert exc_info.value.status_code == 403

