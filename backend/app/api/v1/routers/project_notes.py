"""
PROJECT NOTES API ENDPOINTS
===========================

This module provides endpoints for the Projectaantekeningen (Project Notes) feature.
Teachers can create notes on projects, teams, and individual students, linking observations
to OMZA categories and competencies.
"""

from __future__ import annotations
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    User,
    ProjectNotesContext,
    ProjectNote,
    Course,
    Group,
    GroupMember,
    LearningObjective,
)
from app.api.v1.schemas.project_notes import (
    ProjectNotesContextOut,
    ProjectNotesContextCreate,
    ProjectNotesContextUpdate,
    ProjectNotesContextDetailOut,
    ProjectNoteOut,
    ProjectNoteCreate,
    ProjectNoteUpdate,
    TeamInfo,
    StudentInfo,
)
from app.core.rbac import require_role
from app.core.audit import log_create, log_update, log_delete

router = APIRouter(prefix="/project-notes", tags=["project-notes"])


def serialize_note(note: ProjectNote, db: Session) -> dict:
    """Helper function to serialize a ProjectNote to dict with proper metadata handling"""
    note_dict = {
        "id": note.id,
        "context_id": note.context_id,
        "note_type": note.note_type,
        "team_id": note.team_id,
        "student_id": note.student_id,
        "text": note.text,
        "tags": note.tags,
        "omza_category": note.omza_category,
        "learning_objective_id": note.learning_objective_id,
        "is_competency_evidence": note.is_competency_evidence,
        "is_portfolio_evidence": note.is_portfolio_evidence,
        "metadata": note.note_metadata,  # Map note_metadata to metadata
        "created_by": note.created_by,
        "created_at": note.created_at,
        "updated_at": note.updated_at,
    }

    # Add joined data
    if note.team_id:
        team = db.query(Group).filter(Group.id == note.team_id).first()
        note_dict["team_name"] = team.name if team else None
    else:
        note_dict["team_name"] = None

    if note.student_id:
        student = db.query(User).filter(User.id == note.student_id).first()
        note_dict["student_name"] = student.name if student else None
    else:
        note_dict["student_name"] = None

    if note.learning_objective_id:
        lo = (
            db.query(LearningObjective)
            .filter(LearningObjective.id == note.learning_objective_id)
            .first()
        )
        note_dict["learning_objective_title"] = lo.title if lo else None
    else:
        note_dict["learning_objective_title"] = None

    creator = db.query(User).filter(User.id == note.created_by).first()
    note_dict["created_by_name"] = creator.name if creator else None

    return note_dict


@router.get("/contexts", response_model=List[ProjectNotesContextOut])
async def list_contexts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    course_id: Optional[int] = Query(None),
    class_name: Optional[str] = Query(None),
):
    """List all project note contexts for the current teacher."""
    require_role(current_user, ["teacher", "admin"])

    query = db.query(ProjectNotesContext).filter(
        ProjectNotesContext.school_id == current_user.school_id,
        ProjectNotesContext.created_by == current_user.id,
    )

    if course_id:
        query = query.filter(ProjectNotesContext.course_id == course_id)
    if class_name:
        query = query.filter(ProjectNotesContext.class_name == class_name)

    contexts = query.order_by(ProjectNotesContext.created_at.desc()).all()

    # Enrich with course names and note counts
    results = []
    for context in contexts:
        context_dict = ProjectNotesContextOut.model_validate(context).model_dump()

        # Add course name
        if context.course_id:
            course = db.query(Course).filter(Course.id == context.course_id).first()
            context_dict["course_name"] = course.name if course else None

        # Add creator name
        creator = db.query(User).filter(User.id == context.created_by).first()
        context_dict["created_by_name"] = creator.name if creator else None

        # Add note count
        note_count = (
            db.query(func.count(ProjectNote.id))
            .filter(ProjectNote.context_id == context.id)
            .scalar()
        )
        context_dict["note_count"] = note_count or 0

        results.append(ProjectNotesContextOut(**context_dict))

    return results


@router.post(
    "/contexts",
    response_model=ProjectNotesContextOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_context(
    data: ProjectNotesContextCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    """Create a new project notes context."""
    require_role(current_user, ["teacher", "admin"])

    # Verify course exists if provided
    if data.course_id:
        course = (
            db.query(Course)
            .filter(
                Course.id == data.course_id,
                Course.school_id == current_user.school_id,
            )
            .first()
        )
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found",
            )

    context = ProjectNotesContext(
        school_id=current_user.school_id,
        title=data.title,
        project_id=data.project_id,
        course_id=data.course_id,
        class_name=data.class_name,
        description=data.description,
        evaluation_id=data.evaluation_id,
        created_by=current_user.id,
        settings=data.settings,
    )

    db.add(context)
    db.flush()

    # Log the action
    log_create(
        db=db,
        user=current_user,
        entity_type="project_notes_context",
        entity_id=context.id,
        details={"title": context.title},
        request=request,
    )

    db.commit()
    db.refresh(context)

    # Enrich response
    context_dict = ProjectNotesContextOut.model_validate(context).model_dump()
    context_dict["created_by_name"] = current_user.name
    context_dict["note_count"] = 0

    if context.course_id:
        course = db.query(Course).filter(Course.id == context.course_id).first()
        context_dict["course_name"] = course.name if course else None

    return ProjectNotesContextOut(**context_dict)


@router.get("/contexts/{context_id}", response_model=ProjectNotesContextDetailOut)
async def get_context(
    context_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get details of a specific project notes context."""
    require_role(current_user, ["teacher", "admin"])

    context = (
        db.query(ProjectNotesContext)
        .filter(
            ProjectNotesContext.id == context_id,
            ProjectNotesContext.school_id == current_user.school_id,
        )
        .first()
    )

    if not context:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Context not found",
        )

    # Build basic response
    context_dict = ProjectNotesContextOut.model_validate(context).model_dump()

    # Add course name
    if context.course_id:
        course = db.query(Course).filter(Course.id == context.course_id).first()
        context_dict["course_name"] = course.name if course else None

    # Add creator name
    creator = db.query(User).filter(User.id == context.created_by).first()
    context_dict["created_by_name"] = creator.name if creator else None

    # Add note count
    note_count = (
        db.query(func.count(ProjectNote.id))
        .filter(ProjectNote.context_id == context.id)
        .scalar()
    )
    context_dict["note_count"] = note_count or 0

    # Get teams for this context (based on course_id)
    # Teams are formed by grouping students by their team_number field
    teams = []
    students = []

    if context.course_id:
        # Get all students in this course via GroupMember
        all_students = (
            db.query(User)
            .join(GroupMember, GroupMember.user_id == User.id)
            .join(Group, Group.id == GroupMember.group_id)
            .filter(
                Group.course_id == context.course_id,
                Group.school_id == current_user.school_id,
                GroupMember.active,
                User.role == "student",
            )
            .distinct()
            .all()
        )

        # Group students by team_number
        teams_dict = {}
        students_without_team = []
        
        for student in all_students:
            if student.team_number is not None:
                team_num = student.team_number
                if team_num not in teams_dict:
                    teams_dict[team_num] = []
                teams_dict[team_num].append(student)
            else:
                students_without_team.append(student)

        # Create TeamInfo for each team
        for team_num in sorted(teams_dict.keys()):
            team_members = teams_dict[team_num]
            member_names = [m.name for m in team_members]
            member_ids = [m.id for m in team_members]

            teams.append(
                TeamInfo(
                    id=team_num,  # Use team_number as ID
                    name=f"Team {team_num}",
                    team_number=team_num,
                    member_count=len(member_names),
                    members=member_names,
                    member_ids=member_ids,
                )
            )

            # Add team students to the students list
            for member in team_members:
                students.append(
                    StudentInfo(
                        id=member.id,
                        name=member.name,
                        team_id=team_num,
                        team_name=f"Team {team_num}",
                    )
                )
        
        # Add students without teams
        for student in students_without_team:
            students.append(
                StudentInfo(
                    id=student.id,
                    name=student.name,
                    team_id=None,
                    team_name=None,
                )
            )

    context_dict["teams"] = teams
    context_dict["students"] = students

    return ProjectNotesContextDetailOut(**context_dict)


@router.put("/contexts/{context_id}", response_model=ProjectNotesContextOut)
async def update_context(
    context_id: int,
    data: ProjectNotesContextUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    """Update a project notes context."""
    require_role(current_user, ["teacher", "admin"])

    context = (
        db.query(ProjectNotesContext)
        .filter(
            ProjectNotesContext.id == context_id,
            ProjectNotesContext.school_id == current_user.school_id,
        )
        .first()
    )

    if not context:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Context not found",
        )

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(context, field, value)

    # Log the action
    log_update(
        db=db,
        user=current_user,
        entity_type="project_notes_context",
        entity_id=context.id,
        details=update_data,
        request=request,
    )

    db.commit()
    db.refresh(context)

    # Enrich response
    context_dict = ProjectNotesContextOut.model_validate(context).model_dump()

    if context.course_id:
        course = db.query(Course).filter(Course.id == context.course_id).first()
        context_dict["course_name"] = course.name if course else None

    creator = db.query(User).filter(User.id == context.created_by).first()
    context_dict["created_by_name"] = creator.name if creator else None

    note_count = (
        db.query(func.count(ProjectNote.id))
        .filter(ProjectNote.context_id == context.id)
        .scalar()
    )
    context_dict["note_count"] = note_count or 0

    return ProjectNotesContextOut(**context_dict)


@router.delete("/contexts/{context_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_context(
    context_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    """Delete a project notes context and all its notes."""
    require_role(current_user, ["teacher", "admin"])

    context = (
        db.query(ProjectNotesContext)
        .filter(
            ProjectNotesContext.id == context_id,
            ProjectNotesContext.school_id == current_user.school_id,
        )
        .first()
    )

    if not context:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Context not found",
        )

    # Log the action
    log_delete(
        db=db,
        user=current_user,
        entity_type="project_notes_context",
        entity_id=context.id,
        details={"title": context.title},
        request=request,
    )

    db.delete(context)
    db.commit()


@router.get("/contexts/{context_id}/notes", response_model=List[ProjectNoteOut])
async def list_notes(
    context_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    note_type: Optional[str] = Query(None),
    team_id: Optional[int] = Query(None),
    student_id: Optional[int] = Query(None),
    omza_category: Optional[str] = Query(None),
):
    """Get all notes for a specific context with optional filters."""
    require_role(current_user, ["teacher", "admin"])

    # Verify context exists and belongs to user's school
    context = (
        db.query(ProjectNotesContext)
        .filter(
            ProjectNotesContext.id == context_id,
            ProjectNotesContext.school_id == current_user.school_id,
        )
        .first()
    )

    if not context:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Context not found",
        )

    query = db.query(ProjectNote).filter(ProjectNote.context_id == context_id)

    if note_type:
        query = query.filter(ProjectNote.note_type == note_type)
    if team_id:
        query = query.filter(ProjectNote.team_id == team_id)
    if student_id:
        query = query.filter(ProjectNote.student_id == student_id)
    if omza_category:
        query = query.filter(ProjectNote.omza_category == omza_category)

    notes = query.order_by(ProjectNote.created_at.desc()).all()

    # Serialize with joined data
    results = [ProjectNoteOut(**serialize_note(note, db)) for note in notes]
    return results


@router.post(
    "/contexts/{context_id}/notes",
    response_model=ProjectNoteOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_note(
    context_id: int,
    data: ProjectNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    """Create a new note in the context."""
    require_role(current_user, ["teacher", "admin"])

    # Verify context exists
    context = (
        db.query(ProjectNotesContext)
        .filter(
            ProjectNotesContext.id == context_id,
            ProjectNotesContext.school_id == current_user.school_id,
        )
        .first()
    )

    if not context:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Context not found",
        )

    # Validate note type requirements
    if data.note_type == "team" and not data.team_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="team_id is required for team notes",
        )
    if data.note_type == "student" and not data.student_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="student_id is required for student notes",
        )

    note = ProjectNote(
        context_id=context_id,
        note_type=data.note_type,
        team_id=data.team_id,
        student_id=data.student_id,
        text=data.text,
        tags=data.tags,
        omza_category=data.omza_category,
        learning_objective_id=data.learning_objective_id,
        is_competency_evidence=data.is_competency_evidence,
        is_portfolio_evidence=data.is_portfolio_evidence,
        note_metadata=data.metadata,
        created_by=current_user.id,
    )

    db.add(note)
    db.flush()

    # Log the action
    log_create(
        db=db,
        user=current_user,
        entity_type="project_note",
        entity_id=note.id,
        details={"context_id": context_id, "note_type": data.note_type},
        request=request,
    )

    db.commit()
    db.refresh(note)

    # Serialize and return
    return ProjectNoteOut(**serialize_note(note, db))


@router.get("/notes/{note_id}", response_model=ProjectNoteOut)
async def get_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific note by ID."""
    require_role(current_user, ["teacher", "admin"])

    note = (
        db.query(ProjectNote)
        .join(ProjectNotesContext, ProjectNotesContext.id == ProjectNote.context_id)
        .filter(
            ProjectNote.id == note_id,
            ProjectNotesContext.school_id == current_user.school_id,
        )
        .first()
    )

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found",
        )

    # Serialize and return
    return ProjectNoteOut(**serialize_note(note, db))


@router.put("/notes/{note_id}", response_model=ProjectNoteOut)
async def update_note(
    note_id: int,
    data: ProjectNoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    """Update a note."""
    require_role(current_user, ["teacher", "admin"])

    note = (
        db.query(ProjectNote)
        .join(ProjectNotesContext, ProjectNotesContext.id == ProjectNote.context_id)
        .filter(
            ProjectNote.id == note_id,
            ProjectNotesContext.school_id == current_user.school_id,
        )
        .first()
    )

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found",
        )

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        # Handle metadata field name mapping
        if field == "metadata":
            setattr(note, "note_metadata", value)
        else:
            setattr(note, field, value)

    # Log the action
    log_update(
        db=db,
        user=current_user,
        entity_type="project_note",
        entity_id=note.id,
        details=update_data,
        request=request,
    )

    db.commit()
    db.refresh(note)

    # Serialize and return
    return ProjectNoteOut(**serialize_note(note, db))


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    """Delete a specific note."""
    require_role(current_user, ["teacher", "admin"])

    note = (
        db.query(ProjectNote)
        .join(ProjectNotesContext, ProjectNotesContext.id == ProjectNote.context_id)
        .filter(
            ProjectNote.id == note_id,
            ProjectNotesContext.school_id == current_user.school_id,
        )
        .first()
    )

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found",
        )

    # Log the action
    log_delete(
        db=db,
        user=current_user,
        entity_type="project_note",
        entity_id=note.id,
        details={"context_id": note.context_id, "note_type": note.note_type},
        request=request,
    )

    db.delete(note)
    db.commit()


@router.get("/contexts/{context_id}/timeline", response_model=List[ProjectNoteOut])
async def get_timeline(
    context_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get chronological timeline of all notes in a context."""
    require_role(current_user, ["teacher", "admin"])

    # Verify context exists
    context = (
        db.query(ProjectNotesContext)
        .filter(
            ProjectNotesContext.id == context_id,
            ProjectNotesContext.school_id == current_user.school_id,
        )
        .first()
    )

    if not context:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Context not found",
        )

    notes = (
        db.query(ProjectNote)
        .filter(ProjectNote.context_id == context_id)
        .order_by(ProjectNote.created_at.desc())
        .all()
    )

    # Serialize with joined data
    results = [ProjectNoteOut(**serialize_note(note, db)) for note in notes]
    return results
