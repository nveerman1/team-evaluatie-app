"""
Users API endpoints
"""

from __future__ import annotations
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import User
from app.api.v1.schemas.users import UserOut
from app.core.rbac import require_role

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=List[UserOut])
def search_users(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    role: Optional[str] = Query(None, description="Filter by user role"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """
    Search users in the same school
    
    Can filter by role and search by name/email
    Only returns active (non-archived) users
    """
    if not user or not user.school_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )
    
    # Base query scoped to school, exclude archived users
    query = db.query(User).filter(
        User.school_id == user.school_id,
        User.archived == False,
    )
    
    # Filter by role
    if role:
        query = query.filter(User.role == role)
    
    # Search by name or email
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (User.name.ilike(search_pattern)) | (User.email.ilike(search_pattern))
        )
    
    # Pagination
    offset = (page - 1) * per_page
    users = query.order_by(User.name).offset(offset).limit(per_page).all()
    
    return [UserOut.model_validate(u) for u in users]
