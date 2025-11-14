"""
Tests for Teachers API endpoints
"""

import pytest
from unittest.mock import Mock, patch
from fastapi import HTTPException
from app.infra.db.models import User
from app.api.v1.routers.teachers import get_teacher
from app.api.v1.schemas.teachers import TeacherCreate


class TestTeachersEndpoints:
    """Tests for teachers CRUD endpoints"""

    def test_get_teacher_not_found(self):
        """Test getting non-existent teacher returns 404"""
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "admin"

        # Mock query to return None (teacher not found)
        db.query.return_value.filter.return_value.first.return_value = None

        with patch("app.api.v1.routers.teachers.require_role"):
            with pytest.raises(HTTPException) as exc_info:
                get_teacher(teacher_id=999, db=db, user=user)
            assert exc_info.value.status_code == 404

    def test_teacher_create_schema_validation(self):
        """Test that TeacherCreate schema validates correctly"""
        # Valid teacher data
        valid_teacher = TeacherCreate(
            name="Test Teacher", email="test@example.com", role="teacher"
        )
        assert valid_teacher.name == "Test Teacher"
        assert valid_teacher.email == "test@example.com"
        assert valid_teacher.role == "teacher"

        # Test with admin role
        admin_teacher = TeacherCreate(
            name="Admin User", email="admin@example.com", role="admin"
        )
        assert admin_teacher.role == "admin"
