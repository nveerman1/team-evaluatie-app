"""
Clients (Opdrachtgevers) API endpoints
"""

from __future__ import annotations
from typing import Optional
from io import StringIO
import csv
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc
from datetime import datetime

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import User, Client, ClientLog, ClientProjectLink, Project
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
    ReminderOut,
)
from app.infra.services.reminder_service import ReminderService
from app.infra.services.email_template_service import EmailTemplateService

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("/upcoming-reminders", response_model=ReminderListOut)
def get_upcoming_reminders(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    days_ahead: int = Query(30, ge=1, le=90),
):
    """
    Get upcoming client communication reminders based on project deadlines
    """
    reminders_data = ReminderService.generate_reminders(
        db, user.school_id, days_ahead=days_ahead
    )
    
    # Convert to ReminderOut schema
    items = [ReminderOut(**reminder) for reminder in reminders_data]
    
    return ReminderListOut(items=items, total=len(items))


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
            .join(Project)
            .filter(
                ClientProjectLink.client_id == client.id,
                func.extract("year", Project.created_at) == current_year,
            )
            .scalar()
            or 0
        )
        
        # Get last active date (most recent project end_date or created_at)
        last_project = (
            db.query(ClientProjectLink)
            .join(Project)
            .filter(ClientProjectLink.client_id == client.id)
            .order_by(desc(Project.created_at))
            .first()
        )
        
        last_active = None
        if last_project:
            last_active = (
                last_project.end_date or last_project.project.created_at
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
    
    # Format project data
    items = []
    for link in project_links:
        project = link.project
        items.append({
            "id": project.id,
            "title": project.title,
            "role": link.role,
            "start_date": link.start_date.isoformat() if link.start_date else None,
            "end_date": link.end_date.isoformat() if link.end_date else None,
        })
    
    return {
        "items": items,
        "total": len(items),
    }


@router.post("/{client_id}/projects/{project_id}", status_code=status.HTTP_201_CREATED)
def link_project_to_client(
    client_id: int,
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    role: str = Query("main", description="Role of the client in the project"),
):
    """
    Link a project to a client
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
    
    # Verify project exists and belongs to user's school
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.school_id == user.school_id)
        .first()
    )
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    
    # Check if link already exists
    existing_link = (
        db.query(ClientProjectLink)
        .filter(
            ClientProjectLink.client_id == client_id,
            ClientProjectLink.project_id == project_id,
        )
        .first()
    )
    
    if existing_link:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project is already linked to this client",
        )
    
    # Create new link
    new_link = ClientProjectLink(
        client_id=client_id,
        project_id=project_id,
        role=role,
        start_date=project.start_date,
        end_date=project.end_date,
    )
    
    db.add(new_link)
    db.commit()
    db.refresh(new_link)
    
    return {
        "id": new_link.id,
        "client_id": client_id,
        "project_id": project_id,
        "role": role,
    }


@router.delete("/{client_id}/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def unlink_project_from_client(
    client_id: int,
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Unlink a project from a client
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
    
    # Find and delete the link
    link = (
        db.query(ClientProjectLink)
        .filter(
            ClientProjectLink.client_id == client_id,
            ClientProjectLink.project_id == project_id,
        )
        .first()
    )
    
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project link not found",
        )
    
    db.delete(link)
    db.commit()


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


@router.get("/export/csv")
def export_clients_csv(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    level: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
):
    """
    Export clients to CSV file
    """
    # Build query with same filters as list endpoint
    query = db.query(Client).filter(Client.school_id == user.school_id)
    
    if level and level != "Alle":
        query = query.filter(Client.level == level)
    
    if status:
        if status == "Actief":
            query = query.filter(Client.active.is_(True))
        elif status == "Inactief":
            query = query.filter(Client.active.is_(False))
    
    if search:
        search_filter = or_(
            Client.organization.ilike(f"%{search}%"),
            Client.contact_name.ilike(f"%{search}%"),
        )
        query = query.filter(search_filter)
    
    clients = query.all()
    
    # Create CSV in memory
    output = StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        "ID",
        "Organisatie",
        "Contactpersoon",
        "Email",
        "Telefoon",
        "Niveau",
        "Sector",
        "Tags",
        "Actief",
        "Aangemaakt",
        "Laatst bijgewerkt",
    ])
    
    # Write data
    for client in clients:
        writer.writerow([
            client.id,
            client.organization,
            client.contact_name or "",
            client.email or "",
            client.phone or "",
            client.level or "",
            client.sector or "",
            ", ".join(client.tags) if client.tags else "",
            "Ja" if client.active else "Nee",
            client.created_at.strftime("%Y-%m-%d %H:%M") if client.created_at else "",
            client.updated_at.strftime("%Y-%m-%d %H:%M") if client.updated_at else "",
        ])
    
    # Prepare response
    output.seek(0)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"opdrachtgevers_{timestamp}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/templates")
def list_email_templates(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    List all available email templates
    """
    templates = EmailTemplateService.list_templates()
    
    # Format for response
    template_list = [
        {
            "key": key,
            "name": template["name"],
            "subject": template["subject"],
            "variables": EmailTemplateService.get_template_variables(key),
        }
        for key, template in templates.items()
    ]
    
    return {"templates": template_list}


@router.post("/templates/{template_key}/render")
def render_email_template(
    template_key: str,
    variables: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Render an email template with provided variables
    """
    rendered = EmailTemplateService.render_template(template_key, variables)
    
    if not rendered:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    
    return rendered
