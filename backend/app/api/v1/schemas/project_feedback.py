from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

# ---------- Questions ----------


class ProjectFeedbackQuestionIn(BaseModel):
    question_text: str = Field(..., max_length=500)
    question_type: str = "rating"  # "rating" | "open"
    order: int = 0
    is_required: bool = True


class ProjectFeedbackQuestionOut(BaseModel):
    id: int
    question_text: str
    question_type: str
    order: int
    is_required: bool

    class Config:
        from_attributes = True


# ---------- Rounds ----------


class ProjectFeedbackRoundCreate(BaseModel):
    project_id: int
    title: str = Field(..., max_length=200)
    deadline: Optional[datetime] = None
    questions: Optional[List[ProjectFeedbackQuestionIn]] = None


class ProjectFeedbackRoundUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    deadline: Optional[datetime] = None
    questions: Optional[List[ProjectFeedbackQuestionIn]] = None


class ProjectFeedbackRoundOut(BaseModel):
    id: int
    project_id: int
    title: str
    status: str
    deadline: Optional[datetime] = None
    question_count: int
    response_count: int
    total_students: int
    avg_rating: Optional[float] = None
    project_grade: Optional[float] = None
    course_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectFeedbackRoundDetail(ProjectFeedbackRoundOut):
    questions: List[ProjectFeedbackQuestionOut] = []
    closed_at: Optional[datetime] = None


# ---------- Student responses ----------


class AnswerIn(BaseModel):
    question_id: int
    rating_value: Optional[int] = None
    text_value: Optional[str] = None

    @field_validator("rating_value")
    @classmethod
    def validate_rating(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not (1 <= v <= 10):
            raise ValueError("rating_value must be between 1 and 10")
        return v


class ProjectFeedbackSubmission(BaseModel):
    answers: List[AnswerIn]


class ProjectFeedbackAnswerOut(BaseModel):
    question_id: int
    rating_value: Optional[int] = None
    text_value: Optional[str] = None

    class Config:
        from_attributes = True


class ProjectFeedbackResponseOut(BaseModel):
    id: int
    round_id: int
    student_id: int
    submitted_at: Optional[datetime] = None
    answers: List[ProjectFeedbackAnswerOut] = []

    class Config:
        from_attributes = True


# ---------- Results / dashboard ----------


class QuestionResultOut(ProjectFeedbackQuestionOut):
    avg_rating: Optional[float] = None
    rating_distribution: Optional[Dict[int, int]] = None
    open_answers: Optional[List[str]] = None


class ProjectFeedbackResults(BaseModel):
    round: ProjectFeedbackRoundOut
    questions: List[QuestionResultOut]
    response_rate: float
