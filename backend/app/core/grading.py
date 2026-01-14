"""
Grade calculation utilities.

Contains the curved grade mapping function used across the application.
"""

from __future__ import annotations
import os


# Configurable exponent for curved grade mapping
# α ≈ 0.85 makes 3/5 → 6.0 on a 1–5 rubric scale
GRADE_CURVE_EXPONENT = float(os.getenv("GRADE_CURVE_EXPONENT", "0.85"))


def score_to_grade(
    avg_score: float | None,
    scale_min: int,
    scale_max: int,
    exponent: float = GRADE_CURVE_EXPONENT,
) -> float | None:
    """
    Convert an average rubric score to a 1–10 grade using a curved mapping.

    The curved mapping uses: grade = 1 + (normalized ** exponent) * 9
    With the default exponent ≈ 0.85:
      - 1/5 → 1.0
      - 3/5 → 6.0
      - 5/5 → 10.0

    Args:
        avg_score: The weighted average score on the rubric scale (e.g. 1–5)
        scale_min: Minimum value of the rubric scale
        scale_max: Maximum value of the rubric scale
        exponent: Curve exponent (default 0.85, lower = more lift in middle)

    Returns:
        Grade on 1–10 scale, rounded to 1 decimal, or None if avg_score is None
    """
    if avg_score is None:
        return None
    scale_range = scale_max - scale_min
    if scale_range <= 0:
        return None
    # Clamp score to valid scale range before normalization
    clamped_score = max(float(scale_min), min(float(scale_max), avg_score))
    normalized = (clamped_score - scale_min) / scale_range
    curved = 1 + (normalized**exponent) * 9
    return round(curved, 1)
