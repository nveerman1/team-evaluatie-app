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
    ProjectTeam,
    ProjectTeamMember,
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
from app.core.audit import log_create, log_update, log_delete
from app.services.omza_weighted_scores import compute_weighted_omza_scores_batch

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
    # Map full category names to short codes for consistency
    category_name_to_code = {
        "Organiseren": "O",
        "Meedoen": "M", 
        "Zelfvertrouwen": "Z",
        "Autonomie": "A",
        # Also handle lowercase
        "organiseren": "O",
        "meedoen": "M",
        "zelfvertrouwen": "Z",
        "autonomie": "A",
    }
    
    categories = {}
    for criterion in criteria:
        if criterion.category:
            # Normalize category to short code if it's a full name
            cat_key = category_name_to_code.get(criterion.category, criterion.category)
            if cat_key not in categories:
                categories[cat_key] = []
            categories[cat_key].append(criterion.id)

    # Get all active students from the course
    from app.infra.db.models import Group, GroupMember
    
    if not evaluation.course_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation must be linked to a course",
        )
    
    # Get all students in the course via group membership
    students = (
        db.query(User)
        .join(GroupMember, GroupMember.user_id == User.id)
        .join(Group, Group.id == GroupMember.group_id)
        .filter(
            Group.course_id == evaluation.course_id,
            Group.school_id == current_user.school_id,
            GroupMember.active == True,
            User.role == "student",
            User.archived == False,
        )
        .distinct()
        .all()
    )

    # Build user_id -> project team_number mapping if evaluation has a project
    user_team_map = {}
    if evaluation.project_id:
        project_teams = (
            db.query(ProjectTeam)
            .filter(
                ProjectTeam.project_id == evaluation.project_id,
                ProjectTeam.school_id == current_user.school_id,
            )
            .all()
        )
        
        for team in project_teams:
            members = (
                db.query(ProjectTeamMember)
                .filter(ProjectTeamMember.project_team_id == team.id)
                .all()
            )
            for member in members:
                user_team_map[member.user_id] = team.team_number

    # Build student data
    student_data_list = []
    
    # Use batch scoring for efficiency
    student_ids = [s.id for s in students]
    batch_scores = compute_weighted_omza_scores_batch(db, evaluation_id, student_ids)
    
    # Collect all unique category names from the batch scores
    all_categories = set()
    for student_scores in batch_scores.values():
        all_categories.update(student_scores.keys())
    
    for student in students:
        # Get weighted scores from batch calculation
        omza_scores = batch_scores.get(student.id, {})
        
        category_scores = {}
        # Use actual category names from the rubric (not hardcoded O/M/Z/A)
        for category in omza_scores.keys():
            peer_avg = omza_scores.get(category, {}).get("peer")
            self_avg = omza_scores.get(category, {}).get("self")
            
            # Teacher score (stored in settings for now - we'll use a dedicated table later)
            # For MVP, we'll store teacher scores in evaluation settings
            # Try both full category name and abbreviated first letter
            teacher_score = None
            if evaluation.settings:
                # Try full category name first
                teacher_key = f"teacher_score_{student.id}_{category}"
                if teacher_key in evaluation.settings:
                    teacher_score = evaluation.settings[teacher_key]
                else:
                    # Fallback to abbreviated (first letter uppercase)
                    cat_abbrev = category[0].upper() if category else ""
                    teacher_key = f"teacher_score_{student.id}_{cat_abbrev}"
                    if teacher_key in evaluation.settings:
                        teacher_score = evaluation.settings[teacher_key]

            category_scores[category] = OmzaCategoryScore(
                peer_avg=round(peer_avg, 2) if peer_avg is not None else None,
                self_avg=round(self_avg, 2) if self_avg is not None else None,
                teacher_score=teacher_score,
            )

        # Teacher comment (stored in evaluation settings for now)
        teacher_comment_key = f"teacher_comment_{student.id}"
        teacher_comment = (
            evaluation.settings.get(teacher_comment_key)
            if evaluation.settings
            else None
        )

        # If evaluation has a project, only use project teams (don't fallback to user.team_number)
        # If no project, use user.team_number
        if evaluation.project_id:
            team_number = user_team_map.get(student.id, None)
        else:
            team_number = student.team_number
        
        student_data_list.append(
            OmzaStudentData(
                student_id=student.id,
                student_name=student.name,
                class_name=student.class_name,
                team_number=team_number,
                category_scores=category_scores,
                teacher_comment=teacher_comment,
            )
        )

    # Return the categories in the correct order: O, M, Z, A
    # This is the OMZA order (Organiseren, Meedoen, Zelfvertrouwen, Autonomie)
    category_order = ["O", "M", "Z", "A"]
    categories_list = [cat for cat in category_order if cat in all_categories]
    # Add any other categories that might exist
    categories_list.extend([cat for cat in sorted(all_categories) if cat not in category_order])
    
    return OmzaDataResponse(
        evaluation_id=evaluation_id,
        students=student_data_list,
        categories=categories_list,
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

    # Store teacher score in evaluation settings
    if evaluation.settings is None:
        evaluation.settings = {}

    teacher_key = f"teacher_score_{data.student_id}_{data.category}"
    evaluation.settings[teacher_key] = data.score

    # Mark as modified
    from sqlalchemy.orm.attributes import flag_modified

    flag_modified(evaluation, "settings")

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

    # Store teacher comment in evaluation settings
    if evaluation.settings is None:
        evaluation.settings = {}

    teacher_comment_key = f"teacher_comment_{data.student_id}"
    evaluation.settings[teacher_comment_key] = data.comment

    # Mark as modified
    from sqlalchemy.orm.attributes import flag_modified

    flag_modified(evaluation, "settings")

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


@router.get("/evaluations/{evaluation_id}/standard-comments", response_model=List[StandardCommentOut])
async def get_standard_comments(
    evaluation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    category: Optional[str] = Query(None),
):
    """
    Get standard comments for an evaluation, optionally filtered by category.
    Combines template-based remarks from the StandardRemark table (type='omza')
    with evaluation-specific comments stored in evaluation settings.
    """
    require_role(current_user, ["teacher", "admin"])
    
    from app.infra.db.models import StandardRemark

    # Get evaluation
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

    results = []
    seen_texts = set()  # Track texts to avoid duplicates
    
    # First, fetch template-based standard remarks for OMZA type
    # OMZA remarks are about behavior (Organiseren, Meedoen, Zelfvertrouwen, Autonomie)
    # and are generally school-wide, not subject-specific, so we don't filter by subject
    template_query = db.query(StandardRemark).filter(
        StandardRemark.school_id == current_user.school_id,
        StandardRemark.type == "omza",
    )
    
    if category:
        template_query = template_query.filter(StandardRemark.category == category)
    
    template_remarks = template_query.order_by(StandardRemark.order, StandardRemark.id).all()
    
    # Add template remarks first (prefixed with "template_")
    for remark in template_remarks:
        results.append(
            StandardCommentOut(
                id=f"template_{remark.id}",
                category=remark.category,
                text=remark.text,
            )
        )
        seen_texts.add(remark.text.lower().strip())

    # Initialize default standard comments if not present in evaluation settings
    default_comments = {
        "O": [
            "Plant goed en houdt overzicht.",
            "Werkt gestructureerd.",
            "Verliest snel overzicht.",
            "Plant onregelmatig.",
        ],
        "M": [
            "Doet actief mee.",
            "Draagt positief bij.",
            "Blijft op de achtergrond.",
            "Toont weinig betrokkenheid.",
        ],
        "Z": [
            "Toont vertrouwen in eigen kunnen.",
            "Durft uitdagingen aan.",
            "Twijfelt snel aan zichzelf.",
            "Vermijdt moeilijke taken.",
        ],
        "A": [
            "Werkt zelfstandig.",
            "Neemt verantwoordelijkheid.",
            "Heeft veel sturing nodig.",
            "Wacht af en toont weinig initiatief.",
        ],
    }
    
    # Get standard comments from evaluation settings
    if evaluation.settings is None:
        evaluation.settings = {}
    
    if "omza_standard_comments" not in evaluation.settings:
        evaluation.settings["omza_standard_comments"] = default_comments
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(evaluation, "settings")
        db.commit()
    
    standard_comments = evaluation.settings.get("omza_standard_comments", {})

    # Ensure categories are in the correct order: O, M, Z, A
    category_order = ["O", "M", "Z", "A"]
    ordered_categories = [cat for cat in category_order if cat in standard_comments]
    # Add any other categories that might exist
    ordered_categories.extend([cat for cat in standard_comments.keys() if cat not in category_order])
    
    # Add evaluation-specific comments (prefixed with category_index)
    for cat in ordered_categories:
        if category and cat != category:
            continue
        comments = standard_comments[cat]
        for idx, text in enumerate(comments):
            # Skip if this text is already in the results from templates
            if text.lower().strip() in seen_texts:
                continue
            results.append(
                StandardCommentOut(
                    id=f"{cat}_{idx}",
                    category=cat,
                    text=text,
                )
            )

    return results


@router.post("/evaluations/{evaluation_id}/standard-comments", response_model=StandardCommentOut)
async def add_standard_comment(
    evaluation_id: int,
    data: StandardCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Add a new standard comment for a specific category in an evaluation.
    """
    require_role(current_user, ["teacher", "admin"])

    # Get evaluation
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

    if evaluation.settings is None:
        evaluation.settings = {}

    if "omza_standard_comments" not in evaluation.settings:
        evaluation.settings["omza_standard_comments"] = {}

    if data.category not in evaluation.settings["omza_standard_comments"]:
        evaluation.settings["omza_standard_comments"][data.category] = []

    # Add the new comment
    evaluation.settings["omza_standard_comments"][data.category].append(data.text)

    # Mark as modified
    from sqlalchemy.orm.attributes import flag_modified

    flag_modified(evaluation, "settings")

    # Log the action
    log_create(
        db=db,
        user=current_user,
        entity_type="omza_standard_comment",
        entity_id=evaluation_id,
        details={"category": data.category, "text": data.text},
        request=request,
    )

    db.commit()

    idx = len(evaluation.settings["omza_standard_comments"][data.category]) - 1
    return StandardCommentOut(
        id=f"{data.category}_{idx}",
        category=data.category,
        text=data.text,
    )


@router.delete("/evaluations/{evaluation_id}/standard-comments/{comment_id}")
async def delete_standard_comment(
    evaluation_id: int,
    comment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Delete a standard comment from an evaluation.
    Only evaluation-specific comments can be deleted here.
    Template-based comments must be deleted from the templates admin page.
    """
    require_role(current_user, ["teacher", "admin"])
    
    # Template-based comments cannot be deleted from here
    if comment_id.startswith("template_"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Template-based comments cannot be deleted here. Use the templates admin page instead.",
        )

    # Get evaluation
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

    if evaluation.settings is None:
        evaluation.settings = {}

    # Parse comment_id (format: "category_index")
    try:
        category, idx_str = comment_id.rsplit("_", 1)
        idx = int(idx_str)
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid comment ID format",
        )

    # Check if comment exists
    if "omza_standard_comments" not in evaluation.settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No standard comments found",
        )

    if category not in evaluation.settings["omza_standard_comments"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No comments found for category {category}",
        )

    comments = evaluation.settings["omza_standard_comments"][category]
    if idx < 0 or idx >= len(comments):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    # Delete the comment
    deleted_text = comments.pop(idx)

    # Mark as modified
    from sqlalchemy.orm.attributes import flag_modified

    flag_modified(evaluation, "settings")

    # Log the action
    log_delete(
        db=db,
        user=current_user,
        entity_type="omza_standard_comment",
        entity_id=evaluation_id,
        details={"category": category, "text": deleted_text},
        request=request,
    )

    db.commit()

    return {"message": "Standard comment deleted", "category": category}
