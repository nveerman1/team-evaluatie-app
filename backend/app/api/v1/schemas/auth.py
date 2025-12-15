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


class UserInfo(BaseModel):
    """User information returned after authentication"""
    id: int
    email: str
    name: str
    role: str
    school_id: int
    class_name: Optional[str] = None


class AzureAuthResponse(BaseModel):
    """Response from Azure AD authentication callback"""
    access_token: str
    token_type: str
    user: UserInfo
