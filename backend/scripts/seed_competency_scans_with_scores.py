"""
Seed script for competency scans with self-scores filled in

Creates 3 competency scan windows for course_id=1 with self-scores
filled in for specific students.

Usage:
    python scripts/seed_competency_scans_with_scores.py
    
This script:
- Creates 3 competency scan windows for course_id=1
- Fills in self-scores for students with IDs: 5, 6, 7, 8, 18, 19, 20, 34, 35, 36, 37
- Uses realistic score distributions (1-5 scale)
"""

import sys
import os
import random

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta

from app.infra.db.session import SessionLocal
from app.infra.db.models import (
    School,
    User,
    Competency,
    CompetencyWindow,
    CompetencySelfScore,
    Course
)


def seed_competency_scans_with_scores():
    """Seed competency scans with self-scores for specific students"""
    print("=" * 60)
    print("SEEDING COMPETENCY SCANS WITH SELF-SCORES")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        # Configuration
        course_id = 1
        # Preferred student IDs - will use these if they exist, otherwise use all students
        preferred_student_ids = [5, 6, 7, 8, 18, 19, 20, 34, 35, 36, 37]
        
        # Get course
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            print(f"❌ Error: Course with ID {course_id} not found!")
            return
        
        print(f"✓ Using course: {course.name} (ID: {course.id}, school_id: {course.school_id})")
        school_id = course.school_id
        
        # Get school
        school = db.query(School).filter(School.id == school_id).first()
        if not school:
            print(f"❌ Error: School with ID {school_id} not found!")
            return
        
        print(f"✓ School: {school.name} (ID: {school.id})")
        
        # Verify students exist - try preferred IDs first
        students = []
        print("\n" + "-" * 60)
        print("Checking students:")
        print("-" * 60)
        
        # Try to get students with preferred IDs
        for student_id in preferred_student_ids:
            user = db.query(User).filter(
                User.id == student_id,
                User.school_id == school_id,
                User.role == 'student'
            ).first()
            if user:
                students.append(user)
                print(f"✓ Student {student_id}: {user.name} ({user.class_name or 'no class'})")
            else:
                print(f"⚠ Student {student_id}: NOT FOUND in school {school_id}")
        
        # If no preferred students found, use all students from the school
        if not students:
            print(f"\nPreferred student IDs not found. Using all students from school {school_id}...")
            students = db.query(User).filter(
                User.school_id == school_id,
                User.role == 'student'
            ).all()
            for student in students:
                print(f"✓ Student {student.id}: {student.name} ({student.class_name or 'no class'})")
        
        if not students:
            print("\n❌ Error: No students found in this school!")
            return
        
        print(f"\n✓ Found {len(students)} students")
        
        # Get competencies
        competencies = db.query(Competency).filter(
            Competency.school_id == school_id
        ).order_by(Competency.order).all()
        
        if not competencies:
            print("❌ Error: No competencies found in this school.")
            print("  Please run: alembic upgrade head")
            return
        
        print(f"✓ Found {len(competencies)} competencies")
        
        # Define 3 competency scan windows
        now = datetime.now()
        
        # Select different subsets for each scan
        scan1_competencies = competencies[:10] if len(competencies) >= 10 else competencies
        scan2_competencies = competencies[10:20] if len(competencies) >= 20 else competencies[:10]
        scan3_competencies = competencies[20:30] if len(competencies) >= 30 else competencies[-10:] if len(competencies) >= 10 else competencies
        
        windows_data = [
            {
                "title": "Startscan - Course 1",
                "description": "Startscan voor studenten in course 1. Focus op samenwerking en planning.",
                "start_date": now - timedelta(days=60),
                "end_date": now - timedelta(days=45),
                "status": "closed",
                "competencies": scan1_competencies,
            },
            {
                "title": "Midscan - Course 1",
                "description": "Midscan voor studenten in course 1. Focus op creatief denken en technische vaardigheden.",
                "start_date": now - timedelta(days=30),
                "end_date": now - timedelta(days=15),
                "status": "closed",
                "competencies": scan2_competencies,
            },
            {
                "title": "Eindscan - Course 1",
                "description": "Eindscan voor studenten in course 1. Focus op communicatie en reflectie.",
                "start_date": now - timedelta(days=7),
                "end_date": now + timedelta(days=7),
                "status": "open",
                "competencies": scan3_competencies,
            },
        ]
        
        print("\n" + "-" * 60)
        print("Creating competency scan windows with self-scores:")
        print("-" * 60)
        
        created_windows = []
        for window_data in windows_data:
            # Check if window already exists
            existing = db.query(CompetencyWindow).filter(
                CompetencyWindow.school_id == school_id,
                CompetencyWindow.title == window_data["title"]
            ).first()
            
            if existing:
                print(f"\n⚠ Window already exists: {window_data['title']}")
                print(f"  Deleting existing window and scores to recreate...")
                # Delete existing scores
                db.query(CompetencySelfScore).filter(
                    CompetencySelfScore.window_id == existing.id
                ).delete()
                db.delete(existing)
                db.commit()
            
            # Get competency IDs
            competency_ids = [c.id for c in window_data["competencies"]]
            
            # Create the window
            window = CompetencyWindow(
                school_id=school_id,
                title=window_data["title"],
                description=window_data["description"],
                class_names=[],  # No class filter - course-based
                course_id=course_id,
                start_date=window_data["start_date"],
                end_date=window_data["end_date"],
                status=window_data["status"],
                require_self_score=True,
                require_goal=False,
                require_reflection=False,
                settings={
                    "competency_ids": competency_ids,
                    "deadline": window_data["end_date"].isoformat(),
                }
            )
            db.add(window)
            db.flush()
            
            print(f"\n✓ Created window: {window.title}")
            print(f"  - Status: {window.status}")
            print(f"  - Start: {window.start_date.strftime('%Y-%m-%d')}")
            print(f"  - End: {window.end_date.strftime('%Y-%m-%d')}")
            print(f"  - Competencies: {len(competency_ids)}")
            
            # Create self-scores for each student
            scores_created = 0
            for student in students:
                for competency in window_data["competencies"]:
                    # Generate realistic scores (weighted towards 3-4)
                    # 10% = 1, 15% = 2, 35% = 3, 30% = 4, 10% = 5
                    rand = random.random()
                    if rand < 0.10:
                        score = 1
                    elif rand < 0.25:
                        score = 2
                    elif rand < 0.60:
                        score = 3
                    elif rand < 0.90:
                        score = 4
                    else:
                        score = 5
                    
                    # Random example text (50% chance)
                    example = None
                    if random.random() < 0.5:
                        examples = [
                            "Tijdens het project heb ik dit toegepast.",
                            "In de groepsopdracht kwam dit naar voren.",
                            "Bij de presentatie was dit duidelijk zichtbaar.",
                            "Tijdens de samenwerking met mijn team.",
                            "In de praktijkopdracht heb ik dit laten zien.",
                        ]
                        example = random.choice(examples)
                    
                    # Create self-score
                    self_score = CompetencySelfScore(
                        school_id=school_id,
                        window_id=window.id,
                        user_id=student.id,
                        competency_id=competency.id,
                        score=score,
                        example=example,
                        submitted_at=window.end_date - timedelta(days=random.randint(1, 10))
                    )
                    db.add(self_score)
                    scores_created += 1
            
            print(f"  - Self-scores created: {scores_created}")
            created_windows.append(window)
        
        db.commit()
        
        print("\n" + "=" * 60)
        print("COMPETENCY SCANS WITH SELF-SCORES SEEDED SUCCESSFULLY")
        print("=" * 60)
        print(f"\nSchool: {school.name} (ID: {school.id})")
        print(f"Course: {course.name} (ID: {course.id})")
        print(f"Students: {len(students)}")
        print(f"\nCreated {len(created_windows)} competency scan windows:")
        for window in created_windows:
            comp_count = len(window.settings.get("competency_ids", []))
            score_count = db.query(CompetencySelfScore).filter(
                CompetencySelfScore.window_id == window.id
            ).count()
            print(f"  - {window.title}")
            print(f"    Status: {window.status}, Competencies: {comp_count}, Self-scores: {score_count}")
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
    seed_competency_scans_with_scores()
