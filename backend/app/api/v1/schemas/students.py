from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, EmailStr


# …bovenaan ongewijzigd…


class StudentCreate(BaseModel):
    name: str
    email: EmailStr
    class_name: Optional[str] = None
    # optional “free form”:
    cluster_name: Optional[str] = None  # bv. "GA2"
    team_number: Optional[int] = None  # bv. 1


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    class_name: Optional[str] = None
    active: Optional[bool] = None
    # wijziging via vrije velden:
    cluster_name: Optional[str] = None
    team_number: Optional[int] = None


class StudentOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    class_name: Optional[str] = None
    # bestaande:
    team_id: Optional[int] = None
    team_name: Optional[str] = None
    cluster_id: Optional[int] = None
    cluster_name: Optional[str] = None
    # nieuw, handig voor UI:
    team_number: Optional[int] = None
    status: str

    class Config:
        from_attributes = True
