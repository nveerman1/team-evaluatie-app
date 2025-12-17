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
    """
    Response schema for Azure AD authentication.
    
    Note: This schema is kept for documentation and potential API clients
    that may need a JSON response format. The main /auth/azure/callback
    endpoint now uses cookie-based auth with redirect, but this schema
    documents the expected structure for alternative implementations.
    """
    access_token: str
    token_type: str
    user: UserInfo
