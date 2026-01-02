from __future__ import annotations
import hashlib
import logging
import time
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, aliased
from sqlalchemy import text
from pydantic import BaseModel
from rq.job import Job

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    Evaluation,
    Allocation,
    Score,
    User,
    FeedbackSummary,
    SummaryGenerationJob,
)
from app.infra.services.ollama_service import OllamaService
from app.infra.services.anonymization_service import AnonymizationService
from app.infra.queue.connection import get_queue
from app.infra.queue.tasks import generate_ai_summary_task, batch_generate_summaries_task

router = APIRouter(prefix="/feedback-summaries", tags=["feedback-summaries"])
logger = logging.getLogger(__name__)

# Priority constants
PRIORITY_HIGH = "high"
PRIORITY_NORMAL = "normal"
PRIORITY_LOW = "low"
VALID_PRIORITIES = [PRIORITY_HIGH, PRIORITY_NORMAL, PRIORITY_LOW]

# Queue name constants
QUEUE_AI_SUMMARIES = "ai-summaries"
QUEUE_AI_SUMMARIES_HIGH = "ai-summaries-high"
QUEUE_AI_SUMMARIES_LOW = "ai-summaries-low"


class FeedbackSummaryResponse(BaseModel):
    student_id: int
    student_name: str
    summary_text: str
    generation_method: str  # "ai" | "fallback"
    feedback_count: int
    cached: bool


class JobStatusResponse(BaseModel):
    job_id: str
    status: str  # "queued" | "processing" | "completed" | "failed" | "cancelled"
    student_id: int
    evaluation_id: int
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    cancelled_at: Optional[str] = None
    result: Optional[dict] = None
    error_message: Optional[str] = None
    progress: int = 0
    priority: str = "normal"
    retry_count: int = 0
    max_retries: int = 3
    webhook_delivered: bool = False


class QueueJobRequest(BaseModel):
    priority: str = "normal"  # "high" | "normal" | "low"
    webhook_url: Optional[str] = None
    max_retries: int = 3


class BatchQueueRequest(BaseModel):
    student_ids: List[int]
    priority: str = "normal"
    webhook_url: Optional[str] = None


class RegenerateSummaryRequest(BaseModel):
    force: bool = True


class ScheduledJobRequest(BaseModel):
    name: str
    cron_expression: str
    task_params: dict
    enabled: bool = True


class ScheduledJobResponse(BaseModel):
    id: int
    name: str
    task_type: str
    queue_name: str
    cron_expression: str
    enabled: bool
    last_run_at: Optional[str] = None
    next_run_at: Optional[str] = None
    created_at: str


class QueueStatsResponse(BaseModel):
    queue_name: str
    queued_count: int
    processing_count: int
    completed_count: int
    failed_count: int
    cancelled_count: int
    workers_count: int


def _compute_feedback_hash(comments: List[str]) -> str:
    """Compute a hash of feedback comments for cache invalidation."""
    content = "|".join(sorted(comments))
    return hashlib.sha256(content.encode()).hexdigest()


@router.get("/evaluation/{evaluation_id}/student/{student_id}", response_model=FeedbackSummaryResponse)
def get_student_feedback_summary(
    evaluation_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get or generate AI summary of peer feedback for a student."""
    
    # Verify evaluation exists and user has access
    ev = (
        db.query(Evaluation)
        .filter(Evaluation.id == evaluation_id, Evaluation.school_id == user.school_id)
        .first()
    )
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    
    # Verify student exists and is in the school
    student = (
        db.query(User)
        .filter(User.id == student_id, User.school_id == user.school_id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get peer feedback comments for this student (received, not self)
    U_from = aliased(User)
    U_to = aliased(User)
    
    feedback_rows = (
        db.query(Score.comment, U_from.name)
        .join(Allocation, Allocation.id == Score.allocation_id)
        .join(U_to, U_to.id == Allocation.reviewee_id)
        .join(U_from, U_from.id == Allocation.reviewer_id)
        .filter(
            Allocation.school_id == user.school_id,
            Allocation.evaluation_id == evaluation_id,
            Allocation.reviewee_id == student_id,
            Allocation.is_self.is_(False),  # Only peer feedback
            Score.comment.isnot(None),
            Score.comment != "",
        )
        .all()
    )
    
    comments = [row.comment for row in feedback_rows if row.comment]
    reviewer_names = [row.name for row in feedback_rows if row.name]
    
    if not comments:
        # No feedback yet
        return FeedbackSummaryResponse(
            student_id=student_id,
            student_name=student.name,
            summary_text="Je hebt nog geen peer-feedback ontvangen. Zodra je teamgenoten hun beoordelingen hebben ingeleverd, verschijnt hier een samenvatting.",
            generation_method="empty",
            feedback_count=0,
            cached=False,
        )
    
    # Compute hash of current feedback
    feedback_hash = _compute_feedback_hash(comments)
    
    # Check if we have a cached summary
    cached_summary = (
        db.query(FeedbackSummary)
        .filter(
            FeedbackSummary.evaluation_id == evaluation_id,
            FeedbackSummary.student_id == student_id,
            FeedbackSummary.feedback_hash == feedback_hash,
        )
        .first()
    )
    
    if cached_summary:
        # Return cached summary
        return FeedbackSummaryResponse(
            student_id=student_id,
            student_name=student.name,
            summary_text=cached_summary.summary_text,
            generation_method=cached_summary.generation_method,
            feedback_count=len(comments),
            cached=True,
        )
    
    # Generate new summary
    # First anonymize the comments
    all_names = reviewer_names + [student.name]
    anonymizer = AnonymizationService()
    anonymized_comments = anonymizer.anonymize_comments(comments, all_names)
    
    if not anonymized_comments:
        anonymized_comments = comments  # Fallback if anonymization removed everything
    
    # Try AI generation
    ollama = OllamaService()
    start_time = time.time()
    
    try:
        ai_summary = ollama.generate_summary(
            feedback_comments=anonymized_comments,
            student_name=student.name,
            context=f"Evaluatie: {ev.title}",
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Exception during AI generation: {type(e).__name__}: {e}")
        ai_summary = None
    
    duration_ms = int((time.time() - start_time) * 1000)
    
    if ai_summary:
        summary_text = ai_summary
        method = "ai"
    else:
        # Fallback to rule-based summary
        summary_text = ollama.create_fallback_summary(anonymized_comments)
        method = "fallback"
    
    # Cache the summary
    # Delete old summary if exists
    db.query(FeedbackSummary).filter(
        FeedbackSummary.evaluation_id == evaluation_id,
        FeedbackSummary.student_id == student_id,
    ).delete()
    
    new_summary = FeedbackSummary(
        school_id=user.school_id,
        evaluation_id=evaluation_id,
        student_id=student_id,
        summary_text=summary_text,
        feedback_hash=feedback_hash,
        generation_method=method,
        generation_duration_ms=duration_ms,
    )
    db.add(new_summary)
    db.commit()
    
    return FeedbackSummaryResponse(
        student_id=student_id,
        student_name=student.name,
        summary_text=summary_text,
        generation_method=method,
        feedback_count=len(comments),
        cached=False,
    )


@router.post("/evaluation/{evaluation_id}/student/{student_id}/regenerate", response_model=FeedbackSummaryResponse)
def regenerate_student_feedback_summary(
    evaluation_id: int,
    student_id: int,
    payload: RegenerateSummaryRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Force regeneration of AI summary, bypassing cache."""
    
    # Delete existing cache
    db.query(FeedbackSummary).filter(
        FeedbackSummary.evaluation_id == evaluation_id,
        FeedbackSummary.student_id == student_id,
    ).delete()
    db.commit()
    
    # Call get endpoint to generate new summary
    return get_student_feedback_summary(evaluation_id, student_id, db, user)


@router.get("/evaluation/{evaluation_id}/student/{student_id}/quotes")
def get_student_feedback_quotes(
    evaluation_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get anonymized peer feedback quotes for a student."""
    
    # Verify evaluation exists
    ev = (
        db.query(Evaluation)
        .filter(Evaluation.id == evaluation_id, Evaluation.school_id == user.school_id)
        .first()
    )
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    
    # Get peer feedback comments
    U_from = aliased(User)
    
    feedback_rows = (
        db.query(Score.comment, Score.criterion_id, U_from.name)
        .join(Allocation, Allocation.id == Score.allocation_id)
        .join(U_from, U_from.id == Allocation.reviewer_id)
        .filter(
            Allocation.school_id == user.school_id,
            Allocation.evaluation_id == evaluation_id,
            Allocation.reviewee_id == student_id,
            Allocation.is_self.is_(False),
            Score.comment.isnot(None),
            Score.comment != "",
        )
        .all()
    )
    
    # Get student for anonymization
    student = db.query(User).filter(User.id == student_id).first()
    
    # Anonymize
    anonymizer = AnonymizationService()
    all_names = [row.name for row in feedback_rows if row.name]
    if student:
        all_names.append(student.name)
    
    quotes = []
    for row in feedback_rows:
        if row.comment:
            anonymized = anonymizer.anonymize_comments([row.comment], all_names)
            if anonymized:
                # Truncate long comments
                text = anonymized[0]
                if len(text) > 300:
                    text = text[:297] + "..."
                quotes.append({
                    "text": text,
                    "criterion_id": row.criterion_id,
                })
    
    return {"quotes": quotes, "count": len(quotes)}


# ============ Async Queue Endpoints ============

@router.post("/evaluation/{evaluation_id}/student/{student_id}/queue", response_model=JobStatusResponse)
def queue_summary_generation(
    evaluation_id: int,
    student_id: int,
    request: QueueJobRequest = QueueJobRequest(),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Queue an async job to generate AI summary for a student.
    Returns job status that can be polled.
    
    Supports:
    - Priority levels (high, normal, low)
    - Webhook notifications
    - Configurable retry count
    """
    # Verify evaluation exists
    ev = (
        db.query(Evaluation)
        .filter(Evaluation.id == evaluation_id, Evaluation.school_id == user.school_id)
        .first()
    )
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    
    # Verify student exists
    student = (
        db.query(User)
        .filter(User.id == student_id, User.school_id == user.school_id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Check if job already exists and is not failed or cancelled
    existing_job = (
        db.query(SummaryGenerationJob)
        .filter(
            SummaryGenerationJob.evaluation_id == evaluation_id,
            SummaryGenerationJob.student_id == student_id,
            SummaryGenerationJob.status.in_(["queued", "processing", "completed"]),
        )
        .order_by(SummaryGenerationJob.created_at.desc())
        .first()
    )
    
    if existing_job:
        # Return existing job status
        return JobStatusResponse(
            job_id=existing_job.job_id,
            status=existing_job.status,
            student_id=existing_job.student_id,
            evaluation_id=existing_job.evaluation_id,
            created_at=existing_job.created_at.isoformat(),
            started_at=existing_job.started_at.isoformat() if existing_job.started_at else None,
            completed_at=existing_job.completed_at.isoformat() if existing_job.completed_at else None,
            cancelled_at=existing_job.cancelled_at.isoformat() if existing_job.cancelled_at else None,
            result=existing_job.result,
            error_message=existing_job.error_message,
            progress=existing_job.progress,
            priority=existing_job.priority,
            retry_count=existing_job.retry_count,
            max_retries=existing_job.max_retries,
            webhook_delivered=existing_job.webhook_delivered,
        )
    
    # Validate priority
    if request.priority not in VALID_PRIORITIES:
        raise HTTPException(status_code=400, detail=f"Priority must be one of: {', '.join(VALID_PRIORITIES)}")
    
    # Create new job
    job_id = f"summary-{evaluation_id}-{student_id}-{int(time.time())}"
    
    # Determine queue name based on priority
    queue_name = QUEUE_AI_SUMMARIES
    if request.priority == PRIORITY_HIGH:
        queue_name = QUEUE_AI_SUMMARIES_HIGH
    elif request.priority == PRIORITY_LOW:
        queue_name = QUEUE_AI_SUMMARIES_LOW
    
    new_job_record = SummaryGenerationJob(
        school_id=user.school_id,
        evaluation_id=evaluation_id,
        student_id=student_id,
        job_id=job_id,
        status="queued",
        priority=request.priority,
        max_retries=request.max_retries,
        webhook_url=request.webhook_url,
        queue_name=queue_name,
    )
    db.add(new_job_record)
    db.commit()
    db.refresh(new_job_record)
    
    # Queue the job
    try:
        queue = get_queue(queue_name)
        rq_job = queue.enqueue(
            generate_ai_summary_task,
            school_id=user.school_id,
            evaluation_id=evaluation_id,
            student_id=student_id,
            job_id=job_id,
            job_timeout='10m',
            result_ttl=86400,  # Keep results for 24 hours
            failure_ttl=86400,
        )
        logger.info(
            f"Enqueued job {job_id} to queue '{queue_name}' "
            f"(RQ job ID: {rq_job.id}, student: {student_id}, evaluation: {evaluation_id})"
        )
    except Exception as e:
        # Update job status to failed
        new_job_record.status = "failed"
        new_job_record.error_message = f"Failed to queue job: {str(e)}"
        db.commit()
        logger.error(f"Failed to enqueue job {job_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to queue job: {str(e)}")
    
    return JobStatusResponse(
        job_id=job_id,
        status="queued",
        student_id=student_id,
        evaluation_id=evaluation_id,
        created_at=new_job_record.created_at.isoformat(),
        progress=new_job_record.progress,
        priority=new_job_record.priority,
        retry_count=new_job_record.retry_count,
        max_retries=new_job_record.max_retries,
        webhook_delivered=new_job_record.webhook_delivered,
    )


@router.get("/jobs/{job_id}/status", response_model=JobStatusResponse)
def get_job_status(
    job_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get status of a queued summary generation job."""
    job = (
        db.query(SummaryGenerationJob)
        .filter(
            SummaryGenerationJob.job_id == job_id,
            SummaryGenerationJob.school_id == user.school_id,
        )
        .first()
    )
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return JobStatusResponse(
        job_id=job.job_id,
        status=job.status,
        student_id=job.student_id,
        evaluation_id=job.evaluation_id,
        created_at=job.created_at.isoformat(),
        started_at=job.started_at.isoformat() if job.started_at else None,
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        cancelled_at=job.cancelled_at.isoformat() if job.cancelled_at else None,
        result=job.result,
        error_message=job.error_message,
        progress=job.progress,
        priority=job.priority,
        retry_count=job.retry_count,
        max_retries=job.max_retries,
        webhook_delivered=job.webhook_delivered,
    )


@router.post("/jobs/{job_id}/cancel")
def cancel_job(
    job_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Cancel a queued or processing job.
    
    Note: Jobs that are already processing may complete before cancellation takes effect.
    """
    job = (
        db.query(SummaryGenerationJob)
        .filter(
            SummaryGenerationJob.job_id == job_id,
            SummaryGenerationJob.school_id == user.school_id,
        )
        .first()
    )
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Check if job can be cancelled
    if job.status in ["completed", "failed", "cancelled"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel job with status '{job.status}'"
        )
    
    # Update job status
    job.status = "cancelled"
    job.cancelled_at = db.execute(text("SELECT NOW()")).scalar()
    job.cancelled_by = user.id
    db.commit()
    
    return {
        "message": "Job cancelled successfully",
        "job_id": job_id,
        "status": "cancelled",
    }


@router.post("/evaluation/{evaluation_id}/batch-queue")
def batch_queue_summaries(
    evaluation_id: int,
    payload: BatchQueueRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Queue summary generation for multiple students in an evaluation.
    Useful for teachers to pre-generate summaries for all students.
    
    Supports:
    - Priority levels
    - Webhook notifications
    """
    # Verify evaluation exists
    ev = (
        db.query(Evaluation)
        .filter(Evaluation.id == evaluation_id, Evaluation.school_id == user.school_id)
        .first()
    )
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    
    # Verify all students exist
    students = (
        db.query(User)
        .filter(
            User.id.in_(payload.student_ids),
            User.school_id == user.school_id,
        )
        .all()
    )
    
    if len(students) != len(payload.student_ids):
        raise HTTPException(status_code=400, detail="Some students not found")
    
    # Determine queue name based on priority
    queue_name = QUEUE_AI_SUMMARIES
    if payload.priority == PRIORITY_HIGH:
        queue_name = QUEUE_AI_SUMMARIES_HIGH
    elif payload.priority == PRIORITY_LOW:
        queue_name = QUEUE_AI_SUMMARIES_LOW
    
    # Queue jobs for each student
    queue = get_queue(queue_name)
    results = []
    
    for student_id in payload.student_ids:
        # Check if job already queued or completed
        existing_job = (
            db.query(SummaryGenerationJob)
            .filter(
                SummaryGenerationJob.evaluation_id == evaluation_id,
                SummaryGenerationJob.student_id == student_id,
                SummaryGenerationJob.status.in_(["queued", "processing", "completed"]),
            )
            .order_by(SummaryGenerationJob.created_at.desc())
            .first()
        )
        
        if existing_job:
            results.append({
                "student_id": student_id,
                "job_id": existing_job.job_id,
                "status": "already_exists" if existing_job.status == "completed" else "already_queued",
            })
            continue
        
        # Create and queue new job
        job_id = f"summary-{evaluation_id}-{student_id}-{int(time.time())}"
        
        new_job_record = SummaryGenerationJob(
            school_id=user.school_id,
            evaluation_id=evaluation_id,
            student_id=student_id,
            job_id=job_id,
            status="queued",
            priority=payload.priority,
            webhook_url=payload.webhook_url,
            queue_name=queue_name,
        )
        db.add(new_job_record)
        
        try:
            rq_job = queue.enqueue(
                generate_ai_summary_task,
                school_id=user.school_id,
                evaluation_id=evaluation_id,
                student_id=student_id,
                job_id=job_id,
                job_timeout='10m',
                result_ttl=86400,
                failure_ttl=86400,
            )
            logger.info(
                f"Batch: enqueued job {job_id} to queue '{queue_name}' "
                f"(RQ job ID: {rq_job.id}, student: {student_id})"
            )
            results.append({
                "student_id": student_id,
                "job_id": job_id,
                "status": "queued",
            })
        except Exception as e:
            logger.error(f"Batch: failed to enqueue job {job_id} for student {student_id}: {e}")
            new_job_record.status = "failed"
            new_job_record.error_message = f"Failed to queue: {str(e)}"
            results.append({
                "student_id": student_id,
                "status": "failed",
                "error": str(e),
            })
    
    db.commit()
    
    return {
        "evaluation_id": evaluation_id,
        "total_students": len(payload.student_ids),
        "queued": sum(1 for r in results if r["status"] == "queued"),
        "already_queued": sum(1 for r in results if r["status"] == "already_queued"),
        "failed": sum(1 for r in results if r["status"] == "failed"),
        "results": results,
    }


@router.get("/evaluation/{evaluation_id}/jobs")
def list_evaluation_jobs(
    evaluation_id: int,
    status: Optional[str] = Query(None, description="Filter by status"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """List all summary generation jobs for an evaluation."""
    query = db.query(SummaryGenerationJob).filter(
        SummaryGenerationJob.evaluation_id == evaluation_id,
        SummaryGenerationJob.school_id == user.school_id,
    )
    
    if status:
        query = query.filter(SummaryGenerationJob.status == status)
    
    jobs = query.order_by(SummaryGenerationJob.created_at.desc()).all()
    
    return {
        "evaluation_id": evaluation_id,
        "total": len(jobs),
        "jobs": [
            JobStatusResponse(
                job_id=job.job_id,
                status=job.status,
                student_id=job.student_id,
                evaluation_id=job.evaluation_id,
                created_at=job.created_at.isoformat(),
                started_at=job.started_at.isoformat() if job.started_at else None,
                completed_at=job.completed_at.isoformat() if job.completed_at else None,
                result=job.result,
                error_message=job.error_message,
                progress=job.progress,
                priority=job.priority,
                retry_count=job.retry_count,
                max_retries=job.max_retries,
                webhook_delivered=job.webhook_delivered,
            )
            for job in jobs
        ],
    }


# ============ Queue Monitoring & Dashboard ============

@router.get("/queue/stats", response_model=QueueStatsResponse)
def get_queue_stats(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Get statistics about the job queue.
    Used for monitoring dashboard.
    """
    from rq import Worker
    from app.infra.queue.connection import RedisConnection
    
    # Count jobs by status
    queued_count = db.query(SummaryGenerationJob).filter(
        SummaryGenerationJob.school_id == user.school_id,
        SummaryGenerationJob.status == "queued",
    ).count()
    
    processing_count = db.query(SummaryGenerationJob).filter(
        SummaryGenerationJob.school_id == user.school_id,
        SummaryGenerationJob.status == "processing",
    ).count()
    
    completed_count = db.query(SummaryGenerationJob).filter(
        SummaryGenerationJob.school_id == user.school_id,
        SummaryGenerationJob.status == "completed",
    ).count()
    
    failed_count = db.query(SummaryGenerationJob).filter(
        SummaryGenerationJob.school_id == user.school_id,
        SummaryGenerationJob.status == "failed",
    ).count()
    
    cancelled_count = db.query(SummaryGenerationJob).filter(
        SummaryGenerationJob.school_id == user.school_id,
        SummaryGenerationJob.status == "cancelled",
    ).count()
    
    # Count workers
    try:
        redis_conn = RedisConnection.get_connection()
        workers = Worker.all(connection=redis_conn)
        workers_count = len(workers)
    except Exception:
        workers_count = 0
    
    return QueueStatsResponse(
        queue_name="ai-summaries",
        queued_count=queued_count,
        processing_count=processing_count,
        completed_count=completed_count,
        failed_count=failed_count,
        cancelled_count=cancelled_count,
        workers_count=workers_count,
    )


@router.get("/queue/health")
def get_queue_health(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Health check endpoint for queue system.
    Returns worker status and queue metrics.
    """
    from rq import Worker, Queue
    from app.infra.queue.connection import RedisConnection
    
    try:
        redis_conn = RedisConnection.get_connection()
        
        # Check Redis connection
        redis_conn.ping()
        redis_healthy = True
        
        # Get worker info
        workers = Worker.all(connection=redis_conn)
        workers_info = []
        for w in workers:
            workers_info.append({
                "name": w.name,
                "state": w.get_state(),
                "current_job": w.get_current_job_id(),
            })
        
        # Get queue info
        queues_info = []
        for queue_name in ["ai-summaries-high", "ai-summaries", "ai-summaries-low"]:
            q = Queue(queue_name, connection=redis_conn)
            queues_info.append({
                "name": queue_name,
                "count": len(q),
            })
        
        return {
            "status": "healthy",
            "redis": "connected",
            "workers": workers_info,
            "queues": queues_info,
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
        }


# ============ Scheduled Jobs (Cron) ============

@router.post("/scheduled-jobs", response_model=ScheduledJobResponse)
def create_scheduled_job(
    request: ScheduledJobRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Create a new scheduled job with cron-like scheduling.
    
    Example cron expressions:
    - "0 2 * * *" - Daily at 2am
    - "0 */6 * * *" - Every 6 hours
    - "0 9 * * 1" - Every Monday at 9am
    """
    from app.infra.services.scheduler_service import SchedulerService
    from app.infra.db.models import ScheduledJob as ScheduledJobModel
    
    scheduler = SchedulerService(db)
    
    try:
        scheduled_job = scheduler.create_scheduled_job(
            school_id=user.school_id,
            name=request.name,
            task_type="generate_summary",
            queue_name="ai-summaries",
            cron_expression=request.cron_expression,
            task_params=request.task_params,
            enabled=request.enabled,
            created_by=user.id,
        )
        
        return ScheduledJobResponse(
            id=scheduled_job.id,
            name=scheduled_job.name,
            task_type=scheduled_job.task_type,
            queue_name=scheduled_job.queue_name,
            cron_expression=scheduled_job.cron_expression,
            enabled=scheduled_job.enabled,
            last_run_at=scheduled_job.last_run_at.isoformat() if scheduled_job.last_run_at else None,
            next_run_at=scheduled_job.next_run_at.isoformat() if scheduled_job.next_run_at else None,
            created_at=scheduled_job.created_at.isoformat(),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/scheduled-jobs")
def list_scheduled_jobs(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """List all scheduled jobs for the current school."""
    from app.infra.db.models import ScheduledJob as ScheduledJobModel
    
    jobs = db.query(ScheduledJobModel).filter(
        ScheduledJobModel.school_id == user.school_id,
    ).order_by(ScheduledJobModel.created_at.desc()).all()
    
    return {
        "total": len(jobs),
        "jobs": [
            ScheduledJobResponse(
                id=job.id,
                name=job.name,
                task_type=job.task_type,
                queue_name=job.queue_name,
                cron_expression=job.cron_expression,
                enabled=job.enabled,
                last_run_at=job.last_run_at.isoformat() if job.last_run_at else None,
                next_run_at=job.next_run_at.isoformat() if job.next_run_at else None,
                created_at=job.created_at.isoformat(),
            )
            for job in jobs
        ],
    }


@router.delete("/scheduled-jobs/{job_id}")
def delete_scheduled_job(
    job_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Delete a scheduled job."""
    from app.infra.services.scheduler_service import SchedulerService
    
    scheduler = SchedulerService(db)
    success = scheduler.delete_scheduled_job(job_id, user.school_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Scheduled job not found")
    
    return {"message": "Scheduled job deleted successfully"}


@router.patch("/scheduled-jobs/{job_id}")
def update_scheduled_job(
    job_id: int,
    enabled: Optional[bool] = None,
    cron_expression: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Update a scheduled job (enable/disable or change schedule)."""
    from app.infra.services.scheduler_service import SchedulerService
    
    updates = {}
    if enabled is not None:
        updates['enabled'] = enabled
    if cron_expression is not None:
        updates['cron_expression'] = cron_expression
    
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    scheduler = SchedulerService(db)
    
    try:
        job = scheduler.update_scheduled_job(job_id, user.school_id, **updates)
        if not job:
            raise HTTPException(status_code=404, detail="Scheduled job not found")
        
        return {
            "message": "Scheduled job updated successfully",
            "job_id": job.id,
            "enabled": job.enabled,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
