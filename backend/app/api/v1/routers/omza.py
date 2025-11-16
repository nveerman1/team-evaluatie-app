"""
OMZA (Organiseren, Meedoen, Zelfvertrouwen, Autonomie) API ENDPOINTS
=====================================================================

This module provides endpoints for the OMZA teacher interface where teachers can:
- View peer and self-assessment scores by OMZA category
- Add teacher scores per student per category
- Add teacher comments per student
- Manage standard comments per category
"""

from __future__ import annotations
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    User,
    Evaluation,
    Score,
    Allocation,
    RubricCriterion,
    Rubric,
)
from app.api.v1.schemas.omza import (
    OmzaDataResponse,
    OmzaStudentData,
    OmzaCategoryScore,
    TeacherScoreCreate,
    TeacherCommentCreate,
    StandardCommentCreate,
    StandardCommentOut,
)
from app.core.rbac import require_role
from app.core.audit import log_create, log_update

router = APIRouter(prefix="/omza", tags=["omza"])


@router.get("/evaluations/{evaluation_id}/data", response_model=OmzaDataResponse)
async def get_omza_data(
    evaluation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get OMZA data for an evaluation including peer scores, self scores,
    teacher scores, and teacher comments per student.
    """
    require_role(current_user, ["teacher", "admin"])

    # Verify evaluation exists
    evaluation = (
        db.query(Evaluation)
        .filter(
            Evaluation.id == evaluation_id,
            Evaluation.school_id == current_user.school_id,
        )
        .first()
    )
    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation not found",
        )

    # Get rubric and criteria
    rubric = (
        db.query(Rubric)
        .filter(
            Rubric.id == evaluation.rubric_id,
            Rubric.school_id == current_user.school_id,
        )
        .first()
    )
    if not rubric:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rubric not found",
        )

    criteria = (
        db.query(RubricCriterion)
        .filter(
            RubricCriterion.rubric_id == rubric.id,
            RubricCriterion.school_id == current_user.school_id,
        )
        .all()
    )

    # Group criteria by category
    categories = {}
    for criterion in criteria:
        if criterion.category:
            if criterion.category not in categories:
                categories[criterion.category] = []
            categories[criterion.category].append(criterion.id)

    # Get all students in the evaluation
    allocations = (
        db.query(Allocation)
        .filter(
            Allocation.evaluation_id == evaluation_id,
            Allocation.school_id == current_user.school_id,
        )
        .all()
    )

    student_ids = list(set([a.reviewee_id for a in allocations]))
    students = db.query(User).filter(User.id.in_(student_ids)).all()

    # Build student data
    student_data_list = []
    for student in students:
        category_scores = {}

        # Calculate peer and self averages per category
        for category, criterion_ids in categories.items():
            # Peer scores (where student is reviewee and reviewer is someone else)
            peer_scores = (
                db.query(Score.score)
                .join(Allocation, Allocation.id == Score.allocation_id)
                .filter(
                    Allocation.reviewee_id == student.id,
                    Allocation.reviewer_id != student.id,
                    Score.criterion_id.in_(criterion_ids),
                    Score.status == "submitted",
                )
                .all()
            )
            peer_avg = (
                sum([s[0] for s in peer_scores]) / len(peer_scores)
                if peer_scores
                else None
            )

            # Self scores (where student is both reviewer and reviewee)
            self_scores = (
                db.query(Score.score)
                .join(Allocation, Allocation.id == Score.allocation_id)
                .filter(
                    Allocation.reviewee_id == student.id,
                    Allocation.reviewer_id == student.id,
                    Score.criterion_id.in_(criterion_ids),
                    Score.status == "submitted",
                )
                .all()
            )
            self_avg = (
                sum([s[0] for s in self_scores]) / len(self_scores)
                if self_scores
                else None
            )

            # Teacher score (stored in metadata for now - we'll use a dedicated table later)
            # For MVP, we'll store teacher scores in evaluation metadata
            teacher_score = None
            teacher_key = f"teacher_score_{student.id}_{category}"
            if evaluation.metadata and teacher_key in evaluation.metadata:
                teacher_score = evaluation.metadata[teacher_key]

            category_scores[category] = OmzaCategoryScore(
                peer_avg=round(peer_avg, 2) if peer_avg is not None else None,
                self_avg=round(self_avg, 2) if self_avg is not None else None,
                teacher_score=teacher_score,
            )

        # Teacher comment (stored in evaluation metadata for now)
        teacher_comment_key = f"teacher_comment_{student.id}"
        teacher_comment = (
            evaluation.metadata.get(teacher_comment_key)
            if evaluation.metadata
            else None
        )

        student_data_list.append(
            OmzaStudentData(
                student_id=student.id,
                student_name=student.name,
                class_name=student.class_name,
                team_number=student.team_number,
                category_scores=category_scores,
                teacher_comment=teacher_comment,
            )
        )

    return OmzaDataResponse(
        evaluation_id=evaluation_id,
        students=student_data_list,
        categories=list(categories.keys()),
    )


@router.post("/evaluations/{evaluation_id}/teacher-score")
async def save_teacher_score(
    evaluation_id: int,
    data: TeacherScoreCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Save a teacher score for a specific student and category.
    """
    require_role(current_user, ["teacher", "admin"])

    # Verify evaluation exists
    evaluation = (
        db.query(Evaluation)
        .filter(
            Evaluation.id == evaluation_id,
            Evaluation.school_id == current_user.school_id,
        )
        .first()
    )
    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation not found",
        )

    # Store teacher score in evaluation metadata
    if evaluation.metadata is None:
        evaluation.metadata = {}

    teacher_key = f"teacher_score_{data.student_id}_{data.category}"
    evaluation.metadata[teacher_key] = data.score

    # Mark as modified
    from sqlalchemy.orm.attributes import flag_modified

    flag_modified(evaluation, "metadata")

    # Log the action
    log_update(
        db=db,
        user=current_user,
        entity_type="evaluation_teacher_score",
        entity_id=evaluation_id,
        details={
            "student_id": data.student_id,
            "category": data.category,
            "score": data.score,
        },
        request=request,
    )

    db.commit()

    return {"message": "Teacher score saved", "student_id": data.student_id, "category": data.category}


@router.post("/evaluations/{evaluation_id}/teacher-comment")
async def save_teacher_comment(
    evaluation_id: int,
    data: TeacherCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Save a teacher comment for a specific student.
    """
    require_role(current_user, ["teacher", "admin"])

    # Verify evaluation exists
    evaluation = (
        db.query(Evaluation)
        .filter(
            Evaluation.id == evaluation_id,
            Evaluation.school_id == current_user.school_id,
        )
        .first()
    )
    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation not found",
        )

    # Store teacher comment in evaluation metadata
    if evaluation.metadata is None:
        evaluation.metadata = {}

    teacher_comment_key = f"teacher_comment_{data.student_id}"
    evaluation.metadata[teacher_comment_key] = data.comment

    # Mark as modified
    from sqlalchemy.orm.attributes import flag_modified

    flag_modified(evaluation, "metadata")

    # Log the action
    log_update(
        db=db,
        user=current_user,
        entity_type="evaluation_teacher_comment",
        entity_id=evaluation_id,
        details={
            "student_id": data.student_id,
            "comment_length": len(data.comment) if data.comment else 0,
        },
        request=request,
    )

    db.commit()

    return {"message": "Teacher comment saved", "student_id": data.student_id}


@router.get("/standard-comments", response_model=List[StandardCommentOut])
async def get_standard_comments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    category: Optional[str] = Query(None),
):
    """
    Get standard comments, optionally filtered by category.
    Standard comments are stored in school metadata.
    """
    require_role(current_user, ["teacher", "admin"])

    # Get from school metadata
    from app.infra.db.models import School

    school = db.query(School).filter(School.id == current_user.school_id).first()
    if not school or not school.settings:
        return []

    standard_comments = school.settings.get("omza_standard_comments", {})

    results = []
    for cat, comments in standard_comments.items():
        if category and cat != category:
            continue
        for idx, text in enumerate(comments):
            results.append(
                StandardCommentOut(
                    id=f"{cat}_{idx}",
                    category=cat,
                    text=text,
                )
            )

    return results


@router.post("/standard-comments", response_model=StandardCommentOut)
async def add_standard_comment(
    data: StandardCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Add a new standard comment for a specific category.
    """
    require_role(current_user, ["teacher", "admin"])

    from app.infra.db.models import School

    school = db.query(School).filter(School.id == current_user.school_id).first()
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found",
        )

    if school.settings is None:
        school.settings = {}

    if "omza_standard_comments" not in school.settings:
        school.settings["omza_standard_comments"] = {}

    if data.category not in school.settings["omza_standard_comments"]:
        school.settings["omza_standard_comments"][data.category] = []

    # Add the new comment
    school.settings["omza_standard_comments"][data.category].append(data.text)

    # Mark as modified
    from sqlalchemy.orm.attributes import flag_modified

    flag_modified(school, "settings")

    # Log the action
    log_create(
        db=db,
        user=current_user,
        entity_type="omza_standard_comment",
        entity_id=school.id,
        details={"category": data.category, "text": data.text},
        request=request,
    )

    db.commit()

    idx = len(school.settings["omza_standard_comments"][data.category]) - 1
    return StandardCommentOut(
        id=f"{data.category}_{idx}",
        category=data.category,
        text=data.text,
    )
