"""
Seed script for competency scans (CompetencyWindow) test data

Creates sample competency scans (windows) with associated competencies for testing.
This script creates multiple windows (e.g., Startscan, Midscan, Eindscan) with 
selected competencies from the database.

Usage:
    python scripts/seed_competency_scans.py [school_id]
    
    school_id: Optional. The ID of the school to add competency scans to (default: 1)
    
Examples:
    python scripts/seed_competency_scans.py        # Adds to school_id=1
    python scripts/seed_competency_scans.py 2      # Adds to school_id=2
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta

from app.infra.db.session import SessionLocal
from app.infra.db.models import School, Competency, CompetencyWindow, Course


def seed_competency_scans(target_school_id=1):
    """Seed competency scans test data
    
    Args:
        target_school_id: The school ID to add competency scans to (default: 1)
    """
    print("=" * 60)
    print("SEEDING COMPETENCY SCANS TEST DATA")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        # Get the target school
        school = db.query(School).filter(School.id == target_school_id).first()
        if not school:
            print(f"❌ Error: School with ID {target_school_id} not found!")
            print("\nAvailable schools:")
            schools = db.query(School).all()
            if schools:
                for s in schools:
                    print(f"  - ID {s.id}: {s.name}")
            else:
                print("  No schools found in database.")
            return
        
        print(f"✓ Using school: {school.name} (ID: {school.id})")
        
        # Get competencies from this school
        competencies = db.query(Competency).filter(
            Competency.school_id == school.id
        ).order_by(Competency.order).all()
        
        if not competencies:
            print("❌ Error: No competencies found in this school.")
            print("  Please run the competency seed migration first.")
            print("  Migration: alembic upgrade head")
            return
        
        print(f"✓ Found {len(competencies)} competencies in the database")
        
        # Get a course if available (optional)
        course = db.query(Course).filter(Course.school_id == school.id).first()
        course_id = course.id if course else None
        if course:
            print(f"✓ Found course: {course.name} (ID: {course.id})")
        
        # Define competency scan windows to create
        now = datetime.now()
        
        # Select different subsets of competencies for each window
        # Note: competencies are ordered by their 'order' field from the database.
        # With the default template, this results in competencies grouped by category:
        # 1-5: Samenwerken, 6-10: Plannen & Organiseren, 11-15: Creatief denken,
        # 16-20: Technische vaardigheden, 21-25: Communicatie, 26-30: Reflectie
        
        # Startscan: First 10 competencies (collaboration and planning focus)
        startscan_competencies = competencies[:10] if len(competencies) >= 10 else competencies
        
        # Midscan: Second group of 10 competencies (creative thinking and technical skills focus)
        if len(competencies) >= 20:
            midscan_competencies = competencies[10:20]
        elif len(competencies) > 10:
            midscan_competencies = competencies[10:]
        else:
            midscan_competencies = competencies  # Use all if less than 10
        
        # Eindscan: Third group of 10 competencies (communication and reflection focus)
        if len(competencies) >= 30:
            eindscan_competencies = competencies[20:30]
        elif len(competencies) > 20:
            eindscan_competencies = competencies[20:]
        else:
            eindscan_competencies = competencies[-10:] if len(competencies) >= 10 else competencies
        
        # For Q1 scan: use all competencies
        q1_competencies = competencies
        
        windows_data = [
            {
                "title": "Startscan Periode 1",
                "description": "Begin van het schooljaar competentiescan. Focus op samenwerking en planning.",
                "class_names": ["V4A", "V4B"],
                "start_date": now - timedelta(days=60),
                "end_date": now - timedelta(days=45),
                "status": "closed",
                "competencies": startscan_competencies,
                "require_self_score": True,
                "require_goal": True,
                "require_reflection": False,
            },
            {
                "title": "Midscan Periode 2",
                "description": "Halverwege het semester scan. Focus op creatief denken en technische vaardigheden.",
                "class_names": ["V4A", "V4B"],
                "start_date": now - timedelta(days=30),
                "end_date": now - timedelta(days=15),
                "status": "closed",
                "competencies": midscan_competencies,
                "require_self_score": True,
                "require_goal": True,
                "require_reflection": True,
            },
            {
                "title": "Eindscan Periode 3",
                "description": "Eind van semester scan. Focus op communicatie en reflectie.",
                "class_names": ["V4A", "V4B"],
                "start_date": now - timedelta(days=7),
                "end_date": now + timedelta(days=7),
                "status": "open",
                "competencies": eindscan_competencies,
                "require_self_score": True,
                "require_goal": True,
                "require_reflection": True,
            },
            {
                "title": "Competentiescan Q1 2025",
                "description": "Complete competentiescan voor alle vaardigheden eerste kwartaal.",
                "class_names": ["V4A", "V4B", "V5A"],
                "start_date": now + timedelta(days=14),
                "end_date": now + timedelta(days=28),
                "status": "draft",
                "competencies": q1_competencies,
                "require_self_score": True,
                "require_goal": False,
                "require_reflection": False,
            },
        ]
        
        print("\n" + "-" * 60)
        print("Creating competency scan windows:")
        print("-" * 60)
        
        created_windows = []
        for window_data in windows_data:
            # Check if window already exists
            existing = db.query(CompetencyWindow).filter(
                CompetencyWindow.school_id == school.id,
                CompetencyWindow.title == window_data["title"]
            ).first()
            
            if existing:
                print(f"⚠ Window already exists: {window_data['title']}")
                created_windows.append(existing)
                continue
            
            # Get competency IDs
            competency_ids = [c.id for c in window_data["competencies"]]
            
            # Create the window
            window = CompetencyWindow(
                school_id=school.id,
                title=window_data["title"],
                description=window_data["description"],
                class_names=window_data["class_names"],
                course_id=course_id,
                start_date=window_data["start_date"],
                end_date=window_data["end_date"],
                status=window_data["status"],
                require_self_score=window_data["require_self_score"],
                require_goal=window_data["require_goal"],
                require_reflection=window_data["require_reflection"],
                settings={
                    "competency_ids": competency_ids,
                    # Store deadline in settings for compatibility with wizard-created windows
                    # In this case, deadline matches end_date (students must complete by window end)
                    "deadline": window_data["end_date"].isoformat(),
                }
            )
            db.add(window)
            db.flush()
            
            print(f"✓ Created window: {window.title}")
            print(f"  - Status: {window.status}")
            print(f"  - Class names: {', '.join(window.class_names)}")
            print(f"  - Start: {window.start_date.strftime('%Y-%m-%d')}")
            print(f"  - End: {window.end_date.strftime('%Y-%m-%d')}")
            print(f"  - Competencies: {len(competency_ids)}")
            print(f"  - Require self-score: {window.require_self_score}")
            print(f"  - Require goal: {window.require_goal}")
            print(f"  - Require reflection: {window.require_reflection}")
            
            created_windows.append(window)
        
        db.commit()
        
        print("\n" + "=" * 60)
        print("COMPETENCY SCANS TEST DATA SEEDED SUCCESSFULLY")
        print("=" * 60)
        print(f"\nSchool: {school.name} (ID: {school.id})")
        print(f"\nCreated/verified {len(created_windows)} competency scan windows:")
        for window in created_windows:
            comp_count = len(window.settings.get("competency_ids", []))
            print(f"  - {window.title}")
            print(f"    Status: {window.status}, Competencies: {comp_count}, Classes: {', '.join(window.class_names)}")
        print("\n" + "=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    # Get school_id from command line argument, default to 1
    school_id = 1
    if len(sys.argv) > 1:
        try:
            school_id = int(sys.argv[1])
        except ValueError:
            print(f"❌ Error: Invalid school_id '{sys.argv[1]}'. Please provide a valid integer (e.g., 1, 2, 3).")
            sys.exit(1)
    
    seed_competency_scans(school_id)
