from typing import Optional, Literal, List
from pydantic import BaseModel, EmailStr


class CourseEnrollmentInfo(BaseModel):
    """Info about a student's course enrollment"""

    course_id: int
    course_name: str
    subject_code: Optional[str] = None


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
    # New fields for enhanced display
    class_info: Optional[str] = None  # e.g., "G2a (2025-2026)"
    course_enrollments: List[CourseEnrollmentInfo] = []  # List of enrolled courses
