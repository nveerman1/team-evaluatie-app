"""
Integration tests for Phase 2: ProjectAssessment API with project_team_id

Tests the API endpoints to ensure they work with the new project_team_id primary FK
and maintain backward compatibility with group_id.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.main import app
from app.api.v1.deps import get_db
from app.infra.db.models import (
    Base,
    School,
    Course,
    ProjectAssessment,
    ProjectTeam,
    ProjectTeamMember,
    Group,
    User,
    Project,
    Rubric,
)


@pytest.fixture
def test_db():
    """Create an in-memory SQLite database for testing"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    db = Session(engine)
    yield db
    db.close()


@pytest.fixture
def client(test_db):
    """Create a test client with database override"""
    def override_get_db():
        try:
            yield test_db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def test_school(test_db):
    """Create a test school"""
    school = School(
        id=1,
        name="Test School",
        domain="test.school",
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
        hashed_password="dummy",
    )
    test_db.add(teacher)
    test_db.commit()
    return teacher


@pytest.fixture
def test_course(test_db, test_school):
    """Create a test course"""
    course = Course(
        id=1,
        school_id=test_school.id,
        name="Test Course",
        code="TEST101",
        active=True,
    )
    test_db.add(course)
    test_db.commit()
    return course


@pytest.fixture
def test_project(test_db, test_school, test_course):
    """Create a test project"""
    project = Project(
        id=1,
        school_id=test_school.id,
        course_id=test_course.id,
        name="Test Project",
        is_active=True,
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
def test_group(test_db, test_school, test_course):
    """Create a test group"""
    group = Group(
        id=1,
        school_id=test_school.id,
        course_id=test_course.id,
        name="Test Team 1",
        team_number=1,
    )
    test_db.add(group)
    test_db.commit()
    return group


@pytest.fixture
def test_project_team(test_db, test_school, test_project, test_group):
    """Create a test project team"""
    team = ProjectTeam(
        id=1,
        school_id=test_school.id,
        project_id=test_project.id,
        team_id=test_group.id,
        team_number=1,
        display_name_at_time="Test Team 1",
        version=1,
        is_locked=False,
    )
    test_db.add(team)
    test_db.commit()
    return team


def test_create_assessment_with_project_team_id(
    client, test_db, test_school, test_teacher, test_project, test_rubric, test_project_team, test_group
):
    """Test creating a project assessment with project_team_id (primary FK)"""
    # Mock authentication
    from unittest.mock import patch
    
    with patch("app.api.v1.deps.get_current_user", return_value=test_teacher):
        response = client.post(
            "/api/v1/project-assessments",
            json={
                "project_team_id": test_project_team.id,
                "group_id": test_group.id,  # Optional for backward compatibility
                "rubric_id": test_rubric.id,
                "project_id": test_project.id,
                "title": "Test Assessment",
                "version": "eind",
            }
        )
    
    assert response.status_code == 201
    data = response.json()
    assert data["project_team_id"] == test_project_team.id
    assert data["group_id"] == test_group.id
    assert data["title"] == "Test Assessment"
    
    # Verify in database
    assessment = test_db.query(ProjectAssessment).filter(
        ProjectAssessment.id == data["id"]
    ).first()
    assert assessment is not None
    assert assessment.project_team_id == test_project_team.id
    assert assessment.group_id == test_group.id


def test_create_assessment_without_group_id(
    client, test_db, test_school, test_teacher, test_project, test_rubric, test_project_team
):
    """Test creating assessment with only project_team_id (no group_id)"""
    from unittest.mock import patch
    
    with patch("app.api.v1.deps.get_current_user", return_value=test_teacher):
        response = client.post(
            "/api/v1/project-assessments",
            json={
                "project_team_id": test_project_team.id,
                # No group_id provided
                "rubric_id": test_rubric.id,
                "project_id": test_project.id,
                "title": "Test Assessment No Group",
            }
        )
    
    assert response.status_code == 201
    data = response.json()
    assert data["project_team_id"] == test_project_team.id
    # group_id should be populated from project_team.team_id
    assert data["group_id"] == test_project_team.team_id


def test_list_assessments_by_project_team_id(
    client, test_db, test_school, test_teacher, test_project, test_rubric, test_project_team, test_group
):
    """Test listing assessments filtered by project_team_id"""
    # Create test assessments
    assessment1 = ProjectAssessment(
        id=1,
        school_id=test_school.id,
        project_id=test_project.id,
        project_team_id=test_project_team.id,
        group_id=test_group.id,
        rubric_id=test_rubric.id,
        title="Assessment 1",
        status="draft",
    )
    assessment2 = ProjectAssessment(
        id=2,
        school_id=test_school.id,
        project_id=test_project.id,
        project_team_id=test_project_team.id,
        group_id=test_group.id,
        rubric_id=test_rubric.id,
        title="Assessment 2",
        status="published",
    )
    test_db.add_all([assessment1, assessment2])
    test_db.commit()
    
    from unittest.mock import patch
    
    # Test filtering by project_team_id
    with patch("app.api.v1.deps.get_current_user", return_value=test_teacher):
        response = client.get(
            f"/api/v1/project-assessments?project_team_id={test_project_team.id}"
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


def test_list_assessments_backward_compat_group_id(
    client, test_db, test_school, test_teacher, test_project, test_rubric, test_project_team, test_group
):
    """Test backward compatibility: filtering by group_id still works"""
    # Create test assessment
    assessment = ProjectAssessment(
        id=1,
        school_id=test_school.id,
        project_id=test_project.id,
        project_team_id=test_project_team.id,
        group_id=test_group.id,
        rubric_id=test_rubric.id,
        title="Test Assessment",
        status="draft",
    )
    test_db.add(assessment)
    test_db.commit()
    
    from unittest.mock import patch
    
    # Test filtering by group_id (legacy)
    with patch("app.api.v1.deps.get_current_user", return_value=test_teacher):
        response = client.get(
            f"/api/v1/project-assessments?group_id={test_group.id}"
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["group_id"] == test_group.id


def test_assessment_response_includes_both_ids(
    client, test_db, test_school, test_teacher, test_project, test_rubric, test_project_team, test_group
):
    """Test that assessment responses include both project_team_id and group_id"""
    # Create test assessment
    assessment = ProjectAssessment(
        id=1,
        school_id=test_school.id,
        project_id=test_project.id,
        project_team_id=test_project_team.id,
        group_id=test_group.id,
        rubric_id=test_rubric.id,
        title="Test Assessment",
        status="draft",
    )
    test_db.add(assessment)
    test_db.commit()
    
    from unittest.mock import patch
    
    with patch("app.api.v1.deps.get_current_user", return_value=test_teacher):
        response = client.get("/api/v1/project-assessments")
    
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 1
    item = data["items"][0]
    assert item["project_team_id"] == test_project_team.id
    assert item["group_id"] == test_group.id
