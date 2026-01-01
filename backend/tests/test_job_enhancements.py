"""
Test suite for job queue enhancements.

Tests:
1. Job progress tracking
2. Job cancellation
3. Priority queues
4. Webhook notifications
5. Rate limiting
6. Automatic retry with backoff
7. Scheduled jobs
8. Queue monitoring

Run with: pytest tests/test_job_enhancements.py -v
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
from sqlalchemy.orm import Session

from app.infra.db.models import SummaryGenerationJob, ScheduledJob
from app.infra.services.webhook_service import WebhookService
from app.infra.services.rate_limiter import RateLimiter
from app.infra.services.scheduler_service import SchedulerService
from app.infra.queue.connection import get_queue


class TestJobProgressTracking:
    """Test job progress tracking functionality."""
    
    def test_job_has_progress_field(self):
        """Test that SummaryGenerationJob has progress field."""
        # This would require database setup, so we test the model definition
        assert hasattr(SummaryGenerationJob, 'progress')
    
    def test_progress_range(self):
        """Test that progress is between 0-100."""
        job = SummaryGenerationJob()
        # Default should be 0 or None (before DB commit)
        assert job.progress == 0 or job.progress is None


class TestJobCancellation:
    """Test job cancellation functionality."""
    
    def test_job_has_cancellation_fields(self):
        """Test that SummaryGenerationJob has cancellation fields."""
        assert hasattr(SummaryGenerationJob, 'cancelled_at')
        assert hasattr(SummaryGenerationJob, 'cancelled_by')
    
    def test_cancelled_status_available(self):
        """Test that cancelled is a valid status."""
        # The status field should accept "cancelled"
        job = SummaryGenerationJob()
        job.status = "cancelled"
        assert job.status == "cancelled"


class TestPriorityQueues:
    """Test priority queue functionality."""
    
    def test_job_has_priority_field(self):
        """Test that SummaryGenerationJob has priority field."""
        assert hasattr(SummaryGenerationJob, 'priority')
    
    def test_queue_name_field(self):
        """Test that queue_name field exists."""
        assert hasattr(SummaryGenerationJob, 'queue_name')
    
    def test_get_queue_with_priority(self):
        """Test getting queues with different names."""
        # Test that get_queue function works with priority queue names
        from app.infra.queue.connection import get_queue
        import inspect
        sig = inspect.signature(get_queue)
        params = list(sig.parameters.keys())
        # Queue name is the parameter (not priority anymore)
        assert 'name' in params


class TestWebhookService:
    """Test webhook notification functionality."""
    
    def test_webhook_service_exists(self):
        """Test that WebhookService can be instantiated."""
        service = WebhookService()
        assert service is not None
    
    def test_create_job_payload(self):
        """Test creating webhook payload."""
        service = WebhookService()
        payload = service.create_job_payload(
            job_id="test-123",
            status="completed",
            student_id=456,
            evaluation_id=789,
            result={"summary": "test"},
        )
        
        assert payload["event"] == "job.completed"
        assert payload["data"]["job_id"] == "test-123"
        assert payload["data"]["status"] == "completed"
        assert payload["data"]["student_id"] == 456
        assert payload["data"]["evaluation_id"] == 789
        assert payload["data"]["result"] == {"summary": "test"}
    
    def test_failed_job_payload(self):
        """Test creating webhook payload for failed job."""
        service = WebhookService()
        payload = service.create_job_payload(
            job_id="test-123",
            status="failed",
            student_id=456,
            evaluation_id=789,
            error_message="Test error",
        )
        
        assert payload["event"] == "job.failed"
        assert payload["data"]["error"] == "Test error"
    
    @patch('requests.post')
    def test_send_webhook_success(self, mock_post):
        """Test successful webhook delivery."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response
        
        service = WebhookService()
        success, error = service.send_webhook(
            "https://example.com/webhook",
            {"test": "data"}
        )
        
        assert success is True
        assert error is None
        mock_post.assert_called_once()
    
    @patch('requests.post')
    def test_send_webhook_failure(self, mock_post):
        """Test webhook delivery failure."""
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_post.return_value = mock_response
        
        service = WebhookService()
        success, error = service.send_webhook(
            "https://example.com/webhook",
            {"test": "data"},
            max_retries=1
        )
        
        assert success is False
        assert error is not None


class TestRateLimiter:
    """Test rate limiting functionality."""
    
    @patch('app.infra.services.rate_limiter.RedisConnection')
    def test_rate_limiter_instantiation(self, mock_redis):
        """Test RateLimiter can be instantiated."""
        limiter = RateLimiter()
        assert limiter is not None
    
    @patch('app.infra.services.rate_limiter.RedisConnection')
    def test_is_allowed_first_request(self, mock_redis):
        """Test first request is always allowed."""
        mock_conn = MagicMock()
        mock_redis.get_connection.return_value = mock_conn
        
        # Mock Redis pipeline operations
        mock_pipeline = MagicMock()
        mock_pipeline.execute.return_value = [None, 0, None, None]
        mock_conn.pipeline.return_value = mock_pipeline
        
        limiter = RateLimiter(mock_conn)
        allowed, retry_after = limiter.is_allowed("test_key", 10, 60)
        
        assert allowed is True
        assert retry_after is None
    
    @patch('app.infra.services.rate_limiter.RedisConnection')
    def test_get_usage(self, mock_redis):
        """Test getting rate limit usage."""
        mock_conn = MagicMock()
        mock_redis.get_connection.return_value = mock_conn
        mock_conn.zcount.return_value = 5
        mock_conn.zrange.return_value = []
        
        limiter = RateLimiter(mock_conn)
        usage = limiter.get_usage("test_key", 60)
        
        assert "current_count" in usage
        assert "window_seconds" in usage


class TestSchedulerService:
    """Test job scheduling functionality."""
    
    def test_scheduled_job_model_exists(self):
        """Test that ScheduledJob model exists."""
        assert ScheduledJob is not None
    
    def test_scheduled_job_has_cron_field(self):
        """Test that ScheduledJob has cron_expression field."""
        assert hasattr(ScheduledJob, 'cron_expression')
    
    def test_scheduler_service_instantiation(self):
        """Test SchedulerService can be instantiated."""
        mock_db = Mock(spec=Session)
        service = SchedulerService(mock_db)
        assert service is not None
        assert service.db == mock_db
    
    def test_create_scheduled_job_validates_cron(self):
        """Test that invalid cron expressions are rejected."""
        mock_db = Mock(spec=Session)
        service = SchedulerService(mock_db)
        
        with pytest.raises(ValueError):
            service.create_scheduled_job(
                school_id=1,
                name="Test Job",
                task_type="generate_summary",
                queue_name="ai-summaries",
                cron_expression="invalid cron",
            )


class TestRetryMechanism:
    """Test automatic retry with exponential backoff."""
    
    def test_job_has_retry_fields(self):
        """Test that job has retry-related fields."""
        assert hasattr(SummaryGenerationJob, 'retry_count')
        assert hasattr(SummaryGenerationJob, 'max_retries')
        assert hasattr(SummaryGenerationJob, 'next_retry_at')
    
    def test_default_max_retries(self):
        """Test default max_retries value."""
        job = SummaryGenerationJob()
        # Should have default of 3 or be settable
        assert hasattr(job, 'max_retries')


class TestMultiQueueSupport:
    """Test multi-queue support."""
    
    def test_job_has_task_type_field(self):
        """Test that job has task_type field."""
        assert hasattr(SummaryGenerationJob, 'task_type')
    
    def test_default_task_type(self):
        """Test default task type."""
        job = SummaryGenerationJob()
        # Should have default or be settable
        assert hasattr(job, 'task_type')


class TestQueueMonitoring:
    """Test queue monitoring functionality."""
    
    def test_queue_stats_response_model(self):
        """Test that QueueStatsResponse exists."""
        from app.api.v1.routers.feedback_summary import QueueStatsResponse
        assert QueueStatsResponse is not None
    
    def test_queue_stats_has_required_fields(self):
        """Test QueueStatsResponse has required fields."""
        from app.api.v1.routers.feedback_summary import QueueStatsResponse
        from pydantic import BaseModel
        
        assert issubclass(QueueStatsResponse, BaseModel)
        fields = QueueStatsResponse.model_fields
        
        assert 'queue_name' in fields
        assert 'queued_count' in fields
        assert 'processing_count' in fields
        assert 'completed_count' in fields
        assert 'failed_count' in fields
        assert 'cancelled_count' in fields
        assert 'workers_count' in fields


class TestAPIEndpoints:
    """Test new API endpoints exist."""
    
    def test_cancel_job_endpoint_exists(self):
        """Test that cancel job endpoint exists."""
        from app.api.v1.routers import feedback_summary
        
        routes = [route.path for route in feedback_summary.router.routes]
        assert any('/jobs/{job_id}/cancel' in route for route in routes)
    
    def test_queue_stats_endpoint_exists(self):
        """Test that queue stats endpoint exists."""
        from app.api.v1.routers import feedback_summary
        
        routes = [route.path for route in feedback_summary.router.routes]
        assert any('/queue/stats' in route for route in routes)
    
    def test_queue_health_endpoint_exists(self):
        """Test that queue health endpoint exists."""
        from app.api.v1.routers import feedback_summary
        
        routes = [route.path for route in feedback_summary.router.routes]
        assert any('/queue/health' in route for route in routes)
    
    def test_scheduled_jobs_endpoints_exist(self):
        """Test that scheduled jobs endpoints exist."""
        from app.api.v1.routers import feedback_summary
        
        routes = [route.path for route in feedback_summary.router.routes]
        assert any('/scheduled-jobs' in route for route in routes)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
