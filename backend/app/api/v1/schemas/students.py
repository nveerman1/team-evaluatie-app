from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, EmailStr


# Aanmaken: je kunt óf direct naar een bestaand team koppelen via team_id,
# óf (makkelijker) naar een course + team_number (maakt team aan als nodig).
class StudentCreate(BaseModel):
    name: str
    email: EmailStr
    class_name: Optional[str] = None
    # Koppelen via course + team_number (optioneel, samen gebruikt):
    course_id: Optional[int] = None  # koppel aan course
    team_number: Optional[int] = None  # bv. 1 -> "Team 1" binnen course
    # Alternatief: legacy pad via direct team_id (optioneel):
    team_id: Optional[int] = None


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    class_name: Optional[str] = None
    active: Optional[bool] = None
    # Wijzigen van membership:
    course_id: Optional[int] = None
    team_number: Optional[int] = None
    team_id: Optional[int] = None


class StudentOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    class_name: Optional[str] = None

    # Primair (actief) membership samengevat:
    team_id: Optional[int] = None
    team_name: Optional[str] = None
    team_number: Optional[int] = None
    course_id: Optional[int] = None
    course_name: Optional[str] = None

    status: str  # "active" | "inactive"

    class Config:
        from_attributes = True
