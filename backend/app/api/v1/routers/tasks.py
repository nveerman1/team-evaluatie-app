"""
Tasks API endpoints for teacher task management (opdrachtgeverstaken)
"""

from __future__ import annotations
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    User,
    Task,
    Project,
    Client,
    Class,
    Course,
)
from app.api.v1.schemas.tasks import (
    TaskCreate,
    TaskUpdate,
    TaskOut,
    TaskListOut,
)
from app.core.rbac import require_role, scope_query_by_school
from app.core.audit import log_action

router = APIRouter(prefix="/teacher/tasks", tags=["teacher-tasks"])


def _enrich_task_output(task: Task, db: Session) -> dict:
    """
    Enrich task with related entity names for display
    """
    result = {
        "id": task.id,
        "school_id": task.school_id,
        "title": task.title,
        "description": task.description,
        "due_date": task.due_date,
        "status": task.status,
        "type": task.type,
        "project_id": task.project_id,
        "client_id": task.client_id,
        "class_id": task.class_id,
        "auto_generated": task.auto_generated,
        "source": task.source,
        "email_to": task.email_to,
        "email_cc": task.email_cc,
        "completed_at": task.completed_at,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
        "project_name": None,
        "class_name": None,
        "client_name": None,
        "client_email": None,
        "course_name": None,
    }
    
    # Enrich with project info
    if task.project_id:
        project = db.query(Project).filter(Project.id == task.project_id).first()
        if project:
            result["project_name"] = project.title
            result["class_name"] = project.class_name
            
            # Get course name if available
            if project.course_id:
                course = db.query(Course).filter(Course.id == project.course_id).first()
                if course:
                    result["course_name"] = course.name
    
    # Enrich with client info
    if task.client_id:
        client = db.query(Client).filter(Client.id == task.client_id).first()
        if client:
            result["client_name"] = client.organization
            result["client_email"] = client.email
    
    # Enrich with class info
    if task.class_id:
        class_obj = db.query(Class).filter(Class.id == task.class_id).first()
        if class_obj:
            result["class_name"] = class_obj.name
    
    return result


@router.get("", response_model=TaskListOut)
def list_tasks(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by status: open, done, dismissed"),
    type: Optional[str] = Query(None, description="Filter by type: opdrachtgever, docent, project"),
    from_date: Optional[str] = Query(None, alias="from", description="Filter tasks due from date (ISO format)"),
    to_date: Optional[str] = Query(None, alias="to", description="Filter tasks due to date (ISO format)"),
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    client_id: Optional[int] = Query(None, description="Filter by client ID"),
):
    """
    List all tasks for the current school with optional filters.
    Returns tasks sorted by due_date ascending (earliest first).
    Teachers and admins only.
    """
    require_role(user, ["admin", "teacher"])
    
    # Base query - filter by school
    query = scope_query_by_school(db.query(Task), Task, user)
    
    # Apply filters
    if status:
        query = query.filter(Task.status == status)
    
    if type:
        query = query.filter(Task.type == type)
    
    if from_date:
        try:
            from_dt = datetime.fromisoformat(from_date).date()
            query = query.filter(Task.due_date >= from_dt)
        except (ValueError, AttributeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid 'from' date format: {from_date}. Expected ISO format (YYYY-MM-DD)."
            )
    
    if to_date:
        try:
            to_dt = datetime.fromisoformat(to_date).date()
            query = query.filter(Task.due_date <= to_dt)
        except (ValueError, AttributeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid 'to' date format: {to_date}. Expected ISO format (YYYY-MM-DD)."
            )
    
    if project_id:
        query = query.filter(Task.project_id == project_id)
    
    if client_id:
        query = query.filter(Task.client_id == client_id)
    
    # Count total before pagination
    total = query.count()
    
    # Sort by due_date ascending (nulls last)
    query = query.order_by(Task.due_date.asc().nullslast(), Task.created_at.desc())
    
    # Paginate
    offset = (page - 1) * per_page
    tasks = query.offset(offset).limit(per_page).all()
    
    # Enrich tasks with context
    enriched_tasks = [TaskOut(**_enrich_task_output(task, db)) for task in tasks]
    
    return TaskListOut(
        items=enriched_tasks,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Create a new manual task.
    Auto-generated tasks are created by the system when projects are created/updated.
    Teachers and admins only.
    """
    require_role(user, ["admin", "teacher"])
    
    # Validate project exists and belongs to school
    if payload.project_id:
        project = (
            db.query(Project)
            .filter(Project.id == payload.project_id, Project.school_id == user.school_id)
            .first()
        )
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found or doesn't belong to your school",
            )
    
    # Validate client exists and belongs to school
    if payload.client_id:
        client = (
            db.query(Client)
            .filter(Client.id == payload.client_id, Client.school_id == user.school_id)
            .first()
        )
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found or doesn't belong to your school",
            )
    
    # Create task
    task = Task(
        school_id=user.school_id,
        title=payload.title,
        description=payload.description,
        due_date=payload.due_date,
        status=payload.status,
        type=payload.type,
        project_id=payload.project_id,
        client_id=payload.client_id,
        class_id=payload.class_id,
        email_to=payload.email_to,
        email_cc=payload.email_cc,
        auto_generated=False,
        source="manual",
    )
    
    db.add(task)
    db.commit()
    db.refresh(task)
    
    # Audit log
    log_action(
        db=db,
        user=user,
        action="create_task",
        resource_type="task",
        resource_id=task.id,
        details={"title": task.title, "type": task.type},
    )
    
    # Return enriched task
    return TaskOut(**_enrich_task_output(task, db))


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Update an existing task.
    Teachers and admins only.
    """
    require_role(user, ["admin", "teacher"])
    
    # Get task
    task = (
        db.query(Task)
        .filter(Task.id == task_id, Task.school_id == user.school_id)
        .first()
    )
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    
    # Update fields
    update_data = payload.model_dump(exclude_unset=True)
    
    # Special handling for status changes
    if "status" in update_data:
        if update_data["status"] == "done" and task.status != "done":
            task.completed_at = datetime.now(timezone.utc)
        elif update_data["status"] != "done" and task.status == "done":
            task.completed_at = None
    
    # Apply updates
    for field, value in update_data.items():
        setattr(task, field, value)
    
    db.commit()
    db.refresh(task)
    
    # Audit log
    log_action(
        db=db,
        user=user,
        action="update_task",
        resource_type="task",
        resource_id=task.id,
        details={"updated_fields": list(update_data.keys())},
    )
    
    # Return enriched task
    return TaskOut(**_enrich_task_output(task, db))


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Delete a task.
    Only manual tasks or auto-generated tasks can be deleted.
    Teachers and admins only.
    """
    require_role(user, ["admin", "teacher"])
    
    # Get task
    task = (
        db.query(Task)
        .filter(Task.id == task_id, Task.school_id == user.school_id)
        .first()
    )
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    
    # Audit log before deletion
    log_action(
        db=db,
        user=user,
        action="delete_task",
        resource_type="task",
        resource_id=task.id,
        details={
            "title": task.title,
            "type": task.type,
            "auto_generated": task.auto_generated,
        },
    )
    
    db.delete(task)
    db.commit()
    
    return None


@router.post("/{task_id}/complete", response_model=TaskOut)
def complete_task(
    task_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Mark a task as complete (convenience endpoint).
    Teachers and admins only.
    """
    require_role(user, ["admin", "teacher"])
    
    # Get task
    task = (
        db.query(Task)
        .filter(Task.id == task_id, Task.school_id == user.school_id)
        .first()
    )
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    
    # Mark as done
    task.status = "done"
    task.completed_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(task)
    
    # Audit log
    log_action(
        db=db,
        user=user,
        action="complete_task",
        resource_type="task",
        resource_id=task.id,
        details={"title": task.title},
    )
    
    # Return enriched task
    return TaskOut(**_enrich_task_output(task, db))
