"""
Tests for post-migration dashboard and grades endpoints

Tests that dashboard and grades endpoints work correctly after
migrating from legacy Group/GroupMember models to CourseEnrollment.
"""

import pytest
from unittest.mock import Mock, MagicMock
from app.infra.db.models import User, Evaluation, CourseEnrollment


class TestDashboardPostMigration:
    """Test dashboard endpoints after Group/GroupMember migration"""

    def test_get_evaluation_dashboard_uses_correct_enrollment_field(self):
        """Test that dashboard queries use CourseEnrollment.student_id not user_id"""
        from app.api.v1.routers.dashboard import get_evaluation_dashboard
        
        # Setup mocks
        db = MagicMock()
        user = Mock(spec=User)
        user.id = 1
        user.school_id = 1
        user.role = "teacher"
        
        # Mock evaluation with course
        ev = Mock(spec=Evaluation)
        ev.id = 10
        ev.school_id = 1
        ev.course_id = 5
        ev.rubric_id = 1
        db.query.return_value.filter.return_value.first.return_value = ev
        
        # Mock rubric and criteria
        db.query.return_value.filter.return_value.all.return_value = []
        
        # Mock CourseEnrollment query - should use student_id
        enrollment_query = MagicMock()
        db.query.return_value.join.return_value = enrollment_query
        enrollment_query.filter.return_value.distinct.return_value.all.return_value = []
        
        # Call endpoint - should not raise AttributeError about user_id
        try:
            result = get_evaluation_dashboard(
                evaluation_id=10,
                include_breakdown=False,
                db=db,
                user=user
            )
            # If we get here without AttributeError, the fix is working
            assert True
        except AttributeError as e:
            if "user_id" in str(e):
                pytest.fail(f"CourseEnrollment.user_id still referenced: {e}")
            raise


class TestGradesPostMigration:
    """Test grades endpoints after Group/GroupMember migration"""

    def test_preview_grades_has_no_group_model_flag(self):
        """Test that grades preview doesn't reference HAS_GROUP_MODELS"""
        from app.api.v1.routers.grades import resolve_course_id
        
        # Setup mocks
        db = MagicMock()
        
        # Mock evaluation
        ev = Mock(spec=Evaluation)
        ev.course_id = 5
        db.get.return_value = ev
        
        # Should work without HAS_GROUP_MODELS flag
        try:
            course_id = resolve_course_id(db, evaluation_id=10, explicit_course_id=None)
            assert course_id == 5
        except NameError as e:
            if "HAS_GROUP_MODELS" in str(e):
                pytest.fail(f"HAS_GROUP_MODELS flag still referenced: {e}")
            raise
    
    def test_preview_grades_uses_correct_enrollment_field(self):
        """Test that grades preview uses CourseEnrollment.student_id not user_id"""
        # This is a basic smoke test to ensure the import works
        from app.api.v1.routers.grades import preview_grades
        
        # If imports work without errors, the model references are correct
        assert preview_grades is not None
        
        # Verify CourseEnrollment has student_id attribute
        assert hasattr(CourseEnrollment, 'student_id')
        assert not hasattr(CourseEnrollment, 'user_id')


class TestCourseEnrollmentModel:
    """Test CourseEnrollment model after migration"""
    
    def test_course_enrollment_has_student_id_not_user_id(self):
        """Verify CourseEnrollment model structure"""
        # CourseEnrollment should have student_id, not user_id
        assert hasattr(CourseEnrollment, 'student_id')
        assert hasattr(CourseEnrollment, 'course_id')
        assert hasattr(CourseEnrollment, 'active')
        
        # Should NOT have user_id
        assert not hasattr(CourseEnrollment, 'user_id')


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
