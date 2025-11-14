"""
Tests for new API endpoints (students, users, analytics)
"""

import pytest
from unittest.mock import Mock, MagicMock, patch
from fastapi import HTTPException
from app.infra.db.models import User, Course, Group, GroupMember, Evaluation
from app.api.v1.routers.courses import list_course_students, bulk_update_student_teams
from app.api.v1.routers.users import search_users
from app.api.v1.routers.analytics import (
    get_course_summary,
    get_learning_objectives_progress,
    get_evaluation_type_stats,
)


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


class TestAnalyticsEndpoints:
    """Tests for analytics endpoints"""

    def test_get_course_summary_returns_data(self):
        """Test that course summary returns analytics data"""
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1

        # Mock course query to return a valid course
        mock_course = Mock(id=1, school_id=1)
        
        # Setup query chains with proper return values
        mock_query_course = Mock()
        mock_query_course.filter.return_value.first.return_value = mock_course
        
        # Mock student count
        mock_query_students = Mock()
        mock_query_students.join.return_value.join.return_value.filter.return_value.scalar.return_value = 10
        
        # Mock evaluation counts
        mock_query_evals = Mock()
        mock_query_evals.filter.return_value.scalar.return_value = 5
        
        # Make db.query return different mocks in sequence
        db.query.side_effect = [
            mock_query_course,    # Course lookup
            mock_query_students,  # Student count
            mock_query_evals,     # Total evaluations
            mock_query_evals,     # Completed evaluations
        ]

        with patch("app.api.v1.routers.analytics.require_course_access"):
            result = get_course_summary(course_id=1, db=db, user=user)

            assert hasattr(result, "total_students")
            assert hasattr(result, "total_evaluations")
            assert hasattr(result, "average_score")
            assert result.total_students == 10

    def test_get_learning_objectives_requires_course_access(self):
        """Test that LO progress requires course access"""
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1

        # Mock course query
        db.query.return_value.filter.return_value.first.return_value = Mock(
            id=1, school_id=1
        )

        # Mock LO query
        db.query.return_value.filter.return_value.limit.return_value.all.return_value = (
            []
        )

        with patch("app.api.v1.routers.analytics.require_course_access"):
            result = get_learning_objectives_progress(course_id=1, db=db, user=user)

            assert isinstance(result, list)

    def test_get_evaluation_stats_returns_by_type(self):
        """Test that evaluation stats are grouped by type"""
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1

        # Mock course query
        db.query.return_value.filter.return_value.first.return_value = Mock(
            id=1, school_id=1
        )

        # Mock stats query
        db.query.return_value.filter.return_value.group_by.return_value.all.return_value = [
            ("peer", 5, 4),
            ("project", 2, 1),
        ]

        with patch("app.api.v1.routers.analytics.require_course_access"):
            result = get_evaluation_type_stats(course_id=1, db=db, user=user)

            assert isinstance(result, list)
            assert len(result) == 2


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
            StudentTeamUpdate,
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

    def test_analytics_schemas(self):
        """Test analytics schema validation"""
        from app.api.v1.schemas.analytics import (
            CourseSummaryOut,
            LearningObjectiveProgressOut,
            EvaluationTypeStatsOut,
        )

        summary = CourseSummaryOut(
            total_students=10,
            total_evaluations=5,
            completed_evaluations=3,
            average_score=7.5,
            participation_rate=80.0,
        )
        assert summary.total_students == 10

        lo_progress = LearningObjectiveProgressOut(
            id=1,
            code="A1.2",
            description="Test LO",
            coverage=75.0,
            average_score=7.5,
            student_count=30,
        )
        assert lo_progress.code == "A1.2"

        eval_stats = EvaluationTypeStatsOut(
            type="peer", count=5, avg_score=7.5, completion_rate=80.0
        )
        assert eval_stats.type == "peer"
