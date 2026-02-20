"""
Pytest configuration and shared fixtures.

Adds the backend directory to sys.path and provides composable fixtures for:
- Factory helpers: make_school, make_user, make_project, ...
- Mock-user fixtures: mock_teacher, mock_student, mock_admin
- mock_db: MagicMock session for lightweight mock-based tests

NOTE: A real database fixture (db_session) is NOT included here because the
app uses PostgreSQL-specific column types (e.g. ARRAY) that are incompatible
with SQLite in-memory. Integration tests that need a real DB should use a
dedicated Postgres container (see README.md for details).
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

# ── sys.path bootstrap ─────────────────────────────────────────────────────────
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))


# ── Mock-user fixtures ─────────────────────────────────────────────────────────


@pytest.fixture
def mock_teacher():
    """A Mock User with role='teacher' and school_id=1."""
    from unittest.mock import Mock
    from app.infra.db.models import User

    u = Mock(spec=User)
    u.id = 1
    u.school_id = 1
    u.role = "teacher"
    u.name = "Docent"
    u.email = "teacher@school.nl"
    u.archived = False
    return u


@pytest.fixture
def mock_student():
    """A Mock User with role='student' and school_id=1."""
    from unittest.mock import Mock
    from app.infra.db.models import User

    u = Mock(spec=User)
    u.id = 2
    u.school_id = 1
    u.role = "student"
    u.name = "Student"
    u.email = "student@school.nl"
    u.archived = False
    return u


@pytest.fixture
def mock_admin():
    """A Mock User with role='admin' and school_id=1."""
    from unittest.mock import Mock
    from app.infra.db.models import User

    u = Mock(spec=User)
    u.id = 3
    u.school_id = 1
    u.role = "admin"
    u.name = "Admin"
    u.email = "admin@school.nl"
    u.archived = False
    return u


# ── Mock DB fixture ────────────────────────────────────────────────────────────


@pytest.fixture
def mock_db():
    """A MagicMock database session for lightweight integration tests."""
    return MagicMock()
