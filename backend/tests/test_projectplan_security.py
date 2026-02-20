"""
Security tests for ProjectPlan feature.

These tests are intentionally marked as xfail/skip until the full test
infrastructure (real Postgres session fixture) is available.

The real ProjectPlan security tests live in tests/api/test_projectplans.py.
"""

import pytest


@pytest.mark.skip(
    reason="Requires Postgres fixture — covered in tests/api/test_projectplans.py"
)
def test_student_cannot_modify_status_via_mass_assignment():
    """
    Students cannot modify status, locked, or teacher_note fields through
    mass assignment in the update endpoint.
    Covered by: tests/api/test_projectplans.py::TestUpdateProjectplan
    """
    pass


@pytest.mark.skip(
    reason="Requires Postgres fixture — covered in tests/api/test_projectplans.py"
)
def test_student_cannot_modify_section_status():
    """
    Students cannot modify section status or teacher_note.
    Covered by: tests/api/test_projectplans.py
    """
    pass


@pytest.mark.skip(
    reason="Requires Postgres fixture — state machine tested in tests/api/test_projectplans.py"
)
def test_invalid_status_transition_rejected():
    """
    Invalid status transitions are rejected.
    Valid: concept → ingediend → go/no-go → concept/ingediend
    Invalid: concept → go (must go through ingediend)
    """
    pass


@pytest.mark.skip(reason="Requires Postgres fixture")
def test_teacher_must_be_assigned_to_course_to_update_projectplan():
    """
    Teachers can only update projectplans for courses they are assigned to.
    """
    pass


@pytest.mark.skip(
    reason="Requires Postgres fixture — schema validation in tests/api/test_projectplans.py"
)
def test_max_length_validation_on_text_fields():
    """
    Text fields enforce max_length limits: title 500, text 10000, notes 2000.
    Schema validation is tested in tests/api/test_projectplans.py::TestProjectPlanSchemas.
    """
    pass


@pytest.mark.skip(
    reason="Requires Postgres fixture — covered in tests/api/test_projectplans.py"
)
def test_student_locked_projectplan_update_rejected():
    """
    Students cannot update a locked projectplan.
    Covered by: tests/api/test_projectplans.py::TestSubmitProjectplan
    """
    pass
