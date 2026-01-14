"""
Test suite for queue job_id parameter fix.

This test verifies that:
1. Jobs are enqueued with the correct custom job_id in RQ
2. The task function can retrieve the job_id from RQ context (not from parameters)
3. DB job records match RQ job IDs

Run with:
    cd backend
    pytest tests/test_queue_job_id_fix.py -v
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from app.infra.queue.tasks import generate_ai_summary_task
from app.infra.queue.connection import get_queue


class TestJobIdFix:
    """Test that job_id is correctly passed to RQ and retrieved in task."""
    
    def test_task_function_signature(self):
        """Test that generate_ai_summary_task doesn't expect job_id as parameter."""
        import inspect
        sig = inspect.signature(generate_ai_summary_task)
        params = list(sig.parameters.keys())
        
        # Task should accept school_id, evaluation_id, student_id
        assert 'school_id' in params
        assert 'evaluation_id' in params
        assert 'student_id' in params
        
        # Task should NOT expect job_id as a parameter (it gets it from RQ context)
        assert 'job_id' not in params, \
            "job_id should NOT be in task parameters (it's retrieved from RQ context)"
    
    @patch('app.infra.queue.tasks.get_current_job')
    @patch('app.infra.queue.tasks.SessionLocal')
    def test_task_retrieves_job_id_from_rq_context(self, mock_session_local, mock_get_current_job):
        """Test that task retrieves job_id from RQ's get_current_job()."""
        # Setup mock RQ job
        mock_job = Mock()
        mock_job.id = "test-job-123"
        mock_get_current_job.return_value = mock_job
        
        # Setup mock database
        mock_db = MagicMock()
        mock_session_local.return_value = mock_db
        
        # Mock the database query to return None (job not found, will raise ValueError)
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        # Call the task (will fail because job not in DB, but that's ok for this test)
        try:
            generate_ai_summary_task(
                school_id=1,
                evaluation_id=2,
                student_id=3,
                # NOTE: job_id is NOT passed as parameter
            )
        except ValueError as e:
            # Expected: job not found in DB
            assert "Job test-job-123 not found" in str(e)
        
        # Verify get_current_job was called
        mock_get_current_job.assert_called_once()
        
        # Verify database query used the job_id from RQ context
        mock_db.query.return_value.filter.assert_called()
    
    def test_enqueue_call_sets_rq_job_id(self):
        """Test that enqueue() call correctly sets the RQ job ID."""
        from rq import Queue
        
        # Test RQ's parameter parsing
        kwargs = {
            'school_id': 1,
            'evaluation_id': 2,
            'student_id': 3,
            'job_id': 'custom-job-456',  # RQ parameter
            'job_timeout': '10m',         # RQ parameter
            'result_ttl': 86400,          # RQ parameter
        }
        
        # Simulate what RQ's parse_args does
        parsed = Queue.parse_args(lambda: None, **kwargs)
        
        # Verify RQ extracts job_id
        job_id_from_parse = parsed[7]  # job_id is at index 7 in parse_args return
        assert job_id_from_parse == 'custom-job-456'
        
        # Verify remaining kwargs (passed to task) don't include job_id
        remaining_kwargs = parsed[-1]  # kwargs is last element
        assert 'job_id' not in remaining_kwargs
        assert 'job_timeout' not in remaining_kwargs
        assert 'result_ttl' not in remaining_kwargs
        
        # These should still be in kwargs for the task
        assert remaining_kwargs['school_id'] == 1
        assert remaining_kwargs['evaluation_id'] == 2
        assert remaining_kwargs['student_id'] == 3
    
    @patch('app.infra.queue.tasks.get_current_job')
    def test_task_raises_error_without_rq_context(self, mock_get_current_job):
        """Test that task raises clear error when run outside RQ worker."""
        # Simulate running outside RQ worker
        mock_get_current_job.return_value = None
        
        with pytest.raises(ValueError) as exc_info:
            generate_ai_summary_task(
                school_id=1,
                evaluation_id=2,
                student_id=3,
            )
        
        assert "Could not retrieve job_id from RQ context" in str(exc_info.value)
        assert "must be run via RQ worker" in str(exc_info.value)


class TestEnqueueIntegration:
    """Test the full enqueue flow with proper job_id handling."""
    
    @patch('app.infra.queue.connection.RedisConnection.get_connection')
    def test_enqueue_creates_job_with_custom_id(self, mock_get_connection):
        """Test that enqueuing creates an RQ job with our custom job_id."""
        from rq import Queue
        
        # Create a real Queue with mocked Redis
        mock_redis = MagicMock()
        mock_get_connection.return_value = mock_redis
        
        queue = get_queue('test-queue')
        
        # Mock the Queue's enqueue_call to verify parameters
        with patch.object(Queue, 'enqueue_call') as mock_enqueue_call:
            mock_job = Mock()
            mock_job.id = 'custom-job-789'
            mock_enqueue_call.return_value = mock_job
            
            # Enqueue a job (same way as in feedback_summary.py)
            queue.enqueue(
                generate_ai_summary_task,
                school_id=1,
                evaluation_id=2,
                student_id=3,
                job_id='custom-job-789',  # This should be used as RQ job ID
                job_timeout='10m',
                result_ttl=86400,
            )
            
            # Verify enqueue_call was called
            mock_enqueue_call.assert_called_once()
            
            # Verify job_id parameter was passed to enqueue_call
            call_kwargs = mock_enqueue_call.call_args[1]
            assert call_kwargs['job_id'] == 'custom-job-789'
            
            # Verify task kwargs don't include job_id (it's an RQ parameter, not task param)
            task_kwargs = call_kwargs['kwargs']
            assert 'job_id' not in task_kwargs
            assert task_kwargs['school_id'] == 1
            assert task_kwargs['evaluation_id'] == 2
            assert task_kwargs['student_id'] == 3


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
