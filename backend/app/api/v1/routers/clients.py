"""
Clients (Opdrachtgevers) API endpoints - Mock implementation
"""

from __future__ import annotations
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import datetime

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import User

router = APIRouter(prefix="/clients", tags=["clients"])


# Mock data
MOCK_CLIENTS = [
    {
        "id": "1",
        "organization": "Greystar",
        "contact_name": "Sanne de Vries",
        "email": "sanne.devries@greystar.nl",
        "level": "Bovenbouw",
        "sector": "Vastgoed",
        "tags": ["Duurzaamheid", "Mixed-use", "Stadsontwikkeling"],
        "active": True,
        "projects_this_year": 3,
        "last_active": "2025-03-10",
        "status": "Actief",
    },
    {
        "id": "2",
        "organization": "Koninklijke Marine",
        "contact_name": "Richard Gans",
        "email": "r.gans@mindef.nl",
        "level": "Bovenbouw",
        "sector": "Defensie",
        "tags": ["Defensie", "Innovatie"],
        "active": True,
        "projects_this_year": 1,
        "last_active": "2025-01-22",
        "status": "Actief",
    },
    {
        "id": "3",
        "organization": "Rijndam Revalidatie",
        "contact_name": "Lotte Janssen",
        "email": "l.janssen@rijndam.nl",
        "level": "Onderbouw",
        "sector": "Zorg",
        "tags": ["Healthcare", "Toegankelijkheid"],
        "active": False,
        "projects_this_year": 0,
        "last_active": "2023-11-05",
        "status": "Inactief",
    },
]

MOCK_PROJECTS = {
    "1": [
        {
            "id": "p1",
            "name": "Gemeenschappelijke ruimte mixed-use gebouw",
            "year": "2024–2025",
            "level": "5 VWO",
            "class_name": "5V1",
            "teams": 4,
            "role": "Hoofdopdrachtgever",
        },
        {
            "id": "p2",
            "name": "Bewonersbeleving & gedeelde functies",
            "year": "2023–2024",
            "level": "4 HAVO",
            "class_name": "4H2",
            "teams": 3,
            "role": "Hoofdopdrachtgever",
        },
    ],
}

MOCK_LOG = {
    "1": [
        {
            "id": "l1",
            "date": "2025-03-01",
            "type": "Notitie",
            "text": "Greystar wil volgend jaar graag weer een project, liefst in periode 3.",
            "author": "Nick Veerman",
        },
        {
            "id": "l2",
            "date": "2025-02-10",
            "type": "Mail (template)",
            "text": "Bedankmail eindpresentatie verzonden.",
            "author": "Systeem",
        },
        {
            "id": "l3",
            "date": "2025-01-20",
            "type": "Notitie",
            "text": "Tussenpresentatie goed verlopen, stellen peerfeedback erg op prijs.",
            "author": "Nick Veerman",
        },
    ],
}

MOCK_REMINDERS = [
    {
        "id": "1",
        "text": "Uitnodiging tussenpresentatie versturen aan Greystar (5V1)",
        "client_name": "Greystar",
        "client_email": "sanne.devries@greystar.nl",
        "due_date": "2025-11-20",
        "template": "tussenpresentatie",
    },
    {
        "id": "2",
        "text": "Bevestigingsmail eindpresentatie versturen aan Marine (4H2)",
        "client_name": "Koninklijke Marine",
        "client_email": "r.gans@mindef.nl",
        "due_date": "2025-11-25",
        "template": "eindpresentatie",
    },
    {
        "id": "3",
        "text": "Bedankmail versturen aan Rijndam (3H1)",
        "client_name": "Rijndam Revalidatie",
        "client_email": "l.janssen@rijndam.nl",
        "due_date": "2025-11-18",
        "template": "bedankmail",
    },
]


@router.get("/upcoming-reminders")
def get_upcoming_reminders(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get upcoming client communication reminders (mock data)
    """
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    return {
        "items": MOCK_REMINDERS,
        "total": len(MOCK_REMINDERS),
    }


@router.get("")
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
    List all clients (mock data)
    """
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    # Filter mock data
    clients = MOCK_CLIENTS.copy()
    
    if level and level != "Alle":
        clients = [c for c in clients if c["level"] == level]
    
    if status:
        clients = [c for c in clients if c["status"] == status]
    
    if search:
        search_lower = search.lower()
        clients = [
            c for c in clients 
            if search_lower in c["organization"].lower() 
            or search_lower in c["contact_name"].lower()
        ]
    
    # Pagination
    start = (page - 1) * per_page
    end = start + per_page
    paginated_clients = clients[start:end]
    
    return {
        "items": paginated_clients,
        "total": len(clients),
        "page": page,
        "per_page": per_page,
        "pages": (len(clients) + per_page - 1) // per_page,
    }


@router.get("/{client_id}")
def get_client(
    client_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get a specific client by ID (mock data)
    """
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    client = next((c for c in MOCK_CLIENTS if c["id"] == client_id), None)
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    return client


@router.get("/{client_id}/projects")
def get_client_projects(
    client_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get projects linked to a specific client (mock data)
    """
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    projects = MOCK_PROJECTS.get(client_id, [])
    
    return {
        "items": projects,
        "total": len(projects),
    }


@router.get("/{client_id}/log")
def get_client_log(
    client_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get log entries for a specific client (mock data)
    """
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    log_entries = MOCK_LOG.get(client_id, [])
    
    return {
        "items": log_entries,
        "total": len(log_entries),
    }


@router.post("/{client_id}/log")
def create_log_entry(
    client_id: str,
    log_entry: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Create a new log entry for a client (mock implementation)
    """
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    # Mock: just return the entry with an ID
    new_entry = {
        "id": f"l{len(MOCK_LOG.get(client_id, [])) + 1}",
        "date": datetime.now().isoformat(),
        "type": log_entry.get("type", "Notitie"),
        "text": log_entry.get("text", ""),
        "author": user.name or user.email,
    }
    
    # In a real implementation, this would be saved to the database
    if client_id not in MOCK_LOG:
        MOCK_LOG[client_id] = []
    MOCK_LOG[client_id].insert(0, new_entry)
    
    return new_entry
