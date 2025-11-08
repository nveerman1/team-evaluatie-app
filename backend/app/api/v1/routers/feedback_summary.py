from __future__ import annotations
import hashlib
import time
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, aliased
from pydantic import BaseModel

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    Evaluation,
    Allocation,
    Score,
    User,
    FeedbackSummary,
)
from app.infra.services.ollama_service import OllamaService
from app.infra.services.anonymization_service import AnonymizationService

router = APIRouter(prefix="/feedback-summaries", tags=["feedback-summaries"])


class FeedbackSummaryResponse(BaseModel):
    student_id: int
    student_name: str
    summary_text: str
    generation_method: str  # "ai" | "fallback"
    feedback_count: int
    cached: bool


class RegenerateSummaryRequest(BaseModel):
    force: bool = True


def _compute_feedback_hash(comments: List[str]) -> str:
    """Compute a hash of feedback comments for cache invalidation."""
    content = "|".join(sorted(comments))
    return hashlib.sha256(content.encode()).hexdigest()


@router.get("/evaluation/{evaluation_id}/student/{student_id}", response_model=FeedbackSummaryResponse)
async def get_student_feedback_summary(
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
        ai_summary = await ollama.generate_summary(
            feedback_comments=anonymized_comments,
            student_name=student.name,
            context=f"Evaluatie: {ev.title}",
        )
    except Exception as e:
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
async def regenerate_student_feedback_summary(
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
    return await get_student_feedback_summary(evaluation_id, student_id, db, user)


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
