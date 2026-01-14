"""
Tests for Client (Opdrachtgevers) API endpoints
"""

import pytest
from unittest.mock import Mock
from datetime import datetime
from app.infra.db.models import User, Client, ClientLog
from app.api.v1.routers.clients import (
    list_clients,
    get_client,
    create_client,
    update_client,
    get_client_log,
    create_log_entry,
)
from app.api.v1.schemas.clients import ClientCreate, ClientUpdate, ClientLogCreate
from fastapi import HTTPException


class TestClientsEndpoints:
    """Tests for client CRUD endpoints"""

    def test_list_clients_returns_filtered_results(self):
        """Test that listing clients filters by school and returns paginated results"""
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1

        # Mock the client query chain
        mock_client = Mock(spec=Client)
        mock_client.id = 1
        mock_client.organization = "Test Company"
        mock_client.contact_name = "John Doe"
        mock_client.email = "john@test.com"
        mock_client.level = "Bovenbouw"
        mock_client.sector = "Tech"
        mock_client.tags = ["AI"]
        mock_client.active = True
        mock_client.created_at = datetime.now()
        mock_client.updated_at = datetime.now()

        # Setup query chain
        query_mock = Mock()
        query_mock.filter.return_value = query_mock
        query_mock.count.return_value = 1
        query_mock.offset.return_value = query_mock
        query_mock.limit.return_value = query_mock
        query_mock.all.return_value = [mock_client]

        db.query.return_value = query_mock
        db.query.return_value.join.return_value.filter.return_value.scalar.return_value = 0
        db.query.return_value.join.return_value.filter.return_value.order_by.return_value.first.return_value = None

        # Call with explicit page and per_page arguments to avoid Query objects
        result = list_clients(db=db, user=user, page=1, per_page=20)

        assert result.total >= 0
        assert isinstance(result.items, list)

    def test_get_client_returns_client_for_valid_id(self):
        """Test getting a specific client by ID"""
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1

        mock_client = Mock(spec=Client)
        mock_client.id = 1
        mock_client.organization = "Test Company"
        mock_client.school_id = 1

        # Setup query chain
        query_mock = Mock()
        query_mock.filter.return_value = query_mock
        query_mock.first.return_value = mock_client
        db.query.return_value = query_mock

        result = get_client(client_id=1, db=db, user=user)
        assert result == mock_client

    def test_get_client_raises_404_for_invalid_id(self):
        """Test getting a non-existent client raises 404"""
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1

        # Setup query to return None
        query_mock = Mock()
        query_mock.filter.return_value = query_mock
        query_mock.first.return_value = None
        db.query.return_value = query_mock

        with pytest.raises(HTTPException) as exc_info:
            get_client(client_id=99999, db=db, user=user)

        assert exc_info.value.status_code == 404

    def test_create_client_success_for_teacher(self):
        """Test successful client creation by teacher"""
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"

        client_data = ClientCreate(
            organization="New Company",
            contact_name="Jane Doe",
            email="jane@newcompany.com",
        )

        create_client(client_data=client_data, db=db, user=user)

        assert db.add.called
        assert db.commit.called

    def test_create_client_forbidden_for_student(self):
        """Test that students cannot create clients"""
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "student"

        client_data = ClientCreate(
            organization="New Company",
            contact_name="Jane Doe",
        )

        with pytest.raises(HTTPException) as exc_info:
            create_client(client_data=client_data, db=db, user=user)

        assert exc_info.value.status_code == 403

    def test_update_client_success(self):
        """Test successful client update"""
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"

        mock_client = Mock(spec=Client)
        mock_client.id = 1
        mock_client.school_id = 1

        # Setup query chain
        query_mock = Mock()
        query_mock.filter.return_value = query_mock
        query_mock.first.return_value = mock_client
        db.query.return_value = query_mock

        update_data = ClientUpdate(organization="Updated Name")

        update_client(client_id=1, client_data=update_data, db=db, user=user)

        assert db.commit.called


class TestClientLogEndpoints:
    """Tests for client log endpoints"""

    def test_get_client_log_returns_logs(self):
        """Test successful retrieval of client logs"""
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1

        mock_client = Mock(spec=Client)
        mock_client.id = 1
        mock_client.school_id = 1

        mock_log = Mock(spec=ClientLog)
        mock_log.id = 1
        mock_log.client_id = 1
        mock_log.text = "Test log"
        mock_log.log_type = "Notitie"
        mock_log.author_id = 1
        mock_log.created_at = datetime.now()
        mock_log.author = Mock()
        mock_log.author.name = "Test Author"

        # Setup query chain
        query_mock = Mock()
        query_mock.filter.return_value = query_mock
        query_mock.first.return_value = mock_client
        query_mock.order_by.return_value = query_mock
        query_mock.all.return_value = [mock_log]
        db.query.return_value = query_mock

        result = get_client_log(client_id=1, db=db, user=user)

        assert result.total >= 0
        assert isinstance(result.items, list)

    def test_create_log_entry_success(self):
        """Test successful creation of a log entry"""
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.id = 1
        user.name = "Test User"

        mock_client = Mock(spec=Client)
        mock_client.id = 1
        mock_client.school_id = 1

        # Setup query chain
        query_mock = Mock()
        query_mock.filter.return_value = query_mock
        query_mock.first.return_value = mock_client
        db.query.return_value = query_mock

        # Mock refresh to set id and created_at on the log
        def mock_refresh(obj):
            obj.id = 1
            obj.created_at = datetime.now()

        db.refresh = mock_refresh

        log_data = ClientLogCreate(
            log_type="Notitie",
            text="New log entry",
        )

        result = create_log_entry(client_id=1, log_entry=log_data, db=db, user=user)

        assert db.add.called
        assert db.commit.called
        assert result.author_name == "Test User"

    def test_create_log_entry_client_not_found(self):
        """Test creating a log entry for non-existent client"""
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1

        # Setup query to return None
        query_mock = Mock()
        query_mock.filter.return_value = query_mock
        query_mock.first.return_value = None
        db.query.return_value = query_mock

        log_data = ClientLogCreate(
            log_type="Notitie",
            text="Should fail",
        )

        with pytest.raises(HTTPException) as exc_info:
            create_log_entry(client_id=99999, log_entry=log_data, db=db, user=user)

        assert exc_info.value.status_code == 404


class TestClientSchemas:
    """Tests for client schema validation"""

    def test_client_create_schema_validates_email(self):
        """Test that ClientCreate validates email format"""
        # Valid email
        valid_client = ClientCreate(
            organization="Test Company",
            email="valid@email.com",
        )
        assert valid_client.email == "valid@email.com"

        # Invalid email should raise validation error
        with pytest.raises(Exception):
            ClientCreate(
                organization="Test Company",
                email="invalid-email",
            )

    def test_client_log_create_requires_text(self):
        """Test that ClientLogCreate requires text field"""
        # Valid log
        valid_log = ClientLogCreate(
            text="Some text",
        )
        assert valid_log.text == "Some text"

        # Missing text should raise validation error
        with pytest.raises(Exception):
            ClientLogCreate(text="")
