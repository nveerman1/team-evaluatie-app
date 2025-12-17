"""
Users API endpoints
"""

from __future__ import annotations
from typing import Optional, List
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import User
from app.api.v1.schemas.users import UserOut, UserUpdateRole
from app.core.rbac import require_role

logger = logging.getLogger(__name__)
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
        User.archived.is_(False),
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


@router.patch("/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: int,
    role_update: UserUpdateRole,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update a user's role (admin only)

    This endpoint allows administrators to change user roles after
    auto-provisioning from Azure AD or for existing users.

    Only admins can update roles.
    Users can only be updated within the same school.
    """
    # Require admin role
    require_role(current_user, ["admin"])

    # Find user in same school
    target_user = (
        db.query(User)
        .filter(
            User.id == user_id,
            User.school_id == current_user.school_id,
        )
        .first()
    )

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found in your school",
        )

    # Prevent self-demotion from admin
    if target_user.id == current_user.id and role_update.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own admin role",
        )

    # Update role
    old_role = target_user.role
    target_user.role = role_update.role

    db.commit()
    db.refresh(target_user)

    # Log the change
    logger.info(
        f"Admin {current_user.email} changed user {target_user.email} "
        f"role from {old_role} to {role_update.role}"
    )

    return UserOut.model_validate(target_user)
