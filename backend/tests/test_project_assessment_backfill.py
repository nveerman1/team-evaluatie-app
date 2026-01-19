"""
Unit tests for backfill_project_assessment_teams.py

Tests the backfill logic for populating project_team_id in ProjectAssessment records.
"""

import pytest
import sys
from pathlib import Path
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.infra.db.models import (
    Base,
    School,
    Course,
    ProjectAssessment,
    ProjectTeam,
    ProjectTeamMember,
    Group,
    GroupMember,
    User,
    Project,
    Rubric,
)

# Add backend directory to path once at module level
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from scripts.backfill_project_assessment_teams import backfill_project_assessment_teams


@pytest.fixture
def test_db():
    """Create an in-memory SQLite database for testing"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    db = Session(engine)
    yield db
    db.close()


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
def test_users(test_db, test_school):
    """Create test users"""
    users = []
    for i in range(3):
        user = User(
            id=i + 1,
            school_id=test_school.id,
            name=f"Student {i + 1}",
            email=f"student{i + 1}@test.com",
            role="student",
            hashed_password="dummy",
        )
        test_db.add(user)
        users.append(user)
    test_db.commit()
    return users


@pytest.fixture
def test_group_members(test_db, test_school, test_group, test_users):
    """Create test group members"""
    members = []
    for user in test_users:
        member = GroupMember(
            id=user.id,
            school_id=test_school.id,
            group_id=test_group.id,
            user_id=user.id,
            active=True,
        )
        test_db.add(member)
        members.append(member)
    test_db.commit()
    return members


def test_backfill_links_existing_project_team(
    test_db, test_school, test_project, test_group, test_rubric, test_users, test_group_members
):
    """Test backfill links to existing ProjectTeam when available"""
    # Create an existing ProjectTeam
    project_team = ProjectTeam(
        id=1,
        school_id=test_school.id,
        project_id=test_project.id,
        team_id=test_group.id,
        team_number=1,
        display_name_at_time="Test Team 1",
        version=1,
        is_locked=False,
    )
    test_db.add(project_team)
    
    # Add team members
    for user in test_users:
        member = ProjectTeamMember(
            school_id=test_school.id,
            project_team_id=project_team.id,
            user_id=user.id,
        )
        test_db.add(member)
    test_db.commit()
    
    # Create ProjectAssessment without project_team_id
    assessment = ProjectAssessment(
        id=1,
        school_id=test_school.id,
        project_id=test_project.id,
        group_id=test_group.id,
        project_team_id=None,  # Need to backfill this
        rubric_id=test_rubric.id,
        title="Test Assessment",
        status="draft",
    )
    test_db.add(assessment)
    test_db.commit()
    
    
    # Run backfill
    results = backfill_project_assessment_teams(test_db, dry_run=False)
    
    # Verify results
    assert results['total_assessments'] == 1
    assert results['linked_existing'] == 1
    assert results['created_new'] == 0
    assert len(results['errors']) == 0
    
    # Verify assessment was linked
    test_db.refresh(assessment)
    assert assessment.project_team_id == project_team.id


def test_backfill_creates_new_project_team(
    test_db, test_school, test_project, test_group, test_rubric, test_users, test_group_members
):
    """Test backfill creates new ProjectTeam when none exists"""
    # Create ProjectAssessment without project_team_id and no existing ProjectTeam
    assessment = ProjectAssessment(
        id=1,
        school_id=test_school.id,
        project_id=test_project.id,
        group_id=test_group.id,
        project_team_id=None,
        rubric_id=test_rubric.id,
        title="Test Assessment",
        status="draft",
    )
    test_db.add(assessment)
    test_db.commit()
    
    
    # Run backfill
    results = backfill_project_assessment_teams(test_db, dry_run=False)
    
    # Verify results
    assert results['total_assessments'] == 1
    assert results['linked_existing'] == 0
    assert results['created_new'] == 1
    assert len(results['errors']) == 0
    
    # Verify assessment was linked to new team
    test_db.refresh(assessment)
    assert assessment.project_team_id is not None
    
    # Verify new team was created
    new_team = test_db.query(ProjectTeam).filter(
        ProjectTeam.id == assessment.project_team_id
    ).first()
    assert new_team is not None
    assert new_team.team_id == test_group.id
    assert new_team.team_number == 1
    assert new_team.is_locked is True  # Should be locked since from migration
    
    # Verify team members were created
    team_members = test_db.query(ProjectTeamMember).filter(
        ProjectTeamMember.project_team_id == new_team.id
    ).all()
    assert len(team_members) == len(test_users)


def test_backfill_dry_run_no_changes(
    test_db, test_school, test_project, test_group, test_rubric
):
    """Test dry run mode doesn't make changes"""
    # Create ProjectAssessment without project_team_id
    assessment = ProjectAssessment(
        id=1,
        school_id=test_school.id,
        project_id=test_project.id,
        group_id=test_group.id,
        project_team_id=None,
        rubric_id=test_rubric.id,
        title="Test Assessment",
        status="draft",
    )
    test_db.add(assessment)
    test_db.commit()
    
    
    # Run backfill in dry-run mode
    results = backfill_project_assessment_teams(test_db, dry_run=True)
    
    # Verify results show what would be done
    assert results['total_assessments'] == 1
    
    # Verify no changes were made
    test_db.refresh(assessment)
    assert assessment.project_team_id is None
    
    # Verify no teams were created
    teams = test_db.query(ProjectTeam).all()
    assert len(teams) == 0


def test_backfill_skips_already_populated(
    test_db, test_school, test_project, test_group, test_rubric
):
    """Test backfill skips assessments that already have project_team_id"""
    # Create ProjectTeam
    project_team = ProjectTeam(
        id=1,
        school_id=test_school.id,
        project_id=test_project.id,
        team_id=test_group.id,
        team_number=1,
        display_name_at_time="Test Team 1",
        version=1,
        is_locked=False,
    )
    test_db.add(project_team)
    test_db.commit()
    
    # Create ProjectAssessment with project_team_id already set
    assessment = ProjectAssessment(
        id=1,
        school_id=test_school.id,
        project_id=test_project.id,
        group_id=test_group.id,
        project_team_id=project_team.id,  # Already set
        rubric_id=test_rubric.id,
        title="Test Assessment",
        status="draft",
    )
    test_db.add(assessment)
    test_db.commit()
    
    
    # Run backfill
    results = backfill_project_assessment_teams(test_db, dry_run=False)
    
    # Verify nothing was processed
    assert results['total_assessments'] == 0
    assert results['linked_existing'] == 0
    assert results['created_new'] == 0
