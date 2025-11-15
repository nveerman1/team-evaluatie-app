"""
Clients (Opdrachtgevers) API endpoints
"""

from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc
from datetime import datetime

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import User, Client, ClientLog, ClientProjectLink, ProjectAssessment
from app.api.v1.schemas.clients import (
    ClientCreate,
    ClientUpdate,
    ClientOut,
    ClientListItem,
    ClientListOut,
    ClientLogCreate,
    ClientLogOut,
    ClientLogListOut,
    ReminderListOut,
)

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("/upcoming-reminders", response_model=ReminderListOut)
def get_upcoming_reminders(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get upcoming client communication reminders based on project deadlines
    """
    # For now, return empty list as we need to implement the reminder generation logic
    # based on project assessment phases and deadlines
    # TODO: Implement reminder generation based on project_assessments table
    return ReminderListOut(items=[], total=0)


@router.get("", response_model=ClientListOut)
def list_clients(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    level: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
):
    """
    List all clients with filtering and pagination
    """
    # Base query - filter by school
    query = db.query(Client).filter(Client.school_id == user.school_id)
    
    # Filter by level
    if level and level != "Alle":
        query = query.filter(Client.level == level)
    
    # Filter by status (active/inactive)
    if status:
        if status == "Actief":
            query = query.filter(Client.active.is_(True))
        elif status == "Inactief":
            query = query.filter(Client.active.is_(False))
    
    # Search filter
    if search:
        search_filter = or_(
            Client.organization.ilike(f"%{search}%"),
            Client.contact_name.ilike(f"%{search}%"),
        )
        query = query.filter(search_filter)
    
    # Count total before pagination
    total = query.count()
    
    # Apply pagination
    query = query.offset((page - 1) * per_page).limit(per_page)
    
    # Get clients
    clients = query.all()
    
    # Calculate computed fields for each client
    current_year = datetime.now().year
    
    items = []
    for client in clients:
        # Count projects this year
        projects_this_year = (
            db.query(func.count(ClientProjectLink.id))
            .join(ProjectAssessment)
            .filter(
                ClientProjectLink.client_id == client.id,
                func.extract("year", ProjectAssessment.created_at) == current_year,
            )
            .scalar()
            or 0
        )
        
        # Get last active date (most recent project end_date or created_at)
        last_project = (
            db.query(ClientProjectLink)
            .join(ProjectAssessment)
            .filter(ClientProjectLink.client_id == client.id)
            .order_by(desc(ProjectAssessment.created_at))
            .first()
        )
        
        last_active = None
        if last_project:
            last_active = (
                last_project.end_date or last_project.project_assessment.created_at
            ).strftime("%Y-%m-%d")
        
        # Determine status based on activity
        status_value = "Actief" if client.active else "Inactief"
        
        items.append(
            ClientListItem(
                id=client.id,
                organization=client.organization,
                contact_name=client.contact_name,
                email=client.email,
                level=client.level,
                sector=client.sector,
                tags=client.tags or [],
                active=client.active,
                projects_this_year=projects_this_year,
                last_active=last_active,
                status=status_value,
            )
        )
    
    # Calculate pages
    pages = (total + per_page - 1) // per_page if total > 0 else 0
    
    return ClientListOut(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


@router.get("/{client_id}", response_model=ClientOut)
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get a specific client by ID
    """
    client = (
        db.query(Client)
        .filter(Client.id == client_id, Client.school_id == user.school_id)
        .first()
    )
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    
    return client


@router.get("/{client_id}/projects")
def get_client_projects(
    client_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get projects linked to a specific client
    """
    # Verify client exists and belongs to user's school
    client = (
        db.query(Client)
        .filter(Client.id == client_id, Client.school_id == user.school_id)
        .first()
    )
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    
    # Get all project links for this client
    project_links = (
        db.query(ClientProjectLink)
        .filter(ClientProjectLink.client_id == client_id)
        .all()
    )
    
    # TODO: Format project data with assessment details
    # For now, return basic structure
    items = []
    for link in project_links:
        assessment = link.project_assessment
        items.append({
            "id": assessment.id,
            "title": assessment.title,
            "role": link.role,
            "start_date": link.start_date.isoformat() if link.start_date else None,
            "end_date": link.end_date.isoformat() if link.end_date else None,
        })
    
    return {
        "items": items,
        "total": len(items),
    }


@router.get("/{client_id}/log", response_model=ClientLogListOut)
def get_client_log(
    client_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get log entries for a specific client
    """
    # Verify client exists and belongs to user's school
    client = (
        db.query(Client)
        .filter(Client.id == client_id, Client.school_id == user.school_id)
        .first()
    )
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    
    # Get log entries ordered by most recent first
    logs = (
        db.query(ClientLog)
        .filter(ClientLog.client_id == client_id)
        .order_by(desc(ClientLog.created_at))
        .all()
    )
    
    # Add author names to log entries
    items = []
    for log in logs:
        log_out = ClientLogOut.model_validate(log)
        log_out.author_name = log.author.name if log.author else "Unknown"
        items.append(log_out)
    
    return ClientLogListOut(items=items, total=len(items))


@router.post("/{client_id}/log", response_model=ClientLogOut, status_code=status.HTTP_201_CREATED)
def create_log_entry(
    client_id: int,
    log_entry: ClientLogCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Create a new log entry for a client
    """
    # Verify client exists and belongs to user's school
    client = (
        db.query(Client)
        .filter(Client.id == client_id, Client.school_id == user.school_id)
        .first()
    )
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    
    # Create new log entry
    new_log = ClientLog(
        client_id=client_id,
        author_id=user.id,
        log_type=log_entry.log_type,
        text=log_entry.text,
    )
    
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    
    # Add author name to response
    log_out = ClientLogOut.model_validate(new_log)
    log_out.author_name = user.name
    
    return log_out


@router.post("", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
def create_client(
    client_data: ClientCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Create a new client
    """
    # Only teachers and admins can create clients
    if user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can create clients",
        )
    
    # Create new client
    new_client = Client(
        school_id=user.school_id,
        organization=client_data.organization,
        contact_name=client_data.contact_name,
        email=client_data.email,
        phone=client_data.phone,
        level=client_data.level,
        sector=client_data.sector,
        tags=client_data.tags or [],
        active=client_data.active,
    )
    
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    
    return new_client


@router.put("/{client_id}", response_model=ClientOut)
def update_client(
    client_id: int,
    client_data: ClientUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Update an existing client
    """
    # Only teachers and admins can update clients
    if user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can update clients",
        )
    
    # Get client
    client = (
        db.query(Client)
        .filter(Client.id == client_id, Client.school_id == user.school_id)
        .first()
    )
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    
    # Update fields that are provided
    update_data = client_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(client, field, value)
    
    db.commit()
    db.refresh(client)
    
    return client


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Delete a client
    """
    # Only admins can delete clients
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete clients",
        )
    
    # Get client
    client = (
        db.query(Client)
        .filter(Client.id == client_id, Client.school_id == user.school_id)
        .first()
    )
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    
    db.delete(client)
    db.commit()
    
    return None
