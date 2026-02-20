"""
Security tests for Skill Trainings feature.

These tests are intentionally marked as skip until the full test
infrastructure (real Postgres session fixture) is available.

The real SkillTraining security tests live in tests/api/test_skill_trainings.py.
"""

import pytest


@pytest.mark.skip(
    reason="Requires Postgres fixture — covered in tests/api/test_skill_trainings.py"
)
def test_teacher_cannot_access_other_teacher_course_progress():
    """
    Teacher A cannot access progress matrix for a course taught by Teacher B.
    """
    pass


@pytest.mark.skip(reason="Requires Postgres fixture")
def test_bulk_update_validates_array_size_limits():
    """
    Bulk update enforces limits: max 100 students, max 50 trainings.
    """
    pass


@pytest.mark.skip(reason="Requires Postgres fixture")
def test_bulk_update_validates_student_enrollment():
    """
    Bulk update verifies all students are enrolled in the course.
    """
    pass


@pytest.mark.skip(reason="Requires Postgres fixture")
def test_bulk_update_validates_training_existence():
    """
    Bulk update verifies all trainings exist and belong to the school.
    """
    pass


@pytest.mark.skip(
    reason="Requires Postgres fixture — covered in tests/api/test_skill_trainings.py"
)
def test_student_cannot_modify_teacher_feedback():
    """
    Students cannot override teacher assessments (completed/mastered status).
    Covered by: tests/api/test_skill_trainings.py::TestUpdateMyStatus
    """
    pass


@pytest.mark.skip(
    reason="Requires Postgres fixture — covered in tests/api/test_skill_trainings.py"
)
def test_student_status_restricted_to_allowed_values():
    """
    Students can only set: none, planned, in_progress, submitted.
    Covered by: tests/api/test_skill_trainings.py::TestStudentAllowedStatuses
    """
    pass


@pytest.mark.skip(reason="Requires Postgres fixture")
def test_teacher_update_progress_validates_course_ownership():
    """
    Single progress update endpoint verifies teacher is assigned to the course.
    """
    pass


@pytest.mark.skip(
    reason="Requires Postgres fixture — schema tested in tests/api/test_skill_trainings.py"
)
def test_max_length_validation_on_note_fields():
    """
    Note fields enforce max_length of 2000 chars.
    Schema validation tested in tests/api/test_skill_trainings.py::TestSkillTrainingSchemas.
    """
    pass
