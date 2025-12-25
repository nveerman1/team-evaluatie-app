"""
Seed script for peer evaluations with scores, feedback, and reflections

Creates peer evaluations with:
- Allocations (who reviews whom)
- Scores on rubric criteria
- Optional comments/feedback per score
- Reflections per student

Usage:
    python scripts/seed_peer_evaluations.py

This script:
- Creates peer evaluation(s) for course_id=1
- Seeds data for students with IDs: 5, 6, 7, 8, 18, 19, 20, 34, 35, 36, 37 from school id 1
- Creates allocations (reviewer -> reviewee pairs)
- Creates scores with feedback for each criterion
- Creates reflections for each student
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
    Course,
    Evaluation,
    Rubric,
    RubricCriterion,
    Allocation,
    Score,
    Reflection,
)


def generate_realistic_score(is_self_assessment: bool) -> int:
    """Generate realistic scores based on assessment type.

    Args:
        is_self_assessment: True for self-assessment, False for peer assessment

    Returns:
        Score value between 1-5
    """
    rand = random.random()
    if is_self_assessment:
        # Self-assessment: 10% = 2, 25% = 3, 40% = 4, 25% = 5
        if rand < 0.10:
            return 2
        elif rand < 0.35:
            return 3
        elif rand < 0.75:
            return 4
        else:
            return 5
    else:
        # Peer assessment: 10% = 1, 20% = 2, 35% = 3, 25% = 4, 10% = 5
        if rand < 0.10:
            return 1
        elif rand < 0.30:
            return 2
        elif rand < 0.65:
            return 3
        elif rand < 0.90:
            return 4
        else:
            return 5


def seed_peer_evaluations():
    """Seed peer evaluations with scores, feedback, and reflections"""
    print("=" * 60)
    print("SEEDING PEER EVALUATIONS")
    print("=" * 60)

    db = SessionLocal()

    try:
        # Configuration
        school_id = 1
        course_id = 1
        student_ids = [5, 6, 7, 8, 18, 19, 20, 34, 35, 36, 37]

        # Get school
        school = db.query(School).filter(School.id == school_id).first()
        if not school:
            print(f"❌ Error: School with ID {school_id} not found!")
            return

        print(f"✓ School: {school.name} (ID: {school.id})")

        # Get course
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            print(f"❌ Error: Course with ID {course_id} not found!")
            return

        print(f"✓ Course: {course.name} (ID: {course.id})")

        # Verify students exist
        students = []
        print("\n" + "-" * 60)
        print("Checking students:")
        print("-" * 60)

        for student_id in student_ids:
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
                print(f"✓ Student {student_id}: {user.name}")
            else:
                print(f"⚠ Student {student_id}: NOT FOUND in school {school_id}")

        if not students:
            print("\n❌ Error: No students found from the specified list!")
            return

        print(f"\n✓ Found {len(students)} students")

        # Get peer rubrics for this school
        rubrics = (
            db.query(Rubric)
            .filter(Rubric.school_id == school_id, Rubric.scope == "peer")
            .all()
        )

        if not rubrics:
            print("❌ Error: No peer rubrics found in this school.")
            print("  Please ensure peer rubrics are created first.")
            return

        print(f"✓ Found {len(rubrics)} peer rubric(s)")
        for rubric in rubrics:
            criteria_count = (
                db.query(RubricCriterion)
                .filter(RubricCriterion.rubric_id == rubric.id)
                .count()
            )
            print(f"  - {rubric.title} (ID: {rubric.id}, {criteria_count} criteria)")

        # Use the first available peer rubric
        rubric = rubrics[0]
        criteria = (
            db.query(RubricCriterion)
            .filter(RubricCriterion.rubric_id == rubric.id)
            .order_by(RubricCriterion.order)
            .all()
        )

        if not criteria:
            print(f"❌ Error: No criteria found for rubric {rubric.id}")
            return

        print(f"\n✓ Using rubric: {rubric.title} with {len(criteria)} criteria")

        # Define evaluation scenarios
        now = datetime.now()

        evaluations_data = [
            {
                "title": "Peerevaluatie Q1 - Teamwork",
                "description": "Peerevaluatie gericht op samenwerking en communicatie binnen teams.",
                "status": "closed",
                "closed_at": now - timedelta(days=10),
            },
            {
                "title": "Peerevaluatie Q2 - Project Skills",
                "description": "Peerevaluatie gericht op projectvaardigheden en zelfsturing.",
                "status": "closed",
                "closed_at": now - timedelta(days=3),
            },
            {
                "title": "Peerevaluatie Q3 - Current",
                "description": "Lopende peerevaluatie voor het huidige kwartaal.",
                "status": "open",
                "closed_at": None,
            },
        ]

        print("\n" + "-" * 60)
        print("Creating peer evaluations:")
        print("-" * 60)

        created_evaluations = []
        for eval_data in evaluations_data:
            # Check if evaluation already exists
            existing = (
                db.query(Evaluation)
                .filter(
                    Evaluation.school_id == school_id,
                    Evaluation.course_id == course_id,
                    Evaluation.title == eval_data["title"],
                )
                .first()
            )

            if existing:
                print(f"\n⚠ Evaluation already exists: {eval_data['title']}")
                print("  Deleting existing evaluation and related data to recreate...")
                # Delete existing data
                allocations = (
                    db.query(Allocation)
                    .filter(Allocation.evaluation_id == existing.id)
                    .all()
                )
                for allocation in allocations:
                    db.query(Score).filter(
                        Score.allocation_id == allocation.id
                    ).delete()
                db.query(Allocation).filter(
                    Allocation.evaluation_id == existing.id
                ).delete()
                db.query(Reflection).filter(
                    Reflection.evaluation_id == existing.id
                ).delete()
                db.delete(existing)
                db.commit()

            # Create the evaluation
            evaluation = Evaluation(
                school_id=school_id,
                course_id=course_id,
                rubric_id=rubric.id,
                title=eval_data["title"],
                evaluation_type="peer",
                status=eval_data["status"],
                closed_at=eval_data["closed_at"],
                settings={
                    "description": eval_data["description"],
                    "allow_self_assessment": True,
                },
            )
            db.add(evaluation)
            db.flush()

            print(f"\n✓ Created evaluation: {evaluation.title}")
            print(f"  - Status: {evaluation.status}")
            print(f"  - Rubric: {rubric.title}")

            # Create allocations (peer reviews)
            # Each student reviews themselves and 2-3 other students
            allocations_created = 0
            scores_created = 0
            reflections_created = 0

            student_allocations = {}  # Track allocations per student

            for student in students:
                # Self-assessment
                self_allocation = Allocation(
                    school_id=school_id,
                    evaluation_id=evaluation.id,
                    reviewer_id=student.id,
                    reviewee_id=student.id,
                    is_self=True,
                )
                db.add(self_allocation)
                db.flush()
                allocations_created += 1

                if student.id not in student_allocations:
                    student_allocations[student.id] = []
                student_allocations[student.id].append(self_allocation)

                # Peer reviews: each student reviews 2-3 others
                num_peer_reviews = random.randint(2, 3)
                other_students = [s for s in students if s.id != student.id]
                reviewees = random.sample(
                    other_students, min(num_peer_reviews, len(other_students))
                )

                for reviewee in reviewees:
                    peer_allocation = Allocation(
                        school_id=school_id,
                        evaluation_id=evaluation.id,
                        reviewer_id=student.id,
                        reviewee_id=reviewee.id,
                        is_self=False,
                    )
                    db.add(peer_allocation)
                    db.flush()
                    allocations_created += 1
                    student_allocations[student.id].append(peer_allocation)

            # Create scores and feedback for each allocation
            for student_id, allocations in student_allocations.items():
                for allocation in allocations:
                    for criterion in criteria:
                        # Generate realistic scores
                        score_value = generate_realistic_score(allocation.is_self)

                        # Generate optional feedback (60% chance)
                        comment = None
                        if random.random() < 0.6:
                            if allocation.is_self:
                                self_comments = [
                                    "Ik denk dat ik hier goed in ben en dit consequent toepas.",
                                    "Dit is een punt waar ik aan werk en vooruitgang boek.",
                                    "Ik zie dit als een sterke kant van mezelf.",
                                    "Hier kan ik nog groeien en meer aandacht aan besteden.",
                                    "Dit past ik regelmatig toe in het team.",
                                ]
                                comment = random.choice(self_comments)
                            else:
                                if score_value >= 4:
                                    positive_comments = [
                                        "Doet dit uitstekend en neemt het initiatief.",
                                        "Sterke bijdrage aan het team op dit punt.",
                                        "Altijd betrouwbaar en consistent.",
                                        "Laat goede voorbeelden zien hiervan.",
                                        "Neemt verantwoordelijkheid en handelt proactief.",
                                    ]
                                    comment = random.choice(positive_comments)
                                elif score_value >= 3:
                                    neutral_comments = [
                                        "Doet wat er van verwacht wordt.",
                                        "Goede basis, met ruimte voor verbetering.",
                                        "Past dit meestal goed toe.",
                                        "Voldoende bijdrage op dit gebied.",
                                        "Consistent in de uitvoering.",
                                    ]
                                    comment = random.choice(neutral_comments)
                                else:
                                    constructive_comments = [
                                        "Hier is nog ruimte voor groei.",
                                        "Kan meer initiatief tonen op dit punt.",
                                        "Zou hier meer aandacht aan kunnen besteden.",
                                        "Dit aspect vraagt nog wat ontwikkeling.",
                                        "Meer betrokkenheid zou helpen.",
                                    ]
                                    comment = random.choice(constructive_comments)

                        # Create score
                        score = Score(
                            school_id=school_id,
                            allocation_id=allocation.id,
                            criterion_id=criterion.id,
                            score=score_value,
                            comment=comment,
                            status="submitted",
                        )
                        db.add(score)
                        scores_created += 1

            # Create reflections for each student (only for closed evaluations)
            if evaluation.status == "closed":
                for student in students:
                    reflection_templates = [
                        (
                            "Deze peer evaluatie heeft me geholpen om bewuster te worden van mijn rol in het team. "
                            "Ik realiseer me dat ik sterker ben in organisatie dan ik dacht, maar dat ik nog kan groeien "
                            "in het delen van mijn ideeën tijdens teamoverleggen. De feedback van mijn teamgenoten was waardevol.",
                            38,
                        ),
                        (
                            "De feedback die ik heb ontvangen bevestigt waar ik al aan werkte: beter luisteren en meer ruimte "
                            "geven aan anderen. Ik ben trots op mijn bijdrage aan het project en de manier waarop ik taken heb "
                            "georganiseerd. Voor de volgende periode wil ik meer initiatief nemen in het oplossen van problemen.",
                            43,
                        ),
                        (
                            "Wat me opviel is dat mijn teamgenoten mijn inzet waarderen, maar dat ik soms te snel conclusies trek. "
                            "Ik ga bewuster nadenken voordat ik beslissingen neem en meer samenwerken bij het zoeken naar oplossingen. "
                            "Mijn sterke punten zijn creativiteit en doorzettingsvermogen.",
                            38,
                        ),
                        (
                            "Deze evaluatie heeft me nieuwe inzichten gegeven. Ik ben goed in het motiveren van anderen en het "
                            "bewaken van deadlines, maar ik kan nog werken aan het geven van constructieve feedback aan teamleden. "
                            "Ik neem me voor om opener te zijn in communicatie en meer te reflecteren op mijn eigen acties.",
                            43,
                        ),
                        (
                            "De peer feedback was eerlijk en constructief. Ik zie dat ik sterk ben in technische uitvoering en "
                            "detailgericht werk, maar dat ik meer kan communiceren over mijn voortgang. Ik ga actief updates delen "
                            "met het team en meer vragen stellen als iets onduidelijk is. Samenwerken is een continu leerproces.",
                            44,
                        ),
                    ]

                    # Select a random reflection with pre-calculated word count
                    reflection_text, word_count = random.choice(reflection_templates)

                    # Random submission time (within the evaluation period)
                    days_before_close = random.randint(0, 7)
                    submitted_at = evaluation.closed_at - timedelta(
                        days=days_before_close
                    )

                    reflection = Reflection(
                        school_id=school_id,
                        evaluation_id=evaluation.id,
                        user_id=student.id,
                        text=reflection_text,
                        word_count=word_count,
                        submitted_at=submitted_at,
                    )
                    db.add(reflection)
                    reflections_created += 1

            print(f"  - Allocations created: {allocations_created}")
            print(f"  - Scores created: {scores_created}")
            if reflections_created > 0:
                print(f"  - Reflections created: {reflections_created}")

            created_evaluations.append(evaluation)

        db.commit()

        print("\n" + "=" * 60)
        print("PEER EVALUATIONS SEEDED SUCCESSFULLY")
        print("=" * 60)
        print(f"\nSchool: {school.name} (ID: {school.id})")
        print(f"Course: {course.name} (ID: {course.id})")
        print(f"Students: {len(students)}")
        print(f"Rubric: {rubric.title}")
        print(f"\nCreated {len(created_evaluations)} peer evaluation(s):")
        for evaluation in created_evaluations:
            allocation_count = (
                db.query(Allocation)
                .filter(Allocation.evaluation_id == evaluation.id)
                .count()
            )
            score_count = (
                db.query(Score)
                .join(Allocation)
                .filter(Allocation.evaluation_id == evaluation.id)
                .count()
            )
            reflection_count = (
                db.query(Reflection)
                .filter(Reflection.evaluation_id == evaluation.id)
                .count()
            )

            print(f"  - {evaluation.title}")
            print(f"    Status: {evaluation.status}")
            print(f"    Allocations: {allocation_count}, Scores: {score_count}", end="")
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
    seed_peer_evaluations()
