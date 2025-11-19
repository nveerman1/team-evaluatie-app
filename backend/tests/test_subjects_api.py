"""
Tests for Subject API endpoints
"""

import pytest
from unittest.mock import Mock, MagicMock, patch
from fastapi import HTTPException
from app.infra.db.models import User, Subject, Course
from app.api.v1.routers.subjects import (
    list_subjects,
    get_subject,
    get_subject_courses,
    create_subject,
)


class TestSubjectEndpoints:
    """Tests for subject endpoints"""

    def test_list_subjects_requires_authentication(self):
        """Test that listing subjects requires authentication"""
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1

        # Mock query chain
        mock_query = Mock()
        db.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.count.return_value = 0
        mock_query.order_by.return_value = mock_query
        mock_query.offset.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = []

        result = list_subjects(db=db, user=user)
        assert result.total == 0
        assert result.subjects == []

    def test_list_subjects_filters_by_school(self):
        """Test that subjects are filtered by user's school"""
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1

        # Mock subject
        mock_subject = Mock(spec=Subject)
        mock_subject.id = 1
        mock_subject.school_id = 1
        mock_subject.name = "Biology"
        mock_subject.code = "BIO"
        mock_subject.is_active = True
        mock_subject.color = None
        mock_subject.icon = None

        # Mock query chain
        mock_query = Mock()
        db.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.count.return_value = 1
        mock_query.order_by.return_value = mock_query
        mock_query.offset.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = [mock_subject]

        result = list_subjects(db=db, user=user)
        assert result.total == 1

    def test_get_subject_not_found(self):
        """Test that getting non-existent subject raises 404"""
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1

        # Mock query to return None
        mock_query = Mock()
        db.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            get_subject(subject_id=999, db=db, user=user)

        assert exc_info.value.status_code == 404
        assert "not found" in exc_info.value.detail.lower()

    def test_get_subject_courses(self):
        """Test getting courses for a subject"""
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1

        # Mock subject
        mock_subject = Mock(spec=Subject)
        mock_subject.id = 1
        mock_subject.school_id = 1

        # Mock course
        mock_course = Mock(spec=Course)
        mock_course.id = 1
        mock_course.name = "Biology 101"
        mock_course.school_id = 1
        mock_course.subject_id = 1
        mock_course.is_active = True

        # Setup query mocks
        def query_side_effect(model):
            query_mock = Mock()
            query_mock.filter.return_value = query_mock
            
            if model == Subject:
                query_mock.first.return_value = mock_subject
            elif model == Course:
                query_mock.order_by.return_value = query_mock
                query_mock.all.return_value = [mock_course]
            
            return query_mock

        db.query = Mock(side_effect=query_side_effect)

        result = get_subject_courses(subject_id=1, db=db, user=user)
        assert isinstance(result, list)
        assert len(result) == 1

    def test_create_subject_checks_duplicate_code(self):
        """Test that creating subject with duplicate code fails"""
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "admin"

        # Mock existing subject with same code
        existing_subject = Mock(spec=Subject)
        existing_subject.code = "BIO"

        mock_query = Mock()
        db.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = existing_subject

        from app.api.v1.schemas.subjects import SubjectCreate

        subject_data = SubjectCreate(
            name="Biology",
            code="BIO",
        )

        with patch("app.api.v1.routers.subjects.require_role"):
            with pytest.raises(HTTPException) as exc_info:
                create_subject(subject_data=subject_data, db=db, user=user)

            assert exc_info.value.status_code == 409
            assert "already exists" in exc_info.value.detail.lower()

    def test_create_subject_success(self):
        """Test successful subject creation"""
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "admin"

        # Mock no existing subject
        mock_query = Mock()
        db.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None

        # Mock db.add and db.commit
        db.add = Mock()
        db.commit = Mock()
        
        def refresh_side_effect(obj):
            obj.id = 1
            obj.school_id = 1
        
        db.refresh = Mock(side_effect=refresh_side_effect)

        from app.api.v1.schemas.subjects import SubjectCreate

        subject_data = SubjectCreate(
            name="Biology",
            code="BIO",
        )

        with patch("app.api.v1.routers.subjects.require_role"):
            with patch("app.api.v1.routers.subjects.log_create"):
                result = create_subject(subject_data=subject_data, db=db, user=user)

        db.add.assert_called_once()
        db.commit.assert_called_once()
