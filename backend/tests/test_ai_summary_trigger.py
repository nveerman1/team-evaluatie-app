"""
Unit tests for the automatic AI-summary batch-generation trigger.

Tests the private helper ``_trigger_batch_summary_generation`` and the
``update_status`` endpoint that calls it when an evaluation is published
(status → "closed").

All tests are pure-mock unit tests — no database or Redis required.
"""

from __future__ import annotations

import pytest
from unittest.mock import MagicMock, Mock, call, patch

from app.infra.db.models import Allocation, Evaluation, SummaryGenerationJob
from app.api.v1.routers.evaluations import (
    _trigger_batch_summary_generation,
    update_status,
)
from app.api.v1.schemas.evaluations import EvaluationUpdateStatus

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_db(reviewee_ids: list[int], existing_job: object = None) -> MagicMock:
    """
    Build a mock SQLAlchemy session whose query chain satisfies the two calls
    made inside ``_trigger_batch_summary_generation``:

    1. ``db.query(Allocation.reviewee_id).filter(...).distinct().all()``
       → returns [(id,), ...] rows.

    2. ``db.query(SummaryGenerationJob).filter(...).order_by(...).first()``
       → returns *existing_job* (None means no pre-existing job).
    """
    db = MagicMock()

    # Each call to db.query() returns a fresh mock so we can chain differently.
    allocation_query = MagicMock()
    allocation_query.filter.return_value.distinct.return_value.all.return_value = [
        (sid,) for sid in reviewee_ids
    ]

    job_query = MagicMock()
    job_query.filter.return_value.order_by.return_value.first.return_value = (
        existing_job
    )

    db.query.side_effect = lambda model: (
        allocation_query if model is Allocation.reviewee_id else job_query
    )

    return db


# ---------------------------------------------------------------------------
# Tests for _trigger_batch_summary_generation
# ---------------------------------------------------------------------------


class TestTriggerBatchSummaryGeneration:
    """Tests for the private batch-trigger helper."""

    # ------------------------------------------------------------------
    # Happy path
    # ------------------------------------------------------------------

    @patch("app.api.v1.routers.evaluations.get_queue")
    def test_creates_job_records_and_enqueues_for_each_student(self, mock_get_queue):
        """Each student without an existing job gets a DB record + an enqueue call."""
        mock_queue = MagicMock()
        mock_get_queue.return_value = mock_queue

        db = _make_db(reviewee_ids=[10, 20, 30])

        _trigger_batch_summary_generation(db=db, evaluation_id=1, school_id=99)

        # Three job records added to the session
        assert db.add.call_count == 3

        # Queue requested once with the correct name
        mock_get_queue.assert_called_once_with("ai-summaries")

        # One enqueue call per student
        assert mock_queue.enqueue.call_count == 3

        # Verify the kwargs passed to enqueue for every student
        for c in mock_queue.enqueue.call_args_list:
            kwargs = c.kwargs
            assert kwargs["school_id"] == 99
            assert kwargs["evaluation_id"] == 1
            assert kwargs["student_id"] in {10, 20, 30}
            assert kwargs["job_id"].startswith("summary-1-")

        # Session committed at the end
        db.commit.assert_called()

    @patch("app.api.v1.routers.evaluations.get_queue")
    def test_job_records_have_correct_initial_fields(self, mock_get_queue):
        """Created SummaryGenerationJob records have the expected field values."""
        mock_queue = MagicMock()
        mock_get_queue.return_value = mock_queue

        db = _make_db(reviewee_ids=[5])
        added_jobs: list[SummaryGenerationJob] = []
        db.add.side_effect = added_jobs.append

        _trigger_batch_summary_generation(db=db, evaluation_id=7, school_id=3)

        assert len(added_jobs) == 1
        job = added_jobs[0]
        assert job.school_id == 3
        assert job.evaluation_id == 7
        assert job.student_id == 5
        assert job.status == "queued"
        assert job.priority == "normal"
        assert job.queue_name == "ai-summaries"
        assert job.job_id.startswith("summary-7-5-")

    # ------------------------------------------------------------------
    # No students
    # ------------------------------------------------------------------

    @patch("app.api.v1.routers.evaluations.get_queue")
    def test_no_students_returns_early_without_touching_queue(self, mock_get_queue):
        """When there are no allocations the function exits early."""
        mock_queue = MagicMock()
        mock_get_queue.return_value = mock_queue

        db = _make_db(reviewee_ids=[])

        _trigger_batch_summary_generation(db=db, evaluation_id=1, school_id=1)

        # Queue should not even be obtained
        mock_get_queue.assert_not_called()
        mock_queue.enqueue.assert_not_called()
        db.add.assert_not_called()

    # ------------------------------------------------------------------
    # Idempotency
    # ------------------------------------------------------------------

    @patch("app.api.v1.routers.evaluations.get_queue")
    def test_skips_student_with_existing_active_job(self, mock_get_queue):
        """A student who already has a queued/processing/completed job is skipped."""
        mock_queue = MagicMock()
        mock_get_queue.return_value = mock_queue

        existing_job = Mock(spec=SummaryGenerationJob)
        existing_job.status = "queued"

        db = _make_db(reviewee_ids=[42], existing_job=existing_job)

        _trigger_batch_summary_generation(db=db, evaluation_id=2, school_id=1)

        db.add.assert_not_called()
        mock_queue.enqueue.assert_not_called()

    @patch("app.api.v1.routers.evaluations.get_queue")
    def test_partial_idempotency_only_new_students_enqueued(self, mock_get_queue):
        """Students with an existing job are skipped; others are processed normally."""
        mock_queue = MagicMock()
        mock_get_queue.return_value = mock_queue

        existing_job = Mock(spec=SummaryGenerationJob)
        existing_job.status = "completed"

        # First student already has a job; second does not.
        job_query = MagicMock()
        job_query.filter.return_value.order_by.return_value.first.side_effect = [
            existing_job,  # student 1 → skip
            None,  # student 2 → create
        ]

        allocation_query = MagicMock()
        allocation_query.filter.return_value.distinct.return_value.all.return_value = [
            (1,),
            (2,),
        ]

        db = MagicMock()
        db.query.side_effect = lambda model: (
            allocation_query if model is Allocation.reviewee_id else job_query
        )

        _trigger_batch_summary_generation(db=db, evaluation_id=3, school_id=1)

        assert db.add.call_count == 1
        assert mock_queue.enqueue.call_count == 1
        enqueued_student = mock_queue.enqueue.call_args.kwargs["student_id"]
        assert enqueued_student == 2

    # ------------------------------------------------------------------
    # Enqueue failure
    # ------------------------------------------------------------------

    @patch("app.api.v1.routers.evaluations.get_queue")
    def test_enqueue_failure_marks_job_as_failed(self, mock_get_queue):
        """If the queue raises an exception the job record is marked 'failed'."""
        mock_queue = MagicMock()
        mock_queue.enqueue.side_effect = ConnectionError("Redis unreachable")
        mock_get_queue.return_value = mock_queue

        db = _make_db(reviewee_ids=[7])
        added_jobs: list[SummaryGenerationJob] = []
        db.add.side_effect = added_jobs.append

        # Should not propagate the exception
        _trigger_batch_summary_generation(db=db, evaluation_id=4, school_id=1)

        assert len(added_jobs) == 1
        job = added_jobs[0]
        assert job.status == "failed"
        assert "Failed to queue" in job.error_message
        # Session still committed (job record is persisted)
        db.commit.assert_called()

    @patch("app.api.v1.routers.evaluations.get_queue")
    def test_enqueue_failure_does_not_affect_other_students(self, mock_get_queue):
        """A single enqueue failure should not prevent other students from being queued."""
        mock_queue = MagicMock()
        # First call fails, second succeeds
        mock_queue.enqueue.side_effect = [ConnectionError("fail"), MagicMock()]
        mock_get_queue.return_value = mock_queue

        job_query = MagicMock()
        job_query.filter.return_value.order_by.return_value.first.return_value = None

        allocation_query = MagicMock()
        allocation_query.filter.return_value.distinct.return_value.all.return_value = [
            (1,),
            (2,),
        ]

        db = MagicMock()
        db.query.side_effect = lambda model: (
            allocation_query if model is Allocation.reviewee_id else job_query
        )

        added_jobs: list[SummaryGenerationJob] = []
        db.add.side_effect = added_jobs.append

        _trigger_batch_summary_generation(db=db, evaluation_id=5, school_id=1)

        assert len(added_jobs) == 2
        failed = [j for j in added_jobs if j.status == "failed"]
        queued = [j for j in added_jobs if j.status == "queued"]
        assert len(failed) == 1
        assert len(queued) == 1


# ---------------------------------------------------------------------------
# Tests for update_status endpoint (trigger integration)
# ---------------------------------------------------------------------------


class TestUpdateStatusTrigger:
    """Tests that verify update_status fires (or skips) the batch trigger."""

    def _make_evaluation(self, status: str) -> Mock:
        ev = Mock(spec=Evaluation)
        ev.id = 1
        ev.school_id = 1
        ev.status = status
        ev.title = "Test Evaluation"
        ev.settings = None
        ev.rubric_id = None
        ev.created_at = None
        ev.updated_at = None
        return ev

    def _make_user(self) -> Mock:
        user = Mock()
        user.school_id = 1
        return user

    @patch("app.api.v1.routers.evaluations._trigger_batch_summary_generation")
    @patch("app.api.v1.routers.evaluations._to_out")
    def test_trigger_called_when_transitioning_to_closed(
        self, mock_to_out, mock_trigger
    ):
        """Closing an open evaluation fires the batch trigger."""
        db = MagicMock()
        ev = self._make_evaluation("open")
        db.query.return_value.filter.return_value.first.return_value = ev
        mock_to_out.return_value = Mock()

        payload = EvaluationUpdateStatus(status="closed")

        update_status(evaluation_id=1, payload=payload, db=db, user=self._make_user())

        mock_trigger.assert_called_once_with(db=db, evaluation_id=1, school_id=1)

    @patch("app.api.v1.routers.evaluations._trigger_batch_summary_generation")
    @patch("app.api.v1.routers.evaluations._to_out")
    def test_trigger_not_called_when_already_closed(self, mock_to_out, mock_trigger):
        """Re-closing an already-closed evaluation does NOT re-fire the trigger."""
        db = MagicMock()
        ev = self._make_evaluation("closed")
        db.query.return_value.filter.return_value.first.return_value = ev
        mock_to_out.return_value = Mock()

        payload = EvaluationUpdateStatus(status="closed")

        update_status(evaluation_id=1, payload=payload, db=db, user=self._make_user())

        mock_trigger.assert_not_called()

    @patch("app.api.v1.routers.evaluations._trigger_batch_summary_generation")
    @patch("app.api.v1.routers.evaluations._to_out")
    def test_trigger_not_called_when_status_is_open(self, mock_to_out, mock_trigger):
        """Setting status to 'open' does not trigger summary generation."""
        db = MagicMock()
        ev = self._make_evaluation("draft")
        db.query.return_value.filter.return_value.first.return_value = ev
        mock_to_out.return_value = Mock()

        payload = EvaluationUpdateStatus(status="open")

        update_status(evaluation_id=1, payload=payload, db=db, user=self._make_user())

        mock_trigger.assert_not_called()

    @patch("app.api.v1.routers.evaluations._trigger_batch_summary_generation")
    @patch("app.api.v1.routers.evaluations._to_out")
    def test_trigger_not_called_when_status_is_draft(self, mock_to_out, mock_trigger):
        """Setting status to 'draft' does not trigger summary generation."""
        db = MagicMock()
        ev = self._make_evaluation("open")
        db.query.return_value.filter.return_value.first.return_value = ev
        mock_to_out.return_value = Mock()

        payload = EvaluationUpdateStatus(status="draft")

        update_status(evaluation_id=1, payload=payload, db=db, user=self._make_user())

        mock_trigger.assert_not_called()

    def test_raises_404_when_evaluation_not_found(self):
        """update_status raises 404 if the evaluation does not exist."""
        from fastapi import HTTPException

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        payload = EvaluationUpdateStatus(status="closed")

        with pytest.raises(HTTPException) as exc_info:
            update_status(
                evaluation_id=999, payload=payload, db=db, user=self._make_user()
            )

        assert exc_info.value.status_code == 404
