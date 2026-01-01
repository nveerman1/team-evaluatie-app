# Fix: Missing updated_at Column in summary_generation_jobs

## Issue Description

**Error**: GET `/api/v1/feedback-summaries/queue/stats` endpoint returns HTTP 500

**Root Cause**: 
```
psycopg2.errors.UndefinedColumn: column summary_generation_jobs.updated_at does not exist
```

The SQLAlchemy model `SummaryGenerationJob` inherits from `Base`, which defines both `created_at` and `updated_at` columns with server defaults. However, the model overrode `created_at` without properly managing the inheritance, and the initial Alembic migrations didn't create the `updated_at` column in the database.

## Timeline

1. **Initial Migration** (`queue_20260101_01`): Created `summary_generation_jobs` table without `updated_at` column and without `server_default` for `created_at`
2. **Model Definition**: `SummaryGenerationJob` inherited from `Base` but overrode `created_at` with `default=datetime.utcnow` instead of using server default
3. **Query Failure**: When the `/queue/stats` endpoint tried to query jobs, SQLAlchemy expected `updated_at` to exist (from Base class), causing the error

## Root Cause Analysis

### Problem 1: Model Override Without Proper Inheritance
```python
# BAD - Overrides created_at without handling updated_at
class SummaryGenerationJob(Base):
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    # updated_at not declared, but Base defines it
```

### Problem 2: Migration Didn't Match Model Expectations
```python
# Migration created table without updated_at
op.create_table(
    "summary_generation_jobs",
    sa.Column("created_at", sa.DateTime(), nullable=False),  # No server_default
    # No updated_at column
)
```

### Problem 3: Inconsistent Timestamp Strategy
- Base class uses `server_default=func.now()` (database-level default)
- Model override used `default=datetime.utcnow` (Python-level default)
- This inconsistency caused the migration generator to not include server defaults

## Solution

### 1. Model Fix
Remove timestamp field overrides and use Base class definitions:

```python
class SummaryGenerationJob(Base):
    # ... other fields ...
    
    # Timestamps (created_at and updated_at inherited from Base)
    started_at: Mapped[Optional[datetime]] = mapped_column()
    completed_at: Mapped[Optional[datetime]] = mapped_column()
```

### 2. Database Migrations

Three migrations were created to fix the issue:

#### Migration 1: `queue_20260101_03` - Add updated_at column
```python
op.add_column(
    "summary_generation_jobs",
    sa.Column(
        "updated_at",
        sa.DateTime(timezone=True),
        server_default=sa.text("NOW()"),
        nullable=False,
    ),
)
# Backfill existing rows
op.execute(
    "UPDATE summary_generation_jobs SET updated_at = created_at WHERE updated_at IS NULL"
)
```

#### Migration 2: `queue_20260101_04` - Fix updated_at in scheduled_jobs
```python
op.execute(
    "UPDATE scheduled_jobs SET updated_at = created_at WHERE updated_at IS NULL"
)
op.alter_column(
    "scheduled_jobs",
    "updated_at",
    type_=sa.DateTime(timezone=True),
    server_default=sa.text("NOW()"),
    nullable=False,
)
```

#### Migration 3: `queue_20260101_05` - Fix created_at server_default
```python
op.alter_column(
    "summary_generation_jobs",
    "created_at",
    type_=sa.DateTime(timezone=True),
    server_default=sa.text("NOW()"),
    nullable=False,
)
```

### 3. Verification

Created comprehensive tests in `tests/test_queue_stats_endpoint.py`:
- ✅ Model has required timestamp fields
- ✅ Query patterns work correctly
- ✅ Regression prevention tests
- ✅ Integration test with actual database (when TEST_DATABASE_URL is set)

## Prevention Strategy

### 1. Always Use Base Class Timestamps
**DO**:
```python
class MyModel(Base):
    __tablename__ = "my_table"
    # ... fields ...
    # created_at and updated_at are inherited from Base automatically
```

**DON'T**:
```python
class MyModel(Base):
    __tablename__ = "my_table"
    # ... fields ...
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)  # ❌ Don't override
```

### 2. If You Must Override Timestamps

If you have a specific need to override timestamp behavior:

```python
class MyModel(Base):
    __tablename__ = "my_table"
    # ... fields ...
    
    # Override BOTH fields consistently
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(),  # Use server_default, not default
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),  # Don't forget onupdate
        nullable=False
    )
```

### 3. Verify Migrations Match Models

Before applying migrations:
1. Check that all columns in the model exist in the migration
2. Check that server defaults match between model and migration
3. Run `alembic check` if available

### 4. Add Schema Validation Tests

Create tests that verify model definitions match database schema:

```python
def test_model_columns_match_database():
    """Verify all model columns exist in database."""
    from sqlalchemy import inspect
    
    inspector = inspect(engine)
    columns = inspector.get_columns('summary_generation_jobs')
    column_names = {col['name'] for col in columns}
    
    # Check required fields exist
    assert 'created_at' in column_names
    assert 'updated_at' in column_names
```

### 5. Code Review Checklist

When reviewing model changes:
- [ ] Does the model inherit from Base?
- [ ] Are created_at/updated_at overridden? If yes, why?
- [ ] Does the migration include all model fields?
- [ ] Do server defaults match between model and migration?
- [ ] Are timezone settings consistent?

## Commands to Apply Fix

### For Fresh Database
```bash
cd backend
alembic upgrade head
```

### For Existing Database
Check current revision:
```bash
alembic current
```

Apply new migrations:
```bash
alembic upgrade head
```

Verify schema:
```bash
psql $DATABASE_URL -c "\d summary_generation_jobs"
```

Expected output should include:
```
 created_at  | timestamp with time zone | NO | now()
 updated_at  | timestamp with time zone | NO | now()
```

## Testing

Run the test suite:
```bash
cd backend
pytest tests/test_queue_stats_endpoint.py -v
```

Run with test database:
```bash
export TEST_DATABASE_URL="postgresql://..."
pytest tests/test_queue_stats_endpoint.py -v -m integration
```

## Related Files

- **Models**: `backend/app/infra/db/models.py` (lines 1488-1554)
- **Base Class**: `backend/app/infra/db/base.py`
- **Endpoint**: `backend/app/api/v1/routers/feedback_summary.py` (line 726)
- **Migrations**: 
  - `backend/migrations/versions/queue_20260101_03_add_updated_at_to_summary_generation_jobs.py`
  - `backend/migrations/versions/queue_20260101_04_fix_updated_at_in_scheduled_jobs.py`
  - `backend/migrations/versions/queue_20260101_05_fix_created_at_in_summary_generation_jobs.py`
- **Tests**: `backend/tests/test_queue_stats_endpoint.py`

## Summary

This issue was caused by a mismatch between the SQLAlchemy model (which expected `updated_at` via Base class inheritance) and the actual database schema (which didn't have the column). The fix involved:

1. Removing timestamp field overrides from models to use Base class definitions
2. Creating migrations to add missing columns and fix server defaults
3. Adding tests to prevent regression
4. Documenting best practices for timestamp handling

The endpoint `/api/v1/feedback-summaries/queue/stats` should now return HTTP 200 successfully.
