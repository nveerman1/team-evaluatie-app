from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, EmailStr


class UserRead(BaseModel):
    """Schema for reading current user information"""
    id: int
    email: EmailStr
    name: str
    role: str
    class_name: Optional[str] = None

    class Config:
        from_attributes = True
