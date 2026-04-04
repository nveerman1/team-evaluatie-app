"""
Tests for Bug Fix: individual student score override filtering in get_project_assessment.

Bug 1: Individual overrides created for one student were returned to all team members.
Fix:   Backend now filters scores for student users so they only receive:
        - team scores (student_id IS NULL), and
        - their own individual overrides (student_id == user.id).

Bug 2: Individual overrides (often without comments) overwrote team score comments in the
        teacher team edit view.
Fix:   Frontend teacher edit view now only loads team scores (student_id == null) into the
        form, so individual overrides never clear team comments.
       This file tests the backend side only; the frontend fix is a TypeScript-only change.
"""

import pytest
from unittest.mock import Mock
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    Base,
    School,
    User,
    Course,
    TeacherCourse,
    Project,
    Rubric,
    RubricCriterion,
    ProjectTeam,
    ProjectTeamMember,
    ProjectAssessment,
    ProjectAssessmentScore,
)
from app.infra.db.models.assessments import (
    ProjectAssessmentReflection,
    ProjectAssessmentTeam,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Tables needed by these tests – avoids the ARRAY-type columns in clients/notes
# that are incompatible with SQLite.
_NEEDED_TABLES = [
    School.__table__,
    User.__table__,
    Course.__table__,
    TeacherCourse.__table__,
    Project.__table__,
    Rubric.__table__,
    RubricCriterion.__table__,
    ProjectTeam.__table__,
    ProjectTeamMember.__table__,
    ProjectAssessment.__table__,
    ProjectAssessmentScore.__table__,
    ProjectAssessmentReflection.__table__,
    ProjectAssessmentTeam.__table__,
]


def _make_engine():
    """Create a SQLite in-memory engine with a single shared connection.

    StaticPool ensures all threads reuse the same underlying connection, which
    is required for SQLite in-memory databases used with FastAPI's thread-pool
    request handling (anyio.to_thread.run_sync).
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _set_pragmas(dbapi_conn, _record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=OFF")
        cursor.close()

    Base.metadata.create_all(engine, tables=_NEEDED_TABLES)
    return engine


def _mock_user(user_id: int, school_id: int, role: str) -> Mock:
    """Return a Mock that quacks like a User ORM object without lazy-loading."""
    u = Mock(spec=User)
    u.id = user_id
    u.school_id = school_id
    u.role = role
    u.archived = False
    return u


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="function")
def test_db():
    engine = _make_engine()
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = Session()
    yield db
    db.close()
    engine.dispose()


@pytest.fixture
def base_objects(test_db):
    """Create the minimal set of DB rows shared by all tests in this module."""
    school = School(id=1, name="Test School")
    # Stored in DB for teacher-name lookup and team-member checks
    teacher_row = User(
        id=1,
        school_id=1,
        name="Docent",
        email="teacher@school.nl",
        role="teacher",
        password_hash="x",
    )
    student_a_row = User(
        id=2,
        school_id=1,
        name="Student A",
        email="student_a@school.nl",
        role="student",
        password_hash="x",
    )
    student_b_row = User(
        id=3,
        school_id=1,
        name="Student B",
        email="student_b@school.nl",
        role="student",
        password_hash="x",
    )
    course = Course(id=1, school_id=1, name="Vak", code="V1", is_active=True)
    teacher_course = TeacherCourse(
        school_id=1,
        teacher_id=1,
        course_id=1,
        role="teacher",
        is_active=True,
    )
    project = Project(
        id=1,
        school_id=1,
        course_id=1,
        title="Project",
        status="active",
        created_by_id=1,
    )
    rubric = Rubric(
        id=1,
        school_id=1,
        title="Rubric",
        scope="project",
        scale_min=1,
        scale_max=5,
    )
    criterion = RubricCriterion(
        id=1,
        school_id=1,
        rubric_id=1,
        name="Criterion 1",
        weight=1.0,
    )
    team = ProjectTeam(
        id=1,
        school_id=1,
        project_id=1,
        team_number=1,
        display_name_at_time="Team 1",
        version=1,
    )
    member_a = ProjectTeamMember(id=1, school_id=1, project_team_id=1, user_id=2)
    member_b = ProjectTeamMember(id=2, school_id=1, project_team_id=1, user_id=3)
    assessment = ProjectAssessment(
        id=1,
        school_id=1,
        project_id=1,
        rubric_id=1,
        title="Assessment",
        status="published",
        teacher_id=1,
    )
    test_db.add_all(
        [
            school,
            teacher_row,
            student_a_row,
            student_b_row,
            course,
            teacher_course,
            project,
            rubric,
            criterion,
            team,
            member_a,
            member_b,
            assessment,
        ]
    )
    test_db.commit()

    # Return Mock user objects to avoid SQLAlchemy lazy-loading across threads
    return {
        "teacher": _mock_user(1, 1, "teacher"),
        "student_a": _mock_user(2, 1, "student"),
        "student_b": _mock_user(3, 1, "student"),
    }


def _make_client(test_db, current_user):
    """Create a TestClient with db and auth overrides for the given user."""

    def override_db():
        try:
            yield test_db
        finally:
            pass

    def override_user():
        return current_user

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user
    return TestClient(app, base_url="http://testserver", raise_server_exceptions=True)


def _teardown_client():
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Tests: student receives only team scores + own overrides
# ---------------------------------------------------------------------------


class TestStudentScoreFiltering:
    """Student users must only see team scores and their own individual overrides."""

    def test_student_sees_team_scores(self, test_db, base_objects):
        """A student receives the team score (student_id IS NULL)."""
        test_db.add(
            ProjectAssessmentScore(
                id=1,
                school_id=1,
                assessment_id=1,
                criterion_id=1,
                team_number=1,
                student_id=None,
                score=3,
                comment="team comment",
            )
        )
        test_db.commit()

        client = _make_client(test_db, base_objects["student_a"])
        try:
            resp = client.get("/api/v1/project-assessments/1")
            assert resp.status_code == 200
            scores = resp.json()["scores"]
            assert len(scores) == 1
            assert scores[0]["student_id"] is None
            assert scores[0]["score"] == 3
            assert scores[0]["comment"] == "team comment"
        finally:
            _teardown_client()

    def test_student_sees_own_override(self, test_db, base_objects):
        """A student receives their own individual override alongside the team score."""
        test_db.add_all(
            [
                ProjectAssessmentScore(
                    id=1,
                    school_id=1,
                    assessment_id=1,
                    criterion_id=1,
                    team_number=1,
                    student_id=None,
                    score=3,
                    comment="team comment",
                ),
                ProjectAssessmentScore(
                    id=2,
                    school_id=1,
                    assessment_id=1,
                    criterion_id=1,
                    team_number=1,
                    student_id=2,
                    score=4,
                    comment="override for A",
                ),
            ]
        )
        test_db.commit()

        client = _make_client(test_db, base_objects["student_a"])  # student_a has id=2
        try:
            resp = client.get("/api/v1/project-assessments/1")
            assert resp.status_code == 200
            scores = resp.json()["scores"]
            assert len(scores) == 2
            student_ids = {s["student_id"] for s in scores}
            assert None in student_ids  # team score present
            assert 2 in student_ids  # own override present
        finally:
            _teardown_client()

    def test_student_does_not_see_other_student_override(self, test_db, base_objects):
        """A student must NOT receive a teammate's individual override.

        This is the primary regression test for Bug 1.
        """
        test_db.add_all(
            [
                ProjectAssessmentScore(
                    id=1,
                    school_id=1,
                    assessment_id=1,
                    criterion_id=1,
                    team_number=1,
                    student_id=None,
                    score=3,
                    comment="team",
                ),
                ProjectAssessmentScore(
                    id=2,
                    school_id=1,
                    assessment_id=1,
                    criterion_id=1,
                    team_number=1,
                    student_id=3,
                    score=5,
                    comment="override for B",
                ),
            ]
        )
        test_db.commit()

        client = _make_client(test_db, base_objects["student_a"])  # id=2, NOT id=3
        try:
            resp = client.get("/api/v1/project-assessments/1")
            assert resp.status_code == 200
            scores = resp.json()["scores"]
            # Student B's override (student_id=3) must be absent
            student_ids = [s["student_id"] for s in scores]
            assert (
                3 not in student_ids
            ), "Student A must not see Student B's individual override"
            # Team score must still be present
            assert None in student_ids
        finally:
            _teardown_client()

    def test_student_sees_own_override_but_not_teammates(self, test_db, base_objects):
        """When both students have overrides, each student only sees their own.

        Tests the full scenario: team score + override A + override B.
        Student A should see team score and override A only.
        """
        test_db.add_all(
            [
                ProjectAssessmentScore(
                    id=1,
                    school_id=1,
                    assessment_id=1,
                    criterion_id=1,
                    team_number=1,
                    student_id=None,
                    score=3,
                ),
                ProjectAssessmentScore(
                    id=2,
                    school_id=1,
                    assessment_id=1,
                    criterion_id=1,
                    team_number=1,
                    student_id=2,
                    score=4,
                    comment="override A",
                ),
                ProjectAssessmentScore(
                    id=3,
                    school_id=1,
                    assessment_id=1,
                    criterion_id=1,
                    team_number=1,
                    student_id=3,
                    score=5,
                    comment="override B",
                ),
            ]
        )
        test_db.commit()

        # Student A (id=2) – should see team + own override only
        client_a = _make_client(test_db, base_objects["student_a"])
        try:
            resp_a = client_a.get("/api/v1/project-assessments/1")
            assert resp_a.status_code == 200
            scores_a = resp_a.json()["scores"]
            student_ids_a = [s["student_id"] for s in scores_a]
            assert 3 not in student_ids_a, "Student A must not see Student B's override"
            assert None in student_ids_a, "Student A must see the team score"
            assert 2 in student_ids_a, "Student A must see their own override"
            assert len(scores_a) == 2
        finally:
            _teardown_client()

        # Student B (id=3) – should see team + own override only
        client_b = _make_client(test_db, base_objects["student_b"])
        try:
            resp_b = client_b.get("/api/v1/project-assessments/1")
            assert resp_b.status_code == 200
            scores_b = resp_b.json()["scores"]
            student_ids_b = [s["student_id"] for s in scores_b]
            assert 2 not in student_ids_b, "Student B must not see Student A's override"
            assert None in student_ids_b, "Student B must see the team score"
            assert 3 in student_ids_b, "Student B must see their own override"
            assert len(scores_b) == 2
        finally:
            _teardown_client()


# ---------------------------------------------------------------------------
# Tests: teacher receives all scores (no filtering)
# ---------------------------------------------------------------------------


class TestTeacherScoreFiltering:
    """Teacher users must receive all scores – team scores and all overrides."""

    def test_teacher_sees_all_scores(self, test_db, base_objects):
        """Teacher receives team score plus overrides for both students."""
        test_db.add_all(
            [
                ProjectAssessmentScore(
                    id=1,
                    school_id=1,
                    assessment_id=1,
                    criterion_id=1,
                    team_number=1,
                    student_id=None,
                    score=3,
                ),
                ProjectAssessmentScore(
                    id=2,
                    school_id=1,
                    assessment_id=1,
                    criterion_id=1,
                    team_number=1,
                    student_id=2,
                    score=4,
                    comment="override A",
                ),
                ProjectAssessmentScore(
                    id=3,
                    school_id=1,
                    assessment_id=1,
                    criterion_id=1,
                    team_number=1,
                    student_id=3,
                    score=5,
                    comment="override B",
                ),
            ]
        )
        test_db.commit()

        client = _make_client(test_db, base_objects["teacher"])
        try:
            resp = client.get("/api/v1/project-assessments/1?team_number=1")
            assert resp.status_code == 200
            scores = resp.json()["scores"]
            assert (
                len(scores) == 3
            ), "Teacher must receive all 3 scores (team + 2 overrides)"
            student_ids = {s["student_id"] for s in scores}
            assert None in student_ids
            assert 2 in student_ids
            assert 3 in student_ids
        finally:
            _teardown_client()

    def test_teacher_sees_team_score_with_comment(self, test_db, base_objects):
        """Regression: teacher sees the team score comment even when an override exists.

        This verifies the backend returns both records separately, allowing the
        teacher edit view to filter them correctly (frontend fix for Bug 2).
        """
        test_db.add_all(
            [
                ProjectAssessmentScore(
                    id=1,
                    school_id=1,
                    assessment_id=1,
                    criterion_id=1,
                    team_number=1,
                    student_id=None,
                    score=3,
                    comment="team opmerking",
                ),
                ProjectAssessmentScore(
                    id=2,
                    school_id=1,
                    assessment_id=1,
                    criterion_id=1,
                    team_number=1,
                    student_id=2,
                    score=4,
                    comment=None,
                ),
            ]
        )
        test_db.commit()

        client = _make_client(test_db, base_objects["teacher"])
        try:
            resp = client.get("/api/v1/project-assessments/1?team_number=1")
            assert resp.status_code == 200
            scores = resp.json()["scores"]
            team_scores = [s for s in scores if s["student_id"] is None]
            assert len(team_scores) == 1
            assert (
                team_scores[0]["comment"] == "team opmerking"
            ), "Team comment must survive even when an individual override exists"
        finally:
            _teardown_client()
