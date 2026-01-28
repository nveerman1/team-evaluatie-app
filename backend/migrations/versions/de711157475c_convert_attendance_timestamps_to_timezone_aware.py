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
    If a timestamp is already timezone-aware, this is a no-op.
    """
    # Convert check_in to timestamptz
    # Using 'ALTER COLUMN ... TYPE ... USING ...' to safely convert data
    op.execute("""
        ALTER TABLE attendance_events 
        ALTER COLUMN check_in 
        TYPE TIMESTAMP WITH TIME ZONE 
        USING check_in AT TIME ZONE 'UTC'
    """)
    
    # Convert check_out to timestamptz (handles NULL values)
    op.execute("""
        ALTER TABLE attendance_events 
        ALTER COLUMN check_out 
        TYPE TIMESTAMP WITH TIME ZONE 
        USING check_out AT TIME ZONE 'UTC'
    """)
    
    # Convert approved_at to timestamptz (handles NULL values)
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
    
    WARNING: This will lose timezone information!
    """
    # Revert check_in to timestamp without timezone
    op.execute("""
        ALTER TABLE attendance_events 
        ALTER COLUMN check_in 
        TYPE TIMESTAMP WITHOUT TIME ZONE 
        USING check_in AT TIME ZONE 'UTC'
    """)
    
    # Revert check_out
    op.execute("""
        ALTER TABLE attendance_events 
        ALTER COLUMN check_out 
        TYPE TIMESTAMP WITHOUT TIME ZONE 
        USING check_out AT TIME ZONE 'UTC'
    """)
    
    # Revert approved_at
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
