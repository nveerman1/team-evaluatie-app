"""Background tasks for queue processing."""
from __future__ import annotations

import logging
import time
from typing import Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session, aliased
from rq import get_current_job

from app.infra.db.session import SessionLocal
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
from app.infra.services.webhook_service import WebhookService
import hashlib

logger = logging.getLogger(__name__)


def _compute_feedback_hash(comments: list[str]) -> str:
    """Compute a hash of feedback comments for cache invalidation."""
    content = "|".join(sorted(comments))
    return hashlib.sha256(content.encode()).hexdigest()


def _update_job_progress(db: Session, job: SummaryGenerationJob, progress: int):
    """Update job progress."""
    if job and 0 <= progress <= 100:
        job.progress = progress
        db.commit()


def generate_ai_summary_task(
    school_id: int,
    evaluation_id: int,
    student_id: int,
) -> dict:
    """
    Background task to generate AI summary for a student's peer feedback.
    
    Args:
        school_id: School ID for multi-tenant isolation
        evaluation_id: Evaluation ID
        student_id: Student ID
        
    Returns:
        dict with status and summary information
        
    Note:
        The job_id is retrieved from RQ's current job context, not passed as a parameter.
        This is because RQ's enqueue() pops job_id from kwargs to use it for the RQ Job ID.
    """
    db = SessionLocal()
    start_time = time.time()
    
    # Get job_id from RQ job context
    current_job = get_current_job()
    job_id = current_job.id if current_job else None
    
    if not job_id:
        raise ValueError("Could not retrieve job_id from RQ context. Task must be run via RQ worker.")
    
    try:
        logger.info(f"[Job {job_id}] Starting AI summary generation for student {student_id} in evaluation {evaluation_id}")
        
        # Update job status to processing
        job = db.query(SummaryGenerationJob).filter(
            SummaryGenerationJob.job_id == job_id
        ).first()
        
        if not job:
            raise ValueError(f"Job {job_id} not found")
        
        # Check if job was cancelled
        if job.status == "cancelled":
            logger.info(f"Job {job_id} was cancelled, skipping")
            return {
                "status": "cancelled",
                "student_id": student_id,
                "evaluation_id": evaluation_id,
            }
        
        job.status = "processing"
        job.started_at = db.execute("SELECT NOW()").scalar()
        job.progress = 10
        db.commit()
        
        # Verify evaluation exists
        ev = (
            db.query(Evaluation)
            .filter(Evaluation.id == evaluation_id, Evaluation.school_id == school_id)
            .first()
        )
        if not ev:
            raise ValueError(f"Evaluation {evaluation_id} not found")
        
        _update_job_progress(db, job, 20)
        
        # Verify student exists
        student = (
            db.query(User)
            .filter(User.id == student_id, User.school_id == school_id)
            .first()
        )
        if not student:
            raise ValueError(f"Student {student_id} not found")
        
        _update_job_progress(db, job, 30)
        
        # Get peer feedback comments
        U_from = aliased(User)
        U_to = aliased(User)
        
        feedback_rows = (
            db.query(Score.comment, U_from.name)
            .join(Allocation, Allocation.id == Score.allocation_id)
            .join(U_to, U_to.id == Allocation.reviewee_id)
            .join(U_from, U_from.id == Allocation.reviewer_id)
            .filter(
                Allocation.school_id == school_id,
                Allocation.evaluation_id == evaluation_id,
                Allocation.reviewee_id == student_id,
                Allocation.is_self.is_(False),
                Score.comment.isnot(None),
                Score.comment != "",
            )
            .all()
        )
        
        _update_job_progress(db, job, 40)
        
        comments = [row.comment for row in feedback_rows if row.comment]
        reviewer_names = [row.name for row in feedback_rows if row.name]
        
        if not comments:
            # No feedback yet
            summary_text = "Je hebt nog geen peer-feedback ontvangen. Zodra je teamgenoten hun beoordelingen hebben ingeleverd, verschijnt hier een samenvatting."
            method = "empty"
        else:
            # Anonymize comments
            _update_job_progress(db, job, 50)
            
            all_names = reviewer_names + [student.name]
            anonymizer = AnonymizationService()
            anonymized_comments = anonymizer.anonymize_comments(comments, all_names)
            
            if not anonymized_comments:
                anonymized_comments = comments
            
            _update_job_progress(db, job, 60)
            
            # Try AI generation
            ollama = OllamaService()
            try:
                ai_summary = ollama.generate_summary(
                    feedback_comments=anonymized_comments,
                    student_name=student.name,
                    context=f"Evaluatie: {ev.title}",
                )
            except Exception as e:
                logger.error(f"Exception during AI generation: {type(e).__name__}: {e}")
                ai_summary = None
            
            _update_job_progress(db, job, 80)
            
            if ai_summary:
                summary_text = ai_summary
                method = "ai"
            else:
                # Fallback to rule-based summary
                summary_text = ollama.create_fallback_summary(anonymized_comments)
                method = "fallback"
            
            # Compute hash and cache the summary
            feedback_hash = _compute_feedback_hash(comments)
            
            # Delete old summary if exists
            db.query(FeedbackSummary).filter(
                FeedbackSummary.evaluation_id == evaluation_id,
                FeedbackSummary.student_id == student_id,
            ).delete()
            
            _update_job_progress(db, job, 90)
            
            duration_ms = int((time.time() - start_time) * 1000)
            
            new_summary = FeedbackSummary(
                school_id=school_id,
                evaluation_id=evaluation_id,
                student_id=student_id,
                summary_text=summary_text,
                feedback_hash=feedback_hash,
                generation_method=method,
                generation_duration_ms=duration_ms,
            )
            db.add(new_summary)
            db.commit()
        
        # Update job status to completed
        job.status = "completed"
        job.completed_at = db.execute("SELECT NOW()").scalar()
        job.progress = 100
        job.result = {
            "summary_text": summary_text,
            "generation_method": method,
            "feedback_count": len(comments),
        }
        db.commit()
        
        # Send webhook if configured
        if job.webhook_url:
            webhook_service = WebhookService()
            payload = webhook_service.create_job_payload(
                job_id=job_id,
                status="completed",
                student_id=student_id,
                evaluation_id=evaluation_id,
                result=job.result,
            )
            success, error = webhook_service.send_webhook(job.webhook_url, payload)
            job.webhook_delivered = success
            job.webhook_attempts += 1
            db.commit()
        
        duration = time.time() - start_time
        logger.info(f"[Job {job_id}] AI summary generated successfully in {duration:.2f}s for student {student_id}")
        
        return {
            "status": "completed",
            "student_id": student_id,
            "evaluation_id": evaluation_id,
            "summary_text": summary_text,
            "generation_method": method,
            "feedback_count": len(comments),
            "duration_ms": int(duration * 1000),
        }
        
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"[Job {job_id}] Failed to generate AI summary for student {student_id}: {e}", exc_info=True)
        
        # Check if we should retry
        if job and job.retry_count < job.max_retries:
            # Schedule retry with exponential backoff
            job.retry_count += 1
            # Cap backoff at 30 minutes to prevent excessively long delays
            # Formula: 2^retry_count * 60 seconds = 2min, 4min, 8min, 16min, ...
            # Examples: retry 1 = 2^1*60 = 120s = 2min
            #          retry 2 = 2^2*60 = 240s = 4min
            #          retry 3 = 2^3*60 = 480s = 8min
            backoff_seconds = min(2 ** job.retry_count * 60, 1800)
            job.next_retry_at = datetime.utcnow() + timedelta(seconds=backoff_seconds)
            job.status = "queued"  # Back to queued for retry
            job.error_message = f"Retry {job.retry_count}/{job.max_retries}: {str(e)}"
            db.commit()
            
            logger.info(f"[Job {job_id}] Scheduling retry {job.retry_count}/{job.max_retries} in {backoff_seconds}s")
            
            # Re-enqueue the job with delay
            # Note: job_id is passed as RQ parameter, not task argument
            from app.infra.queue.connection import get_queue
            queue = get_queue(job.queue_name)
            queue.enqueue_in(
                timedelta(seconds=backoff_seconds),
                generate_ai_summary_task,
                school_id=school_id,
                evaluation_id=evaluation_id,
                student_id=student_id,
                job_id=job_id,  # RQ parameter, not task argument
            )
            
            return {
                "status": "retry_scheduled",
                "student_id": student_id,
                "evaluation_id": evaluation_id,
                "retry_count": job.retry_count,
                "next_retry_at": job.next_retry_at.isoformat(),
            }
        
        # Update job status to failed
        if job:
            job.status = "failed"
            job.completed_at = db.execute("SELECT NOW()").scalar()
            job.error_message = str(e)
            db.commit()
            
            # Send webhook if configured
            if job.webhook_url:
                webhook_service = WebhookService()
                payload = webhook_service.create_job_payload(
                    job_id=job_id,
                    status="failed",
                    student_id=student_id,
                    evaluation_id=evaluation_id,
                    error_message=str(e),
                )
                success, error = webhook_service.send_webhook(job.webhook_url, payload)
                job.webhook_delivered = success
                job.webhook_attempts += 1
                db.commit()
        
        return {
            "status": "failed",
            "student_id": student_id,
            "evaluation_id": evaluation_id,
            "error": str(e),
            "duration_ms": int(duration * 1000),
        }
        
    finally:
        db.close()


def batch_generate_summaries_task(
    school_id: int,
    evaluation_id: int,
    student_ids: list[int],
) -> dict:
    """
    Generate summaries for multiple students in batch.
    
    Args:
        school_id: School ID
        evaluation_id: Evaluation ID
        student_ids: List of student IDs
        
    Returns:
        dict with batch processing results
    """
    from app.infra.queue.connection import get_queue
    
    queue = get_queue('ai-summaries')
    results = []
    
    for student_id in student_ids:
        try:
            # Queue individual job for each student
            job = queue.enqueue(
                generate_ai_summary_task,
                school_id=school_id,
                evaluation_id=evaluation_id,
                student_id=student_id,
                job_id=f"summary-{evaluation_id}-{student_id}-{int(time.time())}",
                job_timeout='10m',
                result_ttl=86400,  # Keep results for 24 hours
                failure_ttl=86400,
            )
            results.append({
                "student_id": student_id,
                "job_id": job.id,
                "status": "queued",
            })
        except Exception as e:
            logger.error(f"Failed to queue job for student {student_id}: {e}")
            results.append({
                "student_id": student_id,
                "status": "failed",
                "error": str(e),
            })
    
    return {
        "status": "completed",
        "evaluation_id": evaluation_id,
        "total_students": len(student_ids),
        "queued": sum(1 for r in results if r["status"] == "queued"),
        "failed": sum(1 for r in results if r["status"] == "failed"),
        "results": results,
    }
