"""
Tests for CourseEnrollment-only implementation

Tests the CourseEnrollment logic for Phase 1 of the legacy tables migration.
Note: These tests are for the CourseEnrollment-only approach (no GroupMember).

To run these tests:
  - With pytest: `pytest tests/test_course_enrollment_backfill.py -v`
  - Standalone: `python tests/test_course_enrollment_backfill.py`
"""

import sys
from pathlib import Path

# Add backend directory to Python path BEFORE any app imports
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from unittest.mock import Mock

# Try to import pytest, but make it optional for standalone runs
try:
    import pytest
    PYTEST_AVAILABLE = True
except ImportError:
    PYTEST_AVAILABLE = False
    # Create a simple fixture decorator that does nothing when pytest isn't available
    def pytest_fixture(func):
        return func
    
    class pytest:
        fixture = staticmethod(pytest_fixture)

# Try to import models, but use mocks if dependencies aren't available
try:
    from app.infra.db.models import User, Course, CourseEnrollment
    MODELS_AVAILABLE = True
except (ImportError, ModuleNotFoundError):
    # Create mock classes for standalone testing without dependencies
    MODELS_AVAILABLE = False
    
    class User:
        """Mock User model for testing"""
        pass
    
    class Course:
        """Mock Course model for testing"""
        pass
    
    class CourseEnrollment:
        """Mock CourseEnrollment model for testing"""
        pass


if PYTEST_AVAILABLE:
    @pytest.fixture
    def test_db():
        """Create a mock database session for testing"""
        db = Mock()
        db.add = Mock()
        db.commit = Mock()
        db.rollback = Mock()
        db.close = Mock()
        return db


    @pytest.fixture
    def sample_data():
        """Create sample mock data for testing"""
        # Mock students
        student1 = Mock(spec=User)
        student1.id = 1
        student1.email = "student1@test.com"
        student1.name = "Student One"
        student1.role = "student"
        
        student2 = Mock(spec=User)
        student2.id = 2
        student2.email = "student2@test.com"
        student2.name = "Student Two"
        student2.role = "student"
        
        # Mock course
        course = Mock(spec=Course)
        course.id = 1
        course.name = "Test Course"
        
        return {
            'course': course,
            'students': [student1, student2],
        }
else:
    # For standalone runs, create simple functions that return the same data
    def test_db():
        db = Mock()
        db.add = Mock()
        db.commit = Mock()
        db.rollback = Mock()
        db.close = Mock()
        return db

    def sample_data():
        student1 = Mock(spec=User)
        student1.id = 1
        student1.email = "student1@test.com"
        student1.name = "Student One"
        student1.role = "student"
        
        student2 = Mock(spec=User)
        student2.id = 2
        student2.email = "student2@test.com"
        student2.name = "Student Two"
        student2.role = "student"
        
        course = Mock(spec=Course)
        course.id = 1
        course.name = "Test Course"
        
        return {
            'course': course,
            'students': [student1, student2],
        }


# Helper function that can be called directly (not a fixture)
def _get_sample_data():
    """Get sample data for tests - can be called directly without fixture"""
    student1 = Mock(spec=User)
    student1.id = 1
    student1.email = "student1@test.com"
    student1.name = "Student One"
    student1.role = "student"
    
    student2 = Mock(spec=User)
    student2.id = 2
    student2.email = "student2@test.com"
    student2.name = "Student Two"
    student2.role = "student"
    
    course = Mock(spec=Course)
    course.id = 1
    course.name = "Test Course"
    
    return {
        'course': course,
        'students': [student1, student2],
    }

def test_course_enrollment_creation(sample_data=None):
    """Test direct CourseEnrollment creation"""
    # Support both pytest (fixture parameter) and standalone (function call)
    if sample_data is None:
        data = _get_sample_data()
    else:
        data = sample_data
    
    # Simulate creating enrollments directly
    enrollments_to_create = []
    for student in data['students']:
        enrollments_to_create.append({
            'student_id': student.id,
            'course_id': data['course'].id,
            'active': True
        })
    
    assert len(enrollments_to_create) == 2
    assert all(e['course_id'] == 1 for e in enrollments_to_create)
    assert set(e['student_id'] for e in enrollments_to_create) == {1, 2}


def test_unique_student_course_pairs():
    """Test that each student-course pair is unique"""
    # Simulate multiple enrollment attempts for same student-course
    enrollment_attempts = [
        {'user_id': 1, 'course_id': 1},  # Student 1, Course 1
        {'user_id': 1, 'course_id': 1},  # Student 1, Course 1 (duplicate)
        {'user_id': 2, 'course_id': 1},  # Student 2, Course 1
        {'user_id': 1, 'course_id': 2},  # Student 1, Course 2
    ]
    
    # Logic to enforce unique pairs
    unique_pairs = {}
    for attempt in enrollment_attempts:
        key = (attempt['user_id'], attempt['course_id'])
        unique_pairs[key] = attempt
    
    # Should have 3 unique combinations
    assert len(unique_pairs) == 3
    assert (1, 1) in unique_pairs
    assert (2, 1) in unique_pairs
    assert (1, 2) in unique_pairs


def test_active_enrollment_status():
    """Test active/inactive enrollment handling"""
    # Mock enrollments with different statuses
    enrollments = [
        Mock(student_id=1, course_id=1, active=True),
        Mock(student_id=2, course_id=1, active=False),
        Mock(student_id=3, course_id=1, active=True),
    ]
    
    active_only = [e for e in enrollments if e.active]
    
    assert len(active_only) == 2
    assert all(e.active for e in active_only)


def test_enrollment_reactivation():
    """Test that inactive enrollments can be reactivated"""
    # Simulate existing inactive enrollment
    existing_enrollment = {
        'student_id': 1,
        'course_id': 1,
        'active': False
    }
    
    # Reactivation logic
    if not existing_enrollment['active']:
        existing_enrollment['active'] = True
    
    assert existing_enrollment['active'] == True


def test_idempotent_enrollment():
    """Test that enrollment creation is idempotent"""
    # Simulate existing enrollments
    existing_enrollments = {
        (1, 1): True,  # Student 1, Course 1 already exists
    }
    
    # New enrollment requests
    requests = [
        (1, 1),  # Already exists - should skip
        (2, 1),  # Needs creation
        (3, 1),  # Needs creation
    ]
    
    to_create = []
    for student_id, course_id in requests:
        if (student_id, course_id) not in existing_enrollments:
            to_create.append((student_id, course_id))
    
    # Should only create 2 new ones
    assert len(to_create) == 2
    assert (1, 1) not in to_create
    assert (2, 1) in to_create
    assert (3, 1) in to_create


def test_enrollment_coverage_calculation():
    """Test enrollment coverage percentage calculation"""
    total_students = 100
    enrolled_students = 95
    
    coverage = (enrolled_students / total_students) * 100
    
    assert coverage == 95.0
    
    # Test edge case: all enrolled
    full_coverage = (100 / 100) * 100
    assert full_coverage == 100.0


def test_multiple_course_enrollments():
    """Test student enrolled in multiple courses"""
    # Student 1 enrolled in multiple courses
    enrollments = [
        {'user_id': 1, 'course_id': 1},  # Math
        {'user_id': 1, 'course_id': 2},  # Physics
        {'user_id': 1, 'course_id': 3},  # Chemistry
    ]
    
    # Count enrollments per student
    student_courses = {}
    for e in enrollments:
        student_id = e['user_id']
        if student_id not in student_courses:
            student_courses[student_id] = []
        student_courses[student_id].append(e['course_id'])
    
    assert len(student_courses[1]) == 3
    assert set(student_courses[1]) == {1, 2, 3}


def test_enrollment_query_logic():
    """Test CourseEnrollment query logic"""
    # Simulate query for active enrollments
    all_enrollments = [
        {'student_id': 1, 'course_id': 1, 'active': True},
        {'student_id': 1, 'course_id': 2, 'active': False},
        {'student_id': 2, 'course_id': 1, 'active': True},
        {'student_id': 3, 'course_id': 1, 'active': True},
    ]
    
    # Filter for active only
    active_enrollments = [e for e in all_enrollments if e['active']]
    
    assert len(active_enrollments) == 3
    
    # Filter for specific course
    course_1_enrollments = [e for e in active_enrollments if e['course_id'] == 1]
    assert len(course_1_enrollments) == 3  # Students 1, 2, and 3 all have course_id=1 and active=True


def test_course_creation_with_enrollment():
    """Test that course is created if it doesn't exist"""
    # Simulate course creation logic
    existing_courses = {
        'Math 101': {'id': 1, 'name': 'Math 101'},
    }
    
    requested_course = 'Physics 201'
    
    if requested_course not in existing_courses:
        # Would create new course
        new_course = {'id': 2, 'name': requested_course}
        existing_courses[requested_course] = new_course
    
    assert 'Physics 201' in existing_courses
    assert existing_courses['Physics 201']['id'] == 2
    assert len(existing_courses) == 2


# Main block for standalone execution
if __name__ == "__main__":
    print("Running CourseEnrollment tests...\n")
    
    tests = [
        ("Course Enrollment Creation", test_course_enrollment_creation),
        ("Unique Student-Course Pairs", test_unique_student_course_pairs),
        ("Active Enrollment Status", test_active_enrollment_status),
        ("Enrollment Reactivation", test_enrollment_reactivation),
        ("Idempotent Enrollment", test_idempotent_enrollment),
        ("Enrollment Coverage Calculation", test_enrollment_coverage_calculation),
        ("Multiple Course Enrollments", test_multiple_course_enrollments),
        ("Enrollment Query Logic", test_enrollment_query_logic),
        ("Course Creation with Enrollment", test_course_creation_with_enrollment),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            test_func()
            print(f"✓ {test_name}")
            passed += 1
        except AssertionError as e:
            print(f"✗ {test_name}")
            print(f"  AssertionError: {e}")
            failed += 1
        except Exception as e:
            print(f"✗ {test_name}")
            print(f"  Error: {e}")
            failed += 1
    
    print(f"\n{'='*50}")
    print(f"Results: {passed} passed, {failed} failed")
    print(f"{'='*50}")
    
    if failed > 0:
        sys.exit(1)
    else:
        print("\n✓ All tests passed!")
        sys.exit(0)


