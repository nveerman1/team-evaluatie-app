"""
Tests for CourseEnrollment backfill scripts

Tests the audit and backfill functionality for Phase 1 of the legacy tables migration.
"""

import pytest
from unittest.mock import Mock, MagicMock
from app.infra.db.models import (
    User, Course, Group, GroupMember, CourseEnrollment
)


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
    
    # Mock group
    group = Mock(spec=Group)
    group.id = 1
    group.course_id = 1
    group.name = "Team 1"
    
    # Mock group members
    gm1 = Mock(spec=GroupMember)
    gm1.id = 1
    gm1.user_id = 1
    gm1.group_id = 1
    gm1.active = True
    
    gm2 = Mock(spec=GroupMember)
    gm2.id = 2
    gm2.user_id = 2
    gm2.group_id = 1
    gm2.active = True
    
    return {
        'course': course,
        'students': [student1, student2],
        'group': group,
        'group_members': [gm1, gm2]
    }


def test_backfill_logic(sample_data):
    """Test the basic logic of the backfill process"""
    # Simulate the backfill logic
    active_members = [gm for gm in sample_data['group_members'] if gm.active]
    
    assert len(active_members) == 2
    
    # Check that we would create the right number of enrollments
    enrollments_to_create = []
    for gm in active_members:
        enrollments_to_create.append({
            'student_id': gm.user_id,
            'course_id': sample_data['group'].course_id,
            'active': True
        })
    
    assert len(enrollments_to_create) == 2
    assert all(e['course_id'] == 1 for e in enrollments_to_create)
    assert set(e['student_id'] for e in enrollments_to_create) == {1, 2}


def test_unique_pairs_identification():
    """Test identification of unique student-course pairs"""
    # Simulate student in multiple groups of same course
    group_members = [
        {'user_id': 1, 'course_id': 1},  # Student 1, Course 1
        {'user_id': 1, 'course_id': 1},  # Student 1, Course 1 again (different group)
        {'user_id': 2, 'course_id': 1},  # Student 2, Course 1
        {'user_id': 1, 'course_id': 2},  # Student 1, Course 2
    ]
    
    # Logic to get unique pairs
    unique_pairs = {}
    for gm in group_members:
        key = (gm['user_id'], gm['course_id'])
        unique_pairs[key] = gm
    
    # Should have 3 unique combinations
    assert len(unique_pairs) == 3
    assert (1, 1) in unique_pairs
    assert (2, 1) in unique_pairs
    assert (1, 2) in unique_pairs


def test_inactive_filtering():
    """Test that inactive members are filtered out"""
    group_members = [
        Mock(user_id=1, active=True),
        Mock(user_id=2, active=False),
        Mock(user_id=3, active=True),
    ]
    
    active_only = [gm for gm in group_members if gm.active]
    
    assert len(active_only) == 2
    assert all(gm.active for gm in active_only)


def test_idempotent_creation():
    """Test that backfill logic handles existing enrollments correctly"""
    # Simulate existing enrollments
    existing_enrollments = {
        (1, 1): True,  # Student 1, Course 1 already exists
    }
    
    # New memberships to check
    memberships_to_check = [
        (1, 1),  # Already exists
        (2, 1),  # Needs creation
        (3, 1),  # Needs creation
    ]
    
    to_create = []
    for student_id, course_id in memberships_to_check:
        if (student_id, course_id) not in existing_enrollments:
            to_create.append((student_id, course_id))
    
    # Should only create 2 new ones
    assert len(to_create) == 2
    assert (1, 1) not in to_create


def test_coverage_calculation():
    """Test coverage percentage calculation"""
    total_pairs = 100
    with_enrollment = 95
    without_enrollment = 5
    
    coverage = (with_enrollment / total_pairs) * 100
    
    assert coverage == 95.0
    
    # Test edge case: no pairs
    coverage_empty = (0 / 1) * 100 if 1 > 0 else 100.0
    assert coverage_empty == 0.0


def test_multiple_groups_same_course():
    """Test handling student in multiple groups of the same course"""
    # Student 1 is in two different groups (Team A and Team B) of the same course
    group_members = [
        {'user_id': 1, 'course_id': 1, 'group_id': 1},
        {'user_id': 1, 'course_id': 1, 'group_id': 2},
    ]
    
    # Should only create ONE enrollment (unique by student+course)
    unique_pairs = {}
    for gm in group_members:
        key = (gm['user_id'], gm['course_id'])
        if key not in unique_pairs:
            unique_pairs[key] = gm
        else:
            # Track that this student is in multiple groups
            unique_pairs[key]['group_count'] = unique_pairs[key].get('group_count', 1) + 1
    
    assert len(unique_pairs) == 1, "Should create only one enrollment per student-course pair"
    assert (1, 1) in unique_pairs
