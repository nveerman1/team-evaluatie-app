"""
Tests for per-goal reflection functionality
"""
import pytest
from app.api.v1.schemas.competencies import (
    CompetencyReflectionCreate,
    CompetencyReflectionBulkCreate,
    CompetencyReflectionItemCreate,
)


def test_reflection_schemas():
    """Test that reflection schemas require goal_id"""
    # Test single reflection schema
    single = CompetencyReflectionCreate(
        window_id=1,
        goal_id=1,
        text="Test reflection text",
        goal_achieved=True,
        evidence="Test evidence",
    )
    assert single.goal_id == 1
    assert single.text == "Test reflection text"

    # Test bulk reflection schema
    bulk = CompetencyReflectionBulkCreate(
        window_id=1,
        reflections=[
            CompetencyReflectionItemCreate(
                goal_id=1,
                text="First reflection",
                goal_achieved=True,
            ),
            CompetencyReflectionItemCreate(
                goal_id=2,
                text="Second reflection",
                goal_achieved=False,
                evidence="Some evidence",
            ),
        ],
    )
    assert bulk.window_id == 1
    assert len(bulk.reflections) == 2
    assert bulk.reflections[0].goal_id == 1
    assert bulk.reflections[1].goal_id == 2


def test_reflection_goal_id_required():
    """Test that goal_id is required in reflection schemas"""
    # This should fail if goal_id is not provided
    with pytest.raises((TypeError, ValueError)):
        CompetencyReflectionCreate(
            window_id=1,
            text="Test reflection without goal",
        )


def test_bulk_reflection_item_requires_goal_id():
    """Test that individual bulk reflection items require goal_id"""
    with pytest.raises((TypeError, ValueError)):
        CompetencyReflectionItemCreate(
            text="Test reflection without goal",
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
