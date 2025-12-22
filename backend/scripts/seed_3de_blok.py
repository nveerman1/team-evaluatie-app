"""
Seed script for 3de Blok RFID attendance module test data

Creates:
- 3 test students (Bram de Boer, Emma Smit, Finn Bakker)
- RFID cards for each student
- Sample attendance events for testing

Usage:
    python scripts/seed_3de_blok.py
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.infra.db.session import SessionLocal
from app.infra.db.models import School, User, RFIDCard, AttendanceEvent
from app.core.security import get_password_hash


def seed_3de_blok():
    """Seed 3de Blok test data"""
    print("=" * 60)
    print("SEEDING 3DE BLOK TEST DATA")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        # Get or create the demo school
        school = db.query(School).filter(School.name.like("%Demo%")).first()
        if not school:
            school = School(name="Demo School")
            db.add(school)
            db.commit()
            db.refresh(school)
            print(f"✓ Created {school.name}")
        else:
            print(f"✓ Using existing school: {school.name}")
        
        # Get or create admin user for created_by field
        admin = db.query(User).filter(
            User.school_id == school.id,
            User.role == "admin"
        ).first()
        
        if not admin:
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
            db.refresh(admin)
            print(f"✓ Created admin user")
        
        # Define test students
        students_data = [
            {
                "name": "Bram de Boer",
                "email": "bram.demo@example.com",
                "class_name": "V4A",
                "rfid_uid": "RFID001",
            },
            {
                "name": "Emma Smit",
                "email": "emma.smit@example.com",
                "class_name": "V4A",
                "rfid_uid": "RFID002",
            },
            {
                "name": "Finn Bakker",
                "email": "finn.bakker@example.com",
                "class_name": "V4A",
                "rfid_uid": "RFID003",
            },
        ]
        
        print("\n" + "-" * 60)
        print("Creating students and RFID cards:")
        print("-" * 60)
        
        created_students = []
        for student_data in students_data:
            # Check if student already exists
            student = db.query(User).filter(
                User.email == student_data["email"],
                User.school_id == school.id
            ).first()
            
            if not student:
                # Create student
                student = User(
                    school_id=school.id,
                    email=student_data["email"],
                    name=student_data["name"],
                    class_name=student_data["class_name"],
                    role="student",
                    auth_provider="local",
                    password_hash=get_password_hash("demo123"),
                )
                db.add(student)
                db.flush()
                print(f"✓ Created student: {student.name} ({student.email})")
            else:
                print(f"✓ Student already exists: {student.name} ({student.email})")
            
            # Check if RFID card already exists
            rfid_card = db.query(RFIDCard).filter(
                RFIDCard.uid == student_data["rfid_uid"]
            ).first()
            
            if not rfid_card:
                # Create RFID card
                rfid_card = RFIDCard(
                    user_id=student.id,
                    uid=student_data["rfid_uid"],
                    label=f"{student.name} - Card",
                    is_active=True,
                    created_by=admin.id,
                )
                db.add(rfid_card)
                print(f"  ✓ Assigned RFID card: {rfid_card.uid}")
            else:
                print(f"  ✓ RFID card already exists: {rfid_card.uid}")
            
            created_students.append(student)
        
        db.commit()
        
        print("\n" + "-" * 60)
        print("Creating sample attendance events:")
        print("-" * 60)
        
        # Create some sample attendance events
        now = datetime.now()
        
        # Bram: School check-in (yesterday, 2 hours)
        bram = created_students[0]
        event1 = AttendanceEvent(
            user_id=bram.id,
            check_in=now - timedelta(days=1, hours=10),
            check_out=now - timedelta(days=1, hours=8),
            is_external=False,
            source="rfid",
            created_by=admin.id,
        )
        db.add(event1)
        print(f"✓ Created school attendance for {bram.name} (yesterday, 2h)")
        
        # Emma: School check-in (today, still checked in)
        emma = created_students[1]
        event2 = AttendanceEvent(
            user_id=emma.id,
            check_in=now - timedelta(hours=3),
            check_out=None,  # Still checked in
            is_external=False,
            source="rfid",
            created_by=admin.id,
        )
        db.add(event2)
        print(f"✓ Created school attendance for {emma.name} (currently checked in)")
        
        # Finn: External work (pending approval)
        finn = created_students[2]
        event3 = AttendanceEvent(
            user_id=finn.id,
            check_in=now - timedelta(days=2, hours=8),
            check_out=now - timedelta(days=2, hours=4),
            is_external=True,
            location="Thuis",
            description="Werken aan 3de blok project documentatie",
            approval_status="pending",
            source="manual",
            created_by=finn.id,
        )
        db.add(event3)
        print(f"✓ Created external work for {finn.name} (pending approval)")
        
        # Bram: External work (approved)
        event4 = AttendanceEvent(
            user_id=bram.id,
            check_in=now - timedelta(days=3, hours=6),
            check_out=now - timedelta(days=3, hours=3),
            is_external=True,
            location="Stage bedrijf",
            description="Werkzaamheden aan technisch project",
            approval_status="approved",
            approved_by=admin.id,
            approved_at=now - timedelta(days=2),
            source="manual",
            created_by=bram.id,
        )
        db.add(event4)
        print(f"✓ Created external work for {bram.name} (approved)")
        
        db.commit()
        
        print("\n" + "=" * 60)
        print("3DE BLOK TEST DATA SEEDED SUCCESSFULLY")
        print("=" * 60)
        print(f"\nCreated/verified {len(students_data)} students:")
        for student in created_students:
            print(f"  - {student.name} ({student.email})")
        print(f"\nPassword for all students: demo123")
        print(f"\nRFID UIDs assigned:")
        for i, student_data in enumerate(students_data):
            print(f"  - {created_students[i].name}: {student_data['rfid_uid']}")
        print(f"\nSample attendance events created: 4")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_3de_blok()
