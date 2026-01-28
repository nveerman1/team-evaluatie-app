"""convert_attendance_timestamps_to_timezone_aware

Revision ID: de711157475c
Revises: 118f1aa65586
Create Date: 2026-01-28 13:45:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'de711157475c'
down_revision = '118f1aa65586'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Convert attendance_events datetime columns to timezone-aware (timestamptz).
    
    This migration:
    1. Converts check_in, check_out, approved_at columns from TIMESTAMP to TIMESTAMPTZ
    2. Assumes existing naive timestamps are in UTC (server time)
    3. Converts created_at and updated_at as well for consistency
    
    Strategy: For PostgreSQL, we use AT TIME ZONE to convert naive timestamps to UTC-aware.
    
    IMPORTANT NOTES:
    - "USING column_name AT TIME ZONE 'UTC'" interprets naive timestamps as UTC
    - NULL values are handled automatically (remain NULL)
    - If timestamps are already timezone-aware, they are converted to UTC
    - This is a safe, non-destructive migration
    
    Pre-migration verification (recommended):
    -- Check current column types:
    SELECT column_name, data_type, datetime_precision, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'attendance_events'
      AND column_name IN ('check_in', 'check_out', 'approved_at', 'created_at', 'updated_at');
    
    -- Check for NULL values:
    SELECT COUNT(*) as total_records,
           COUNT(check_in) as check_in_count,
           COUNT(check_out) as check_out_count,
           COUNT(approved_at) as approved_at_count
    FROM attendance_events;
    
    Post-migration verification (recommended):
    -- Verify column types changed:
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'attendance_events'
      AND column_name IN ('check_in', 'check_out', 'approved_at', 'created_at', 'updated_at');
    -- Expected: data_type = 'timestamp with time zone'
    
    -- Verify data integrity (no data loss):
    SELECT COUNT(*) FROM attendance_events;
    -- Should match pre-migration count
    
    -- Verify timezone information:
    SELECT check_in, timezone('UTC', check_in) as check_in_utc
    FROM attendance_events LIMIT 5;
    -- Timestamps should have timezone info (+00 or UTC)
    """
    # Convert check_in to timestamptz
    # Using 'ALTER COLUMN ... TYPE ... USING ...' to safely convert data
    op.execute("""
        ALTER TABLE attendance_events 
        ALTER COLUMN check_in 
        TYPE TIMESTAMP WITH TIME ZONE 
        USING check_in AT TIME ZONE 'UTC'
    """)
    
    # Convert check_out to timestamptz (handles NULL values automatically)
    op.execute("""
        ALTER TABLE attendance_events 
        ALTER COLUMN check_out 
        TYPE TIMESTAMP WITH TIME ZONE 
        USING check_out AT TIME ZONE 'UTC'
    """)
    
    # Convert approved_at to timestamptz (handles NULL values automatically)
    op.execute("""
        ALTER TABLE attendance_events 
        ALTER COLUMN approved_at 
        TYPE TIMESTAMP WITH TIME ZONE 
        USING approved_at AT TIME ZONE 'UTC'
    """)
    
    # Convert created_at to timestamptz
    op.execute("""
        ALTER TABLE attendance_events 
        ALTER COLUMN created_at 
        TYPE TIMESTAMP WITH TIME ZONE 
        USING created_at AT TIME ZONE 'UTC'
    """)
    
    # Convert updated_at to timestamptz
    op.execute("""
        ALTER TABLE attendance_events 
        ALTER COLUMN updated_at 
        TYPE TIMESTAMP WITH TIME ZONE 
        USING updated_at AT TIME ZONE 'UTC'
    """)


def downgrade() -> None:
    """
    Revert timezone-aware columns back to naive timestamps.
    
    ⚠️ WARNING: This will LOSE TIMEZONE INFORMATION!
    
    The downgrade converts timestamptz back to timestamp by:
    1. Converting to UTC (if not already)
    2. Stripping timezone information
    
    This means:
    - Timestamps will be stored as naive UTC
    - Original timezone information is lost
    - Applications must assume UTC when reading
    
    Use this only if you need to rollback the application code changes as well.
    Consider the implications carefully before downgrading.
    
    Post-downgrade verification:
    -- Verify column types reverted:
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'attendance_events'
      AND column_name IN ('check_in', 'check_out', 'approved_at', 'created_at', 'updated_at');
    -- Expected: data_type = 'timestamp without time zone'
    """
    # Revert check_in to timestamp without timezone
    op.execute("""
        ALTER TABLE attendance_events 
        ALTER COLUMN check_in 
        TYPE TIMESTAMP WITHOUT TIME ZONE 
        USING check_in AT TIME ZONE 'UTC'
    """)
    
    # Revert check_out (NULL values handled automatically)
    op.execute("""
        ALTER TABLE attendance_events 
        ALTER COLUMN check_out 
        TYPE TIMESTAMP WITHOUT TIME ZONE 
        USING check_out AT TIME ZONE 'UTC'
    """)
    
    # Revert approved_at (NULL values handled automatically)
    op.execute("""
        ALTER TABLE attendance_events 
        ALTER COLUMN approved_at 
        TYPE TIMESTAMP WITHOUT TIME ZONE 
        USING approved_at AT TIME ZONE 'UTC'
    """)
    
    # Revert created_at
    op.execute("""
        ALTER TABLE attendance_events 
        ALTER COLUMN created_at 
        TYPE TIMESTAMP WITHOUT TIME ZONE 
        USING created_at AT TIME ZONE 'UTC'
    """)
    
    # Revert updated_at
    op.execute("""
        ALTER TABLE attendance_events 
        ALTER COLUMN updated_at 
        TYPE TIMESTAMP WITHOUT TIME ZONE 
        USING updated_at AT TIME ZONE 'UTC'
    """)
