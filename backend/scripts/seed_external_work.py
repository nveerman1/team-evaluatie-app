"""
Seed script for external work test data

Creates sample external work registrations for testing the Extern Werk tab
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta

from app.infra.db.session import SessionLocal
from app.infra.db.models import AttendanceEvent, User, School


def seed_external_work():
    """Create sample external work registrations"""
    print("=" * 60)
    print("SEEDING EXTERNAL WORK TEST DATA")
    print("=" * 60)

    db = SessionLocal()

    try:
        # Get the demo school and admin
        school = db.query(School).filter(School.name.like("%Demo%")).first()
        if not school:
            print("❌ No demo school found. Run seed_demo_data.py first.")
            return

        # Get or create some students
        admin_user = (
            db.query(User)
            .filter(User.school_id == school.id, User.role == "admin")
            .first()
        )

        # Create test students if they don't exist
        students = []
        student_names = [
            ("Niels van Bergem", "V5"),
            ("Luuk Brouwer", "V4"),
            ("Daan Meijer", "V6"),
            ("Nathan Kasidin", "V6"),
            ("Ivy Schep", "H5"),
            ("Jasmijn Diederix", "V4"),
        ]

        for name, class_name in student_names:
            email = name.lower().replace(" ", ".") + "@demo.school"
            student = (
                db.query(User)
                .filter(User.email == email, User.school_id == school.id)
                .first()
            )

            if not student:
                student = User(
                    school_id=school.id,
                    email=email,
                    name=name,
                    class_name=class_name,
                    role="student",
                    auth_provider="local",
                )
                db.add(student)
                db.flush()
                print(f"✓ Created student: {name}")

            students.append(student)

        # Create external work registrations
        external_work_data = [
            {
                "student": students[0],
                "location": "Thuis",
                "description": "Lazersnij klaar maken van arcade-kast opnieuw doen want was niet goed, snijvlak van lazersnijder HHS te klein, voor onze componenten van arcade-kast.",
                "start": datetime.now() - timedelta(days=2, hours=8),
                "duration_hours": 2.5,
                "status": "approved",
            },
            {
                "student": students[1],
                "location": "Thuis",
                "description": "5 metingen van een halfuur afgerond, verspreid over de hele dag. Ook de code voor de visualisatie verbeterd: vergelijkingen, boxplots en originele grafieken bij elkaar in één window.",
                "start": datetime.now() - timedelta(days=1, hours=6),
                "duration_hours": 2.55,
                "status": "pending",
            },
            {
                "student": students[2],
                "location": "Thuis",
                "description": "Het verslag voor de tussenpresentatie volledig afgemaakt.",
                "start": datetime.now() - timedelta(days=3, hours=3),
                "duration_hours": 1.43,
                "status": "pending",
            },
            {
                "student": students[3],
                "location": "Thuis",
                "description": "Gewerkt aan het verslag.",
                "start": datetime.now() - timedelta(days=3, hours=4),
                "duration_hours": 1.53,
                "status": "pending",
            },
            {
                "student": students[4],
                "location": "Thuis",
                "description": "Werken aan presentatie en verslag.",
                "start": datetime.now() - timedelta(days=3, hours=5),
                "duration_hours": 1.25,
                "status": "pending",
            },
            {
                "student": students[5],
                "location": "Anders",
                "description": "Pannenkoeken gebakken bij Laura (meting 1)",
                "start": datetime.now() - timedelta(days=3, hours=12),
                "duration_hours": 2.0,
                "status": "pending",
            },
        ]

        for data in external_work_data:
            check_in = data["start"]
            check_out = check_in + timedelta(hours=data["duration_hours"])

            event = AttendanceEvent(
                user_id=data["student"].id,
                check_in=check_in,
                check_out=check_out,
                is_external=True,
                location=data["location"],
                description=data["description"],
                approval_status=data["status"],
                source="manual",
                created_by=admin_user.id if admin_user else None,
                approved_by=(
                    admin_user.id
                    if data["status"] == "approved" and admin_user
                    else None
                ),
                approved_at=datetime.now() if data["status"] == "approved" else None,
            )
            db.add(event)
            print(
                f"✓ Created external work for {data['student'].name} ({data['status']})"
            )

        db.commit()

        print("\n" + "=" * 60)
        print("EXTERNAL WORK TEST DATA SEEDED")
        print("=" * 60)
        print(f"Created {len(external_work_data)} external work registrations")
        print("=" * 60)

    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_external_work()
