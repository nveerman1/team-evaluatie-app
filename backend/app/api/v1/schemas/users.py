"""
Schemas for Users API
"""

from __future__ import annotations
from typing import Optional, Literal
from pydantic import BaseModel, Field


class UserOut(BaseModel):
    """Schema for user output"""

    id: int
    school_id: int
    email: str
    name: str
    role: str
    class_name: Optional[str] = None
    team_number: Optional[int] = None

    class Config:
        from_attributes = True


class UserUpdateRole(BaseModel):
    """Schema for updating user role (admin only)"""

    role: Literal["student", "teacher", "admin"] = Field(
        ..., description="New role for the user"
    )
