from typing import Optional, Literal
from pydantic import BaseModel, EmailStr


class AdminStudentCreate(BaseModel):
    name: str
    email: EmailStr
    class_name: Optional[str] = None
    team_number: Optional[int] = None
    status: Optional[Literal["active", "inactive"]] = "active"


class AdminStudentUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    class_name: Optional[str] = None
    # NB: course_name wijzigen doen we via dedicated membership endpoints; niet hier.
    team_number: Optional[int] = None
    status: Optional[Literal["active", "inactive"]] = None


class AdminStudentOut(BaseModel):
    id: int
    name: Optional[str] = None
    email: EmailStr
    class_name: Optional[str] = None
    # read-only, afgeleid via membership:
    course_name: Optional[str] = None
    team_number: Optional[int] = None
    status: Literal["active", "inactive"]
