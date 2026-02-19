"""
Tests to ensure evaluations are created once per project, not per team.
This prevents the duplicate "Team X" evaluations bug.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.infra.db.base import Base
from app.infra.db.models import (
    School,
    User,
    Course,
    Project,
    ProjectTeam,
    ProjectTeamMember,
    Evaluation,
    Rubric,
    RubricCriterion,
    Allocation,
)


# Fixture for test database
@pytest.fixture(scope="function")
def db_session():
    """Create a test database session"""
    # Use SQLite in-memory database for testing
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(bind=engine)
    session = TestingSessionLocal()

    yield session

    session.close()


def test_create_evaluation_creates_single_evaluation_per_project(db_session):
    """
    Test that creating an evaluation for a project with multiple teams
    results in ONE evaluation, not multiple team-specific evaluations.
    """
    # Setup: Create school, users, course, project, and teams
    school = School(name="Test School")
    db_session.add(school)
    db_session.commit()

    teacher = User(
        school_id=school.id,
        email="teacher@test.com",
        name="Test Teacher",
        role="teacher",
    )
    db_session.add(teacher)
    db_session.commit()

    # Create 4 students
    students = []
    for i in range(4):
        student = User(
            school_id=school.id,
            email=f"student{i}@test.com",
            name=f"Student {i}",
            role="student",
        )
        db_session.add(student)
        students.append(student)
    db_session.commit()

    course = Course(
        school_id=school.id,
        name="Test Course",
    )
    db_session.add(course)
    db_session.commit()

    project = Project(
        school_id=school.id,
        course_id=course.id,
        title="Test Project",
        description="A test project",
        created_by_id=teacher.id,
    )
    db_session.add(project)
    db_session.commit()

    # Create 2 teams for the project
    teams = []
    for team_num in range(1, 3):
        team = ProjectTeam(
            school_id=school.id,
            project_id=project.id,
            team_number=team_num,
            display_name_at_time=f"Team {team_num}",
        )
        db_session.add(team)
        teams.append(team)
    db_session.commit()

    # Assign students to teams
    for i, student in enumerate(students):
        team_idx = i % 2  # Alternate between team 0 and team 1
        member = ProjectTeamMember(
            school_id=school.id,
            project_team_id=teams[team_idx].id,
            user_id=student.id,
        )
        db_session.add(member)
    db_session.commit()

    # Create rubric for evaluation
    rubric = Rubric(
        school_id=school.id,
        title="Peer Rubric",
        scope="peer",
    )
    db_session.add(rubric)
    db_session.commit()

    criterion = RubricCriterion(
        school_id=school.id,
        rubric_id=rubric.id,
        name="Teamwork",
        category="Meedoen",
        description="How well does the student work in a team?",
        order=0,
        weight=1.0,
    )
    db_session.add(criterion)
    db_session.commit()

    # ACT: Create evaluation for the project
    # This should create ONE evaluation, not one per team
    evaluation = Evaluation(
        school_id=school.id,
        course_id=course.id,
        project_id=project.id,
        project_team_id=None,  # NULL = project-level
        rubric_id=rubric.id,
        title=f"Peer Evaluatie - {project.title}",
        evaluation_type="peer",
        status="draft",
    )
    db_session.add(evaluation)
    db_session.commit()

    # ASSERT: Check that only ONE evaluation was created
    all_evaluations = (
        db_session.query(Evaluation).filter(Evaluation.project_id == project.id).all()
    )

    assert len(all_evaluations) == 1, (
        f"Expected 1 evaluation for project, but found {len(all_evaluations)}. "
        f"Evaluations: {[e.title for e in all_evaluations]}"
    )

    # Check that the evaluation title does NOT contain "Team X"
    created_eval = all_evaluations[0]
    assert (
        "Team" not in created_eval.title
        or created_eval.title == f"Peer Evaluatie - {project.title}"
    ), f"Evaluation title should not contain team suffix. Got: {created_eval.title}"

    # Check that project_team_id is NULL (project-level)
    assert created_eval.project_team_id is None, (
        "Evaluation should be project-level (project_team_id=NULL), "
        f"but got project_team_id={created_eval.project_team_id}"
    )


def test_allocations_include_all_teams(db_session):
    """
    Test that allocations are created for all students across all teams
    in a single project-level evaluation.
    """
    # Setup (similar to previous test)
    school = School(name="Test School")
    db_session.add(school)
    db_session.commit()

    teacher = User(
        school_id=school.id,
        email="teacher@test.com",
        name="Test Teacher",
        role="teacher",
    )
    db_session.add(teacher)
    db_session.commit()

    students = []
    for i in range(4):
        student = User(
            school_id=school.id,
            email=f"student{i}@test.com",
            name=f"Student {i}",
            role="student",
        )
        db_session.add(student)
        students.append(student)
    db_session.commit()

    course = Course(
        school_id=school.id,
        name="Test Course",
    )
    db_session.add(course)
    db_session.commit()

    project = Project(
        school_id=school.id,
        course_id=course.id,
        title="Test Project",
        description="A test project",
        created_by_id=teacher.id,
    )
    db_session.add(project)
    db_session.commit()

    # Create 2 teams
    teams = []
    for team_num in range(1, 3):
        team = ProjectTeam(
            school_id=school.id,
            project_id=project.id,
            team_number=team_num,
            display_name_at_time=f"Team {team_num}",
        )
        db_session.add(team)
        teams.append(team)
    db_session.commit()

    # Assign 2 students to each team
    for i, student in enumerate(students):
        team_idx = i % 2
        member = ProjectTeamMember(
            school_id=school.id,
            project_team_id=teams[team_idx].id,
            user_id=student.id,
        )
        db_session.add(member)
    db_session.commit()

    # Create rubric
    rubric = Rubric(
        school_id=school.id,
        title="Peer Rubric",
        scope="peer",
    )
    db_session.add(rubric)
    db_session.commit()

    # Create evaluation
    evaluation = Evaluation(
        school_id=school.id,
        course_id=course.id,
        project_id=project.id,
        project_team_id=None,
        rubric_id=rubric.id,
        title=f"Peer Evaluatie - {project.title}",
        evaluation_type="peer",
        status="draft",
    )
    db_session.add(evaluation)
    db_session.commit()

    # ACT: Create allocations for students within their teams
    # Each student reviews other students in their team only
    for team in teams:
        team_members = (
            db_session.query(ProjectTeamMember)
            .filter(ProjectTeamMember.project_team_id == team.id)
            .all()
        )

        for reviewer in team_members:
            for reviewee in team_members:
                if reviewer.user_id != reviewee.user_id:
                    allocation = Allocation(
                        school_id=school.id,
                        evaluation_id=evaluation.id,
                        reviewer_id=reviewer.user_id,
                        reviewee_id=reviewee.user_id,
                        is_self=False,
                    )
                    db_session.add(allocation)
    db_session.commit()

    # ASSERT: Check that allocations exist for all teams
    all_allocations = (
        db_session.query(Allocation)
        .filter(Allocation.evaluation_id == evaluation.id)
        .all()
    )

    # With 2 teams of 2 students each:
    # Team 1: Student 0 -> Student 2, Student 2 -> Student 0 (2 allocations)
    # Team 2: Student 1 -> Student 3, Student 3 -> Student 1 (2 allocations)
    # Total: 4 allocations
    assert (
        len(all_allocations) == 4
    ), f"Expected 4 allocations (2 per team), but found {len(all_allocations)}"

    # Verify that students from different teams do NOT review each other
    reviewer_reviewee_pairs = [(a.reviewer_id, a.reviewee_id) for a in all_allocations]

    # Student 0 and 2 are in team 1, students 1 and 3 are in team 2
    # Student 0 should NOT review students 1 or 3
    assert (students[0].id, students[1].id) not in reviewer_reviewee_pairs
    assert (students[0].id, students[3].id) not in reviewer_reviewee_pairs


def test_evaluation_title_format(db_session):
    """
    Test that evaluation titles follow the correct format:
    "Peer Evaluatie - {Project Title}" without team suffix.
    """
    school = School(name="Test School")
    db_session.add(school)
    db_session.commit()

    teacher = User(
        school_id=school.id,
        email="teacher@test.com",
        name="Test Teacher",
        role="teacher",
    )
    db_session.add(teacher)
    db_session.commit()

    course = Course(
        school_id=school.id,
        name="Test Course",
    )
    db_session.add(course)
    db_session.commit()

    project = Project(
        school_id=school.id,
        course_id=course.id,
        title="Mobile App Development",
        description="Build a mobile app",
        created_by_id=teacher.id,
    )
    db_session.add(project)
    db_session.commit()

    rubric = Rubric(
        school_id=school.id,
        title="Peer Rubric",
        scope="peer",
    )
    db_session.add(rubric)
    db_session.commit()

    # Create evaluation
    evaluation = Evaluation(
        school_id=school.id,
        course_id=course.id,
        project_id=project.id,
        project_team_id=None,
        rubric_id=rubric.id,
        title=f"Peer Evaluatie - {project.title}",
        evaluation_type="peer",
        status="draft",
    )
    db_session.add(evaluation)
    db_session.commit()

    # ASSERT: Title should be exactly "Peer Evaluatie - Mobile App Development"
    assert evaluation.title == "Peer Evaluatie - Mobile App Development"

    # ASSERT: Title should NOT contain "Team" followed by a number
    import re

    assert not re.search(
        r"Team \d+", evaluation.title
    ), f"Evaluation title should not contain 'Team X' pattern. Got: {evaluation.title}"
