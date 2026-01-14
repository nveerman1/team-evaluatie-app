"""
Somtoday integration API endpoints

Placeholder endpoints for Somtoday integration
"""

from __future__ import annotations
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import User
from app.core.rbac import require_role

router = APIRouter(prefix="/integrations/somtoday", tags=["integrations"])


class SomtodayConnectionStatus(BaseModel):
    """Status of Somtoday connection"""

    connected: bool
    school_name: Optional[str] = None
    last_sync: Optional[str] = None
    error: Optional[str] = None


class ImportStudentsRequest(BaseModel):
    """Request to import students from Somtoday"""

    class_id: Optional[str] = None
    course_id: int
    create_groups: bool = True


class ImportStudentsResponse(BaseModel):
    """Response from importing students"""

    success: bool
    created: int
    updated: int
    skipped: int
    errors: int
    message: str


class ExportGradesRequest(BaseModel):
    """Request to export grades to Somtoday"""

    evaluation_id: int
    course_code: str
    description: Optional[str] = None


class ExportGradesResponse(BaseModel):
    """Response from exporting grades"""

    success: bool
    exported: int
    failed: int
    message: str


@router.get("/status", response_model=SomtodayConnectionStatus)
def get_somtoday_status(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get Somtoday connection status for current school
    
    Only admins can check connection status
    """
    require_role(user, ["admin"])
    
    # TODO: Check if school has Somtoday credentials configured
    # TODO: Test connection with stored credentials
    
    return SomtodayConnectionStatus(
        connected=False,
        error="Somtoday integration not yet configured. Please contact support.",
    )


@router.get("/authorize")
def start_oauth_flow(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    redirect_uri: Optional[str] = None,
):
    """
    Start OAuth2 authorization flow with Somtoday
    
    Only admins can authorize Somtoday connection
    """
    require_role(user, ["admin"])
    
    # TODO: Generate state token and store in session/database
    # TODO: Use SomtodayClient to generate authorization URL
    # TODO: Redirect user to Somtoday authorization page
    
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="OAuth2 authorization not yet implemented",
    )


@router.get("/callback")
def oauth_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    OAuth2 callback from Somtoday
    
    Exchanges authorization code for access token
    """
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Authorization failed: {error}",
        )
    
    if not code or not state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing code or state parameter",
        )
    
    # TODO: Verify state token
    # TODO: Exchange code for access token using SomtodayClient
    # TODO: Store tokens securely in database
    # TODO: Redirect user to success page
    
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="OAuth2 callback not yet implemented",
    )


@router.post("/import/classes", response_model=Dict[str, Any])
async def import_classes(
    course_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Import classes from Somtoday as Groups
    
    Only admins and teachers can import classes
    """
    require_role(user, ["admin", "teacher"])
    
    # TODO: Get access token for school
    # TODO: Fetch classes from Somtoday API
    # TODO: Map classes to Group model using mappers
    # TODO: Create/update groups in database
    # TODO: Return import results
    
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Class import not yet implemented",
    )


@router.post("/import/students", response_model=ImportStudentsResponse)
async def import_students(
    payload: ImportStudentsRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Import students from Somtoday
    
    Creates User records and optionally adds them to groups
    Only admins and teachers can import students
    """
    require_role(user, ["admin", "teacher"])
    
    # TODO: Get access token for school
    # TODO: Fetch students from Somtoday API (optionally filtered by class)
    # TODO: Match existing users by email or leerlingnummer
    # TODO: Create new users or update existing ones
    # TODO: If create_groups=True, add students to appropriate groups
    # TODO: Return detailed import results
    
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Student import not yet implemented. "
        "Use CSV import as fallback: POST /api/v1/students/import",
    )


@router.post("/export/grades", response_model=ExportGradesResponse)
async def export_grades(
    payload: ExportGradesRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Export grades to Somtoday
    
    Requires write permissions (somtoday.write.grades scope)
    Only admins and teachers can export grades
    """
    require_role(user, ["admin", "teacher"])
    
    # TODO: Check if user has write permissions
    # TODO: Get access token for school with write scope
    # TODO: Fetch grades for specified evaluation
    # TODO: Map grades to Somtoday format using mappers
    # TODO: Export grades via Somtoday API
    # TODO: Return export results
    
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Grade export not yet implemented. "
        "Use CSV export as fallback: GET /api/v1/grades/export",
    )


@router.delete("/disconnect")
def disconnect_somtoday(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Disconnect Somtoday integration
    
    Removes stored credentials and tokens
    Only admins can disconnect
    """
    require_role(user, ["admin"])
    
    # TODO: Remove stored tokens from database
    # TODO: Revoke tokens with Somtoday if possible
    
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Disconnect not yet implemented",
    )
