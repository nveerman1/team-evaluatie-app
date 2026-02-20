"""
Unit tests for grade calculation utilities.

Pure-function tests: no DB, no HTTP.
"""

import pytest

from app.core.grading import score_to_grade


@pytest.mark.unit
class TestScoreToGrade:
    """Tests for the curved grade mapping helper."""

    def test_min_score_maps_to_grade_1(self):
        assert score_to_grade(1.0, 1, 5) == 1.0

    def test_middle_score_maps_to_grade_6(self):
        assert score_to_grade(3.0, 1, 5) == 6.0

    def test_max_score_maps_to_grade_10(self):
        assert score_to_grade(5.0, 1, 5) == 10.0

    def test_none_score_returns_none(self):
        assert score_to_grade(None, 1, 5) is None

    def test_invalid_scale_returns_none(self):
        assert score_to_grade(3.0, 5, 5) is None  # range == 0
        assert score_to_grade(3.0, 6, 5) is None  # range < 0

    def test_score_clamped_below_min(self):
        assert score_to_grade(0.0, 1, 5) == 1.0

    def test_score_clamped_above_max(self):
        assert score_to_grade(6.0, 1, 5) == 10.0

    def test_different_scale_range(self):
        assert score_to_grade(50.0, 0, 100) == 6.0

    def test_linear_exponent(self):
        """With exponent=1.0 (linear), mid-point → 5.5."""
        assert score_to_grade(3.0, 1, 5, exponent=1.0) == 5.5

    def test_score_2_on_1_to_5_scale(self):
        grade = score_to_grade(2.0, 1, 5)
        assert grade is not None
        assert 3.0 < grade < 5.0

    def test_score_4_on_1_to_5_scale(self):
        grade = score_to_grade(4.0, 1, 5)
        assert grade is not None
        assert 7.5 < grade < 9.0

    def test_result_rounded_to_one_decimal(self):
        grade = score_to_grade(2.5, 1, 5)
        assert grade == round(grade, 1)
