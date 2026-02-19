"""
Integration tests for Phase 2: ProjectAssessment API with project_team_id

Tests the API endpoints to ensure they work with project_team_id exclusively.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.api.v1.deps import get_db
from app.infra.db.models import (
    Base,
    School,
    User,
    Course,
    TeacherCourse,
    Project,
    Rubric,
    ProjectTeam,
    ProjectAssessment,
)


@pytest.fixture(scope="function")
def test_db():
    """Create an in-memory SQLite database for testing"""
    # Use check_same_thread=False to allow SQLite usage across threads (needed for TestClient)
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )

    # For SQLite, we need to enable foreign keys
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=OFF")  # Disable FK checks for test setup
        cursor.close()

    # Create ALL tables - SQLite will convert ARRAY to TEXT automatically
    # This avoids foreign key dependency issues
    Base.metadata.create_all(engine)

    # Use sessionmaker for proper session management
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()

    yield db

    db.close()
    engine.dispose()


@pytest.fixture
def client(test_db, test_teacher):
    """Create a test client with database and auth overrides"""

    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    def override_get_current_user():
        return test_teacher

    from app.api.v1.deps import get_current_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    # Set base_url to avoid CSRF validation in tests
    with TestClient(app, base_url="http://testserver") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def test_school(test_db):
    """Create a test school"""
    school = School(
        id=1,
        name="Test School",
    )
    test_db.add(school)
    test_db.commit()
    return school


@pytest.fixture
def test_teacher(test_db, test_school):
    """Create a test teacher"""
    teacher = User(
        id=1,
        school_id=test_school.id,
        name="Test Teacher",
        email="teacher@test.com",
        role="teacher",
        password_hash="dummy",
    )
    test_db.add(teacher)
    test_db.commit()
    return teacher


@pytest.fixture
def test_course(test_db, test_school, test_teacher):
    """Create a test course and link teacher to it"""
    course = Course(
        id=1,
        school_id=test_school.id,
        name="Test Course",
        code="TEST101",
        is_active=True,
    )
    test_db.add(course)
    test_db.commit()

    # Link teacher to course for RBAC
    teacher_course = TeacherCourse(
        school_id=test_school.id,
        teacher_id=test_teacher.id,
        course_id=course.id,
        role="teacher",
        is_active=True,
    )
    test_db.add(teacher_course)
    test_db.commit()

    return course


@pytest.fixture
def test_project(test_db, test_school, test_course, test_teacher):
    """Create a test project"""
    project = Project(
        id=1,
        school_id=test_school.id,
        course_id=test_course.id,
        title="Test Project",
        status="active",
        created_by_id=test_teacher.id,
    )
    test_db.add(project)
    test_db.commit()
    return project


@pytest.fixture
def test_rubric(test_db, test_school):
    """Create a test rubric"""
    rubric = Rubric(
        id=1,
        school_id=test_school.id,
        title="Test Rubric",
        scope="project",
        scale_min=1,
        scale_max=5,
    )
    test_db.add(rubric)
    test_db.commit()
    return rubric


@pytest.fixture
def test_project_team(test_db, test_school, test_project):
    """Create a test project team"""
    team = ProjectTeam(
        id=1,
        school_id=test_school.id,
        project_id=test_project.id,
        team_id=None,  # No legacy group_id
        team_number=1,
        display_name_at_time="Test Team 1",
        version=1,
    )
    test_db.add(team)
    test_db.commit()
    return team


def test_create_assessment_with_project_team_id(
    client,
    test_db,
    test_school,
    test_teacher,
    test_project,
    test_rubric,
    test_project_team,
):
    """Test creating a project assessment with project_team_id"""
    response = client.post(
        "/api/v1/project-assessments",
        json={
            "project_team_id": test_project_team.id,
            "rubric_id": test_rubric.id,
            "project_id": test_project.id,
            "title": "Test Assessment",
            "version": "eind",
        },
        headers={
            "Origin": "http://testserver"
        },  # Add Origin header to pass CSRF validation
    )

    assert response.status_code == 201
    data = response.json()
    assert data["project_team_id"] == test_project_team.id
    assert data["title"] == "Test Assessment"

    # Verify in database
    assessment = (
        test_db.query(ProjectAssessment)
        .filter(ProjectAssessment.id == data["id"])
        .first()
    )
    assert assessment is not None
    assert assessment.project_team_id == test_project_team.id


def test_list_assessments_by_project_team_id(
    client,
    test_db,
    test_school,
    test_teacher,
    test_project,
    test_rubric,
    test_project_team,
):
    """Test listing assessments filtered by project_team_id"""
    # Create test assessments
    assessment1 = ProjectAssessment(
        id=1,
        school_id=test_school.id,
        project_id=test_project.id,
        project_team_id=test_project_team.id,
        rubric_id=test_rubric.id,
        title="Assessment 1",
        status="draft",
    )
    assessment2 = ProjectAssessment(
        id=2,
        school_id=test_school.id,
        project_id=test_project.id,
        project_team_id=test_project_team.id,
        rubric_id=test_rubric.id,
        title="Assessment 2",
        status="published",
    )
    test_db.add_all([assessment1, assessment2])
    test_db.commit()

    # Test filtering by project_team_id
    response = client.get(
        f"/api/v1/project-assessments?project_team_id={test_project_team.id}"
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


def test_assessment_response_includes_project_team_id(
    client,
    test_db,
    test_school,
    test_teacher,
    test_project,
    test_rubric,
    test_project_team,
):
    """Test that assessment responses include project_team_id"""
    # Create test assessment
    assessment = ProjectAssessment(
        id=1,
        school_id=test_school.id,
        project_id=test_project.id,
        project_team_id=test_project_team.id,
        rubric_id=test_rubric.id,
        title="Test Assessment",
        status="draft",
    )
    test_db.add(assessment)
    test_db.commit()

    response = client.get("/api/v1/project-assessments")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 1
    item = data["items"][0]
    assert item["project_team_id"] == test_project_team.id
