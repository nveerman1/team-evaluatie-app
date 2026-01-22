from __future__ import annotations
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.core.grading import score_to_grade as _score_to_grade
from app.infra.db.models import (
    ProjectAssessment,
    ProjectAssessmentScore,
    ProjectAssessmentReflection,
    ProjectAssessmentSelfAssessment,
    ProjectAssessmentSelfAssessmentScore,
    Rubric,
    RubricCriterion,
    User,
    Course,
    ProjectTeam,
    ProjectTeamMember,
    Project,
    Client,
    ClientProjectLink,
    TeacherCourse,
)
from app.api.v1.schemas.project_assessments import (
    ProjectAssessmentCreate,
    ProjectAssessmentUpdate,
    ProjectAssessmentOut,
    ProjectAssessmentListItem,
    ProjectAssessmentListResponse,
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
    SelfAssessmentCreate,
    SelfAssessmentOut,
    SelfAssessmentDetailOut,
    SelfAssessmentScoreOut,
    ProjectAssessmentSelfOverview,
    TeamSelfAssessmentOverview,
    StudentSelfAssessmentInfo,
    SelfAssessmentStatistics,
)

router = APIRouter(prefix="/project-assessments", tags=["project-assessments"])


def _get_teacher_course_ids(db: Session, user: User) -> list[int]:
    """Get all course IDs that a teacher is assigned to via teacher_courses"""
    if user.role == "admin":
        # Admins see everything, return empty list to indicate no filtering
        return []
    if user.role != "teacher":
        return []
    
    course_ids_query = select(TeacherCourse.course_id).where(
        TeacherCourse.school_id == user.school_id,
        TeacherCourse.teacher_id == user.id,
        TeacherCourse.is_active.is_(True),
    )
    result = db.execute(course_ids_query).scalars().all()
    return list(result)


def _get_assessment_with_access_check(
    db: Session, assessment_id: int, user: User
) -> ProjectAssessment:
    """
    Get a project assessment and verify the user has access to it.
    
    - Admins: can access any assessment in their school
    - Teachers: can access assessments for courses they're assigned to
    - Others: raises 404
    
    Raises HTTPException(404) if not found or no access.
    """
    pa = db.query(ProjectAssessment).filter(
        ProjectAssessment.id == assessment_id,
        ProjectAssessment.school_id == user.school_id,
    ).first()
    
    if not pa:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    # Check access for teachers
    if user.role == "teacher":
        # Check course access via project_id
        if pa.project_id:
            project = db.query(Project).filter(Project.id == pa.project_id).first()
            if project and project.course_id:
                teacher_course_ids = _get_teacher_course_ids(db, user)
                if teacher_course_ids and project.course_id not in teacher_course_ids:
                    raise HTTPException(status_code=404, detail="Assessment not found")
    
    return pa


def _get_ordered_criteria_query(db: Session, rubric_id: int, school_id: int):
    """
    Helper function to get criteria query with consistent ordering.
    Orders by 'order' column (if exists), then by id - same as rubric edit page.
    """
    criteria_query = db.query(RubricCriterion).filter(
        RubricCriterion.rubric_id == rubric_id,
        RubricCriterion.school_id == school_id,
    )
    if hasattr(RubricCriterion, "order"):
        criteria_query = criteria_query.order_by(
            RubricCriterion.order.asc().nulls_last(), RubricCriterion.id.asc()
        )
    else:
        criteria_query = criteria_query.order_by(RubricCriterion.id.asc())
    return criteria_query


def _to_out_assessment(pa: ProjectAssessment) -> ProjectAssessmentOut:
    return ProjectAssessmentOut.model_validate(
        {
            "id": pa.id,
            "school_id": pa.school_id,
            "project_id": pa.project_id,
            "rubric_id": pa.rubric_id,
            "teacher_id": pa.teacher_id,
            "external_evaluator_id": pa.external_evaluator_id,
            "title": pa.title,
            "version": pa.version,
            "status": pa.status,
            "closed_at": pa.closed_at,
            "published_at": pa.published_at,
            "role": pa.role,
            "is_advisory": pa.is_advisory,
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
    """
    Create a new project assessment for a project (teacher/admin only)
    
    Refactored: Creates ONE assessment per project with child rows for all teams
    """
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
    
    # Verify project exists
    project = db.query(Project).filter(
        Project.id == payload.project_id,
        Project.school_id == user.school_id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Create the assessment
    pa = ProjectAssessment(
        school_id=user.school_id,
        project_id=payload.project_id,
        rubric_id=payload.rubric_id,
        teacher_id=user.id,
        title=payload.title,
        version=payload.version,
        status="draft",
        metadata_json=payload.metadata_json,
    )
    db.add(pa)
    db.flush()  # Get the ID without committing
    
    # Create child rows for ALL teams in this project
    from app.infra.db.models import ProjectAssessmentTeam
    project_teams = db.query(ProjectTeam).filter(
        ProjectTeam.project_id == payload.project_id,
        ProjectTeam.school_id == user.school_id,
    ).all()
    
    for pt in project_teams:
        pat = ProjectAssessmentTeam(
            school_id=user.school_id,
            project_assessment_id=pa.id,
            project_team_id=pt.id,
            status="not_started",
            scores_count=0,
        )
        db.add(pat)
    
    db.commit()
    db.refresh(pa)
    return _to_out_assessment(pa)


@router.get("")
def list_project_assessments(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    project_id: Optional[int] = Query(None, description="Filter by project"),
    course_id: Optional[int] = Query(None, description="Filter by course"),
    status: Optional[str] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
):
    """
    List project assessments.
    
    Refactored: Uses project_id and project_assessment_teams
    
    Access control:
    - Admins: see all assessments in their school (excluding advisory/external assessments)
    - Teachers: see all assessments for courses they're assigned to (excluding advisory/external assessments)
    - Students: see assessments for projects where they belong to ANY team (excluding advisory/external assessments)
    
    Note: Advisory/external assessments (is_advisory=True) are shown separately in the external tab
    """
    from app.infra.db.models import ProjectAssessmentTeam
    from fastapi.responses import JSONResponse
    stmt = select(ProjectAssessment).where(
        ProjectAssessment.school_id == user.school_id,
        ProjectAssessment.is_advisory.is_(False)  # Exclude external assessments (consistent with overview.py)
    )
    
    # Debug info for students (visible in browser Network tab)
    debug_info = {}
    
    if user.role == "admin":
        # Admins see all assessments in their school
        pass
    elif user.role == "teacher":
        # Teachers see assessments for courses they're assigned to
        teacher_course_ids = _get_teacher_course_ids(db, user)
        if teacher_course_ids:
            # Filter by projects in assigned courses
            stmt = stmt.where(
                ProjectAssessment.project_id.in_(
                    select(Project.id).where(
                        Project.school_id == user.school_id,
                        Project.course_id.in_(teacher_course_ids)
                    )
                )
            )
        else:
            # Teacher has no assigned courses, return empty
            return ProjectAssessmentListResponse(items=[], page=page, limit=limit, total=0)
    else:
        # Students see assessments for projects where they belong to ANY team
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"[STUDENT PROJECT ASSESSMENTS] User ID: {user.id}, School ID: {user.school_id}, Role: {user.role}")
        
        debug_info["user_id"] = user.id
        debug_info["school_id"] = user.school_id
        debug_info["role"] = user.role
        
        # Get all project_team_ids the student is part of
        student_teams = db.query(ProjectTeamMember.project_team_id).filter(
            ProjectTeamMember.user_id == user.id,
            ProjectTeamMember.school_id == user.school_id,
        ).all()
        team_ids = [t[0] for t in student_teams]
        
        logger.info(f"[STUDENT PROJECT ASSESSMENTS] Found {len(team_ids)} teams for student: {team_ids}")
        debug_info["team_count"] = len(team_ids)
        debug_info["team_ids"] = team_ids
        
        if team_ids:
            # Get project IDs from the student's teams
            project_ids_subquery = select(ProjectTeam.project_id).where(
                ProjectTeam.id.in_(team_ids),
                ProjectTeam.school_id == user.school_id,
            ).distinct()
            
            # Filter assessments by projects where student has a team
            stmt = stmt.where(ProjectAssessment.project_id.in_(project_ids_subquery))
            # Students only see 'open' or 'published' assessments
            stmt = stmt.where(ProjectAssessment.status.in_(["open", "published"]))
            
            logger.info(f"[STUDENT PROJECT ASSESSMENTS] Filtering by project membership")
        else:
            # No teams, return empty
            logger.info(f"[STUDENT PROJECT ASSESSMENTS] Student has no teams, returning empty list")
            debug_info["message"] = "No teams found for student"
            return ProjectAssessmentListResponse(items=[], page=page, limit=limit, total=0)
    
    # Filter by project_id
    if project_id:
        stmt = stmt.where(ProjectAssessment.project_id == project_id)
    
    # Apply status filter if provided (but already applied for students above)
    if status and user.role != "student":
        stmt = stmt.where(ProjectAssessment.status == status)
    
    # Filter by course
    if course_id:
        stmt = stmt.where(
            ProjectAssessment.project_id.in_(
                select(Project.id).where(
                    Project.school_id == user.school_id,
                    Project.course_id == course_id,
                )
            )
        )
    
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    
    # Debug logging for students
    if user.role == "student":
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"[STUDENT PROJECT ASSESSMENTS] Total matching assessments after all filters: {total}")
        debug_info["total_after_filters"] = total
    
    stmt = stmt.order_by(ProjectAssessment.id.desc()).limit(limit).offset((page - 1) * limit)
    rows: List[ProjectAssessment] = db.execute(stmt).scalars().all()
    
    # Debug logging for students
    if user.role == "student":
        logger.info(f"[STUDENT PROJECT ASSESSMENTS] Returning {len(rows)} assessments to student")
        debug_info["returned_count"] = len(rows)
    
    # Fetch project and course information
    project_map = {}  # Maps project_id -> (project_title, course_id)
    course_map = {}
    
    project_ids = [r.project_id for r in rows]
    if project_ids:
        # Batch query for projects with their courses
        projects = db.query(Project).filter(
            Project.id.in_(project_ids),
            Project.school_id == user.school_id,
        ).all()
        
        for project in projects:
            # Store project title and course_id
            project_map[project.id] = (project.title, project.course_id)
    
    # Get courses
    course_ids = [c_id for _, c_id in project_map.values() if c_id]
    if course_ids:
        for c in db.query(Course).filter(
            Course.school_id == user.school_id,
            Course.id.in_(course_ids),
        ).all():
            course_map[c.id] = c.name
    
    teacher_ids = [r.teacher_id for r in rows if r.teacher_id is not None]
    teacher_map = {}
    if teacher_ids:
        teacher_map = {
            t.id: t.name
            for t in db.query(User).filter(
                User.school_id == user.school_id,
                User.id.in_(teacher_ids),
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
    
    # For students, get their team_number and project end_date
    team_number_map = {}
    project_end_date_map = {}
    if user.role == "student":
        for r in rows:
            if r.project_id:
                # Find student's team for this project
                project_team_member = db.query(ProjectTeamMember).join(
                    ProjectTeam, ProjectTeam.id == ProjectTeamMember.project_team_id
                ).filter(
                    ProjectTeam.project_id == r.project_id,
                    ProjectTeam.school_id == user.school_id,
                    ProjectTeamMember.user_id == user.id,
                ).first()
                
                if project_team_member:
                    team = db.query(ProjectTeam).filter(
                        ProjectTeam.id == project_team_member.project_team_id
                    ).first()
                    if team and team.team_number:
                        team_number_map[r.id] = team.team_number
                
                # Get project end_date
                project = db.query(Project).filter(
                    Project.id == r.project_id,
                    Project.school_id == user.school_id,
                ).first()
                if project and project.end_date:
                    project_end_date_map[r.id] = project.end_date.isoformat()
    
    # Fetch client names for all assessments with projects
    client_name_map = {}
    project_ids_with_client = [r.project_id for r in rows if r.project_id is not None]
    if project_ids_with_client:
        # Query projects with their associated clients through client_project_links
        projects_with_clients = db.query(Project, Client).join(
            ClientProjectLink, ClientProjectLink.project_id == Project.id
        ).join(
            Client, ClientProjectLink.client_id == Client.id
        ).filter(
            Project.id.in_(project_ids_with_client),
            Project.school_id == user.school_id,
        ).all()
        
        # Build map from project_id to client name
        project_to_client = {p.id: c.organization if c else None for p, c in projects_with_clients}
        
        # Map assessment_id to client_name
        for r in rows:
            if r.project_id and r.project_id in project_to_client:
                client_name_map[r.id] = project_to_client[r.project_id]
    
    items = []
    for r in rows:
        # Get project info from project_id
        project_title, course_id_val = project_map.get(r.project_id, (None, None))
        course_name = course_map.get(course_id_val) if course_id_val else None
        
        item_dict = {
            **_to_out_assessment(r).model_dump(),
            "group_name": project_title,  # Using 'group_name' field for project title for now
            "teacher_name": teacher_map.get(r.teacher_id),
            "course_name": course_name,
            "course_id": course_id_val,
            "scores_count": score_counts.get(r.id, 0),
            "total_criteria": criteria_counts.get(r.id, 0),
            "updated_at": r.published_at if r.status == "published" else None,
            "client_name": client_name_map.get(r.id),
        }
        
        # Add team_number and project_end_date for students
        if user.role == "student":
            item_dict["team_number"] = team_number_map.get(r.id)
            item_dict["project_end_date"] = project_end_date_map.get(r.id)
        
        items.append(ProjectAssessmentListItem(**item_dict))
    
    response_data = ProjectAssessmentListResponse(items=items, page=page, limit=limit, total=total)
    
    # For students, add debug info in custom HTTP headers (visible in browser Network tab)
    if user.role == "student":
        import json
        response = JSONResponse(content=response_data.model_dump(mode='json'))
        response.headers["X-Debug-Info"] = json.dumps(debug_info)
        response.headers["X-Debug-Team-Count"] = str(debug_info.get("team_count", 0))
        response.headers["X-Debug-Returned-Count"] = str(debug_info.get("returned_count", 0))
        return response
    
    return response_data


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
        # Students can only view published assessments for their projects
        if pa.status != "published":
            raise HTTPException(status_code=403, detail="Assessment not published yet")
        
        # Check if student is in ANY team for this project
        is_member = db.query(ProjectTeamMember).join(
            ProjectTeam, ProjectTeam.id == ProjectTeamMember.project_team_id
        ).filter(
            ProjectTeam.project_id == pa.project_id,
            ProjectTeamMember.user_id == user.id,
            ProjectTeamMember.school_id == user.school_id,
        ).first()
        
        if not is_member:
            raise HTTPException(status_code=403, detail="Not authorized to view this assessment")
        
        # Students should only see their own team's scores
        # Get team number from the student's team in this project
        project_team = db.query(ProjectTeam).join(
            ProjectTeamMember, ProjectTeamMember.project_team_id == ProjectTeam.id
        ).filter(
            ProjectTeam.project_id == pa.project_id,
            ProjectTeamMember.user_id == user.id,
        ).first()
        
        if project_team:
            team_number = project_team.team_number
        else:
            # Fallback to user.team_number for legacy assessments
            student_info = db.query(User).filter(User.id == user.id).first()
            if student_info and student_info.team_number:
                team_number = student_info.team_number
    elif user.role == "teacher":
        # Teachers can view assessments for courses they're assigned to
        project = db.query(Project).filter(Project.id == pa.project_id).first()
        if project and project.course_id:
            teacher_course_ids = _get_teacher_course_ids(db, user)
            if teacher_course_ids and project.course_id not in teacher_course_ids:
                raise HTTPException(status_code=403, detail="Not authorized to view this assessment")
    
    # Get rubric and criteria
    rubric = db.query(Rubric).filter(Rubric.id == pa.rubric_id).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    
    # Get criteria with consistent ordering
    criteria = _get_ordered_criteria_query(db, rubric.id, user.school_id).all()
    
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
            
            # Convert to grade (1-10 scale) using curved mapping
            grade = _score_to_grade(total_score, rubric.scale_min, rubric.scale_max)
    
    return ProjectAssessmentDetailOut(
        assessment=_to_out_assessment(pa),
        scores=[
            ProjectAssessmentScoreOut.model_validate(s) for s in scores
        ],
        rubric_title=rubric.title,
        rubric_scale_min=rubric.scale_min,
        rubric_scale_max=rubric.scale_max,
        criteria=[
            {"id": c.id, "name": c.name, "weight": c.weight, "category": getattr(c, "category", None), "descriptors": c.descriptors}
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
    
    pa = _get_assessment_with_access_check(db, assessment_id, user)
    
    if payload.title is not None:
        pa.title = payload.title
    if payload.rubric_id is not None:
        # Verify rubric exists and has scope='project'
        rubric = db.query(Rubric).filter(
            Rubric.id == payload.rubric_id,
            Rubric.school_id == user.school_id,
        ).first()
        if not rubric:
            raise HTTPException(status_code=404, detail="Rubric not found")
        if rubric.scope != "project":
            raise HTTPException(status_code=400, detail="Rubric must have scope='project'")
        pa.rubric_id = payload.rubric_id
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
    
    pa = _get_assessment_with_access_check(db, assessment_id, user)
    
    db.delete(pa)
    db.commit()
    return None


@router.post("/{assessment_id}/close", response_model=ProjectAssessmentOut)
def close_project_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Close a project assessment and mark it as archived
    
    Sets status to 'closed' and records closed_at timestamp.
    This action is idempotent - calling it multiple times has the same effect.
    Once closed, the project_team members become read-only.
    """
    from datetime import datetime, timezone
    from app.core.rbac import require_role
    from app.core.audit import log_update
    
    # Require teacher or admin role
    require_role(user, ["teacher", "admin"])
    
    # Get assessment
    assessment = db.query(ProjectAssessment).filter(
        ProjectAssessment.id == assessment_id,
        ProjectAssessment.school_id == user.school_id,
    ).first()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )
    
    # Update status and closed_at if not already closed
    if assessment.status != "closed":
        assessment.status = "closed"
        assessment.closed_at = datetime.now(timezone.utc)
        
        # Log action
        log_update(
            db=db,
            user=user,
            entity_type="project_assessment",
            entity_id=assessment_id,
            details={"action": "close", "closed_at": assessment.closed_at.isoformat()},
        )
    
    db.commit()
    db.refresh(assessment)
    
    # Format output
    return ProjectAssessmentOut(
        id=assessment.id,
        school_id=assessment.school_id,
        project_id=assessment.project_id,
        rubric_id=assessment.rubric_id,
        teacher_id=assessment.teacher_id,
        external_evaluator_id=assessment.external_evaluator_id,
        title=assessment.title,
        version=assessment.version,
        status=assessment.status,
        closed_at=assessment.closed_at,
        published_at=assessment.published_at,
        role=assessment.role,
        is_advisory=assessment.is_advisory,
        metadata_json=assessment.metadata_json,
    )


@router.post("/repair-team-links")
def repair_project_assessment_team_links(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Repair/backfill missing project_assessment_teams rows for existing assessments.
    
    This endpoint:
    - Finds all project assessments that are missing team links
    - Creates project_assessment_teams rows for ALL teams in each project
    - Is idempotent (safe to run multiple times - uses ON CONFLICT DO NOTHING)
    - Admin only
    
    Returns the number of rows created.
    """
    from app.core.rbac import require_role
    from app.infra.db.models import ProjectAssessmentTeam
    
    # Require admin role
    require_role(user, ["admin"])
    
    # Get all assessments with their project teams
    assessments = db.query(ProjectAssessment).filter(
        ProjectAssessment.school_id == user.school_id,
        ProjectAssessment.project_id.isnot(None),
    ).all()
    
    rows_created = 0
    assessments_fixed = []
    
    for assessment in assessments:
        # Get all teams for this project
        project_teams = db.query(ProjectTeam).filter(
            ProjectTeam.project_id == assessment.project_id,
            ProjectTeam.school_id == user.school_id,
        ).order_by(ProjectTeam.team_number).all()
        
        # Get existing assessment_team links
        existing_team_ids = set(
            row.project_team_id for row in 
            db.query(ProjectAssessmentTeam.project_team_id).filter(
                ProjectAssessmentTeam.project_assessment_id == assessment.id,
                ProjectAssessmentTeam.school_id == user.school_id,
            ).all()
        )
        
        # Create missing links
        teams_added = 0
        for pt in project_teams:
            if pt.id not in existing_team_ids:
                pat = ProjectAssessmentTeam(
                    school_id=user.school_id,
                    project_assessment_id=assessment.id,
                    project_team_id=pt.id,
                    status="not_started",
                    scores_count=0,
                )
                db.add(pat)
                teams_added += 1
                rows_created += 1
        
        if teams_added > 0:
            assessments_fixed.append({
                "assessment_id": assessment.id,
                "title": assessment.title,
                "project_id": assessment.project_id,
                "teams_added": teams_added,
                "total_teams": len(project_teams),
            })
    
    db.commit()
    
    return {
        "success": True,
        "rows_created": rows_created,
        "assessments_fixed": len(assessments_fixed),
        "details": assessments_fixed,
    }


# ---------- Team Overview ----------

@router.get("/{assessment_id}/teams", response_model=ProjectAssessmentTeamOverview)
def get_assessment_teams_overview(
    assessment_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get team overview for a project assessment (teacher/admin only)"""
    from app.infra.db.models import ProjectAssessmentTeam
    
    if user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Alleen docenten en admins kunnen team overzicht bekijken")
    
    pa = _get_assessment_with_access_check(db, assessment_id, user)
    
    # Get rubric info
    rubric = db.query(Rubric).filter(Rubric.id == pa.rubric_id).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    
    total_criteria = db.query(func.count(RubricCriterion.id)).filter(
        RubricCriterion.rubric_id == rubric.id,
        RubricCriterion.school_id == user.school_id,
    ).scalar() or 0
    
    # Get all project teams for this assessment via project_assessment_teams
    assessment_teams = db.query(ProjectAssessmentTeam).filter(
        ProjectAssessmentTeam.project_assessment_id == assessment_id,
        ProjectAssessmentTeam.school_id == user.school_id,
    ).all()
    
    teams_list = []
    for assessment_team in assessment_teams:
        # Get project team info
        project_team = db.query(ProjectTeam).filter(
            ProjectTeam.id == assessment_team.project_team_id
        ).first()
        
        if not project_team:
            continue
        
        # Get team members
        team_members = (
            db.query(User)
            .join(ProjectTeamMember, ProjectTeamMember.user_id == User.id)
            .filter(
                ProjectTeamMember.project_team_id == project_team.id,
                ProjectTeamMember.school_id == user.school_id,
            )
            .all()
        )
        
        # Build member info list
        members_info = [
            TeamMemberInfo(
                id=m.id,
                name=m.name,
                email=m.email,
            )
            for m in team_members
        ]
        
        # Get score count for this team
        scores_count = db.query(func.count(ProjectAssessmentScore.id)).filter(
            ProjectAssessmentScore.assessment_id == assessment_id,
            ProjectAssessmentScore.team_number == project_team.team_number,
            ProjectAssessmentScore.school_id == user.school_id,
        ).scalar() or 0
        
        # Determine status
        if scores_count == 0:
            status = "not_started"
        elif scores_count < total_criteria:
            status = "in_progress"
        else:
            status = "completed"
        
        teams_list.append(
            TeamAssessmentStatus(
                group_id=project_team.id,
                group_name=project_team.display_name_at_time,
                team_number=project_team.team_number,
                members=members_info,
                scores_count=scores_count,
                total_criteria=total_criteria,
                status=status,
                updated_at=assessment_team.last_updated_at,
                updated_by=None,  # Can be enhanced later
            )
        )
    
    return ProjectAssessmentTeamOverview(
        assessment=_to_out_assessment(pa),
        rubric_title=rubric.title,
        rubric_scale_min=rubric.scale_min,
        rubric_scale_max=rubric.scale_max,
        total_criteria=total_criteria,
        teams=teams_list,
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
    
    pa = _get_assessment_with_access_check(db, assessment_id, user)
    
    # Get project name
    project = db.query(Project).filter(Project.id == pa.project_id).first()
    group_name = project.title if project else "Onbekend"
    
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
    """Batch create/update scores for project assessment (teacher/admin only)
    
    Supports both team scores and individual student overrides.
    - Team score: set team_number, leave student_id as None
    - Individual override: set both team_number and student_id
    """
    if user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Alleen docenten en admins kunnen scores toevoegen")
    
    _get_assessment_with_access_check(db, assessment_id, user)
    
    result = []
    for score_data in payload.scores:
        # Build filter based on whether this is a student override or team score
        filters = [
            ProjectAssessmentScore.assessment_id == assessment_id,
            ProjectAssessmentScore.criterion_id == score_data.criterion_id,
            ProjectAssessmentScore.team_number == score_data.team_number,
            ProjectAssessmentScore.school_id == user.school_id,
        ]
        
        # Handle student_id filtering (None vs specific value)
        if score_data.student_id is not None:
            filters.append(ProjectAssessmentScore.student_id == score_data.student_id)
        else:
            filters.append(ProjectAssessmentScore.student_id.is_(None))
        
        existing = db.query(ProjectAssessmentScore).filter(*filters).first()
        
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
                student_id=score_data.student_id,
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
    
    # Check if student is in any team for this project
    is_member = db.query(ProjectTeamMember).join(
        ProjectTeam, ProjectTeam.id == ProjectTeamMember.project_team_id
    ).filter(
        ProjectTeam.project_id == pa.project_id,
        ProjectTeam.school_id == user.school_id,
        ProjectTeamMember.user_id == user.id,
        ProjectTeamMember.school_id == user.school_id,
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
    
    pa = _get_assessment_with_access_check(db, assessment_id, user)
    
    # Get rubric info
    rubric = db.query(Rubric).filter(Rubric.id == pa.rubric_id).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    
    # Get all criteria with consistent ordering
    criteria = _get_ordered_criteria_query(db, rubric.id, user.school_id).all()
    
    criteria_list = [
        {"id": c.id, "name": c.name, "weight": c.weight, "category": getattr(c, "category", None), "descriptors": c.descriptors}
        for c in criteria
    ]
    
    # Get all users from project teams (no more group_id support)
    members_set: set[User] = set()
    
    # Get members from project teams
    if pa.project_id:
        project_team_members = (
            db.query(User)
            .join(ProjectTeamMember, ProjectTeamMember.user_id == User.id)
            .join(ProjectTeam, ProjectTeam.id == ProjectTeamMember.project_team_id)
            .filter(
                ProjectTeam.project_id == pa.project_id,
                ProjectTeam.school_id == user.school_id,
                User.archived.is_(False),
            )
            .all()
        )
        members_set.update(project_team_members)
    
    members_in_group = list(members_set)
    
    # Build user_id -> project team_number mapping if assessment has a project
    user_team_map: dict[int, int] = {}
    if pa.project_id:
        project_teams = (
            db.query(ProjectTeam)
            .filter(
                ProjectTeam.project_id == pa.project_id,
                ProjectTeam.school_id == user.school_id,
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
    
    # Group users by team_number
    # If assessment has project_id, only use project teams (don't fallback to user.team_number)
    # If no project_id, use user.team_number
    teams_dict: dict[int, List[User]] = {}
    for u in members_in_group:
        if pa.project_id:
            team_num = user_team_map.get(u.id, None)
        else:
            team_num = u.team_number
        if team_num is not None:
            if team_num not in teams_dict:
                teams_dict[team_num] = []
            teams_dict[team_num].append(u)
    
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
                    category=getattr(criterion, "category", None),
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
                    category=getattr(criterion, "category", None),
                    score=None,
                    comment=None,
                ))
        
        # Calculate weighted average score
        avg_score = total_score / total_weight if total_weight > 0 else None
        
        # Calculate grade using curved mapping
        grade = _score_to_grade(avg_score, rubric.scale_min, rubric.scale_max)
        
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
    """Get individual students overview for a project assessment (teacher/admin only)
    
    Shows individual student scores. If a student has an individual override for a criterion,
    that override is shown (with is_override=True). Otherwise, the team score is shown.
    """
    if user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Alleen docenten en admins kunnen leerlingenoverzicht bekijken")
    
    pa = _get_assessment_with_access_check(db, assessment_id, user)
    
    # Get rubric info
    rubric = db.query(Rubric).filter(Rubric.id == pa.rubric_id).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    
    # Get all criteria with consistent ordering
    criteria = _get_ordered_criteria_query(db, rubric.id, user.school_id).all()
    
    criteria_list = [
        {"id": c.id, "name": c.name, "weight": c.weight, "category": getattr(c, "category", None), "descriptors": c.descriptors}
        for c in criteria
    ]
    
    # Get all students from project teams (no more group_id support)
    students_set: set[User] = set()
    
    # Get students from project teams
    if pa.project_id:
        project_team_students = (
            db.query(User)
            .join(ProjectTeamMember, ProjectTeamMember.user_id == User.id)
            .join(ProjectTeam, ProjectTeam.id == ProjectTeamMember.project_team_id)
            .filter(
                ProjectTeam.project_id == pa.project_id,
                ProjectTeam.school_id == user.school_id,
                User.archived.is_(False),
                User.role == "student",
            )
            .all()
        )
        students_set.update(project_team_students)
    
    students = list(students_set)
    
    # Build user_id -> project team_number mapping if assessment has a project
    user_team_map: dict[int, int] = {}
    if pa.project_id:
        project_teams = (
            db.query(ProjectTeam)
            .filter(
                ProjectTeam.project_id == pa.project_id,
                ProjectTeam.school_id == user.school_id,
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
    
    # Sort students by class_name, then by team_number, then by name
    # If assessment has project_id, only use project teams (don't fallback to user.team_number)
    # If no project_id, use user.team_number
    students_with_teams = []
    for s in students:
        if pa.project_id:
            team_num = user_team_map.get(s.id, None)
        else:
            team_num = s.team_number
        students_with_teams.append((s, team_num))
    
    # Sort by class_name, team_number, name
    students_with_teams.sort(key=lambda x: (x[0].class_name or "", x[1] or 0, x[0].name or ""))
    students = [s[0] for s in students_with_teams]
    
    # Get all scores for this assessment
    all_scores = db.query(ProjectAssessmentScore).filter(
        ProjectAssessmentScore.assessment_id == pa.id,
        ProjectAssessmentScore.school_id == user.school_id,
    ).all()
    
    # Organize scores:
    # - Team scores: (team_number, criterion_id) -> score (where student_id is None)
    # - Student overrides: (student_id, criterion_id) -> score (where student_id is set)
    team_scores_map = {}  # (team_number, criterion_id) -> score
    student_scores_map = {}  # (student_id, criterion_id) -> score
    
    for score in all_scores:
        if score.student_id is not None:
            # Individual student override
            key = (score.student_id, score.criterion_id)
            student_scores_map[key] = score
        else:
            # Team score
            key = (score.team_number, score.criterion_id)
            team_scores_map[key] = score
    
    # Get teacher name
    teacher = db.query(User).filter(User.id == pa.teacher_id).first()
    teacher_name = teacher.name if teacher else None
    
    # Build student score overview for each student
    student_scores = []
    all_grades = []
    criterion_totals = {c.id: {"sum": 0, "count": 0, "name": c.name} for c in criteria}
    pending_count = 0
    deviating_count = 0  # Count students with at least one override
    
    for student in students:
        # If assessment has project_id, only use project teams (don't fallback to user.team_number)
        # If no project_id, use user.team_number
        if pa.project_id:
            team_num = user_team_map.get(student.id, None)
        else:
            team_num = student.team_number
        team_name = f"Team {team_num}" if team_num else None
        
        # Build criterion scores for this student
        criterion_scores_list = []
        total_score = 0.0
        total_weight = 0.0
        scores_count = 0
        has_override = False
        
        for criterion in criteria:
            # Check for individual student override first
            student_key = (student.id, criterion.id)
            team_key = (team_num, criterion.id)
            
            if student_key in student_scores_map:
                # Use student override
                score_obj = student_scores_map[student_key]
                is_override = True
                has_override = True
            elif team_key in team_scores_map:
                # Fall back to team score
                score_obj = team_scores_map[team_key]
                is_override = False
            else:
                # No score available
                criterion_scores_list.append(CriterionScore(
                    criterion_id=criterion.id,
                    criterion_name=criterion.name,
                    category=getattr(criterion, "category", None),
                    score=None,
                    comment=None,
                    is_override=False,
                ))
                continue
            
            criterion_scores_list.append(CriterionScore(
                criterion_id=criterion.id,
                criterion_name=criterion.name,
                category=getattr(criterion, "category", None),
                score=score_obj.score,
                comment=score_obj.comment,
                is_override=is_override,
            ))
            # Use weighted average
            total_score += score_obj.score * criterion.weight
            total_weight += criterion.weight
            scores_count += 1
            criterion_totals[criterion.id]["sum"] += score_obj.score
            criterion_totals[criterion.id]["count"] += 1
        
        if has_override:
            deviating_count += 1
        
        # Calculate weighted average score
        avg_score = total_score / total_weight if total_weight > 0 else None
        
        # Calculate grade using curved mapping
        grade = _score_to_grade(avg_score, rubric.scale_min, rubric.scale_max)
        if grade is not None:
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


# ---------- Self Assessment (Student) ----------


@router.get("/{assessment_id}/self", response_model=SelfAssessmentDetailOut)
def get_self_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get student's own self-assessment for a project assessment"""
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can access self-assessments")
    
    # Get the assessment - students can see it if status is open or published
    pa = db.query(ProjectAssessment).filter(
        ProjectAssessment.id == assessment_id,
        ProjectAssessment.school_id == user.school_id,
        ProjectAssessment.status.in_(["open", "published", "closed"]),
    ).first()
    if not pa:
        raise HTTPException(status_code=404, detail="Assessment not found or not yet available")
    
    # Check if student is in project team (assessments are now project-based only)
    is_member = False
    if pa.project_id:
        is_member = db.query(ProjectTeamMember).join(
            ProjectTeam, ProjectTeam.id == ProjectTeamMember.project_team_id
        ).filter(
            ProjectTeam.project_id == pa.project_id,
            ProjectTeam.school_id == user.school_id,
            ProjectTeamMember.user_id == user.id,
            ProjectTeamMember.school_id == user.school_id,
        ).first() is not None
    
    if not is_member:
        raise HTTPException(status_code=403, detail="Not authorized to access this assessment")
    
    # Get rubric info
    rubric = db.query(Rubric).filter(Rubric.id == pa.rubric_id).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    
    # Get all criteria
    criteria = _get_ordered_criteria_query(db, rubric.id, user.school_id).all()
    criteria_list = [
        {
            "id": c.id,
            "name": c.name,
            "weight": c.weight,
            "category": getattr(c, "category", None),
            "descriptors": c.descriptors,
        }
        for c in criteria
    ]
    
    # Get existing self-assessment if it exists
    self_assessment = db.query(ProjectAssessmentSelfAssessment).filter(
        ProjectAssessmentSelfAssessment.assessment_id == assessment_id,
        ProjectAssessmentSelfAssessment.student_id == user.id,
        ProjectAssessmentSelfAssessment.school_id == user.school_id,
    ).first()
    
    self_assessment_out = None
    if self_assessment:
        # Get scores for this self-assessment
        scores = db.query(ProjectAssessmentSelfAssessmentScore).filter(
            ProjectAssessmentSelfAssessmentScore.self_assessment_id == self_assessment.id,
            ProjectAssessmentSelfAssessmentScore.school_id == user.school_id,
        ).all()
        
        score_outs = [SelfAssessmentScoreOut.model_validate(s) for s in scores]
        self_assessment_out = SelfAssessmentOut(
            id=self_assessment.id,
            assessment_id=self_assessment.assessment_id,
            student_id=self_assessment.student_id,
            team_number=self_assessment.team_number,
            locked=self_assessment.locked,
            created_at=self_assessment.created_at,
            updated_at=self_assessment.updated_at,
            scores=score_outs,
        )
    
    # TODO: Add policy to lock self-assessment after published if desired
    # Currently students can edit during open/published/closed status
    can_edit = pa.status in ["open", "published"] and (
        not self_assessment or not self_assessment.locked
    )
    
    return SelfAssessmentDetailOut(
        self_assessment=self_assessment_out,
        assessment=_to_out_assessment(pa),
        rubric_title=rubric.title,
        rubric_scale_min=rubric.scale_min,
        rubric_scale_max=rubric.scale_max,
        criteria=criteria_list,
        can_edit=can_edit,
    )


@router.post("/{assessment_id}/self", response_model=SelfAssessmentOut)
def create_or_update_self_assessment(
    assessment_id: int,
    payload: SelfAssessmentCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Create or update student's self-assessment"""
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can submit self-assessments")
    
    # Get the assessment - only open or published assessments can be filled
    pa = db.query(ProjectAssessment).filter(
        ProjectAssessment.id == assessment_id,
        ProjectAssessment.school_id == user.school_id,
        ProjectAssessment.status.in_(["open", "published"]),
    ).first()
    if not pa:
        raise HTTPException(
            status_code=404,
            detail="Assessment not found or not available for self-assessment",
        )
    
    # Check if student is in project team (assessments are now project-based only)
    is_member = False
    if pa.project_id:
        is_member = db.query(ProjectTeamMember).join(
            ProjectTeam, ProjectTeam.id == ProjectTeamMember.project_team_id
        ).filter(
            ProjectTeam.project_id == pa.project_id,
            ProjectTeam.school_id == user.school_id,
            ProjectTeamMember.user_id == user.id,
            ProjectTeamMember.school_id == user.school_id,
        ).first() is not None
    
    if not is_member:
        raise HTTPException(status_code=403, detail="Not authorized to assess this project")
    
    # Get student's team number
    team_number = user.team_number
    
    # Get or create self-assessment
    self_assessment = db.query(ProjectAssessmentSelfAssessment).filter(
        ProjectAssessmentSelfAssessment.assessment_id == assessment_id,
        ProjectAssessmentSelfAssessment.student_id == user.id,
        ProjectAssessmentSelfAssessment.school_id == user.school_id,
    ).first()
    
    if self_assessment:
        # Check if locked
        if self_assessment.locked:
            raise HTTPException(
                status_code=403,
                detail="Self-assessment is locked and cannot be modified",
            )
        # Update timestamp
        self_assessment.updated_at = datetime.now(timezone.utc)
    else:
        # Create new self-assessment
        self_assessment = ProjectAssessmentSelfAssessment(
            school_id=user.school_id,
            assessment_id=assessment_id,
            student_id=user.id,
            team_number=team_number,
            locked=False,
        )
        db.add(self_assessment)
        db.flush()  # Get the ID
    
    # Validate that all criterion_ids are valid for this rubric
    rubric = db.query(Rubric).filter(Rubric.id == pa.rubric_id).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    
    valid_criterion_ids_query = select(RubricCriterion.id).where(
        RubricCriterion.rubric_id == rubric.id,
        RubricCriterion.school_id == user.school_id,
    )
    valid_criterion_ids = set(
        db.execute(valid_criterion_ids_query).scalars().all()
    )
    
    for score_data in payload.scores:
        if score_data.criterion_id not in valid_criterion_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid criterion_id: {score_data.criterion_id}",
            )
        
        # Validate score range
        if not (rubric.scale_min <= score_data.score <= rubric.scale_max):
            raise HTTPException(
                status_code=400,
                detail=f"Score must be between {rubric.scale_min} and {rubric.scale_max}",
            )
    
    # Update scores - delete existing and insert new ones
    db.query(ProjectAssessmentSelfAssessmentScore).filter(
        ProjectAssessmentSelfAssessmentScore.self_assessment_id == self_assessment.id
    ).delete()
    
    for score_data in payload.scores:
        score = ProjectAssessmentSelfAssessmentScore(
            school_id=user.school_id,
            self_assessment_id=self_assessment.id,
            criterion_id=score_data.criterion_id,
            score=score_data.score,
            comment=score_data.comment,
        )
        db.add(score)
    
    db.commit()
    db.refresh(self_assessment)
    
    # Get all scores for response
    scores = db.query(ProjectAssessmentSelfAssessmentScore).filter(
        ProjectAssessmentSelfAssessmentScore.self_assessment_id == self_assessment.id
    ).all()
    
    score_outs = [SelfAssessmentScoreOut.model_validate(s) for s in scores]
    
    return SelfAssessmentOut(
        id=self_assessment.id,
        assessment_id=self_assessment.assessment_id,
        student_id=self_assessment.student_id,
        team_number=self_assessment.team_number,
        locked=self_assessment.locked,
        created_at=self_assessment.created_at,
        updated_at=self_assessment.updated_at,
        scores=score_outs,
    )


# ---------- Self Assessment Overview (Teacher) ----------


@router.get("/{assessment_id}/self/overview", response_model=ProjectAssessmentSelfOverview)
def get_self_assessment_overview(
    assessment_id: int,
    q: Optional[str] = Query(None, description="Search by student name or team"),
    sort: Optional[str] = Query("team", description="Sort by: team|name|grade"),
    direction: Optional[str] = Query("asc", description="Sort direction: asc|desc"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get aggregated self-assessment overview for teachers"""
    if user.role not in ("teacher", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Only teachers and admins can view self-assessment overview",
        )
    
    pa = _get_assessment_with_access_check(db, assessment_id, user)
    
    # Get rubric info
    rubric = db.query(Rubric).filter(Rubric.id == pa.rubric_id).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    
    # Get all criteria
    criteria = _get_ordered_criteria_query(db, rubric.id, user.school_id).all()
    criteria_list = [
        {
            "id": c.id,
            "name": c.name,
            "weight": c.weight,
            "category": getattr(c, "category", None),
            "descriptors": c.descriptors,
        }
        for c in criteria
    ]
    
    # Get all students - if assessment has a project, include students from ProjectTeamMember
    # This matches the behavior of the submissions page
    students_set = set()
    
    # Get students from project teams (no more group_id support)
    if pa.project_id:
        project_team_students = (
            db.query(User)
            .join(ProjectTeamMember, ProjectTeamMember.user_id == User.id)
            .join(ProjectTeam, ProjectTeam.id == ProjectTeamMember.project_team_id)
            .filter(
                ProjectTeam.project_id == pa.project_id,
                ProjectTeam.school_id == user.school_id,
                User.archived.is_(False),
                User.role == "student",
            )
            .all()
        )
        students_set.update(project_team_students)
    
    students = list(students_set)
    
    # Build user_id -> project team_number mapping if assessment has a project
    user_team_map: dict[int, int] = {}
    if pa.project_id:
        project_teams = (
            db.query(ProjectTeam)
            .filter(
                ProjectTeam.project_id == pa.project_id,
                ProjectTeam.school_id == user.school_id,
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
    
    # Apply search filter if provided
    if q:
        q_lower = q.lower()
        students = [
            s
            for s in students
            if q_lower in s.name.lower()
            or (str(user_team_map.get(s.id, s.team_number or 0)) in q_lower)
        ]
    
    # Get all self-assessments for this project assessment
    self_assessments = (
        db.query(ProjectAssessmentSelfAssessment)
        .filter(
            ProjectAssessmentSelfAssessment.assessment_id == assessment_id,
            ProjectAssessmentSelfAssessment.school_id == user.school_id,
        )
        .all()
    )
    
    # Build map of student_id -> self_assessment
    self_assessment_map = {sa.student_id: sa for sa in self_assessments}
    
    # Get all self-assessment scores
    self_assessment_ids = [sa.id for sa in self_assessments]
    all_scores = []
    if self_assessment_ids:
        all_scores = (
            db.query(ProjectAssessmentSelfAssessmentScore)
            .filter(
                ProjectAssessmentSelfAssessmentScore.self_assessment_id.in_(
                    self_assessment_ids
                ),
                ProjectAssessmentSelfAssessmentScore.school_id == user.school_id,
            )
            .all()
        )
    
    # Build map of self_assessment_id -> [scores]
    scores_map: dict[int, list[ProjectAssessmentSelfAssessmentScore]] = {}
    for score in all_scores:
        if score.self_assessment_id not in scores_map:
            scores_map[score.self_assessment_id] = []
        scores_map[score.self_assessment_id].append(score)
    
    # Group students by team using project teams if available
    # Note: Students without a team_num will be added to team 0 (no team)
    teams_dict: dict[int, list[User]] = {}
    for student in students:
        if pa.project_id:
            team_num = user_team_map.get(student.id, 0)  # Default to 0 if not found
        else:
            team_num = student.team_number if student.team_number is not None else 0
        
        if team_num not in teams_dict:
            teams_dict[team_num] = []
        teams_dict[team_num].append(student)
    
    # Build team overviews
    team_overviews = []
    for team_num in sorted(teams_dict.keys()):
        team_students = teams_dict[team_num]
        team_name = f"Team {team_num}" if team_num > 0 else "Geen team"
        
        # Build student details for this team
        student_details = []
        for student in team_students:
            sa = self_assessment_map.get(student.id)
            if sa:
                scores = scores_map.get(sa.id, [])
                criterion_scores = []
                for criterion in criteria:
                    score_obj = next(
                        (s for s in scores if s.criterion_id == criterion.id), None
                    )
                    criterion_scores.append(
                        CriterionScore(
                            criterion_id=criterion.id,
                            criterion_name=criterion.name,
                            category=getattr(criterion, "category", None),
                            score=score_obj.score if score_obj else None,
                            comment=score_obj.comment if score_obj else None,
                        )
                    )
                
                # Calculate total score and grade
                total_score = _calculate_total_score(
                    criterion_scores, criteria, rubric.scale_min, rubric.scale_max
                )
                grade = (
                    _score_to_grade(total_score, rubric.scale_min, rubric.scale_max)
                    if total_score is not None
                    else None
                )
                
                student_details.append(
                    StudentSelfAssessmentInfo(
                        student_id=student.id,
                        student_name=student.name,
                        criterion_scores=criterion_scores,
                        total_score=total_score,
                        grade=grade,
                        updated_at=sa.updated_at,
                        has_self_assessment=True,
                    )
                )
            else:
                # Student has not completed self-assessment
                student_details.append(
                    StudentSelfAssessmentInfo(
                        student_id=student.id,
                        student_name=student.name,
                        criterion_scores=[
                            CriterionScore(
                                criterion_id=c.id,
                                criterion_name=c.name,
                                category=getattr(c, "category", None),
                                score=None,
                                comment=None,
                            )
                            for c in criteria
                        ],
                        total_score=None,
                        grade=None,
                        updated_at=None,
                        has_self_assessment=False,
                    )
                )
        
        # Calculate team averages
        completed_students = [s for s in student_details if s.has_self_assessment]
        avg_criterion_scores = []
        for criterion in criteria:
            scores_for_criterion = [
                s.score
                for student in completed_students
                for s in student.criterion_scores
                if s.criterion_id == criterion.id and s.score is not None
            ]
            avg_score = (
                sum(scores_for_criterion) / len(scores_for_criterion)
                if scores_for_criterion
                else None
            )
            avg_criterion_scores.append(
                CriterionScore(
                    criterion_id=criterion.id,
                    criterion_name=criterion.name,
                    category=getattr(criterion, "category", None),
                    score=round(avg_score, 1) if avg_score is not None else None,
                    comment=None,
                )
            )
        
        # Calculate average total score and grade for team
        total_scores = [s.total_score for s in completed_students if s.total_score is not None]
        avg_total_score = sum(total_scores) / len(total_scores) if total_scores else None
        
        grades = [s.grade for s in completed_students if s.grade is not None]
        avg_grade = sum(grades) / len(grades) if grades else None
        
        team_overviews.append(
            TeamSelfAssessmentOverview(
                team_number=team_num,
                team_name=team_name,
                members=[
                    TeamMemberInfo(id=s.id, name=s.name, email=s.email)
                    for s in team_students
                ],
                avg_criterion_scores=avg_criterion_scores,
                avg_total_score=avg_total_score,
                avg_grade=avg_grade,
                student_details=student_details,
                completed_count=len(completed_students),
            )
        )
    
    # Apply sorting
    if sort == "team":
        team_overviews.sort(
            key=lambda t: t.team_number, reverse=(direction == "desc")
        )
    elif sort == "name":
        # Sort by first student name in team
        team_overviews.sort(
            key=lambda t: t.members[0].name if t.members else "",
            reverse=(direction == "desc"),
        )
    elif sort == "grade":
        team_overviews.sort(
            key=lambda t: t.avg_grade if t.avg_grade is not None else -1,
            reverse=(direction == "desc"),
        )
    
    # Calculate overall statistics
    all_criterion_averages = {}
    for criterion in criteria:
        all_scores_for_criterion = []
        for team in team_overviews:
            for student in team.student_details:
                if student.has_self_assessment:
                    for cs in student.criterion_scores:
                        if cs.criterion_id == criterion.id and cs.score is not None:
                            all_scores_for_criterion.append(cs.score)
        
        if all_scores_for_criterion:
            all_criterion_averages[criterion.name] = sum(
                all_scores_for_criterion
            ) / len(all_scores_for_criterion)
    
    all_grades = []
    for team in team_overviews:
        for student in team.student_details:
            if student.grade is not None:
                all_grades.append(student.grade)
    
    statistics = SelfAssessmentStatistics(
        total_students=len(students),
        completed_assessments=len(self_assessments),
        average_per_criterion=all_criterion_averages,
        average_grade=sum(all_grades) / len(all_grades) if all_grades else None,
    )
    
    return ProjectAssessmentSelfOverview(
        assessment=_to_out_assessment(pa),
        rubric_title=rubric.title,
        rubric_scale_min=rubric.scale_min,
        rubric_scale_max=rubric.scale_max,
        criteria=criteria_list,
        team_overviews=team_overviews,
        statistics=statistics,
    )


def _calculate_total_score(
    criterion_scores: List[CriterionScore],
    criteria: List[RubricCriterion],
    scale_min: int,
    scale_max: int,
) -> Optional[float]:
    """Calculate weighted average total score"""
    total_weight = 0.0
    weighted_sum = 0.0
    
    for cs in criterion_scores:
        if cs.score is not None:
            # Find the criterion to get its weight
            criterion = next((c for c in criteria if c.id == cs.criterion_id), None)
            if criterion:
                weight = criterion.weight or 1.0
                weighted_sum += cs.score * weight
                total_weight += weight
    
    if total_weight == 0:
        return None
    
    return weighted_sum / total_weight
