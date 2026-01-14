"""
OMZA (Organiseren, Meedoen, Zelfvertrouwen, Autonomie) Schemas
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, List


class OmzaCategoryScore(BaseModel):
    """Scores for a single OMZA category (peer, self, and teacher)"""

    peer_avg: Optional[float] = Field(
        None, description="Average peer score for this category"
    )
    self_avg: Optional[float] = Field(
        None, description="Average self score for this category"
    )
    teacher_score: Optional[float] = Field(
        None, description="Teacher score for this category"
    )


class OmzaStudentData(BaseModel):
    """OMZA data for a single student"""

    student_id: int
    student_name: str
    class_name: Optional[str] = None
    team_number: Optional[int] = None
    category_scores: Dict[str, OmzaCategoryScore] = Field(
        default_factory=dict,
        description="Map of category name to scores (e.g., {'O': {...}, 'M': {...}})",
    )
    teacher_comment: Optional[str] = Field(
        None, description="Teacher's general comment for this student"
    )


class OmzaDataResponse(BaseModel):
    """Response containing OMZA data for all students in an evaluation"""

    evaluation_id: int
    students: List[OmzaStudentData]
    categories: List[str] = Field(
        description="List of category names in order (e.g., ['O', 'M', 'Z', 'A'])"
    )


class TeacherScoreCreate(BaseModel):
    """Request to save a teacher score"""

    student_id: int
    category: str = Field(description="Category code (e.g., 'O', 'M', 'Z', 'A')")
    score: float = Field(description="Score value")


class TeacherCommentCreate(BaseModel):
    """Request to save a teacher comment"""

    student_id: int
    comment: str = Field(description="Teacher's comment text")


class StandardCommentOut(BaseModel):
    """A standard/quick comment for a category"""

    id: str = Field(description="Unique identifier for this comment")
    category: str = Field(description="OMZA category this comment belongs to")
    text: str = Field(description="The comment text")


class StandardCommentCreate(BaseModel):
    """Request to create a new standard comment"""

    category: str = Field(description="OMZA category (e.g., 'O', 'M', 'Z', 'A')")
    text: str = Field(description="The comment text")
