from __future__ import annotations
from fastapi import APIRouter, Depends
from app.api.v1.deps import get_current_user
from app.api.v1.schemas.auth import UserRead
from app.infra.db.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_user)):
    """
    Get the currently authenticated user's information.
    Returns user details including class_name.
    """
    return current_user
