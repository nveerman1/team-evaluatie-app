# Tests – Team Evaluatie App (backend)

## Running tests locally

```bash
# From the backend/ directory:
cd backend/

# Run the full test suite
pytest

# Run only fast unit tests
pytest -m unit

# Run security tests
pytest -m security

# Run integration tests (no external services needed — uses mocks)
pytest -m integration

# Skip slow tests (migrations etc.)
pytest -m "not slow"

# Run a single file
pytest tests/unit/test_grading.py -v
```

## Test layout

```
tests/
├── conftest.py                  # Shared fixtures (mock users, mock DB)
├── README.md                    # This file
│
├── unit/                        # Pure-function tests — no I/O
│   ├── test_grading.py          # score_to_grade() helper
│   └── test_security_utils.py  # JWT create/decode + sliding-session logic
│
├── security/                    # Auth, RBAC, multi-tenant isolation
│   └── test_rbac_unit.py        # require_role, ensure_school_access, can_access_course
│
├── api/                         # Router/integration tests per feature
│   ├── test_projectplans.py     # ProjectPlan CRUD + student restrictions
│   └── test_skill_trainings.py  # SkillTraining CRUD + student status rules
│
└── test_*.py                    # Legacy flat tests (gradually migrated above)
```

## Markers

| Marker        | When to use                                           |
|---------------|-------------------------------------------------------|
| `unit`        | Pure functions, no DB, no HTTP, no network            |
| `integration` | In-process tests that call router functions with Mocks|
| `security`    | RBAC, tenant isolation, input validation              |
| `slow`        | Alembic migrations, large seed fixtures               |

CI runs `pytest -q` by default (includes all non-slow tests).
Slow tests can be run manually or in a dedicated nightly job with `pytest -m slow`.

## Fixtures (`conftest.py`)

| Fixture       | What it provides                                   |
|---------------|----------------------------------------------------|
| `mock_db`     | MagicMock session for lightweight mock-based tests |
| `mock_teacher`| Mock User with `role="teacher"`, `school_id=1`     |
| `mock_student`| Mock User with `role="student"`, `school_id=1`     |
| `mock_admin`  | Mock User with `role="admin"`, `school_id=1`       |

> **Note:** A real `db_session` fixture is not provided because the app uses
> PostgreSQL-specific column types (e.g. `ARRAY`) that are incompatible with
> SQLite in-memory. Tests that need a real database should be marked
> `@pytest.mark.slow` and run against a Postgres container.

## Adding a new test

1. **Unit test** (no I/O): add to `tests/unit/`, decorate with `@pytest.mark.unit`.
2. **Security test**: add to `tests/security/`, use `@pytest.mark.security`.
3. **Router / integration test**: add to `tests/api/`, use `@pytest.mark.integration`.
   - Use `MagicMock()` for the DB session and call the router function directly.
   - Override service calls with `unittest.mock.patch` as needed.
4. **Real DB test** (slow): set up a Postgres container in CI, use a real
   `Session` fixture, and mark the test `@pytest.mark.slow`.

## Adding a mock fixture

Add a new `@pytest.fixture` function to `tests/conftest.py` following the
pattern of `mock_teacher` / `mock_student`. Keep mocks minimal: set only the
attributes that the test actually reads.

## CI integration

CI (`.github/workflows/ci.yml`) runs:
```bash
ruff check .           # lint
black --check .        # format
pytest -q              # all tests (skips tests marked @pytest.mark.skip)
bandit -r app -x tests,migrations -q   # security scan
```

Add `@pytest.mark.slow` to any test that takes > 2 seconds or requires
external services (Postgres container, real Redis, etc.).
