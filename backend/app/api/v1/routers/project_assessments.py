from __future__ import annotations
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    ProjectAssessment,
    ProjectAssessmentScore,
    ProjectAssessmentReflection,
    Rubric,
    RubricCriterion,
    Group,
    GroupMember,
    User,
)
from app.api.v1.schemas.project_assessments import (
    ProjectAssessmentCreate,
    ProjectAssessmentUpdate,
    ProjectAssessmentOut,
    ProjectAssessmentListItem,
    ProjectAssessmentListResponse,
    ProjectAssessmentScoreCreate,
    ProjectAssessmentScoreOut,
    ProjectAssessmentScoreBatchRequest,
    ProjectAssessmentReflectionCreate,
    ProjectAssessmentReflectionOut,
    ProjectAssessmentDetailOut,
)

router = APIRouter(prefix="/project-assessments", tags=["project-assessments"])


def _to_out_assessment(pa: ProjectAssessment) -> ProjectAssessmentOut:
    return ProjectAssessmentOut.model_validate(
        {
            "id": pa.id,
            "group_id": pa.group_id,
            "rubric_id": pa.rubric_id,
            "teacher_id": pa.teacher_id,
            "title": pa.title,
            "version": pa.version,
            "status": pa.status,
            "published_at": pa.published_at,
            "metadata_json": pa.metadata_json or {},
        }
    )


# ---------- CRUD Project Assessments ----------

@router.post("", response_model=ProjectAssessmentOut, status_code=status.HTTP_201_CREATED)
def create_project_assessment(
    payload: ProjectAssessmentCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Create a new project assessment for a group (teacher only)"""
    if user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can create assessments")
    
    # Verify rubric exists and has scope='project'
    rubric = db.query(Rubric).filter(
        Rubric.id == payload.rubric_id,
        Rubric.school_id == user.school_id,
    ).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    if rubric.scope != "project":
        raise HTTPException(status_code=400, detail="Rubric must have scope='project'")
    
    # Verify group exists
    group = db.query(Group).filter(
        Group.id == payload.group_id,
        Group.school_id == user.school_id,
    ).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    pa = ProjectAssessment(
        school_id=user.school_id,
        group_id=payload.group_id,
        rubric_id=payload.rubric_id,
        teacher_id=user.id,
        title=payload.title,
        version=payload.version,
        status="draft",
        metadata_json=payload.metadata_json,
    )
    db.add(pa)
    db.commit()
    db.refresh(pa)
    return _to_out_assessment(pa)


@router.get("", response_model=ProjectAssessmentListResponse)
def list_project_assessments(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    group_id: Optional[int] = Query(None, description="Filter by group"),
    status: Optional[str] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
):
    """List project assessments (teachers see all, students see only their group's published assessments)"""
    stmt = select(ProjectAssessment).where(ProjectAssessment.school_id == user.school_id)
    
    if user.role == "teacher":
        # Teachers see all assessments they created
        stmt = stmt.where(ProjectAssessment.teacher_id == user.id)
    else:
        # Students only see published assessments for their groups
        stmt = stmt.where(ProjectAssessment.status == "published")
        # Get student's groups
        student_groups = db.query(GroupMember.group_id).filter(
            GroupMember.user_id == user.id,
            GroupMember.school_id == user.school_id,
            GroupMember.active == True,
        ).all()
        group_ids = [g[0] for g in student_groups]
        if group_ids:
            stmt = stmt.where(ProjectAssessment.group_id.in_(group_ids))
        else:
            # No groups, return empty
            return ProjectAssessmentListResponse(items=[], page=page, limit=limit, total=0)
    
    if group_id:
        stmt = stmt.where(ProjectAssessment.group_id == group_id)
    if status:
        stmt = stmt.where(ProjectAssessment.status == status)
    
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    stmt = stmt.order_by(ProjectAssessment.id.desc()).limit(limit).offset((page - 1) * limit)
    rows: List[ProjectAssessment] = db.execute(stmt).scalars().all()
    
    # Fetch group and teacher names
    group_map = {
        g.id: g.name
        for g in db.query(Group).filter(
            Group.school_id == user.school_id,
            Group.id.in_([r.group_id for r in rows]),
        ).all()
    }
    teacher_map = {
        t.id: t.name
        for t in db.query(User).filter(
            User.school_id == user.school_id,
            User.id.in_([r.teacher_id for r in rows]),
        ).all()
    }
    
    items = [
        ProjectAssessmentListItem(
            **_to_out_assessment(r).model_dump(),
            group_name=group_map.get(r.group_id),
            teacher_name=teacher_map.get(r.teacher_id),
        )
        for r in rows
    ]
    return ProjectAssessmentListResponse(items=items, page=page, limit=limit, total=total)


@router.get("/{assessment_id}", response_model=ProjectAssessmentDetailOut)
def get_project_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get detailed project assessment including scores"""
    pa = db.query(ProjectAssessment).filter(
        ProjectAssessment.id == assessment_id,
        ProjectAssessment.school_id == user.school_id,
    ).first()
    if not pa:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    # Check permissions
    if user.role == "student":
        # Students can only view published assessments for their groups
        if pa.status != "published":
            raise HTTPException(status_code=403, detail="Assessment not published yet")
        # Check if student is in the group
        is_member = db.query(GroupMember).filter(
            GroupMember.group_id == pa.group_id,
            GroupMember.user_id == user.id,
            GroupMember.school_id == user.school_id,
            GroupMember.active == True,
        ).first()
        if not is_member:
            raise HTTPException(status_code=403, detail="Not authorized to view this assessment")
    elif user.role == "teacher" and pa.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this assessment")
    
    # Get rubric and criteria
    rubric = db.query(Rubric).filter(Rubric.id == pa.rubric_id).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    
    criteria = db.query(RubricCriterion).filter(
        RubricCriterion.rubric_id == rubric.id,
        RubricCriterion.school_id == user.school_id,
    ).order_by(RubricCriterion.id.asc()).all()
    
    # Get scores
    scores = db.query(ProjectAssessmentScore).filter(
        ProjectAssessmentScore.assessment_id == pa.id,
        ProjectAssessmentScore.school_id == user.school_id,
    ).all()
    
    # Get reflection (if student)
    reflection = None
    if user.role == "student":
        reflection = db.query(ProjectAssessmentReflection).filter(
            ProjectAssessmentReflection.assessment_id == pa.id,
            ProjectAssessmentReflection.user_id == user.id,
            ProjectAssessmentReflection.school_id == user.school_id,
        ).first()
    
    return ProjectAssessmentDetailOut(
        assessment=_to_out_assessment(pa),
        scores=[
            ProjectAssessmentScoreOut.model_validate(s) for s in scores
        ],
        rubric_title=rubric.title,
        rubric_scale_min=rubric.scale_min,
        rubric_scale_max=rubric.scale_max,
        criteria=[
            {"id": c.id, "name": c.name, "weight": c.weight, "descriptors": c.descriptors}
            for c in criteria
        ],
        reflection=ProjectAssessmentReflectionOut.model_validate(reflection) if reflection else None,
    )


@router.put("/{assessment_id}", response_model=ProjectAssessmentOut)
def update_project_assessment(
    assessment_id: int,
    payload: ProjectAssessmentUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Update project assessment (teacher only)"""
    if user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can update assessments")
    
    pa = db.query(ProjectAssessment).filter(
        ProjectAssessment.id == assessment_id,
        ProjectAssessment.school_id == user.school_id,
        ProjectAssessment.teacher_id == user.id,
    ).first()
    if not pa:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    if payload.title is not None:
        pa.title = payload.title
    if payload.version is not None:
        pa.version = payload.version
    if payload.status is not None:
        pa.status = payload.status
        if payload.status == "published" and not pa.published_at:
            pa.published_at = datetime.utcnow()
    if payload.metadata_json is not None:
        pa.metadata_json = payload.metadata_json
    
    db.add(pa)
    db.commit()
    db.refresh(pa)
    return _to_out_assessment(pa)


@router.delete("/{assessment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Delete project assessment (teacher only)"""
    if user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can delete assessments")
    
    pa = db.query(ProjectAssessment).filter(
        ProjectAssessment.id == assessment_id,
        ProjectAssessment.school_id == user.school_id,
        ProjectAssessment.teacher_id == user.id,
    ).first()
    if not pa:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    db.delete(pa)
    db.commit()
    return None


# ---------- Scores ----------

@router.post("/{assessment_id}/scores/batch", response_model=List[ProjectAssessmentScoreOut])
def batch_create_update_scores(
    assessment_id: int,
    payload: ProjectAssessmentScoreBatchRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Batch create/update scores for project assessment (teacher only)"""
    if user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can add scores")
    
    pa = db.query(ProjectAssessment).filter(
        ProjectAssessment.id == assessment_id,
        ProjectAssessment.school_id == user.school_id,
        ProjectAssessment.teacher_id == user.id,
    ).first()
    if not pa:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    result = []
    for score_data in payload.scores:
        # Check if score exists
        existing = db.query(ProjectAssessmentScore).filter(
            ProjectAssessmentScore.assessment_id == assessment_id,
            ProjectAssessmentScore.criterion_id == score_data.criterion_id,
            ProjectAssessmentScore.school_id == user.school_id,
        ).first()
        
        if existing:
            existing.score = score_data.score
            if score_data.comment is not None:
                existing.comment = score_data.comment
            db.add(existing)
            result.append(existing)
        else:
            new_score = ProjectAssessmentScore(
                school_id=user.school_id,
                assessment_id=assessment_id,
                criterion_id=score_data.criterion_id,
                score=score_data.score,
                comment=score_data.comment,
            )
            db.add(new_score)
            db.flush()
            result.append(new_score)
    
    db.commit()
    return [ProjectAssessmentScoreOut.model_validate(s) for s in result]


# ---------- Reflections ----------

@router.post("/{assessment_id}/reflection", response_model=ProjectAssessmentReflectionOut)
def create_or_update_reflection(
    assessment_id: int,
    payload: ProjectAssessmentReflectionCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Create or update reflection for project assessment (student only)"""
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can add reflections")
    
    pa = db.query(ProjectAssessment).filter(
        ProjectAssessment.id == assessment_id,
        ProjectAssessment.school_id == user.school_id,
        ProjectAssessment.status == "published",
    ).first()
    if not pa:
        raise HTTPException(status_code=404, detail="Published assessment not found")
    
    # Check if student is in the group
    is_member = db.query(GroupMember).filter(
        GroupMember.group_id == pa.group_id,
        GroupMember.user_id == user.id,
        GroupMember.school_id == user.school_id,
        GroupMember.active == True,
    ).first()
    if not is_member:
        raise HTTPException(status_code=403, detail="Not authorized to reflect on this assessment")
    
    word_count = len(payload.text.split())
    
    # Check if reflection exists
    existing = db.query(ProjectAssessmentReflection).filter(
        ProjectAssessmentReflection.assessment_id == assessment_id,
        ProjectAssessmentReflection.user_id == user.id,
        ProjectAssessmentReflection.school_id == user.school_id,
    ).first()
    
    if existing:
        existing.text = payload.text
        existing.word_count = word_count
        existing.submitted_at = datetime.utcnow()
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return ProjectAssessmentReflectionOut.model_validate(existing)
    else:
        reflection = ProjectAssessmentReflection(
            school_id=user.school_id,
            assessment_id=assessment_id,
            user_id=user.id,
            text=payload.text,
            word_count=word_count,
            submitted_at=datetime.utcnow(),
        )
        db.add(reflection)
        db.commit()
        db.refresh(reflection)
        return ProjectAssessmentReflectionOut.model_validate(reflection)
