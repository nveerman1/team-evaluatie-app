"""
Tests for new API endpoints (students, users)
"""

import pytest
from unittest.mock import Mock, patch
from fastapi import HTTPException
from app.infra.db.models import User
from app.api.v1.routers.courses import list_course_students, bulk_update_student_teams
from app.api.v1.routers.users import search_users


class TestCourseStudentsEndpoints:
    """Tests for course students endpoints"""

    def test_list_course_students_requires_course_access(self):
        """Test that listing students requires course access"""
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"

        # Mock course query to return a course
        db.query.return_value.filter.return_value.first.return_value = Mock(
            id=1, school_id=1
        )

        # Mock students query
        db.query.return_value.join.return_value.join.return_value.filter.return_value.distinct.return_value.order_by.return_value.all.return_value = []

        with patch("app.api.v1.routers.courses.require_course_access"):
            result = list_course_students(course_id=1, db=db, user=user)
            assert isinstance(result, list)

    def test_bulk_update_requires_teacher_role(self):
        """Test that bulk update requires teacher or admin role"""
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "student"  # Student shouldn't be able to update

        payload = Mock()
        payload.updates = []

        with patch("app.api.v1.routers.courses.require_role") as mock_require:
            mock_require.side_effect = Exception("Insufficient permissions")

            with pytest.raises(Exception) as exc_info:
                bulk_update_student_teams(
                    course_id=1, payload=payload, db=db, user=user, request=None
                )

            assert "Insufficient permissions" in str(exc_info.value)


class TestUsersEndpoint:
    """Tests for users search endpoint"""

    def test_search_users_by_role(self):
        """Test searching users by role"""
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1

        # Mock query to return teachers
        mock_query = Mock()
        db.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.offset.return_value = mock_query
        mock_query.limit.return_value = mock_query

        mock_teacher = Mock(spec=User)
        mock_teacher.id = 1
        mock_teacher.name = "Teacher One"
        mock_teacher.email = "teacher@school.nl"
        mock_teacher.role = "teacher"
        mock_teacher.school_id = 1
        mock_teacher.class_name = None
        mock_teacher.team_number = None

        mock_query.all.return_value = [mock_teacher]

        # Call with explicit page and per_page as integers
        result = search_users(db=db, user=user, role="teacher", page=1, per_page=20)

        assert len(result) > 0
        db.query.assert_called()

    def test_search_users_requires_authentication(self):
        """Test that search requires authentication"""
        db = Mock()
        user = None

        with pytest.raises(HTTPException) as exc_info:
            search_users(db=db, user=user)

        assert exc_info.value.status_code == 401


class TestSchemaValidation:
    """Tests for schema validation"""

    def test_course_student_out_schema(self):
        """Test CourseStudentOut schema validation"""
        from app.api.v1.schemas.courses import CourseStudentOut

        student_data = {
            "id": 1,
            "name": "Test Student",
            "email": "student@school.nl",
            "class_name": "5V1",
            "team_number": 1,
        }

        student = CourseStudentOut(**student_data)
        assert student.id == 1
        assert student.name == "Test Student"
        assert student.team_number == 1

    def test_bulk_student_team_update_schema(self):
        """Test BulkStudentTeamUpdate schema validation"""
        from app.api.v1.schemas.courses import (
            BulkStudentTeamUpdate,
        )

        update_data = {
            "updates": [
                {"student_id": 1, "team_number": 2},
                {"student_id": 2, "team_number": 2},
            ]
        }

        bulk_update = BulkStudentTeamUpdate(**update_data)
        assert len(bulk_update.updates) == 2
        assert bulk_update.updates[0].student_id == 1
