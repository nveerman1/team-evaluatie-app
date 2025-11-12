"""
Seed script for demo data

Creates:
- 2 schools (School A and School B)
- 3 courses per school (O&O, XPLR, NE)
- Teachers and students
- 1 evaluation per course with sample data

Usage:
    python scripts/seed_demo_data.py
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.infra.db.session import SessionLocal
from app.infra.db.models import (
    School,
    User,
    Course,
    TeacherCourse,
    Group,
    GroupMember,
    Rubric,
    RubricCriterion,
    Evaluation,
    Allocation,
)
from app.core.security import get_password_hash


def seed_demo_data():
    """Main seed function"""
    print("=" * 60)
    print("SEEDING DEMO DATA")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        # Check if demo data already exists
        existing = db.query(School).filter(School.name.like("%Demo%")).first()
        if existing:
            print("\nDemo data already exists!")
            return
        
        # Create school
        school = School(name="Demo School")
        db.add(school)
        db.commit()
        db.refresh(school)
        print(f"Created {school.name}")
        
        # Create admin
        admin = User(
            school_id=school.id,
            email="admin@demo.school",
            name="Demo Admin",
            role="admin",
            auth_provider="local",
            password_hash=get_password_hash("demo123"),
        )
        db.add(admin)
        db.commit()
        print("Created admin user")
        
        print("\n" + "=" * 60)
        print("DEMO DATA SEEDED")
        print("=" * 60)
        print("\nCredentials: admin@demo.school / demo123")
        print("=" * 60)
        
    except Exception as e:
        print(f"\nError: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
