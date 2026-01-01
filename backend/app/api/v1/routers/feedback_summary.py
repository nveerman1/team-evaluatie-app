from __future__ import annotations
import hashlib
import time
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, aliased
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


class FeedbackSummaryResponse(BaseModel):
    student_id: int
    student_name: str
    summary_text: str
    generation_method: str  # "ai" | "fallback"
    feedback_count: int
    cached: bool


class JobStatusResponse(BaseModel):
    job_id: str
    status: str  # "queued" | "processing" | "completed" | "failed"
    student_id: int
    evaluation_id: int
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    result: Optional[dict] = None
    error_message: Optional[str] = None


class QueueSummaryRequest(BaseModel):
    async_mode: bool = True


class BatchQueueRequest(BaseModel):
    student_ids: List[int]


class RegenerateSummaryRequest(BaseModel):
    force: bool = True


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
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Queue an async job to generate AI summary for a student.
    Returns job status that can be polled.
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
    
    # Check if job already exists and is not failed
    existing_job = (
        db.query(SummaryGenerationJob)
        .filter(
            SummaryGenerationJob.evaluation_id == evaluation_id,
            SummaryGenerationJob.student_id == student_id,
            SummaryGenerationJob.status.in_(["queued", "processing"]),
        )
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
            result=existing_job.result,
            error_message=existing_job.error_message,
        )
    
    # Create new job
    job_id = f"summary-{evaluation_id}-{student_id}-{int(time.time())}"
    
    new_job_record = SummaryGenerationJob(
        school_id=user.school_id,
        evaluation_id=evaluation_id,
        student_id=student_id,
        job_id=job_id,
        status="queued",
    )
    db.add(new_job_record)
    db.commit()
    db.refresh(new_job_record)
    
    # Queue the job
    try:
        queue = get_queue('ai-summaries')
        job = queue.enqueue(
            generate_ai_summary_task,
            school_id=user.school_id,
            evaluation_id=evaluation_id,
            student_id=student_id,
            job_id=job_id,
            job_timeout='10m',
            result_ttl=86400,  # Keep results for 24 hours
            failure_ttl=86400,
        )
    except Exception as e:
        # Update job status to failed
        new_job_record.status = "failed"
        new_job_record.error_message = f"Failed to queue job: {str(e)}"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to queue job: {str(e)}")
    
    return JobStatusResponse(
        job_id=job_id,
        status="queued",
        student_id=student_id,
        evaluation_id=evaluation_id,
        created_at=new_job_record.created_at.isoformat(),
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
        result=job.result,
        error_message=job.error_message,
    )


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
    
    # Queue jobs for each student
    queue = get_queue('ai-summaries')
    results = []
    
    for student_id in payload.student_ids:
        # Check if job already queued
        existing_job = (
            db.query(SummaryGenerationJob)
            .filter(
                SummaryGenerationJob.evaluation_id == evaluation_id,
                SummaryGenerationJob.student_id == student_id,
                SummaryGenerationJob.status.in_(["queued", "processing"]),
            )
            .first()
        )
        
        if existing_job:
            results.append({
                "student_id": student_id,
                "job_id": existing_job.job_id,
                "status": "already_queued",
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
        )
        db.add(new_job_record)
        
        try:
            job = queue.enqueue(
                generate_ai_summary_task,
                school_id=user.school_id,
                evaluation_id=evaluation_id,
                student_id=student_id,
                job_id=job_id,
                job_timeout='10m',
                result_ttl=86400,
                failure_ttl=86400,
            )
            results.append({
                "student_id": student_id,
                "job_id": job_id,
                "status": "queued",
            })
        except Exception as e:
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
            )
            for job in jobs
        ],
    }
