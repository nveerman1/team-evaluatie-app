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
    CompetencyCategory,
    CompetencyWindow,
    CompetencySelfScore,
    CompetencyGoal,
    CompetencyTeacherObservation,
    LearningObjective,
    Client,
    ClientLog,
    ClientProjectLink,
    RFIDCard,
    AttendanceEvent,
)
from app.core.security import get_password_hash
from app.db.seed_utils import (
    DeterministicRandom,
    TimestampGenerator,
    UpsertHelper,
    DataFactory,
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
        cls = Class(
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

            student = User(
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
        membership = StudentClassMembership(
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
    course = Course(
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
    teacher_course = TeacherCourse(
        school_id=school.id,  # <-- fix
        teacher_id=teacher.id,
        course_id=course.id,
        role="teacher",
        is_active=True,
    )

    db.add(teacher_course)
    db.commit()
    print_info(f"Assigned {teacher.name} to course")

    # Enroll students in course
    for student in student_objs:
        enrollment = CourseEnrollment(
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

        project = Project(
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

            pt = ProjectTeam(
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
                ptm = ProjectTeamMember(
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
    peer_rubric = Rubric(
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
        criterion = RubricCriterion(
            rubric_id=peer_rubric.id,
            name=factory.criterion_name(category),
            order_index=i,
            weight=1.0,
        )
        db.add(criterion)
    db.commit()
    print_success(
        f"Peer Rubric: {peer_rubric.title} with {len(peer_categories)} criteria"
    )

    # Project rubric
    project_rubric = Rubric(
        school_id=school.id,
        title=factory.rubric_title("project"),
        scope="project",
    )
    db.add(project_rubric)
    db.commit()
    db.refresh(project_rubric)

    # Add project criteria
    project_categories = ["projectproces", "eindresultaat", "communicatie"]
    for i, category in enumerate(project_categories):
        criterion = RubricCriterion(
            rubric_id=project_rubric.id,
            name=factory.criterion_name(category),
            description=f"Beoordeling van {category}",
            order_index=i,
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

    evaluation = Evaluation(
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
            if reviewer_member.student_id == reviewee_member.student_id:
                continue  # Skip self-review

            allocation = Allocation(
                evaluation_id=evaluation.id,
                reviewer_id=reviewer_member.student_id,
                reviewee_id=reviewee_member.student_id,
            )
            db.add(allocation)
            db.commit()
            db.refresh(allocation)

            # Add scores for each criterion
            for criterion in peer_criteria:
                score = Score(
                    allocation_id=allocation.id,
                    criterion_id=criterion.id,
                    score=rand.randint(1, 5),
                    comment=factory.feedback_comment(positive=rand.random() > 0.3),
                )
                db.add(score)

    db.commit()
    print_info(f"Created allocations and scores for {len(team_members)} students")

    # 9. Create Reflections
    print("\n--- Creating Reflections ---")

    # Create reflections for some students
    reflection_students = rand.sample(team_members, min(3, len(team_members)))

    for member in reflection_students:
        reflection = Reflection(
            evaluation_id=evaluation.id,
            student_id=member.student_id,
            content=factory.reflection_text(),
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

    assessment = ProjectAssessment(
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
        pat = ProjectAssessmentTeam(
            project_assessment_id=assessment.id,
            project_team_id=pt.id,
        )
        db.add(pat)
    db.commit()

    # Add scores for each team
    for pt in project_pts:
        for criterion in project_criteria:
            score = ProjectAssessmentScore(
                project_assessment_id=assessment.id,
                project_team_id=pt.id,
                criterion_id=criterion.id,
                score=rand.uniform(1.0, 5.0),
                comment=factory.feedback_comment(positive=rand.random() > 0.4),
            )
            db.add(score)

    db.commit()
    print_info(f"Created scores for {len(project_pts)} teams")

    # Add reflection for one team
    if project_pts:
        pa_reflection = ProjectAssessmentReflection(
            project_assessment_id=assessment.id,
            project_team_id=project_pts[0].id,
            content=factory.reflection_text(),
            submitted_at=ts_gen.recent_timestamp(days_ago_max=5),
        )
        db.add(pa_reflection)
        db.commit()
        print_info("Created project assessment reflection")

    # 11. Create CompetencyWindows
    print("\n--- Creating Competency Windows ---")

    windows = []
    window_titles = ["Startscan Q1", "Midscan Q2"]

    for title in window_titles:
        window = CompetencyWindow(
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

    # Add self-scores, goals, and observations
    sample_students = rand.sample(student_objs, min(10, len(student_objs)))

    for window in windows:
        for student in sample_students:
            # Self-scores
            for category in rand.sample(comp_categories, 3):
                self_score = CompetencySelfScore(
                    competency_window_id=window.id,
                    student_id=student.id,
                    competency_category_id=category.id,
                    score=rand.randint(1, 5),
                )
                db.add(self_score)

            # Goals
            if rand.random() > 0.5:
                goal = CompetencyGoal(
                    competency_window_id=window.id,
                    student_id=student.id,
                    category_id=rand.choice(comp_categories).id,
                    goal_text=factory.competency_goal(),
                    created_at=ts_gen.recent_timestamp(days_ago_max=10),
                )
                db.add(goal)

            # Teacher observations
            if rand.random() > 0.7:
                observation = CompetencyTeacherObservation(
                    competency_window_id=window.id,
                    student_id=student.id,
                    teacher_id=teacher.id,
                    category_id=rand.choice(comp_categories).id,
                    observation=factory.feedback_comment(positive=True),
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
        obj = LearningObjective(
            school_id=school.id,
            subject_id=subject.id,
            code=f"LO-{i+1:03d}",
            description=text,
            is_template=True,
            order_index=i,
        )
        db.add(obj)

    db.commit()
    print_success(f"Created {len(objective_texts)} learning objectives")

    # 13. Create Clients
    print("\n--- Creating Clients ---")

    clients = []
    for i in range(3):
        client = Client(
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
            log = ClientLog(
                client_id=client.id,
                log_type=rand.choice(["call", "email", "meeting", "other"]),
                description=rand.choice(
                    [
                        "Eerste kennismakingsgesprek",
                        "Projectbriefing ontvangen",
                        "Tussentijdse check-in",
                        "Presentatie voor opdrachtgever",
                    ]
                ),
                logged_by=teacher.id,
                logged_at=ts,
            )
            db.add(log)

    db.commit()
    print_info("Created client logs")

    # Link clients to projects
    for i, project in enumerate(projects[:2]):
        link = ClientProjectLink(
            client_id=clients[i].id,
            project_id=project.id,
            role=rand.choice(["primary", "secondary"]),
            linked_at=ts_gen.random_timestamp(days_ago_min=25, days_ago_max=45),
        )
        db.add(link)

    db.commit()
    print_info("Linked clients to projects")

    # 14. Create RFIDCards and AttendanceEvents
    print("\n--- Creating RFID Cards & Attendance ---")

    # Give RFID cards to 8 random students
    rfid_students = rand.sample(student_objs, min(8, len(student_objs)))

    for i, student in enumerate(rfid_students):
        card = RFIDCard(
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
            event = AttendanceEvent(
                user_id=student.id,
                event_type=rand.choice(["check_in", "check_out"]),
                timestamp=ts,
                location="3de Blok",
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
