"""
Tests for Subject API endpoints
"""

import pytest
from unittest.mock import Mock, patch
from fastapi import HTTPException
from app.infra.db.models import User, Subject
from app.api.v1.routers.subjects import (
    get_subject,
    create_subject,
)


class TestSubjectEndpoints:
    """Tests for subject endpoints"""

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
        from datetime import datetime

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
            obj.created_at = datetime.now()
            obj.updated_at = datetime.now()

        db.refresh = Mock(side_effect=refresh_side_effect)

        from app.api.v1.schemas.subjects import SubjectCreate

        subject_data = SubjectCreate(
            name="Biology",
            code="BIO",
        )

        with patch("app.api.v1.routers.subjects.require_role"):
            with patch("app.api.v1.routers.subjects.log_create"):
                create_subject(subject_data=subject_data, db=db, user=user)

        db.add.assert_called_once()
        db.commit.assert_called_once()
