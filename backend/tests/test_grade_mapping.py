"""
Tests for curved grade mapping function.

The curved mapping uses: grade = 1 + (normalized ** exponent) * 9
With exponent ≈ 0.85:
  - 1/5 → 1.0
  - 3/5 → 6.0
  - 5/5 → 10.0
"""

import pytest
from app.core.grading import score_to_grade


class TestCurvedGradeMapping:
    """Tests for the curved grade mapping helper function"""

    def test_min_score_maps_to_grade_1(self):
        """Test that minimum rubric score (1/5) maps to grade 1.0"""
        assert score_to_grade(1.0, 1, 5) == 1.0

    def test_middle_score_maps_to_grade_6(self):
        """Test that middle rubric score (3/5) maps to grade 6.0"""
        assert score_to_grade(3.0, 1, 5) == 6.0

    def test_max_score_maps_to_grade_10(self):
        """Test that maximum rubric score (5/5) maps to grade 10.0"""
        assert score_to_grade(5.0, 1, 5) == 10.0

    def test_none_score_returns_none(self):
        """Test that None score returns None grade"""
        assert score_to_grade(None, 1, 5) is None

    def test_invalid_scale_returns_none(self):
        """Test that invalid scale (range <= 0) returns None"""
        assert score_to_grade(3.0, 5, 5) is None  # scale_range = 0
        assert score_to_grade(3.0, 6, 5) is None  # scale_range < 0

    def test_score_clamped_below_min(self):
        """Test that scores below scale_min are clamped to scale_min"""
        # Score of 0 with scale 1-5 should be clamped and result in 1.0
        assert score_to_grade(0.0, 1, 5) == 1.0

    def test_score_clamped_above_max(self):
        """Test that scores above scale_max are clamped to scale_max"""
        # Score of 6 with scale 1-5 should be clamped and result in 10.0
        assert score_to_grade(6.0, 1, 5) == 10.0

    def test_different_scale_range(self):
        """Test that function works correctly with different scale ranges"""
        # Scale 0-100, middle score 50 should map similarly
        # normalized = 0.5, grade = 1 + (0.5^0.85) * 9 ≈ 6.0
        assert score_to_grade(50.0, 0, 100) == 6.0

    def test_custom_exponent(self):
        """Test that custom exponent affects the curve"""
        # With exponent = 1.0 (linear), middle score should map to 5.5
        grade = score_to_grade(3.0, 1, 5, exponent=1.0)
        assert grade == 5.5

    def test_score_of_2_on_1_to_5_scale(self):
        """Test that score 2/5 maps to expected grade (curved)"""
        # normalized = 0.25, grade = 1 + (0.25^0.85) * 9 ≈ 3.8
        grade = score_to_grade(2.0, 1, 5)
        assert grade is not None
        # With curve exponent 0.85, 2/5 should be > 3.25 (linear would be 3.25)
        assert grade > 3.0
        assert grade < 5.0

    def test_score_of_4_on_1_to_5_scale(self):
        """Test that score 4/5 maps to expected grade (curved)"""
        # normalized = 0.75, grade = 1 + (0.75^0.85) * 9 ≈ 8.1
        grade = score_to_grade(4.0, 1, 5)
        assert grade is not None
        # With curve, 4/5 should be close to 8 (linear would be 7.75)
        assert grade > 7.5
        assert grade < 9.0
