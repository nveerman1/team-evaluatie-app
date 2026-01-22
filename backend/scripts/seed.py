#!/usr/bin/env python3
"""
Comprehensive Database Seeding Script

Creates base or demo data for the Team Evaluatie App.

Usage:
    python -m backend.scripts.seed --mode base
    python -m backend.scripts.seed --mode demo --reset --seed 1234

Modes:
    base: Minimal idempotent seed (school, users, subject, academic year, competencies)
    demo: Comprehensive dataset with students, teams, projects, evaluations, etc.

Options:
    --mode {base|demo}   Required: Seeding mode
    --reset              For demo mode only: Truncate all tables before seeding
    --seed NUMBER        Random seed for deterministic data (default: 42)
"""

import argparse
import sys
import subprocess
from pathlib import Path
from datetime import datetime, date

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.infra.db.session import SessionLocal
from app.infra.db.models import (
    School,
    User,
    Subject,
    AcademicYear,
    Class,
    StudentClassMembership,
    Course,
    TeacherCourse,
    CourseEnrollment,
    Project,
    ProjectTeam,
    ProjectTeamMember,
    Rubric,
    RubricCriterion,
    Evaluation,
    Allocation,
    Score,
    Reflection,
    ProjectAssessment,
    ProjectAssessmentTeam,
    ProjectAssessmentScore,
    ProjectAssessmentReflection,
    ProjectAssessmentSelfAssessment,
    ProjectAssessmentSelfAssessmentScore,
    CompetencyCategory,
    Competency,
    CompetencyWindow,
    CompetencySelfScore,
    CompetencyGoal,
    CompetencyTeacherObservation,
    LearningObjective,
    Client,
    ClientLog,
    ClientProjectLink,
    ProjectNotesContext,
    ProjectNote,
    RFIDCard,
    AttendanceEvent,
)
from app.core.security import get_password_hash
from app.db.seed_utils import (
    DeterministicRandom,
    TimestampGenerator,
    UpsertHelper,
    DataFactory,
    create_instance,
)


# ============================================================================
# Constants
# ============================================================================

COMPETENCY_CATEGORIES = [
    ("Samenwerken", "Teamwork en samenwerking met anderen", "#3B82F6", "👥", 1),
    ("Plannen", "Plannen en organiseren van werk", "#10B981", "📋", 2),
    ("Creatief Denken", "Creatief denken en probleemoplossen", "#F59E0B", "💡", 3),
    ("Technisch Werken", "Technische vaardigheden en vakmanschap", "#8B5CF6", "🔧", 4),
    ("Communiceren", "Communicatie en presenteren", "#EC4899", "💬", 5),
    ("Reflecteren", "Reflectie en professionele houding", "#06B6D4", "🤔", 6),
]

BASE_CREDENTIALS = {
    "admin": ("admin@school.nl", "demo123", "Admin Gebruiker"),
    "teacher": ("docent@school.nl", "demo123", "Dhr. van der Berg"),
}

DEMO_CLASSES = ["G2a", "G2b"]


# ============================================================================
# Helper Functions
# ============================================================================


def print_section(title: str):
    """Print a section header"""
    print(f"\n{'=' * 60}")
    print(f"{title}")
    print("=" * 60)


def print_success(message: str):
    """Print success message"""
    print(f"✓ {message}")


def print_info(message: str):
    """Print info message"""
    print(f"  {message}")


def print_warning(message: str):
    """Print warning message"""
    print(f"⚠ {message}")


def seed_templates_for_school(school_id: int, subject_id: int):
    """
    Call the seed_templates.py script to seed all template data.
    
    This ensures competencies, learning objectives, rubrics, etc. are created.
    
    Args:
        school_id: School ID to seed templates for
        subject_id: Subject ID to use
    """
    print_section("SEEDING TEMPLATES")
    print_info(f"Calling seed_templates.py for school {school_id}, subject {subject_id}...")
    
    # Get the path to seed_templates.py
    seed_templates_path = Path(__file__).parent / "seed_templates.py"
    
    try:
        # Call seed_templates.py as a subprocess
        result = subprocess.run(
            [
                sys.executable,
                str(seed_templates_path),
                "--school-id", str(school_id),
                "--subject-id", str(subject_id),
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        
        # Print output for visibility
        if result.stdout:
            for line in result.stdout.split('\n'):
                if line.strip():
                    print_info(line)
        
        print_success("Templates seeded successfully")
        
    except subprocess.CalledProcessError as e:
        print_warning(f"Template seeding failed: {e}")
        if e.stdout:
            print_info("STDOUT:")
            print(e.stdout)
        if e.stderr:
            print_info("STDERR:")
            print(e.stderr)
        print_info("Continuing with seed - some data may be missing")
    except Exception as e:
        print_warning(f"Error calling seed_templates.py: {e}")
        print_info("Continuing with seed - some data may be missing")


def safe_truncate_tables(db: Session):
    """
    Safely truncate all tables in reverse dependency order.
    Respects foreign key constraints.
    """
    print_section("RESETTING DATABASE")

    # Tables in reverse dependency order (children first, then parents)
    tables = [
        # Deepest dependencies first
        "attendance_events",
        "rfid_cards",
        "submission_events",
        "assignment_submissions",
        "client_project_links",
        "client_logs",
        "clients",
        "learning_objectives",
        "competency_reflections",
        "competency_teacher_observations",
        "competency_goals",
        "competency_self_scores",
        "competency_peer_labels",
        "competency_external_scores",
        "competency_external_invites",
        "competency_windows",
        "competency_rubric_levels",
        "competencies",
        "project_assessment_self_assessment_scores",
        "project_assessment_self_assessments",
        "project_assessment_reflections",
        "project_assessment_scores",
        "project_assessment_teams",
        "project_assessments",
        "reflections",
        "reviewer_ratings",
        "scores",
        "allocations",
        "evaluations",
        "rubric_criterion_learning_objectives",
        "rubric_criteria",
        "rubrics",
        "project_team_members",
        "project_teams",
        "subprojects",
        "projects",
        "group_members",
        "groups",
        "course_enrollments",
        "teacher_courses",
        "courses",
        "student_class_memberships",
        "classes",
        "academic_years",
        "competency_categories",
        "subjects",
        "users",
        "schools",
    ]

    try:
        try:
            db.execute(text("SET session_replication_role = 'replica';"))
        except Exception as e:
            db.rollback()
            print_info(
                f"Info: cannot set session_replication_role (continuing without): {e}"
            )

        for table in tables:
            try:
                db.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE;"))
                db.commit()  # <-- CRUCIAAL: commit per tabel, zodat later rollback niets terugdraait
                print_info(f"Truncated {table}")
            except Exception as e:
                db.rollback()
                print_info(f"Warning: Could not truncate {table}: {e}")

        # No big commit needed here anymore (we already commit per table)
        print_success("Database reset complete")

        print_success("Database reset complete")
    except Exception as e:
        db.rollback()
        print(f"✗ Error during truncate: {e}")
        raise


def seed_base(db: Session):
    """
    Seed minimal base data (idempotent).

    Creates:
    - 1 school
    - 1 subject (O&O)
    - 1 academic year (2025-2026)
    - 6 competency categories
    - 1 admin user
    - 1 teacher user
    """
    print_section("SEEDING BASE DATA")

    upsert = UpsertHelper(db)

    # 1. School
    school = upsert.upsert(
        School,
        lookup_fields={"name": "Demo School"},
    )
    db.commit()
    db.refresh(school)
    print_success(f"School: {school.name} (ID: {school.id})")

    # 2. Subject
    subject = upsert.upsert(
        Subject,
        lookup_fields={"school_id": school.id, "code": "O&O"},
        update_fields={
            "name": "Onderzoek & Ontwerpen",
            "is_active": True,
            "color": "#3B82F6",
        },
    )
    db.commit()
    db.refresh(subject)
    print_success(f"Subject: {subject.name} (ID: {subject.id})")

    # 3. Academic Year (2025-2026)
    current_year = datetime.now().year
    next_year = current_year + 1
    year_label = f"{current_year}-{next_year}"

    academic_year = upsert.upsert(
        AcademicYear,
        lookup_fields={"school_id": school.id, "label": year_label},
        update_fields={
            "start_date": date(current_year, 9, 1),
            "end_date": date(next_year, 7, 31),
            "is_archived": False,
        },
    )
    db.commit()
    db.refresh(academic_year)
    print_success(f"Academic Year: {academic_year.label} (ID: {academic_year.id})")

    # 4. Competency Categories
    for name, desc, color, icon, order in COMPETENCY_CATEGORIES:
        upsert.upsert(
            CompetencyCategory,
            lookup_fields={"school_id": school.id, "name": name},
            update_fields={
                "description": desc,
                "color": color,
                "icon": icon,
                "order_index": order,
            },
        )
    db.commit()
    print_success(f"Competency Categories: {len(COMPETENCY_CATEGORIES)} categories")

    # 5. Admin User
    admin = upsert.upsert(
        User,
        lookup_fields={"school_id": school.id, "email": BASE_CREDENTIALS["admin"][0]},
        update_fields={
            "name": BASE_CREDENTIALS["admin"][2],
            "role": "admin",
            "auth_provider": "local",
            "password_hash": get_password_hash(BASE_CREDENTIALS["admin"][1]),
            "archived": False,
        },
    )
    db.commit()
    print_success(f"Admin: {admin.email}")

    # 6. Teacher User
    teacher = upsert.upsert(
        User,
        lookup_fields={"school_id": school.id, "email": BASE_CREDENTIALS["teacher"][0]},
        update_fields={
            "name": BASE_CREDENTIALS["teacher"][2],
            "role": "teacher",
            "auth_provider": "local",
            "password_hash": get_password_hash(BASE_CREDENTIALS["teacher"][1]),
            "archived": False,
        },
    )
    db.commit()
    print_success(f"Teacher: {teacher.email}")

    # 7. Seed templates (competencies, learning objectives, rubrics, etc.)
    # This is crucial for the demo seed to work properly
    seed_templates_for_school(school.id, subject.id)

    print_section("BASE SEED COMPLETE")
    print("\nCredentials:")
    print(f"  Admin:   {BASE_CREDENTIALS['admin'][0]} / {BASE_CREDENTIALS['admin'][1]}")
    print(
        f"  Teacher: {BASE_CREDENTIALS['teacher'][0]} / {BASE_CREDENTIALS['teacher'][1]}"
    )


def seed_demo(db: Session, rand: DeterministicRandom, reset: bool = False):
    """
    Seed comprehensive demo data.

    Creates:
    - 2 classes (G2a, G2b)
    - 24 students (12 per class)
    - 1 course with teacher
    - 6 teams (Groups) with students
    - 3 projects
    - ProjectTeams (frozen rosters)
    - 2 rubrics (peer + project) with criteria
    - 1-2 Evaluations with allocations and scores
    - 1-2 ProjectAssessments with scores
    - Reflections
    - 2 CompetencyWindows with self-scores, goals, observations
    - 5-10 LearningObjectives
    - 2-3 Clients with logs
    - RFIDCards and AttendanceEvents for some students
    """
    print_section("SEEDING DEMO DATA")

    if reset:
        safe_truncate_tables(db)
        # Re-seed base after reset
        seed_base(db)

    # Get base entities
    school = db.query(School).filter(School.name == "Demo School").first()
    if not school:
        print("✗ Error: Demo School not found. Run base seed first.")
        return

    subject = (
        db.query(Subject)
        .filter(Subject.school_id == school.id, Subject.code == "O&O")
        .first()
    )

    academic_year = (
        db.query(AcademicYear)
        .filter(AcademicYear.school_id == school.id)
        .order_by(AcademicYear.start_date.desc())
        .first()
    )

    teacher = (
        db.query(User)
        .filter(User.school_id == school.id, User.role == "teacher")
        .first()
    )

    if not all([subject, academic_year, teacher]):
        print("✗ Error: Base entities not found. Run base seed first.")
        return

    print_info(f"Using School: {school.name} (ID: {school.id})")
    print_info(f"Using Subject: {subject.name} (ID: {subject.id})")
    print_info(f"Using Academic Year: {academic_year.label}")
    print_info(f"Using Teacher: {teacher.name}")

    # Initialize helpers
    ts_gen = TimestampGenerator(weeks=8, rand=rand)
    factory = DataFactory(rand=rand)

    # 1. Create Classes
    print("\n--- Creating Classes ---")
    classes = []
    for class_name in DEMO_CLASSES:
        cls = create_instance(
            Class,
            school_id=school.id,
            academic_year_id=academic_year.id,
            name=class_name,
        )
        db.add(cls)
        classes.append(cls)
    db.commit()
    for cls in classes:
        db.refresh(cls)
    print_success(
        f"Created {len(classes)} classes: {', '.join(c.name for c in classes)}"
    )

    # 2. Create Students
    print("\n--- Creating Students ---")
    students = []
    students_per_class = 12

    for cls in classes:
        for i in range(students_per_class):
            name = factory.student_name()
            email = factory.email(name)

            student = create_instance(
                User,
                school_id=school.id,
                email=email,
                name=name,
                role="student",
                auth_provider="local",
                password_hash=get_password_hash("demo123"),
                class_name=cls.name,
                archived=False,
            )
            db.add(student)
            students.append((student, cls))

    db.commit()

    # Refresh students and create class memberships
    for student, cls in students:
        db.refresh(student)
        membership = create_instance(
            StudentClassMembership,
            student_id=student.id,
            class_id=cls.id,
            academic_year_id=academic_year.id,
        )
        db.add(membership)

    db.commit()
    print_success(f"Created {len(students)} students across {len(classes)} classes")

    # Extract just the student objects
    student_objs = [s[0] for s in students]

    # 3. Create Course
    print("\n--- Creating Course ---")
    course = create_instance(
        Course,
        school_id=school.id,
        subject_id=subject.id,
        academic_year_id=academic_year.id,
        name=f"O&O {academic_year.label}",
        description="Onderzoek & Ontwerpen - Projectvak voor bovenbouw",
        is_active=True,
    )

    db.add(course)
    db.commit()
    db.refresh(course)
    print_success(f"Course: {course.name} (ID: {course.id})")

    # Assign teacher to course
    teacher_course = create_instance(
        TeacherCourse,
        school_id=school.id,
        teacher_id=teacher.id,
        course_id=course.id,
        role="teacher",
        is_active=True,
    )
    db.add(teacher_course)
    
    # Also assign admin as a second teacher to the course (for smoke test)
    admin = db.query(User).filter(
        User.school_id == school.id, 
        User.role == "admin"
    ).first()
    if admin:
        admin_teacher_course = create_instance(
            TeacherCourse,
            school_id=school.id,
            teacher_id=admin.id,
            course_id=course.id,
            role="admin",
            is_active=True,
        )
        db.add(admin_teacher_course)

    db.commit()
    print_info(f"Assigned {teacher.name} to course")

    # Enroll students in course
    for student in student_objs:
        enrollment = create_instance(
            CourseEnrollment,
            student_id=student.id,
            course_id=course.id,
        )
        db.add(enrollment)
    db.commit()
    print_info(f"Enrolled {len(student_objs)} students in course")

    # 4. Create Teams (ProjectTeams per project, no Groups anymore)
    print("\n--- Creating Projects ---")
    projects = []
    project_statuses = ["concept", "active", "completed"]

    for i in range(3):
        title = factory.project_title()
        status = project_statuses[i]

        project = create_instance(
            Project,
            school_id=school.id,
            course_id=course.id,
            title=title,
            description=factory.project_description(title),
            class_name=rand.choice([cls.name for cls in classes]),
            status=status,
            start_date=ts_gen.random_timestamp(days_ago_min=20, days_ago_max=40),
            end_date=(
                ts_gen.random_timestamp(days_ago_min=0, days_ago_max=15)
                if status == "completed"
                else None
            ),
            created_by_id=teacher.id,
        )
        db.add(project)
        projects.append(project)

    db.commit()
    for project in projects:
        db.refresh(project)

    print_success(f"Created {len(projects)} projects")

    # 5. Create Project Teams (frozen rosters)
    print("\n--- Creating Project Teams ---")

    num_teams_per_project = 2
    students_per_team = 4

    # Shuffle students once for random distribution
    shuffled_students = student_objs.copy()
    rand.shuffle(shuffled_students)
    student_cursor = 0

    project_teams = []

    for project in projects:
        for team_number in range(1, num_teams_per_project + 1):
            team_name = factory.team_name(team_number)

            pt = create_instance(
                ProjectTeam,
                school_id=school.id,
                project_id=project.id,
                team_number=team_number,
                display_name_at_time=team_name,
            )
            db.add(pt)
            project_teams.append(pt)

        db.commit()

        # Refresh project teams for this project
        project_team_slice = project_teams[-num_teams_per_project:]
        for pt in project_team_slice:
            db.refresh(pt)

            # Assign students to this project team
            members = shuffled_students[
                student_cursor : student_cursor + students_per_team
            ]
            student_cursor += students_per_team

            for student in members:
                ptm = create_instance(
                    ProjectTeamMember,
                    school_id=school.id,
                    project_team_id=pt.id,
                    user_id=student.id,
                )
                db.add(ptm)

        db.commit()

    print_success(
        f"Created {len(project_teams)} project teams "
        f"({num_teams_per_project} per project, {students_per_team} students each)"
    )

    # 7. Create Rubrics
    print("\n--- Creating Rubrics ---")

    # Peer rubric
    peer_rubric = create_instance(
        Rubric,
        school_id=school.id,
        title=factory.rubric_title("peer"),
        scope="peer",
    )
    db.add(peer_rubric)
    db.commit()
    db.refresh(peer_rubric)

    # Add peer criteria
    peer_categories = ["Organiseren", "Meedoen", "Zelfvertrouwen", "Autonomie"]
    for i, category in enumerate(peer_categories):
        criterion = create_instance(
            RubricCriterion,
            school_id=school.id,
            rubric_id=peer_rubric.id,
            name=factory.criterion_name(category),
            order=i,
            weight=1.0,
        )
        db.add(criterion)
    db.commit()
    print_success(
        f"Peer Rubric: {peer_rubric.title} with {len(peer_categories)} criteria"
    )

    # Project rubric
    project_rubric = create_instance(
        Rubric,
        school_id=school.id,
        title=factory.rubric_title("project"),
        scope="project",
    )
    db.add(project_rubric)
    db.commit()
    db.refresh(project_rubric)

    # Add project criteria
    project_categories = ["projectproces", "eindresultaat", "communicatie", "documentatie"]
    for i, category in enumerate(project_categories):
        criterion = create_instance(
            RubricCriterion,
            school_id=school.id,
            rubric_id=project_rubric.id,
            name=factory.criterion_name(category),
            order=i,
            weight=1.0,
        )
        db.add(criterion)
    db.commit()
    print_success(
        f"Project Rubric: {project_rubric.title} with {len(project_categories)} criteria"
    )

    # 8. Create Evaluations
    print("\n--- Creating Evaluations ---")

    # Get peer rubric criteria
    peer_criteria = (
        db.query(RubricCriterion)
        .filter(RubricCriterion.rubric_id == peer_rubric.id)
        .all()
    )

    # Create 1 peer evaluation for first project
    project = projects[0]
    pt = [pt for pt in project_teams if pt.project_id == project.id][0]

    evaluation = create_instance(
        Evaluation,
        school_id=school.id,
        course_id=course.id,
        project_id=project.id,
        project_team_id=pt.id,
        rubric_id=peer_rubric.id,
        title=f"Peer Evaluatie - {project.title}",
        evaluation_type="peer",
        status="closed",
        closed_at=ts_gen.random_timestamp(days_ago_min=5, days_ago_max=15),
    )
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)
    print_success(f"Evaluation: {evaluation.title}")

    # Create allocations and scores
    team_members = (
        db.query(ProjectTeamMember)
        .filter(ProjectTeamMember.project_team_id == pt.id)
        .all()
    )

    for reviewer_member in team_members:
        for reviewee_member in team_members:
            if reviewer_member.user_id == reviewee_member.user_id:
                continue  # Skip self-review

            allocation = create_instance(
                Allocation,
                school_id=school.id,
                evaluation_id=evaluation.id,
                reviewer_id=reviewer_member.user_id,
                reviewee_id=reviewee_member.user_id,
            )
            db.add(allocation)
            db.commit()
            db.refresh(allocation)

            # Add scores for each criterion
            for criterion in peer_criteria:
                score = create_instance(
                    Score,
                    school_id=school.id,
                    allocation_id=allocation.id,
                    criterion_id=criterion.id,
                    score=rand.randint(1, 5),
                    comment=factory.feedback_comment(positive=rand.random() > 0.3),
                    status="submitted",
                )
                db.add(score)

    db.commit()
    print_info(f"Created allocations and scores for {len(team_members)} students")

    # 9. Create Reflections
    print("\n--- Creating Reflections ---")

    # Create reflections for some students
    reflection_students = rand.sample(team_members, min(3, len(team_members)))

    for member in reflection_students:
        reflection_text = factory.reflection_text()
        reflection = create_instance(
            Reflection,
            school_id=school.id,
            evaluation_id=evaluation.id,
            user_id=member.user_id,
            text=reflection_text,
            word_count=len(reflection_text.split()),
            submitted_at=ts_gen.recent_timestamp(days_ago_max=7),
        )
        db.add(reflection)

    db.commit()
    print_success(f"Created {len(reflection_students)} reflections")

    # 10. Create ProjectAssessments
    print("\n--- Creating Project Assessments ---")

    # Get project rubric criteria
    project_criteria = (
        db.query(RubricCriterion)
        .filter(RubricCriterion.rubric_id == project_rubric.id)
        .all()
    )

    # Create project assessment for second project
    project = projects[1]
    project_pts = [pt for pt in project_teams if pt.project_id == project.id]

    assessment = create_instance(
        ProjectAssessment,
        school_id=school.id,
        project_id=project.id,
        rubric_id=project_rubric.id,
        teacher_id=teacher.id,
        title=f"Project Beoordeling - {project.title}",
        status="published",
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    print_success(f"Project Assessment: {assessment.title}")

    # Link teams to assessment
    for pt in project_pts:
        pat = create_instance(
            ProjectAssessmentTeam,
            school_id=school.id,
            project_assessment_id=assessment.id,
            project_team_id=pt.id,
            status="draft",
            scores_count=0,
        )
        db.add(pat)
    db.commit()

    # Add scores for each team
    for pt in project_pts:
        for criterion in project_criteria:
            score = create_instance(
                ProjectAssessmentScore,
                school_id=school.id,
                assessment_id=assessment.id,
                criterion_id=criterion.id,
                team_number=pt.team_number,
                score=int(rand.uniform(1.0, 5.0)),
                comment=factory.feedback_comment(positive=rand.random() > 0.4),
            )
            db.add(score)

    db.commit()
    print_info(f"Created scores for {len(project_pts)} teams")

    # Add reflection for one team
    if project_pts:
        # Get a member from the first team to use as the reflection author
        first_team_members = db.query(ProjectTeamMember).filter(
            ProjectTeamMember.project_team_id == project_pts[0].id
        ).first()
        
        if first_team_members:
            reflection_text = factory.reflection_text()
            pa_reflection = create_instance(
                ProjectAssessmentReflection,
                school_id=school.id,
                assessment_id=assessment.id,
                user_id=first_team_members.user_id,
                text=reflection_text,
                word_count=len(reflection_text.split()),
                submitted_at=ts_gen.recent_timestamp(days_ago_max=5),
            )
            db.add(pa_reflection)
            db.commit()
            print_info("Created project assessment reflection")

    # Add self-assessments for some students
    if project_pts:
        # Get members from all teams for this assessment
        assessment_team_members = []
        for pt in project_pts:
            members = db.query(ProjectTeamMember).filter(
                ProjectTeamMember.project_team_id == pt.id
            ).all()
            for member in members:
                assessment_team_members.append((member, pt))
        
        # Create self-assessments for 3-5 random students
        num_self_assessments = rand.randint(3, min(5, len(assessment_team_members)))
        self_assessment_students = rand.sample(assessment_team_members, num_self_assessments)
        
        for member, pt in self_assessment_students:
            # Create self-assessment
            self_assessment = create_instance(
                ProjectAssessmentSelfAssessment,
                school_id=school.id,
                assessment_id=assessment.id,
                student_id=member.user_id,
                team_number=pt.team_number,
                locked=False,
            )
            db.add(self_assessment)
            db.commit()
            db.refresh(self_assessment)
            
            # Add scores for each criterion
            for criterion in project_criteria:
                sa_score = create_instance(
                    ProjectAssessmentSelfAssessmentScore,
                    school_id=school.id,
                    self_assessment_id=self_assessment.id,
                    criterion_id=criterion.id,
                    score=rand.randint(1, 5),
                    comment=factory.feedback_comment(positive=rand.random() > 0.5) if rand.random() > 0.5 else None,
                )
                db.add(sa_score)
        
        db.commit()
        print_info(f"Created {num_self_assessments} self-assessments with scores")

    # 10b. Create Project Notes Context and Notes
    print("\n--- Creating Project Notes ---")
    
    # Create a notes context for the second project
    project = projects[1]
    project_pts = [pt for pt in project_teams if pt.project_id == project.id]
    
    notes_context = create_instance(
        ProjectNotesContext,
        school_id=school.id,
        title=f"Aantekeningen - {project.title}",
        description="Project observaties en voortgangsbewaking",
        project_id=project.id,
        course_id=course.id,
        class_name=rand.choice([cls.name for cls in classes]),
        project_team_id=project_pts[0].id if project_pts else None,
        created_by=teacher.id,
        status="open",
    )
    db.add(notes_context)
    db.commit()
    db.refresh(notes_context)
    print_success(f"Project Notes Context: {notes_context.title}")
    
    # Add various types of notes
    note_count = 0
    
    # Project-level notes (2-3)
    for i in range(rand.randint(2, 3)):
        note = create_instance(
            ProjectNote,
            context_id=notes_context.id,
            note_type="project",
            text=rand.choice([
                "Project loopt goed, teams werken goed samen",
                "Planning moet beter bijgehouden worden",
                "Goede voortgang met prototypes",
                "Extra aandacht nodig voor documentatie",
            ]),
            tags=rand.sample(["voortgang", "samenwerking", "planning", "kwaliteit"], rand.randint(1, 2)),
            created_by=teacher.id,
        )
        db.add(note)
        note_count += 1
    
    # Team-specific notes (1-2 per team) - Note: team_id would need Group model, skip for now
    # Instead create student-specific notes
    
    # Student-specific notes (2-3 students)
    if project_pts:
        all_members = []
        for pt in project_pts:
            members = db.query(ProjectTeamMember).filter(
                ProjectTeamMember.project_team_id == pt.id
            ).all()
            all_members.extend(members)
        
        note_students = rand.sample(all_members, min(3, len(all_members)))
        for member in note_students:
            note = create_instance(
                ProjectNote,
                context_id=notes_context.id,
                note_type="student",
                student_id=member.user_id,
                text=rand.choice([
                    "Toont goed initiatief in het team",
                    "Kan beter communiceren met teamleden",
                    "Sterke technische vaardigheden",
                    "Heeft begeleiding nodig bij planning",
                    "Goede presentatievaardigheden getoond",
                ]),
                tags=rand.sample(["competentie", "samenwerking", "technisch", "communicatie"], rand.randint(1, 2)),
                omza_category=rand.choice(["Organiseren", "Meedoen", "Zelfvertrouwen", "Autonomie"]) if rand.random() > 0.5 else None,
                is_competency_evidence=rand.random() > 0.7,
                created_by=teacher.id,
            )
            db.add(note)
            note_count += 1
    
    db.commit()
    print_info(f"Created {note_count} project notes")

    # 11. Create CompetencyWindows
    print("\n--- Creating Competency Windows ---")

    windows = []
    window_titles = ["Startscan Q1", "Midscan Q2"]

    for title in window_titles:
        window = create_instance(
            CompetencyWindow,
            school_id=school.id,
            title=title,
            description=f"Competentiemeting - {title}",
            class_names=[cls.name for cls in classes],
            course_id=course.id,
            start_date=ts_gen.random_timestamp(days_ago_min=20, days_ago_max=40),
            end_date=ts_gen.random_timestamp(days_ago_min=10, days_ago_max=20),
            status="closed",
        )
        db.add(window)
        windows.append(window)

    db.commit()
    for window in windows:
        db.refresh(window)
    print_success(f"Created {len(windows)} competency windows")

    # Get competency categories
    comp_categories = (
        db.query(CompetencyCategory)
        .filter(CompetencyCategory.school_id == school.id)
        .all()
    )
    
    # Get actual competencies (not just categories)
    # Competencies are created by migrations from templates
    competencies = (
        db.query(Competency)
        .filter(Competency.school_id == school.id, Competency.active == True)
        .all()
    )
    
    if not competencies:
        print_warning("No competencies found - skipping competency self-scores, goals, and observations")
        print_info("Run migrations to seed competencies from templates")
    else:
        # Add self-scores, goals, and observations
        sample_students = rand.sample(student_objs, min(10, len(student_objs)))

        for window in windows:
            for student in sample_students:
                # Self-scores
                for competency in rand.sample(competencies, min(3, len(competencies))):
                    self_score = create_instance(
                        CompetencySelfScore,
                        school_id=school.id,
                        window_id=window.id,
                        user_id=student.id,
                        competency_id=competency.id,
                        score=rand.randint(1, 5),
                    )
                    db.add(self_score)

                # Goals
                if rand.random() > 0.5:
                    goal = create_instance(
                        CompetencyGoal,
                        school_id=school.id,
                        window_id=window.id,
                        user_id=student.id,
                        competency_id=rand.choice(competencies).id,
                        goal_text=factory.competency_goal(),
                        status="active",
                        submitted_at=ts_gen.recent_timestamp(days_ago_max=10),
                    )
                    db.add(goal)

                # Teacher observations
                if rand.random() > 0.7:
                    observation = create_instance(
                        CompetencyTeacherObservation,
                        school_id=school.id,
                        window_id=window.id,
                        user_id=student.id,
                        teacher_id=teacher.id,
                        competency_id=rand.choice(competencies).id,
                        score=rand.randint(1, 5),
                        comment=factory.feedback_comment(positive=True),
                        created_at=ts_gen.recent_timestamp(days_ago_max=15),
                    )
                    db.add(observation)

        db.commit()
        print_info("Created self-scores, goals, and teacher observations")

    # 12. Create LearningObjectives
    print("\n--- Creating Learning Objectives ---")

    objective_texts = [
        "Student kan een gebruikersonderzoek uitvoeren en analyseren",
        "Student kan iteratief ontwerpen en prototypes maken",
        "Student kan feedback geven en ontvangen in een team",
        "Student kan technische documentatie schrijven",
        "Student kan een ontwerpproces verantwoorden",
        "Student kan samenwerken in een projectteam",
        "Student kan presenteren voor een publiek",
        "Student kan reflecteren op eigen leerproces",
    ]

    for i, objective_text in enumerate(objective_texts):
        obj = create_instance(
            LearningObjective,
            school_id=school.id,
            subject_id=subject.id,
            is_template=True,
            title=f"LO-{i+1:03d}",
            description=objective_text,
            order=i,
        )
        db.add(obj)

    db.commit()
    print_success(f"Created {len(objective_texts)} learning objectives")

    # 13. Create Clients
    print("\n--- Creating Clients ---")

    clients = []
    for i in range(3):
        client = create_instance(
            Client,
            school_id=school.id,
            organization=factory.client_organization(),
            contact_name=factory.teacher_name(),
            email=f"contact{i+1}@client.nl",
            phone=f"06-{rand.randint(10000000, 99999999)}",
            level="Bovenbouw",
            sector=rand.choice(["Zorg", "Techniek", "Vastgoed", "Onderwijs"]),
            tags=rand.sample(["Duurzaamheid", "Innovatie", "Digitaal", "Sociaal"], 2),
            active=True,
        )
        db.add(client)
        clients.append(client)

    db.commit()
    for client in clients:
        db.refresh(client)
    print_success(f"Created {len(clients)} clients")

    # Add client logs
    for client in clients:
        num_logs = rand.randint(2, 4)
        timestamps = ts_gen.timestamp_sequence(
            num_logs, days_ago_min=5, days_ago_max=40
        )

        for ts in timestamps:
            log = create_instance(
                ClientLog,
                client_id=client.id,
                author_id=teacher.id,
                log_type=rand.choice(["call", "email", "meeting", "other"]),
                text=rand.choice(
                    [
                        "Eerste kennismakingsgesprek",
                        "Projectbriefing ontvangen",
                        "Tussentijdse check-in",
                        "Presentatie voor opdrachtgever",
                    ]
                ),
            )
            db.add(log)

    db.commit()
    print_info("Created client logs")

    # Link clients to projects - link all 3 clients to first 3 projects
    for i, project in enumerate(projects):
        if i < len(clients):
            link = create_instance(
                ClientProjectLink,
                client_id=clients[i].id,
                project_id=project.id,
                role=rand.choice(["primary", "secondary"]),
            )
            db.add(link)

    db.commit()
    print_info("Linked clients to projects")

    # 14. Create RFIDCards and AttendanceEvents
    print("\n--- Creating RFID Cards & Attendance ---")

    # Give RFID cards to 8 random students
    rfid_students = rand.sample(student_objs, min(8, len(student_objs)))

    for i, student in enumerate(rfid_students):
        card = create_instance(
            RFIDCard,
            user_id=student.id,
            uid=f"CARD-{i+1:04d}-{rand.randint(1000, 9999)}",
            label=f"Kaart {student.name}",
            is_active=True,
        )
        db.add(card)

    db.commit()
    print_success(f"Created {len(rfid_students)} RFID cards")

    # Create attendance events
    num_events = 0
    for student in rfid_students:
        # 5-10 attendance events per student
        event_count = rand.randint(5, 10)
        event_timestamps = ts_gen.timestamp_sequence(
            event_count, days_ago_min=0, days_ago_max=30
        )

        for ts in event_timestamps:
            event = create_instance(
                AttendanceEvent,
                user_id=student.id,
                check_in=ts,
                location="3de Blok",
                source="manual",  # Valid values: rfid, manual, import, api
                created_by=None,
                approved_by=None if rand.random() > 0.8 else teacher.id,
            )
            db.add(event)
            num_events += 1

    db.commit()
    print_success(f"Created {num_events} attendance events")

    print_section("DEMO SEED COMPLETE")
    print("\nSummary:")
    print(f"  Classes: {len(classes)}")
    print(f"  Students: {len(student_objs)}")
    print(f"  Project teams: {len(project_teams)}")
    print(f"  Projects: {len(projects)}")
    print("  Evaluations: 1")
    print("  Project Assessments: 1")
    print(f"  Competency Windows: {len(windows)}")
    print(f"  Learning Objectives: {len(objective_texts)}")
    print(f"  Clients: {len(clients)}")
    print(f"  RFID Cards: {len(rfid_students)}")


# ============================================================================
# Main Entry Point
# ============================================================================


def main():
    parser = argparse.ArgumentParser(
        description="Comprehensive database seeding script",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument(
        "--mode",
        choices=["base", "demo"],
        required=True,
        help="Seeding mode: base (minimal) or demo (comprehensive)",
    )

    parser.add_argument(
        "--reset",
        action="store_true",
        help="Reset database before seeding (demo mode only)",
    )

    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for deterministic data generation (default: 42)",
    )

    args = parser.parse_args()

    # Validate arguments
    if args.reset and args.mode != "demo":
        parser.error("--reset can only be used with --mode demo")

    # Initialize random generator
    rand = DeterministicRandom(seed=args.seed)

    # Create database session
    db = SessionLocal()

    try:
        if args.mode == "base":
            seed_base(db)
        elif args.mode == "demo":
            seed_demo(db, rand, reset=args.reset)

        print("\n" + "=" * 60)
        print("SEEDING COMPLETED SUCCESSFULLY")
        print("=" * 60)

    except Exception as e:
        print(f"\n✗ Error during seeding: {e}")
        db.rollback()
        import traceback

        traceback.print_exc()
        sys.exit(1)

    finally:
        db.close()


if __name__ == "__main__":
    main()
