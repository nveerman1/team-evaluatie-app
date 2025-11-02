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
    ProjectAssessmentScoresOverview,
    TeamScoreOverview,
    CriterionScore,
    ScoreStatistics,
    ProjectAssessmentStudentsOverview,
    StudentScoreOverview,
    StudentScoreStatistics,
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
    team_number: Optional[int] = Query(None, description="Filter scores by team number"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get detailed project assessment including scores for a specific team"""
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
        # Students should only see their own team's scores
        student_info = db.query(User).filter(User.id == user.id).first()
        if student_info and student_info.team_number:
            team_number = student_info.team_number
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
    
    # Get scores - filter by team_number if provided
    scores_query = db.query(ProjectAssessmentScore).filter(
        ProjectAssessmentScore.assessment_id == pa.id,
        ProjectAssessmentScore.school_id == user.school_id,
    )
    if team_number is not None:
        scores_query = scores_query.filter(ProjectAssessmentScore.team_number == team_number)
    scores = scores_query.all()
    
    # Get reflection (if student)
    reflection = None
    if user.role == "student":
        reflection = db.query(ProjectAssessmentReflection).filter(
            ProjectAssessmentReflection.assessment_id == pa.id,
            ProjectAssessmentReflection.user_id == user.id,
            ProjectAssessmentReflection.school_id == user.school_id,
        ).first()
    
    # Get teacher name
    # Note: This could be optimized with eager loading/join in main query
    teacher = db.query(User).filter(User.id == pa.teacher_id).first()
    teacher_name = teacher.name if teacher else None
    
    # Calculate total score and grade (weighted average)
    total_score = None
    grade = None
    if scores and criteria:
        # Create a map of criterion_id -> weight
        weight_map = {c.id: c.weight for c in criteria}
        total_weight = sum(weight_map.values())
        
        # Calculate weighted average - only include scores that have matching criteria
        if total_weight > 0:
            weighted_sum = 0
            for s in scores:
                if s.criterion_id in weight_map:
                    weighted_sum += s.score * weight_map[s.criterion_id]
            
            total_score = weighted_sum / total_weight
            
            # Convert to grade (1-10 scale)
            # Map rubric scale to 1-10
            scale_range = rubric.scale_max - rubric.scale_min
            if scale_range > 0:
                # Clamp total_score to rubric range
                clamped_score = max(rubric.scale_min, min(rubric.scale_max, total_score))
                normalized = (clamped_score - rubric.scale_min) / scale_range
                grade = 1 + (normalized * 9)  # Map to 1-10
                # Ensure grade is within bounds
                grade = max(1.0, min(10.0, grade))
    
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
        teacher_name=teacher_name,
        total_score=total_score,
        grade=grade,
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
    
    # Get group (course/cluster) info
    group = db.query(Group).filter(Group.id == pa.group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Get all users in this course/cluster, grouped by team_number
    # Users can be linked via GroupMember OR have the same course through their team
    members_in_group = db.query(User).join(
        GroupMember, GroupMember.user_id == User.id
    ).filter(
        GroupMember.group_id == group.id,
        GroupMember.school_id == user.school_id,
        GroupMember.active == True,
        User.team_number.isnot(None),  # Only users with team numbers
    ).all()
    
    # Group users by team_number
    teams_dict: dict[int, List[User]] = {}
    for u in members_in_group:
        if u.team_number is not None:
            if u.team_number not in teams_dict:
                teams_dict[u.team_number] = []
            teams_dict[u.team_number].append(u)
    
    # Get teacher name for updated_by
    teacher = db.query(User).filter(User.id == pa.teacher_id).first()
    teacher_name = teacher.name if teacher else None
    
    # Build team status for each team
    teams = []
    for team_num in sorted(teams_dict.keys()):
        team_members = teams_dict[team_num]
        
        members = [
            TeamMemberInfo(id=u.id, name=u.name, email=u.email)
            for u in team_members
        ]
        
        # Get scores count for this team
        scores_count = db.query(func.count(ProjectAssessmentScore.id)).filter(
            ProjectAssessmentScore.assessment_id == pa.id,
            ProjectAssessmentScore.team_number == team_num,
            ProjectAssessmentScore.school_id == user.school_id,
        ).scalar() or 0
        
        # Determine status
        if scores_count == 0:
            team_status = "not_started"
        elif scores_count < total_criteria:
            team_status = "in_progress"
        else:
            team_status = "completed"
        
        team = TeamAssessmentStatus(
            group_id=group.id,
            group_name=f"Team {team_num}",
            team_number=team_num,
            members=members,
            scores_count=scores_count,
            total_criteria=total_criteria,
            status=team_status,
            updated_at=pa.published_at if pa.status == "published" and scores_count > 0 else None,
            updated_by=teacher_name if scores_count > 0 else None,
        )
        teams.append(team)
    
    return ProjectAssessmentTeamOverview(
        assessment=_to_out_assessment(pa),
        rubric_title=rubric.title,
        rubric_scale_min=rubric.scale_min,
        rubric_scale_max=rubric.scale_max,
        total_criteria=total_criteria,
        teams=teams,
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
        # Check if score exists for this assessment, criterion, and team_number
        existing = db.query(ProjectAssessmentScore).filter(
            ProjectAssessmentScore.assessment_id == assessment_id,
            ProjectAssessmentScore.criterion_id == score_data.criterion_id,
            ProjectAssessmentScore.team_number == score_data.team_number,
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
                team_number=score_data.team_number,
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


# ---------- Scores Overview ----------

@router.get("/{assessment_id}/scores-overview", response_model=ProjectAssessmentScoresOverview)
def get_assessment_scores_overview(
    assessment_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get complete scores overview for a project assessment (teacher/admin only)"""
    if user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Alleen docenten en admins kunnen score overzicht bekijken")
    
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
    
    # Get all criteria
    criteria = db.query(RubricCriterion).filter(
        RubricCriterion.rubric_id == rubric.id,
        RubricCriterion.school_id == user.school_id,
    ).order_by(RubricCriterion.id.asc()).all()
    
    criteria_list = [
        {"id": c.id, "name": c.name, "weight": c.weight, "descriptors": c.descriptors}
        for c in criteria
    ]
    
    # Get group info
    group = db.query(Group).filter(Group.id == pa.group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Get all users in this group, grouped by team_number
    members_in_group = db.query(User).join(
        GroupMember, GroupMember.user_id == User.id
    ).filter(
        GroupMember.group_id == group.id,
        GroupMember.school_id == user.school_id,
        GroupMember.active == True,
        User.team_number.isnot(None),
        User.archived == False,
    ).all()
    
    # Group users by team_number
    teams_dict: dict[int, List[User]] = {}
    for u in members_in_group:
        if u.team_number is not None:
            if u.team_number not in teams_dict:
                teams_dict[u.team_number] = []
            teams_dict[u.team_number].append(u)
    
    # Get all scores for this assessment
    all_scores = db.query(ProjectAssessmentScore).filter(
        ProjectAssessmentScore.assessment_id == pa.id,
        ProjectAssessmentScore.school_id == user.school_id,
    ).all()
    
    # Organize scores by team and criterion
    scores_map = {}  # (team_number, criterion_id) -> score
    for score in all_scores:
        key = (score.team_number, score.criterion_id)
        scores_map[key] = score
    
    # Get teacher name
    teacher = db.query(User).filter(User.id == pa.teacher_id).first()
    teacher_name = teacher.name if teacher else None
    
    # Build team score overview for each team
    team_scores = []
    all_total_scores = []
    criterion_totals = {c.id: {"sum": 0, "count": 0, "name": c.name} for c in criteria}
    
    for team_num in sorted(teams_dict.keys()):
        team_members = teams_dict[team_num]
        
        members = [
            TeamMemberInfo(id=u.id, name=u.name, email=u.email)
            for u in team_members
        ]
        
        # Build criterion scores for this team
        criterion_scores_list = []
        total_score = 0.0
        total_weight = 0.0
        scores_count = 0
        
        for criterion in criteria:
            key = (team_num, criterion.id)
            if key in scores_map:
                score_obj = scores_map[key]
                criterion_scores_list.append(CriterionScore(
                    criterion_id=criterion.id,
                    criterion_name=criterion.name,
                    score=score_obj.score,
                    comment=score_obj.comment,
                ))
                # Use weighted average
                total_score += score_obj.score * criterion.weight
                total_weight += criterion.weight
                scores_count += 1
                criterion_totals[criterion.id]["sum"] += score_obj.score
                criterion_totals[criterion.id]["count"] += 1
            else:
                criterion_scores_list.append(CriterionScore(
                    criterion_id=criterion.id,
                    criterion_name=criterion.name,
                    score=None,
                    comment=None,
                ))
        
        # Calculate weighted average score
        avg_score = total_score / total_weight if total_weight > 0 else None
        
        # Calculate grade (simple linear mapping: score 1-5 -> grade 1-10)
        # Formula: grade = (score - scale_min) / (scale_max - scale_min) * 9 + 1
        grade = None
        if avg_score is not None:
            scale_range = rubric.scale_max - rubric.scale_min
            if scale_range > 0:
                grade = ((avg_score - rubric.scale_min) / scale_range) * 9 + 1
                grade = round(grade, 1)
        
        team_score = TeamScoreOverview(
            team_number=team_num,
            team_name=f"Team {team_num}",
            members=members,
            criterion_scores=criterion_scores_list,
            total_score=round(avg_score, 1) if avg_score is not None else None,
            grade=grade,
            updated_at=None,  # Timestamp tracking not implemented yet
            updated_by=None,  # Would require tracking score modifications
        )
        team_scores.append(team_score)
        
        if avg_score is not None:
            all_total_scores.append(avg_score)
    
    # Calculate statistics
    average_per_criterion = {}
    for crit_id, data in criterion_totals.items():
        if data["count"] > 0:
            average_per_criterion[data["name"]] = round(data["sum"] / data["count"], 2)
        else:
            average_per_criterion[data["name"]] = 0.0
    
    highest_score = max(all_total_scores) if all_total_scores else None
    lowest_score = min(all_total_scores) if all_total_scores else None
    pending_assessments = len([t for t in team_scores if t.total_score is None])
    
    # Calculate grade statistics
    all_grades = [t.grade for t in team_scores if t.grade is not None]
    average_grade = round(sum(all_grades) / len(all_grades), 1) if all_grades else None
    highest_grade = round(max(all_grades), 1) if all_grades else None
    lowest_grade = round(min(all_grades), 1) if all_grades else None
    
    statistics = ScoreStatistics(
        average_per_criterion=average_per_criterion,
        highest_score=round(highest_score, 1) if highest_score else None,
        lowest_score=round(lowest_score, 1) if lowest_score else None,
        pending_assessments=pending_assessments,
        average_grade=average_grade,
        highest_grade=highest_grade,
        lowest_grade=lowest_grade,
    )
    
    return ProjectAssessmentScoresOverview(
        assessment=_to_out_assessment(pa),
        rubric_title=rubric.title,
        rubric_scale_min=rubric.scale_min,
        rubric_scale_max=rubric.scale_max,
        criteria=criteria_list,
        team_scores=team_scores,
        statistics=statistics,
    )


# ---------- Individual Students Overview ----------

@router.get("/{assessment_id}/students-overview", response_model=ProjectAssessmentStudentsOverview)
def get_assessment_students_overview(
    assessment_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get individual students overview for a project assessment (teacher/admin only)"""
    if user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Alleen docenten en admins kunnen leerlingenoverzicht bekijken")
    
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
    
    # Get all criteria
    criteria = db.query(RubricCriterion).filter(
        RubricCriterion.rubric_id == rubric.id,
        RubricCriterion.school_id == user.school_id,
    ).order_by(RubricCriterion.id.asc()).all()
    
    criteria_list = [
        {"id": c.id, "name": c.name, "weight": c.weight, "descriptors": c.descriptors}
        for c in criteria
    ]
    
    # Get group info
    group = db.query(Group).filter(Group.id == pa.group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Get all students in this group
    students = db.query(User).join(
        GroupMember, GroupMember.user_id == User.id
    ).filter(
        GroupMember.group_id == group.id,
        GroupMember.school_id == user.school_id,
        GroupMember.active == True,
        User.role == "student",
        User.archived == False,
    ).order_by(User.class_name, User.team_number, User.name).all()
    
    # Get all scores for this assessment
    all_scores = db.query(ProjectAssessmentScore).filter(
        ProjectAssessmentScore.assessment_id == pa.id,
        ProjectAssessmentScore.school_id == user.school_id,
    ).all()
    
    # Organize scores by team and criterion
    scores_by_team = {}  # (team_number, criterion_id) -> score
    for score in all_scores:
        key = (score.team_number, score.criterion_id)
        scores_by_team[key] = score
    
    # Get teacher name
    teacher = db.query(User).filter(User.id == pa.teacher_id).first()
    teacher_name = teacher.name if teacher else None
    
    # Build student score overview for each student
    student_scores = []
    all_grades = []
    criterion_totals = {c.id: {"sum": 0, "count": 0, "name": c.name} for c in criteria}
    pending_count = 0
    deviating_count = 0  # Currently no mechanism to track deviations, so always 0
    
    for student in students:
        # Get scores for this student's team
        team_num = student.team_number
        team_name = f"Team {team_num}" if team_num else None
        
        # Build criterion scores for this student
        criterion_scores_list = []
        total_score = 0.0
        total_weight = 0.0
        scores_count = 0
        
        for criterion in criteria:
            key = (team_num, criterion.id)
            if key in scores_by_team:
                score_obj = scores_by_team[key]
                criterion_scores_list.append(CriterionScore(
                    criterion_id=criterion.id,
                    criterion_name=criterion.name,
                    score=score_obj.score,
                    comment=score_obj.comment,
                ))
                # Use weighted average
                total_score += score_obj.score * criterion.weight
                total_weight += criterion.weight
                scores_count += 1
                criterion_totals[criterion.id]["sum"] += score_obj.score
                criterion_totals[criterion.id]["count"] += 1
            else:
                criterion_scores_list.append(CriterionScore(
                    criterion_id=criterion.id,
                    criterion_name=criterion.name,
                    score=None,
                    comment=None,
                ))
        
        # Calculate weighted average score
        avg_score = total_score / total_weight if total_weight > 0 else None
        
        # Calculate grade (simple linear mapping: score 1-5 -> grade 1-10)
        grade = None
        if avg_score is not None:
            scale_range = rubric.scale_max - rubric.scale_min
            if scale_range > 0:
                grade = ((avg_score - rubric.scale_min) / scale_range) * 9 + 1
                grade = round(grade, 1)
                all_grades.append(grade)
        else:
            pending_count += 1
        
        student_score = StudentScoreOverview(
            student_id=student.id,
            student_name=student.name,
            student_email=student.email,
            class_name=student.class_name,
            team_number=team_num,
            team_name=team_name,
            criterion_scores=criterion_scores_list,
            total_score=round(avg_score, 1) if avg_score is not None else None,
            grade=grade,
            updated_at=None,  # Would need to track last modification
            updated_by=teacher_name if scores_count > 0 else None,
        )
        student_scores.append(student_score)
    
    # Calculate statistics
    average_per_criterion = {}
    for crit_id, data in criterion_totals.items():
        if data["count"] > 0:
            average_per_criterion[data["name"]] = round(data["sum"] / data["count"], 2)
        else:
            average_per_criterion[data["name"]] = 0.0
    
    average_grade = round(sum(all_grades) / len(all_grades), 1) if all_grades else None
    highest_grade = round(max(all_grades), 1) if all_grades else None
    lowest_grade = round(min(all_grades), 1) if all_grades else None
    
    statistics = StudentScoreStatistics(
        average_per_criterion=average_per_criterion,
        average_grade=average_grade,
        highest_grade=highest_grade,
        lowest_grade=lowest_grade,
        pending_assessments=pending_count,
        deviating_grades=deviating_count,
    )
    
    return ProjectAssessmentStudentsOverview(
        assessment=_to_out_assessment(pa),
        rubric_title=rubric.title,
        rubric_scale_min=rubric.scale_min,
        rubric_scale_max=rubric.scale_max,
        criteria=criteria_list,
        student_scores=student_scores,
        statistics=statistics,
    )
