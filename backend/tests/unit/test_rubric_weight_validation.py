"""
Unit tests for rubric criterion weight validation in CriterionBatchUpsertRequest.

Pure-function tests: no DB, no HTTP.
"""

import pytest
from pydantic import ValidationError

from app.api.v1.schemas.rubrics import CriterionBatchUpsertRequest, CriterionUpsertItem


def _make_item(name: str, weight: float) -> CriterionUpsertItem:
    return CriterionUpsertItem(name=name, weight=weight)


@pytest.mark.unit
class TestCriterionBatchWeightValidation:
    """Tests for sum-of-weights and non-negative validation on batch upsert."""

    def test_valid_weights_sum_to_one(self):
        req = CriterionBatchUpsertRequest(
            items=[_make_item("A", 0.4), _make_item("B", 0.6)]
        )
        assert len(req.items) == 2

    def test_valid_weights_within_epsilon(self):
        # 0.33 + 0.33 + 0.34 = 1.00 exactly, but floating point sums may vary slightly
        req = CriterionBatchUpsertRequest(
            items=[_make_item("A", 0.33), _make_item("B", 0.33), _make_item("C", 0.34)]
        )
        assert len(req.items) == 3

    def test_valid_weights_at_epsilon_boundary(self):
        # sum = 1.009 is within 0.01 tolerance
        req = CriterionBatchUpsertRequest(
            items=[_make_item("A", 0.509), _make_item("B", 0.5)]
        )
        assert len(req.items) == 2

    def test_invalid_sum_too_low_raises(self):
        with pytest.raises(ValidationError, match="Sum of weights"):
            CriterionBatchUpsertRequest(
                items=[_make_item("A", 0.3), _make_item("B", 0.3)]
            )

    def test_invalid_sum_too_high_raises(self):
        with pytest.raises(ValidationError, match="Sum of weights"):
            CriterionBatchUpsertRequest(
                items=[_make_item("A", 0.8), _make_item("B", 0.8)]
            )

    def test_negative_weight_raises(self):
        with pytest.raises(ValidationError, match="non-negative"):
            CriterionBatchUpsertRequest(
                items=[_make_item("A", -0.1), _make_item("B", 1.1)]
            )

    def test_empty_items_allowed(self):
        req = CriterionBatchUpsertRequest(items=[])
        assert req.items == []

    def test_single_item_weight_one(self):
        req = CriterionBatchUpsertRequest(items=[_make_item("A", 1.0)])
        assert req.items[0].weight == 1.0
