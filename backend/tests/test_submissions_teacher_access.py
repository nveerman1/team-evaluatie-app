"""
Tests for teacher course access in submissions router

Verifies that teachers can access submissions for assessments
in courses they are assigned to, not just assessments they created.
"""

import pytest
from unittest.mock import Mock

from app.infra.db.models import (
    User,
    ProjectAssessment,
    Project,
)


class TestSubmissionsTeacherAccess:
    """Test teacher course filtering for submissions endpoints"""

    def test_get_teacher_course_ids_for_teacher(self):
        """Test that _get_teacher_course_ids returns courses for teacher"""
        from app.api.v1.routers.submissions import _get_teacher_course_ids

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
        from app.api.v1.routers.submissions import _get_teacher_course_ids

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
        from app.api.v1.routers.submissions import _get_teacher_course_ids

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

    def test_check_teacher_can_access_assessment_with_course_access(self):
        """Test that teacher with course access can access assessment"""
        from app.api.v1.routers.submissions import _check_teacher_can_access_assessment

        # Mock database
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"
        user.id = 10

        # Mock assessment with project
        assessment = Mock(spec=ProjectAssessment)
        assessment.id = 1
        assessment.school_id = 1
        assessment.project_id = 100
        assessment.teacher_id = 99  # Different teacher created it

        # Mock project with course_id 101 (which teacher has access to)
        project = Mock(spec=Project)
        project.id = 100
        project.course_id = 101

        # Mock query result
        db.query.return_value.filter.return_value.first.return_value = project

        # Mock teacher courses (includes 101)
        mock_teacher_result = Mock()
        mock_teacher_result.scalars.return_value.all.return_value = [101, 102]
        db.execute.return_value = mock_teacher_result

        # Call function
        result = _check_teacher_can_access_assessment(db, assessment, user)

        # Verify - should return True
        assert result is True

    def test_check_teacher_can_access_assessment_without_course_access(self):
        """Test that teacher without course access cannot access assessment"""
        from app.api.v1.routers.submissions import _check_teacher_can_access_assessment

        # Mock database
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"
        user.id = 10

        # Mock assessment with project
        assessment = Mock(spec=ProjectAssessment)
        assessment.id = 1
        assessment.school_id = 1
        assessment.project_id = 100
        assessment.teacher_id = 99  # Different teacher created it

        # Mock project with course_id 999 (which teacher does NOT have access to)
        project = Mock(spec=Project)
        project.id = 100
        project.course_id = 999

        # Mock query result
        db.query.return_value.filter.return_value.first.return_value = project

        # Mock teacher courses (does NOT include 999)
        mock_teacher_result = Mock()
        mock_teacher_result.scalars.return_value.all.return_value = [101, 102]
        db.execute.return_value = mock_teacher_result

        # Call function
        result = _check_teacher_can_access_assessment(db, assessment, user)

        # Verify - should return False
        assert result is False

    def test_check_teacher_can_access_assessment_admin_always_allowed(self):
        """Test that admin can always access assessments"""
        from app.api.v1.routers.submissions import _check_teacher_can_access_assessment

        # Mock database
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "admin"
        user.id = 10

        # Mock assessment with project
        assessment = Mock(spec=ProjectAssessment)
        assessment.id = 1
        assessment.school_id = 1
        assessment.project_id = 100
        assessment.teacher_id = 99

        # Call function
        result = _check_teacher_can_access_assessment(db, assessment, user)

        # Verify - admin should always have access
        assert result is True

    def test_check_teacher_can_access_assessment_student_not_allowed(self):
        """Test that students cannot access assessments via this check"""
        from app.api.v1.routers.submissions import _check_teacher_can_access_assessment

        # Mock database
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "student"
        user.id = 10

        # Mock assessment
        assessment = Mock(spec=ProjectAssessment)
        assessment.id = 1
        assessment.school_id = 1
        assessment.project_id = 100

        # Call function
        result = _check_teacher_can_access_assessment(db, assessment, user)

        # Verify - students should not have access
        assert result is False

    def test_check_teacher_can_access_assessment_without_project(self):
        """Test that teacher can access assessment even without project_id"""
        from app.api.v1.routers.submissions import _check_teacher_can_access_assessment

        # Mock database
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"
        user.id = 10

        # Mock assessment without project
        assessment = Mock(spec=ProjectAssessment)
        assessment.id = 1
        assessment.school_id = 1
        assessment.project_id = None
        assessment.teacher_id = 10

        # Call function
        result = _check_teacher_can_access_assessment(db, assessment, user)

        # Verify - should return True (no course filtering when no project)
        assert result is True
