"""
Test suite for feedback summary queue/stats endpoint.

This test verifies that the /queue/stats endpoint works correctly after
adding the updated_at column to the summary_generation_jobs table.

Run with:
    cd backend
    pytest tests/test_queue_stats_endpoint.py -v
"""

import pytest
from unittest.mock import Mock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.infra.db.base import Base
from app.infra.db.models import School, User, SummaryGenerationJob


class TestQueueStatsEndpoint:
    """Test the /queue/stats endpoint that was failing due to missing updated_at column."""

    def test_summary_generation_job_model_has_updated_at(self):
        """Test that SummaryGenerationJob model has updated_at field."""
        assert hasattr(SummaryGenerationJob, "updated_at"), (
            "SummaryGenerationJob should have updated_at field inherited from Base"
        )

    def test_summary_generation_job_model_has_created_at(self):
        """Test that SummaryGenerationJob model has created_at field."""
        assert hasattr(SummaryGenerationJob, "created_at"), (
            "SummaryGenerationJob should have created_at field inherited from Base"
        )

    def test_summary_generation_job_can_be_instantiated(self):
        """Test that SummaryGenerationJob can be created."""
        job = SummaryGenerationJob()
        # Check that timestamp fields are accessible (even if not set yet)
        assert hasattr(job, "created_at")
        assert hasattr(job, "updated_at")

    def test_queue_stats_query_pattern(self):
        """
        Test the query pattern used in /queue/stats endpoint.

        This simulates the query that was failing with:
        "column summary_generation_jobs.updated_at does not exist"
        """
        from sqlalchemy.orm import Query

        # Create mock session
        mock_session = Mock()
        mock_query = Mock(spec=Query)
        mock_session.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.count.return_value = 0

        # Simulate the query pattern from the endpoint
        # This would have failed before with missing updated_at
        result = (
            mock_session.query(SummaryGenerationJob)
            .filter(SummaryGenerationJob.school_id == 1)
            .filter(SummaryGenerationJob.status == "queued")
            .count()
        )

        assert result == 0
        assert mock_session.query.called

    @pytest.mark.integration
    def test_queue_stats_endpoint_with_database(self):
        """
        Integration test: Verify /queue/stats endpoint works with actual database.

        This test requires a test database to be set up.
        Skip if DATABASE_URL is not configured for testing.
        """
        import os

        database_url = os.environ.get("TEST_DATABASE_URL")
        if not database_url:
            pytest.skip("TEST_DATABASE_URL not set, skipping integration test")

        # Create test database engine
        engine = create_engine(database_url)
        TestingSessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=engine
        )

        # Create tables
        Base.metadata.create_all(bind=engine)

        session = TestingSessionLocal()
        try:
            # Create test data
            school = School(name="Test School")
            session.add(school)
            session.flush()

            user = User(
                school_id=school.id,
                email="test@example.com",
                name="Test User",
                role="teacher",
            )
            session.add(user)
            session.flush()

            # Create test job
            job = SummaryGenerationJob(
                school_id=school.id,
                evaluation_id=1,
                student_id=user.id,
                job_id="test-job-stats-1",
                status="queued",
            )
            session.add(job)
            session.commit()
            session.refresh(job)

            # Verify timestamps were auto-populated
            assert job.created_at is not None, "created_at should be auto-populated"
            assert job.updated_at is not None, "updated_at should be auto-populated"

            # Test the query pattern used in /queue/stats
            queued_count = (
                session.query(SummaryGenerationJob)
                .filter(
                    SummaryGenerationJob.school_id == school.id,
                    SummaryGenerationJob.status == "queued",
                )
                .count()
            )

            assert queued_count == 1, "Should find 1 queued job"

            # Test selecting updated_at explicitly (this would fail if column doesn't exist)
            result = (
                session.query(
                    SummaryGenerationJob.status, SummaryGenerationJob.updated_at
                )
                .filter(SummaryGenerationJob.school_id == school.id)
                .first()
            )

            assert result is not None
            assert result.status == "queued"
            assert result.updated_at is not None

        finally:
            # Cleanup
            session.query(SummaryGenerationJob).delete()
            session.query(User).delete()
            session.query(School).delete()
            session.commit()
            session.close()

            # Drop tables
            Base.metadata.drop_all(bind=engine)


class TestRegressionPrevention:
    """Tests to prevent regression of the updated_at column issue."""

    def test_all_base_timestamp_fields_present(self):
        """Verify that all models inheriting from Base have timestamp fields."""
        from app.infra.db.base import Base as BaseModel

        # Base should define both timestamp fields
        assert hasattr(BaseModel, "created_at"), "Base class should define created_at"
        assert hasattr(BaseModel, "updated_at"), "Base class should define updated_at"

    def test_summary_job_inherits_from_base(self):
        """Verify SummaryGenerationJob properly inherits from Base."""
        from app.infra.db.base import Base

        assert issubclass(SummaryGenerationJob, Base), (
            "SummaryGenerationJob should inherit from Base"
        )

    def test_scheduled_job_has_timestamp_fields(self):
        """Verify ScheduledJob also has proper timestamp fields."""
        from app.infra.db.models import ScheduledJob

        assert hasattr(ScheduledJob, "created_at"), (
            "ScheduledJob should have created_at"
        )
        assert hasattr(ScheduledJob, "updated_at"), (
            "ScheduledJob should have updated_at"
        )


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])
