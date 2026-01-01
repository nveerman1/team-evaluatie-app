#!/usr/bin/env python3
"""
Test script to verify the /queue/stats endpoint works after adding updated_at column.
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.infra.db.models import School, User, SummaryGenerationJob
from app.core.config import settings

# Database connection - use settings to avoid hardcoding credentials
DATABASE_URL = settings.DATABASE_URL
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def test_updated_at_column():
    """Test that updated_at column exists and is queryable."""
    print("Testing updated_at column in summary_generation_jobs table...")
    
    session = SessionLocal()
    try:
        # Verify the column exists in database
        result = session.execute(text(
            "SELECT column_name, data_type, is_nullable, column_default "
            "FROM information_schema.columns "
            "WHERE table_name='summary_generation_jobs' AND column_name='updated_at'"
        ))
        row = result.fetchone()
        if row:
            print(f"✓ updated_at column found in database schema")
            print(f"  - type: {row[1]}")
            print(f"  - nullable: {row[2]}")
            print(f"  - default: {row[3]}")
        else:
            print("✗ updated_at column NOT found in database schema")
            return False
        
        # Verify created_at also has proper defaults
        result = session.execute(text(
            "SELECT column_name, data_type, column_default "
            "FROM information_schema.columns "
            "WHERE table_name='summary_generation_jobs' AND column_name='created_at'"
        ))
        row = result.fetchone()
        if row and row[2]:
            print(f"✓ created_at column has default: {row[2]}")
        else:
            print("✗ created_at column does not have server_default")
            return False
        
        # Test that the model can reference these columns without errors
        # This simulates what happens in the /queue/stats endpoint
        try:
            # Query with updated_at - this would fail if column doesn't exist
            count = session.query(SummaryGenerationJob).filter(
                SummaryGenerationJob.status == "queued"
            ).count()
            print(f"✓ Successfully queried jobs table (found {count} rows)")
        except Exception as e:
            print(f"✗ Failed to query jobs table: {e}")
            return False
        
        print("\n✅ All tests passed! The /queue/stats endpoint should work now.")
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        session.close()

def test_scheduled_jobs():
    """Test that scheduled_jobs table also has updated_at properly configured."""
    print("\nTesting updated_at column in scheduled_jobs table...")
    
    session = SessionLocal()
    try:
        # Verify the column exists
        result = session.execute(text(
            "SELECT column_name, is_nullable, column_default FROM information_schema.columns "
            "WHERE table_name='scheduled_jobs' AND column_name='updated_at'"
        ))
        row = result.fetchone()
        if row:
            print(f"✓ updated_at column found: nullable={row[1]}, default={row[2]}")
        else:
            print("✗ updated_at column NOT found in scheduled_jobs")
            return False
            
        print("✅ scheduled_jobs table is properly configured")
        return True
        
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        return False
    finally:
        session.close()

if __name__ == "__main__":
    success = test_updated_at_column()
    success = test_scheduled_jobs() and success
    sys.exit(0 if success else 1)
