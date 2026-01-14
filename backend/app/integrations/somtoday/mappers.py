"""
Somtoday data mappers

Maps Somtoday data structures to internal models
"""

from __future__ import annotations
from typing import Dict, Any, Optional, List
from datetime import datetime


def map_somtoday_student_to_user(
    somtoday_student: Dict[str, Any], school_id: int
) -> Dict[str, Any]:
    """
    Map Somtoday student data to User model

    Args:
        somtoday_student: Student data from Somtoday API
        school_id: School ID to associate with

    Returns:
        Dictionary with User model fields

    Example Somtoday student structure:
    {
        "id": "12345",
        "leerlingnummer": "987654",
        "firstName": "Jan",
        "lastName": "Jansen",
        "email": "jan.jansen@school.nl",
        "class": "4A",
        "birthDate": "2005-03-15"
    }
    """
    return {
        "school_id": school_id,
        "email": somtoday_student.get("email", "").lower(),
        "name": f"{somtoday_student.get('firstName', '')} {somtoday_student.get('lastName', '')}".strip(),
        "role": "student",
        "auth_provider": "somtoday",
        "class_name": somtoday_student.get("class"),
        # Store Somtoday ID in metadata for future reference
        # This would need a metadata_json field on User model
    }


def map_somtoday_class_to_group(
    somtoday_class: Dict[str, Any], school_id: int, course_id: int
) -> Dict[str, Any]:
    """
    Map Somtoday class data to Group model

    Args:
        somtoday_class: Class data from Somtoday API
        school_id: School ID to associate with
        course_id: Course ID to associate with

    Returns:
        Dictionary with Group model fields

    Example Somtoday class structure:
    {
        "id": "class-123",
        "name": "4A-BIO",
        "code": "4ABIO",
        "year": 2024,
        "level": "onderbouw"
    }
    """
    return {
        "school_id": school_id,
        "course_id": course_id,
        "name": somtoday_class.get("name", somtoday_class.get("code", "Unnamed")),
        "team_number": None,  # Could extract from name if format is consistent
    }


def match_user_by_email(email: str, existing_users: List[Any]) -> Optional[Any]:
    """
    Match a user by email address

    Args:
        email: Email to search for
        existing_users: List of User objects

    Returns:
        Matched User or None
    """
    email_lower = email.lower()
    for user in existing_users:
        if user.email.lower() == email_lower:
            return user
    return None


def match_user_by_leerlingnummer(
    leerlingnummer: str, existing_users: List[Any]
) -> Optional[Any]:
    """
    Match a user by leerlingnummer (student number)

    Note: This requires storing leerlingnummer in User metadata

    Args:
        leerlingnummer: Student number to search for
        existing_users: List of User objects

    Returns:
        Matched User or None
    """
    # TODO: Implement when User.metadata_json is available
    # For now, return None
    return None


def prepare_grade_export(
    user_email: str,
    course_code: str,
    grade_value: float,
    grade_date: datetime,
    description: str = "",
) -> Dict[str, Any]:
    """
    Prepare a grade for export to Somtoday

    Args:
        user_email: Student email
        course_code: Course code in Somtoday
        grade_value: Grade value (1-10)
        grade_date: Date when grade was assigned
        description: Optional description

    Returns:
        Grade object for Somtoday API

    Example output:
    {
        "studentEmail": "jan.jansen@school.nl",
        "courseCode": "BIO",
        "grade": 8.5,
        "date": "2024-11-12",
        "description": "Peer evaluation",
        "weight": 1.0
    }
    """
    return {
        "studentEmail": user_email,
        "courseCode": course_code,
        "grade": round(grade_value, 1),
        "date": grade_date.strftime("%Y-%m-%d"),
        "description": description or "Peer evaluation",
        "weight": 1.0,
    }


class ImportResult:
    """Result of an import operation"""

    def __init__(self):
        self.created: List[str] = []
        self.updated: List[str] = []
        self.skipped: List[str] = []
        self.errors: List[Dict[str, str]] = []

    def add_created(self, identifier: str):
        self.created.append(identifier)

    def add_updated(self, identifier: str):
        self.updated.append(identifier)

    def add_skipped(self, identifier: str, reason: str):
        self.skipped.append(f"{identifier}: {reason}")

    def add_error(self, identifier: str, error: str):
        self.errors.append({"identifier": identifier, "error": error})

    def to_dict(self) -> Dict[str, Any]:
        return {
            "created": len(self.created),
            "updated": len(self.updated),
            "skipped": len(self.skipped),
            "errors": len(self.errors),
            "created_items": self.created,
            "updated_items": self.updated,
            "skipped_items": self.skipped,
            "error_details": self.errors,
        }

    def __str__(self) -> str:
        return (
            f"Import complete: "
            f"{len(self.created)} created, "
            f"{len(self.updated)} updated, "
            f"{len(self.skipped)} skipped, "
            f"{len(self.errors)} errors"
        )
