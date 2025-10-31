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
    Course,
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
    ProjectAssessmentTeamOverview,
    TeamAssessmentStatus,
    TeamMemberInfo,
    ProjectAssessmentReflectionsOverview,
    ReflectionInfo,
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
    """Create a new project assessment for a group (teacher/admin only)"""
    if user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Alleen docenten en admins kunnen beoordelingen aanmaken")
    
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
    course_id: Optional[int] = Query(None, description="Filter by course"),
    status: Optional[str] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
):
    """List project assessments (teachers/admins see all, students see only their group's published assessments)"""
    stmt = select(ProjectAssessment).where(ProjectAssessment.school_id == user.school_id)
    
    if user.role in ("teacher", "admin"):
        # Teachers and admins see all assessments they created
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
    
    # Filter by course
    if course_id:
        # Get groups that belong to this course
        course_groups = db.query(Group.id).filter(
            Group.school_id == user.school_id,
            Group.course_id == course_id,
        ).all()
        course_group_ids = [g[0] for g in course_groups]
        if course_group_ids:
            stmt = stmt.where(ProjectAssessment.group_id.in_(course_group_ids))
        else:
            return ProjectAssessmentListResponse(items=[], page=page, limit=limit, total=0)
    
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    stmt = stmt.order_by(ProjectAssessment.id.desc()).limit(limit).offset((page - 1) * limit)
    rows: List[ProjectAssessment] = db.execute(stmt).scalars().all()
    
    # Fetch group, teacher, and course names
    group_map = {}
    course_map = {}
    for g in db.query(Group).filter(
        Group.school_id == user.school_id,
        Group.id.in_([r.group_id for r in rows]),
    ).all():
        group_map[g.id] = (g.name, g.course_id)
    
    # Get courses
    course_ids = [c_id for _, c_id in group_map.values() if c_id]
    if course_ids:
        for c in db.query(Course).filter(
            Course.school_id == user.school_id,
            Course.id.in_(course_ids),
        ).all():
            course_map[c.id] = c.name
    
    teacher_map = {
        t.id: t.name
        for t in db.query(User).filter(
            User.school_id == user.school_id,
            User.id.in_([r.teacher_id for r in rows]),
        ).all()
    }
    
    # Get score counts and criteria counts
    score_counts = {}
    for r in rows:
        count = db.query(func.count(ProjectAssessmentScore.id)).filter(
            ProjectAssessmentScore.assessment_id == r.id,
            ProjectAssessmentScore.school_id == user.school_id,
        ).scalar()
        score_counts[r.id] = count or 0
    
    criteria_counts = {}
    for r in rows:
        count = db.query(func.count(RubricCriterion.id)).filter(
            RubricCriterion.rubric_id == r.rubric_id,
            RubricCriterion.school_id == user.school_id,
        ).scalar()
        criteria_counts[r.id] = count or 0
    
    items = []
    for r in rows:
        group_name, course_id_val = group_map.get(r.group_id, (None, None))
        course_name = course_map.get(course_id_val) if course_id_val else None
        
        items.append(ProjectAssessmentListItem(
            **_to_out_assessment(r).model_dump(),
            group_name=group_name,
            teacher_name=teacher_map.get(r.teacher_id),
            course_name=course_name,
            course_id=course_id_val,
            scores_count=score_counts.get(r.id, 0),
            total_criteria=criteria_counts.get(r.id, 0),
            updated_at=r.published_at if r.status == "published" else None,
        ))
    
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
    elif user.role in ("teacher", "admin") and pa.teacher_id != user.id:
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
    """Update project assessment (teacher/admin only)"""
    if user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Alleen docenten en admins kunnen beoordelingen bijwerken")
    
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
    """Delete project assessment (teacher/admin only)"""
    if user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Alleen docenten en admins kunnen beoordelingen verwijderen")
    
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


# ---------- Team Overview ----------

@router.get("/{assessment_id}/teams", response_model=ProjectAssessmentTeamOverview)
def get_assessment_teams_overview(
    assessment_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get team overview for a project assessment (teacher/admin only)"""
    if user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Alleen docenten en admins kunnen team overzicht bekijken")
    
    pa = db.query(ProjectAssessment).filter(
        ProjectAssessment.id == assessment_id,
        ProjectAssessment.school_id == user.school_id,
        ProjectAssessment.teacher_id == user.id,
    ).first()
    if not pa:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    # Get rubric info
    rubric = db.query(Rubric).filter(Rubric.id == pa.rubric_id).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    
    total_criteria = db.query(func.count(RubricCriterion.id)).filter(
        RubricCriterion.rubric_id == rubric.id,
        RubricCriterion.school_id == user.school_id,
    ).scalar() or 0
    
    # Get group info
    group = db.query(Group).filter(Group.id == pa.group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Get team members
    members_data = db.query(GroupMember, User).join(
        User, GroupMember.user_id == User.id
    ).filter(
        GroupMember.group_id == group.id,
        GroupMember.school_id == user.school_id,
        GroupMember.active == True,
    ).all()
    
    members = [
        TeamMemberInfo(id=u.id, name=u.name, email=u.email)
        for _, u in members_data
    ]
    
    # Get scores count
    scores_count = db.query(func.count(ProjectAssessmentScore.id)).filter(
        ProjectAssessmentScore.assessment_id == pa.id,
        ProjectAssessmentScore.school_id == user.school_id,
    ).scalar() or 0
    
    # Determine status
    if scores_count == 0:
        team_status = "not_started"
    elif scores_count < total_criteria:
        team_status = "in_progress"
    else:
        team_status = "completed"
    
    # Get teacher name for updated_by
    teacher = db.query(User).filter(User.id == pa.teacher_id).first()
    teacher_name = teacher.name if teacher else None
    
    team = TeamAssessmentStatus(
        group_id=group.id,
        group_name=group.name,
        members=members,
        scores_count=scores_count,
        total_criteria=total_criteria,
        status=team_status,
        updated_at=pa.published_at if pa.status == "published" else None,
        updated_by=teacher_name,
    )
    
    return ProjectAssessmentTeamOverview(
        assessment=_to_out_assessment(pa),
        rubric_title=rubric.title,
        rubric_scale_min=rubric.scale_min,
        rubric_scale_max=rubric.scale_max,
        total_criteria=total_criteria,
        teams=[team],  # Currently only one team per assessment
    )


# ---------- Reflections Overview ----------

@router.get("/{assessment_id}/reflections", response_model=ProjectAssessmentReflectionsOverview)
def get_assessment_reflections(
    assessment_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get all reflections for a project assessment (teacher/admin only)"""
    if user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Alleen docenten en admins kunnen reflecties bekijken")
    
    pa = db.query(ProjectAssessment).filter(
        ProjectAssessment.id == assessment_id,
        ProjectAssessment.school_id == user.school_id,
        ProjectAssessment.teacher_id == user.id,
    ).first()
    if not pa:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    # Get group name
    group = db.query(Group).filter(Group.id == pa.group_id).first()
    group_name = group.name if group else "Onbekend"
    
    # Get all reflections
    reflections_data = db.query(ProjectAssessmentReflection, User).join(
        User, ProjectAssessmentReflection.user_id == User.id
    ).filter(
        ProjectAssessmentReflection.assessment_id == assessment_id,
        ProjectAssessmentReflection.school_id == user.school_id,
    ).all()
    
    reflections = [
        ReflectionInfo(
            id=r.id,
            user_id=r.user_id,
            user_name=u.name,
            text=r.text,
            word_count=r.word_count,
            submitted_at=r.submitted_at,
        )
        for r, u in reflections_data
    ]
    
    return ProjectAssessmentReflectionsOverview(
        assessment=_to_out_assessment(pa),
        group_name=group_name,
        reflections=reflections,
    )


# ---------- Scores ----------

@router.post("/{assessment_id}/scores/batch", response_model=List[ProjectAssessmentScoreOut])
def batch_create_update_scores(
    assessment_id: int,
    payload: ProjectAssessmentScoreBatchRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Batch create/update scores for project assessment (teacher/admin only)"""
    if user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Alleen docenten en admins kunnen scores toevoegen")
    
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
