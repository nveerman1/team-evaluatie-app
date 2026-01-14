"""
Seed script for competency scans with self-scores filled in

Creates 6 competency scan windows for course_id=1 with self-scores
filled in for specific students.

Usage:
    python scripts/seed_competency_scans_with_scores.py

This script:
- Creates 6 competency scan windows for course_id=1
- First 3 scans: 10 competencies each with self-scores only
- Scans 4-5: ALL competencies with self-scores, goals, and reflections
- Scan 6: ALL competencies with extreme scores (very low, very high, and strong growth)
- Fills in data for students with IDs: 5, 6, 7, 8, 18, 19, 20, 34, 35, 36, 37
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
    CompetencyGoal,
    CompetencyReflection,
    Course,
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

        print(
            f"✓ Using course: {course.name} (ID: {course.id}, school_id: {course.school_id})"
        )
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
            user = (
                db.query(User)
                .filter(
                    User.id == student_id,
                    User.school_id == school_id,
                    User.role == "student",
                )
                .first()
            )
            if user:
                students.append(user)
                print(
                    f"✓ Student {student_id}: {user.name} ({user.class_name or 'no class'})"
                )
            else:
                print(f"⚠ Student {student_id}: NOT FOUND in school {school_id}")

        # If no preferred students found, use all students from the school
        if not students:
            print(
                f"\nPreferred student IDs not found. Using all students from school {school_id}..."
            )
            students = (
                db.query(User)
                .filter(User.school_id == school_id, User.role == "student")
                .all()
            )
            for student in students:
                print(
                    f"✓ Student {student.id}: {student.name} ({student.class_name or 'no class'})"
                )

        if not students:
            print("\n❌ Error: No students found in this school!")
            return

        print(f"\n✓ Found {len(students)} students")

        # Get competencies
        competencies = (
            db.query(Competency)
            .filter(Competency.school_id == school_id)
            .order_by(Competency.order)
            .all()
        )

        if not competencies:
            print("❌ Error: No competencies found in this school.")
            print("  Please run: alembic upgrade head")
            return

        print(f"✓ Found {len(competencies)} competencies")

        # Define 5 competency scan windows
        now = datetime.now()

        # Select different subsets for first 3 scans
        scan1_competencies = (
            competencies[:10] if len(competencies) >= 10 else competencies
        )
        scan2_competencies = (
            competencies[10:20] if len(competencies) >= 20 else competencies[:10]
        )
        scan3_competencies = (
            competencies[20:30]
            if len(competencies) >= 30
            else competencies[-10:] if len(competencies) >= 10 else competencies
        )

        windows_data = [
            {
                "title": "Startscan - Course 1",
                "description": "Startscan voor studenten in course 1. Focus op samenwerking en planning.",
                "start_date": now - timedelta(days=60),
                "end_date": now - timedelta(days=45),
                "status": "closed",
                "competencies": scan1_competencies,
                "include_goals": False,
                "include_reflection": False,
            },
            {
                "title": "Midscan - Course 1",
                "description": "Midscan voor studenten in course 1. Focus op creatief denken en technische vaardigheden.",
                "start_date": now - timedelta(days=30),
                "end_date": now - timedelta(days=15),
                "status": "closed",
                "competencies": scan2_competencies,
                "include_goals": False,
                "include_reflection": False,
            },
            {
                "title": "Eindscan - Course 1",
                "description": "Eindscan voor studenten in course 1. Focus op communicatie en reflectie.",
                "start_date": now - timedelta(days=7),
                "end_date": now + timedelta(days=7),
                "status": "open",
                "competencies": scan3_competencies,
                "include_goals": False,
                "include_reflection": False,
            },
            {
                "title": "Volledige competentiescan Q1 - Course 1",
                "description": "Complete competentiescan met alle competenties, leerdoelen en reflectie.",
                "start_date": now - timedelta(days=90),
                "end_date": now - timedelta(days=75),
                "status": "closed",
                "competencies": competencies,  # ALL competencies
                "include_goals": True,
                "include_reflection": True,
            },
            {
                "title": "Volledige competentiescan Q2 - Course 1",
                "description": "Complete competentiescan met alle competenties, leerdoelen en reflectie.",
                "start_date": now - timedelta(days=50),
                "end_date": now - timedelta(days=35),
                "status": "closed",
                "competencies": competencies,  # ALL competencies
                "include_goals": True,
                "include_reflection": True,
            },
            {
                "title": "Extreme scores scan - Course 1",
                "description": "Competentiescan met extreme scores: erg lage scores, erg hoge scores, en sterke groei t.o.v. vorige scan.",
                "start_date": now - timedelta(days=20),
                "end_date": now - timedelta(days=5),
                "status": "closed",
                "competencies": competencies,  # ALL competencies
                "include_goals": False,
                "include_reflection": False,
                "use_extreme_scores": True,  # Special flag for extreme scoring
            },
        ]

        print("\n" + "-" * 60)
        print("Creating competency scan windows with self-scores:")
        print("-" * 60)

        created_windows = []
        for window_data in windows_data:
            # Check if window already exists
            existing = (
                db.query(CompetencyWindow)
                .filter(
                    CompetencyWindow.school_id == school_id,
                    CompetencyWindow.title == window_data["title"],
                )
                .first()
            )

            if existing:
                print(f"\n⚠ Window already exists: {window_data['title']}")
                print("  Deleting existing window and related data to recreate...")
                # Delete existing data
                db.query(CompetencyReflection).filter(
                    CompetencyReflection.window_id == existing.id
                ).delete()
                db.query(CompetencyGoal).filter(
                    CompetencyGoal.window_id == existing.id
                ).delete()
                db.query(CompetencySelfScore).filter(
                    CompetencySelfScore.window_id == existing.id
                ).delete()
                db.delete(existing)
                db.commit()

            # Get competency IDs
            competency_ids = [c.id for c in window_data["competencies"]]

            # Create the window
            include_goals = window_data.get("include_goals", False)
            include_reflection = window_data.get("include_reflection", False)

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
                require_goal=include_goals,
                require_reflection=include_reflection,
                settings={
                    "competency_ids": competency_ids,
                    "deadline": window_data["end_date"].isoformat(),
                },
            )
            db.add(window)
            db.flush()

            print(f"\n✓ Created window: {window.title}")
            print(f"  - Status: {window.status}")
            print(f"  - Start: {window.start_date.strftime('%Y-%m-%d')}")
            print(f"  - End: {window.end_date.strftime('%Y-%m-%d')}")
            print(f"  - Competencies: {len(competency_ids)}")
            print(f"  - Includes goals: {include_goals}")
            print(f"  - Includes reflection: {include_reflection}")

            # Create self-scores for each student
            scores_created = 0
            goals_created = 0
            reflections_created = 0

            # Track goals per student for reflection linking
            student_goals = {}

            for student in students:
                # Create goals for this student if needed (one per student, not per competency)
                if include_goals:
                    # Create 2-3 goals per student
                    num_goals = random.randint(2, 3)
                    student_goals[student.id] = []

                    goal_templates = [
                        "Ik wil beter worden in {} door meer te oefenen en feedback te vragen.",
                        "Ik ga werken aan {} door concrete voorbeelden te verzamelen.",
                        "Mijn doel is om {} te verbeteren door actief te oefenen in projecten.",
                        "Ik wil groeien in {} door bewuster te reflecteren op mijn werk.",
                    ]

                    success_criteria_templates = [
                        "Ik heb dit bereikt als ik minimaal 3 concrete voorbeelden kan geven.",
                        "Ik merk dit aan positieve feedback van teamgenoten en docenten.",
                        "Dit is gelukt als ik deze vaardigheid zelfstandig kan toepassen.",
                        "Ik zie vooruitgang in mijn zelfreflecties en voorbeelden.",
                    ]

                    for _ in range(num_goals):
                        # Pick a random competency to focus on
                        random_comp = random.choice(window_data["competencies"])
                        goal_text = random.choice(goal_templates).format(
                            random_comp.name.lower()
                        )
                        success_criteria = random.choice(success_criteria_templates)

                        # Random goal status
                        status_rand = random.random()
                        if status_rand < 0.3:
                            status = "achieved"
                        elif status_rand < 0.6:
                            status = "in_progress"
                        else:
                            status = "not_achieved"

                        goal = CompetencyGoal(
                            school_id=school_id,
                            window_id=window.id,
                            user_id=student.id,
                            competency_id=random_comp.id,
                            goal_text=goal_text,
                            success_criteria=success_criteria,
                            status=status,
                            submitted_at=window.start_date
                            + timedelta(days=random.randint(1, 5)),
                        )
                        db.add(goal)
                        db.flush()
                        student_goals[student.id].append(goal)
                        goals_created += 1

                # Create self-scores for each competency
                for competency in window_data["competencies"]:
                    # Generate scores based on window type
                    if use_extreme_scores:
                        # Extreme scores logic
                        if student in low_score_students:
                            # Very low scores: 80% chance of 1-2
                            rand = random.random()
                            if rand < 0.5:
                                score = 1
                            elif rand < 0.8:
                                score = 2
                            else:
                                score = 3
                        elif student in high_score_students:
                            # Very high scores: 80% chance of 4-5
                            rand = random.random()
                            if rand < 0.5:
                                score = 5
                            elif rand < 0.8:
                                score = 4
                            else:
                                score = 3
                        elif student in growth_students:
                            # Strong growth: previous score + 1 or 2 (capped at 5)
                            key = (student.id, competency.id)
                            if key in previous_scores_by_student:
                                prev_score = previous_scores_by_student[key]
                                growth = random.randint(1, 2)
                                score = min(5, prev_score + growth)
                            else:
                                # If no previous score, use high scores
                                score = random.randint(4, 5)
                        else:
                            # Default to normal distribution
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
                    else:
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
                        submitted_at=window.end_date
                        - timedelta(days=random.randint(1, 10)),
                    )
                    db.add(self_score)
                    scores_created += 1

                # Create reflection for this student if needed (one per student)
                if include_reflection:
                    reflection_templates = [
                        "Deze periode heb ik veel geleerd over mijn vaardigheden. Ik ben vooral gegroeid in samenwerking en communicatie. De projecten hebben me geholpen om bewuster te worden van mijn sterke en zwakke punten.",
                        "Tijdens deze competentiescan heb ik ontdekt dat ik goed ben in planning en organisatie, maar dat ik nog kan groeien in creatief denken. Ik ga me de komende periode meer focussen op het bedenken van originele oplossingen.",
                        "De feedback van mijn teamgenoten was waardevol. Ik realiseer me dat ik meer mijn mening moet delen en initiatief moet nemen. Dit zijn punten waar ik bewust aan ga werken.",
                        "Ik ben tevreden met mijn ontwikkeling dit kwartaal. De doelen die ik had gesteld zijn grotendeels behaald. Voor de volgende periode wil ik me meer richten op reflectie en professionele houding.",
                    ]

                    evidence_templates = [
                        "Concrete voorbeelden: tijdens de groepspresentatie nam ik het voortouw, in het projectverslag schreef ik het grootste deel, en tijdens teamoverleggen droeg ik actief bij met ideeën.",
                        "Ik kan dit onderbouwen met het eindproduct dat we als team hebben opgeleverd, de positieve feedback van mijn begeleider, en mijn eigen logboek waarin ik mijn voortgang heb bijgehouden.",
                        "Bewijs hiervan is te zien in mijn portfolio, de peer-feedback die ik heb ontvangen, en de verbeteringen die zichtbaar zijn tussen mijn start- en eindevaluatie.",
                    ]

                    # Link to first goal if available
                    goal_id = (
                        student_goals[student.id][0].id
                        if student.id in student_goals and student_goals[student.id]
                        else None
                    )

                    # Determine if goal was achieved (70% chance if there's a goal)
                    goal_achieved = random.random() < 0.7 if goal_id else None

                    reflection = CompetencyReflection(
                        school_id=school_id,
                        window_id=window.id,
                        user_id=student.id,
                        goal_id=goal_id,
                        text=random.choice(reflection_templates),
                        goal_achieved=goal_achieved,
                        evidence=(
                            random.choice(evidence_templates)
                            if random.random() < 0.7
                            else None
                        ),
                        submitted_at=window.end_date
                        - timedelta(days=random.randint(0, 3)),
                    )
                    db.add(reflection)
                    reflections_created += 1

            print(f"  - Self-scores created: {scores_created}")
            if include_goals:
                print(f"  - Goals created: {goals_created}")
            if include_reflection:
                print(f"  - Reflections created: {reflections_created}")
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
            score_count = (
                db.query(CompetencySelfScore)
                .filter(CompetencySelfScore.window_id == window.id)
                .count()
            )
            goal_count = (
                db.query(CompetencyGoal)
                .filter(CompetencyGoal.window_id == window.id)
                .count()
            )
            reflection_count = (
                db.query(CompetencyReflection)
                .filter(CompetencyReflection.window_id == window.id)
                .count()
            )

            print(f"  - {window.title}")
            print(f"    Status: {window.status}, Competencies: {comp_count}")
            print(f"    Self-scores: {score_count}", end="")
            if goal_count > 0:
                print(f", Goals: {goal_count}", end="")
            if reflection_count > 0:
                print(f", Reflections: {reflection_count}", end="")
            print()
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
