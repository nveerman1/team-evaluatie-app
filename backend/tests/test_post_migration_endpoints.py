"""
Tests for post-migration dashboard and grades endpoints.

Verifies that the app correctly uses CourseEnrollment (not the removed
Group/GroupMember models) after the schema migration.
"""

from unittest.mock import Mock, MagicMock
from app.infra.db.models import Evaluation, CourseEnrollment


class TestGradesPostMigration:
    """Test grades endpoints after Group/GroupMember migration"""

    def test_resolve_course_id_from_evaluation(self):
        """Test that resolve_course_id reads course_id from Evaluation model"""
        from app.api.v1.routers.grades import resolve_course_id

        db = MagicMock()

        ev = Mock(spec=Evaluation)
        ev.course_id = 5
        db.get.return_value = ev

        course_id = resolve_course_id(db, evaluation_id=10, explicit_course_id=None)
        assert course_id == 5

    def test_resolve_course_id_explicit_override(self):
        """Explicit course_id overrides the evaluation lookup"""
        from app.api.v1.routers.grades import resolve_course_id

        db = MagicMock()
        course_id = resolve_course_id(db, evaluation_id=10, explicit_course_id=42)
        assert course_id == 42
        db.get.assert_not_called()

    def test_resolve_course_id_missing_evaluation(self):
        """Returns None when evaluation is not found"""
        from app.api.v1.routers.grades import resolve_course_id

        db = MagicMock()
        db.get.return_value = None

        course_id = resolve_course_id(db, evaluation_id=999, explicit_course_id=None)
        assert course_id is None

    def test_preview_grades_importable(self):
        """preview_grades endpoint is importable — smoke test"""
        from app.api.v1.routers.grades import preview_grades

        assert preview_grades is not None


class TestCourseEnrollmentModel:
    """Test CourseEnrollment model after migration"""

    def test_has_student_id_not_user_id(self):
        """CourseEnrollment uses student_id, not the old user_id"""
        assert hasattr(CourseEnrollment, "student_id")
        assert hasattr(CourseEnrollment, "course_id")
        assert hasattr(CourseEnrollment, "active")
        assert not hasattr(CourseEnrollment, "user_id")
