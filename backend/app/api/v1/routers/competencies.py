"""
API endpoints for Competency Monitor
"""
from __future__ import annotations
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    User,
    Competency,
    CompetencyWindow,
    CompetencySelfScore,
    CompetencyTeacherObservation,
    CompetencyGoal,
    CompetencyReflection,
)
from app.api.v1.schemas.competencies import (
    CompetencyCreate,
    CompetencyUpdate,
    CompetencyOut,
    CompetencyWindowCreate,
    CompetencyWindowUpdate,
    CompetencyWindowOut,
    CompetencySelfScoreBulkCreate,
    CompetencySelfScoreOut,
    CompetencyTeacherObservationCreate,
    CompetencyTeacherObservationOut,
    CompetencyGoalCreate,
    CompetencyGoalUpdate,
    CompetencyGoalOut,
    CompetencyReflectionCreate,
    CompetencyReflectionOut,
    ClassHeatmap,
    ClassHeatmapRow,
    CompetencyScore,
    StudentCompetencyOverview,
)

router = APIRouter(prefix="/competencies", tags=["competencies"])


# ============ Competency CRUD ============


@router.get("/", response_model=List[CompetencyOut])
def list_competencies(
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all competencies for the school"""
    query = select(Competency).where(Competency.school_id == current_user.school_id)
    if active_only:
        query = query.where(Competency.active == True)
    query = query.order_by(Competency.order, Competency.name)
    
    competencies = db.execute(query).scalars().all()
    return competencies


@router.post("/", response_model=CompetencyOut, status_code=status.HTTP_201_CREATED)
def create_competency(
    data: CompetencyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new competency (teacher only)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Only teachers can create competencies")
    
    competency = Competency(
        school_id=current_user.school_id,
        **data.model_dump()
    )
    db.add(competency)
    db.commit()
    db.refresh(competency)
    return competency


@router.get("/{competency_id}", response_model=CompetencyOut)
def get_competency(
    competency_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific competency"""
    competency = db.get(Competency, competency_id)
    if not competency or competency.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Competency not found")
    return competency


@router.patch("/{competency_id}", response_model=CompetencyOut)
def update_competency(
    competency_id: int,
    data: CompetencyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a competency (teacher only)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Only teachers can update competencies")
    
    competency = db.get(Competency, competency_id)
    if not competency or competency.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Competency not found")
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(competency, key, value)
    
    db.commit()
    db.refresh(competency)
    return competency


@router.delete("/{competency_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_competency(
    competency_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a competency (teacher only)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Only teachers can delete competencies")
    
    competency = db.get(Competency, competency_id)
    if not competency or competency.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Competency not found")
    
    db.delete(competency)
    db.commit()
    return None


# ============ Competency Window CRUD ============


@router.get("/windows/", response_model=List[CompetencyWindowOut])
def list_windows(
    status_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all competency windows"""
    query = select(CompetencyWindow).where(
        CompetencyWindow.school_id == current_user.school_id
    )
    if status_filter:
        query = query.where(CompetencyWindow.status == status_filter)
    query = query.order_by(CompetencyWindow.start_date.desc())
    
    windows = db.execute(query).scalars().all()
    return windows


@router.post("/windows/", response_model=CompetencyWindowOut, status_code=status.HTTP_201_CREATED)
def create_window(
    data: CompetencyWindowCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new competency window (teacher only)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Only teachers can create windows")
    
    window = CompetencyWindow(
        school_id=current_user.school_id,
        **data.model_dump()
    )
    db.add(window)
    db.commit()
    db.refresh(window)
    return window


@router.get("/windows/{window_id}", response_model=CompetencyWindowOut)
def get_window(
    window_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific window"""
    window = db.get(CompetencyWindow, window_id)
    if not window or window.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Window not found")
    return window


@router.patch("/windows/{window_id}", response_model=CompetencyWindowOut)
def update_window(
    window_id: int,
    data: CompetencyWindowUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a window (teacher only)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Only teachers can update windows")
    
    window = db.get(CompetencyWindow, window_id)
    if not window or window.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Window not found")
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(window, key, value)
    
    db.commit()
    db.refresh(window)
    return window


@router.delete("/windows/{window_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_window(
    window_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a window (teacher only)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Only teachers can delete windows")
    
    window = db.get(CompetencyWindow, window_id)
    if not window or window.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Window not found")
    
    db.delete(window)
    db.commit()
    return None


# ============ Self Score Endpoints ============


@router.post("/self-scores/", response_model=List[CompetencySelfScoreOut], status_code=status.HTTP_201_CREATED)
def submit_self_scores(
    data: CompetencySelfScoreBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit self-assessment scores for a window"""
    window = db.get(CompetencyWindow, data.window_id)
    if not window or window.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Window not found")
    
    if window.status != "open":
        raise HTTPException(status_code=400, detail="Window is not open")
    
    results = []
    for score_data in data.scores:
        # Check if score already exists
        existing = db.execute(
            select(CompetencySelfScore).where(
                CompetencySelfScore.window_id == data.window_id,
                CompetencySelfScore.user_id == current_user.id,
                CompetencySelfScore.competency_id == score_data.competency_id,
            )
        ).scalar_one_or_none()
        
        if existing:
            # Update existing score
            existing.score = score_data.score
            existing.example = score_data.example
            existing.submitted_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            results.append(existing)
        else:
            # Create new score
            score = CompetencySelfScore(
                school_id=current_user.school_id,
                window_id=data.window_id,
                user_id=current_user.id,
                competency_id=score_data.competency_id,
                score=score_data.score,
                example=score_data.example,
                submitted_at=datetime.utcnow(),
            )
            db.add(score)
            db.commit()
            db.refresh(score)
            results.append(score)
    
    return results


@router.get("/self-scores/", response_model=List[CompetencySelfScoreOut])
def get_my_self_scores(
    window_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get my self-scores for a window"""
    scores = db.execute(
        select(CompetencySelfScore).where(
            CompetencySelfScore.window_id == window_id,
            CompetencySelfScore.user_id == current_user.id,
        )
    ).scalars().all()
    return scores


# ============ Goal Endpoints ============


@router.post("/goals/", response_model=CompetencyGoalOut, status_code=status.HTTP_201_CREATED)
def create_goal(
    data: CompetencyGoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a learning goal for a window"""
    window = db.get(CompetencyWindow, data.window_id)
    if not window or window.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Window not found")
    
    goal = CompetencyGoal(
        school_id=current_user.school_id,
        window_id=data.window_id,
        user_id=current_user.id,
        goal_text=data.goal_text,
        success_criteria=data.success_criteria,
        competency_id=data.competency_id,
        status=data.status,
        submitted_at=datetime.utcnow(),
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.get("/goals/", response_model=List[CompetencyGoalOut])
def get_my_goals(
    window_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get my goals (optionally filtered by window)"""
    query = select(CompetencyGoal).where(
        CompetencyGoal.user_id == current_user.id,
        CompetencyGoal.school_id == current_user.school_id,
    )
    if window_id:
        query = query.where(CompetencyGoal.window_id == window_id)
    query = query.order_by(CompetencyGoal.submitted_at.desc())
    
    goals = db.execute(query).scalars().all()
    return goals


@router.patch("/goals/{goal_id}", response_model=CompetencyGoalOut)
def update_goal(
    goal_id: int,
    data: CompetencyGoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a goal"""
    goal = db.get(CompetencyGoal, goal_id)
    if not goal or goal.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(goal, key, value)
    
    db.commit()
    db.refresh(goal)
    return goal


# ============ Reflection Endpoints ============


@router.post("/reflections/", response_model=CompetencyReflectionOut, status_code=status.HTTP_201_CREATED)
def create_reflection(
    data: CompetencyReflectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a reflection for a window"""
    window = db.get(CompetencyWindow, data.window_id)
    if not window or window.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Window not found")
    
    # Check if reflection already exists
    existing = db.execute(
        select(CompetencyReflection).where(
            CompetencyReflection.window_id == data.window_id,
            CompetencyReflection.user_id == current_user.id,
        )
    ).scalar_one_or_none()
    
    if existing:
        # Update existing reflection
        existing.text = data.text
        existing.goal_id = data.goal_id
        existing.goal_achieved = data.goal_achieved
        existing.evidence = data.evidence
        existing.submitted_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    
    reflection = CompetencyReflection(
        school_id=current_user.school_id,
        window_id=data.window_id,
        user_id=current_user.id,
        text=data.text,
        goal_id=data.goal_id,
        goal_achieved=data.goal_achieved,
        evidence=data.evidence,
        submitted_at=datetime.utcnow(),
    )
    db.add(reflection)
    db.commit()
    db.refresh(reflection)
    return reflection


@router.get("/reflections/", response_model=List[CompetencyReflectionOut])
def get_my_reflections(
    window_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get my reflections (optionally filtered by window)"""
    query = select(CompetencyReflection).where(
        CompetencyReflection.user_id == current_user.id,
        CompetencyReflection.school_id == current_user.school_id,
    )
    if window_id:
        query = query.where(CompetencyReflection.window_id == window_id)
    query = query.order_by(CompetencyReflection.submitted_at.desc())
    
    reflections = db.execute(query).scalars().all()
    return reflections


# ============ Teacher Observation Endpoints ============


@router.post("/observations/", response_model=CompetencyTeacherObservationOut, status_code=status.HTTP_201_CREATED)
def create_observation(
    data: CompetencyTeacherObservationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a teacher observation (teacher only)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Only teachers can create observations")
    
    window = db.get(CompetencyWindow, data.window_id)
    if not window or window.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Window not found")
    
    # Check if observation already exists
    existing = db.execute(
        select(CompetencyTeacherObservation).where(
            CompetencyTeacherObservation.window_id == data.window_id,
            CompetencyTeacherObservation.user_id == data.user_id,
            CompetencyTeacherObservation.competency_id == data.competency_id,
        )
    ).scalar_one_or_none()
    
    if existing:
        # Update existing observation
        existing.score = data.score
        existing.comment = data.comment
        db.commit()
        db.refresh(existing)
        return existing
    
    observation = CompetencyTeacherObservation(
        school_id=current_user.school_id,
        window_id=data.window_id,
        user_id=data.user_id,
        competency_id=data.competency_id,
        teacher_id=current_user.id,
        score=data.score,
        comment=data.comment,
    )
    db.add(observation)
    db.commit()
    db.refresh(observation)
    return observation


# ============ Overview/Aggregate Endpoints ============


@router.get("/windows/{window_id}/overview", response_model=StudentCompetencyOverview)
def get_my_window_overview(
    window_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get my competency overview for a window"""
    window = db.get(CompetencyWindow, window_id)
    if not window or window.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Window not found")
    
    # Get all competencies
    competencies = db.execute(
        select(Competency).where(
            Competency.school_id == current_user.school_id,
            Competency.active == True,
        ).order_by(Competency.order)
    ).scalars().all()
    
    # Get self scores
    self_scores = db.execute(
        select(CompetencySelfScore).where(
            CompetencySelfScore.window_id == window_id,
            CompetencySelfScore.user_id == current_user.id,
        )
    ).scalars().all()
    self_score_map = {s.competency_id: s.score for s in self_scores}
    
    # Build scores list
    scores = []
    for comp in competencies:
        scores.append(CompetencyScore(
            competency_id=comp.id,
            competency_name=comp.name,
            self_score=self_score_map.get(comp.id),
            peer_score=None,  # TODO: implement peer score calculation
            teacher_score=None,  # TODO: implement teacher score retrieval
            final_score=self_score_map.get(comp.id),  # Simplified for now
            delta=None,  # TODO: implement delta calculation
        ))
    
    # Get goals
    goals = db.execute(
        select(CompetencyGoal).where(
            CompetencyGoal.window_id == window_id,
            CompetencyGoal.user_id == current_user.id,
        )
    ).scalars().all()
    
    # Get reflection
    reflection = db.execute(
        select(CompetencyReflection).where(
            CompetencyReflection.window_id == window_id,
            CompetencyReflection.user_id == current_user.id,
        )
    ).scalar_one_or_none()
    
    return StudentCompetencyOverview(
        window_id=window_id,
        user_id=current_user.id,
        user_name=current_user.name,
        scores=scores,
        goals=goals,
        reflection=reflection,
    )


@router.get("/windows/{window_id}/student/{user_id}/overview", response_model=StudentCompetencyOverview)
def get_student_window_overview(
    window_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a student's competency overview for a window (teacher only)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Only teachers can view student details")
    
    window = db.get(CompetencyWindow, window_id)
    if not window or window.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Window not found")
    
    # Get the student
    student = db.get(User, user_id)
    if not student or student.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get all competencies
    competencies = db.execute(
        select(Competency).where(
            Competency.school_id == current_user.school_id,
            Competency.active == True,
        ).order_by(Competency.order)
    ).scalars().all()
    
    # Get self scores
    self_scores = db.execute(
        select(CompetencySelfScore).where(
            CompetencySelfScore.window_id == window_id,
            CompetencySelfScore.user_id == user_id,
        )
    ).scalars().all()
    
    # Get teacher observations
    teacher_observations = db.execute(
        select(CompetencyTeacherObservation).where(
            CompetencyTeacherObservation.window_id == window_id,
            CompetencyTeacherObservation.user_id == user_id,
        )
    ).scalars().all()
    
    # Build maps
    self_score_map = {s.competency_id: s for s in self_scores}
    teacher_obs_map = {o.competency_id: o for o in teacher_observations}
    
    # Build scores list with full details
    scores = []
    for comp in competencies:
        self_score_obj = self_score_map.get(comp.id)
        teacher_obs_obj = teacher_obs_map.get(comp.id)
        
        scores.append(CompetencyScore(
            competency_id=comp.id,
            competency_name=comp.name,
            self_score=float(self_score_obj.score) if self_score_obj else None,
            peer_score=None,  # TODO: implement peer score calculation
            teacher_score=float(teacher_obs_obj.score) if teacher_obs_obj else None,
            final_score=float(self_score_obj.score) if self_score_obj else None,  # Simplified for now
            delta=None,  # TODO: implement delta calculation
        ))
    
    # Get goals
    goals = db.execute(
        select(CompetencyGoal).where(
            CompetencyGoal.window_id == window_id,
            CompetencyGoal.user_id == user_id,
        )
    ).scalars().all()
    
    # Get reflection
    reflection = db.execute(
        select(CompetencyReflection).where(
            CompetencyReflection.window_id == window_id,
            CompetencyReflection.user_id == user_id,
        )
    ).scalar_one_or_none()
    
    return StudentCompetencyOverview(
        window_id=window_id,
        user_id=user_id,
        user_name=student.name,
        scores=scores,
        goals=goals,
        reflection=reflection,
    )


@router.get("/windows/{window_id}/heatmap", response_model=ClassHeatmap)
def get_class_heatmap(
    window_id: int,
    class_name: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get class heatmap for a window (teacher only)"""
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Only teachers can view heatmap")
    
    window = db.get(CompetencyWindow, window_id)
    if not window or window.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Window not found")
    
    # Get all active competencies
    competencies = db.execute(
        select(Competency).where(
            Competency.school_id == current_user.school_id,
            Competency.active == True,
        ).order_by(Competency.order)
    ).scalars().all()
    
    # Get students (filter by class if specified)
    students_query = select(User).where(
        User.school_id == current_user.school_id,
        User.role == "student",
    )
    if class_name:
        students_query = students_query.where(User.class_name == class_name)
    students = db.execute(students_query).scalars().all()
    
    # Get all self scores for this window
    self_scores = db.execute(
        select(CompetencySelfScore).where(
            CompetencySelfScore.window_id == window_id,
        )
    ).scalars().all()
    
    # Build score map: user_id -> {competency_id -> score}
    score_map = {}
    for score in self_scores:
        if score.user_id not in score_map:
            score_map[score.user_id] = {}
        score_map[score.user_id][score.competency_id] = float(score.score)
    
    # Build rows
    rows = []
    for student in students:
        student_scores = score_map.get(student.id, {})
        rows.append(ClassHeatmapRow(
            user_id=student.id,
            user_name=student.name,
            scores=student_scores,
            deltas={},  # TODO: implement delta calculation
        ))
    
    return ClassHeatmap(
        window_id=window_id,
        window_title=window.title,
        competencies=competencies,
        rows=rows,
    )
