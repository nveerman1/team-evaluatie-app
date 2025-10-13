from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class StudentCreate(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    class_name: Optional[str] = None  # alleen gebruikt als kolom bestaat
    team_id: Optional[int] = None  # indien Group/Team modellen aanwezig


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    class_name: Optional[str] = None
    team_id: Optional[int] = None
    active: Optional[bool] = None  # True = niet-archived, False = archived


class StudentOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    class_name: Optional[str] = None
    team_id: Optional[int] = None
    team_name: Optional[str] = None  # aanwezig voor volledigheid
    status: str  # "active" | "inactive"

    class Config:
        from_attributes = True
