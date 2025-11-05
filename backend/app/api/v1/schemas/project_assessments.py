from __future__ import annotations
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


# ---------- Project Assessment ----------

class ProjectAssessmentCreate(BaseModel):
    group_id: int
    rubric_id: int
    title: str
    version: Optional[str] = None
    metadata_json: Dict[str, Any] = Field(default_factory=dict)


class ProjectAssessmentUpdate(BaseModel):
    title: Optional[str] = None
    version: Optional[str] = None
    status: Optional[str] = None  # draft|published
    metadata_json: Optional[Dict[str, Any]] = None


class ProjectAssessmentOut(BaseModel):
    id: int
    group_id: int
    rubric_id: int
    teacher_id: int
    title: str
    version: Optional[str]
    status: str
    published_at: Optional[datetime]
    metadata_json: Dict[str, Any]

    class Config:
        from_attributes = True


class ProjectAssessmentListItem(ProjectAssessmentOut):
    group_name: Optional[str] = None
    teacher_name: Optional[str] = None
    course_name: Optional[str] = None
    course_id: Optional[int] = None
    scores_count: int = 0
    total_criteria: int = 0
    updated_at: Optional[datetime] = None


class ProjectAssessmentListResponse(BaseModel):
    items: List[ProjectAssessmentListItem]
    page: int
    limit: int
    total: int


# ---------- Project Assessment Scores ----------

class ProjectAssessmentScoreCreate(BaseModel):
    criterion_id: int
    score: int
    comment: Optional[str] = None
    team_number: Optional[int] = None


class ProjectAssessmentScoreUpdate(BaseModel):
    score: Optional[int] = None
    comment: Optional[str] = None


class ProjectAssessmentScoreOut(BaseModel):
    id: int
    assessment_id: int
    criterion_id: int
    score: int
    comment: Optional[str]
    team_number: Optional[int]

    class Config:
        from_attributes = True


class ProjectAssessmentScoreBatchRequest(BaseModel):
    scores: List[ProjectAssessmentScoreCreate]


# ---------- Project Assessment Reflection ----------

class ProjectAssessmentReflectionCreate(BaseModel):
    text: str


class ProjectAssessmentReflectionOut(BaseModel):
    id: int
    assessment_id: int
    user_id: int
    text: str
    word_count: int
    submitted_at: Optional[datetime]

    class Config:
        from_attributes = True


# ---------- Detailed view for students ----------

class ProjectAssessmentDetailOut(BaseModel):
    """Detailed project assessment including scores and rubric info"""
    assessment: ProjectAssessmentOut
    scores: List[ProjectAssessmentScoreOut]
    rubric_title: str
    rubric_scale_min: int
    rubric_scale_max: int
    criteria: List[Dict[str, Any]]  # criterion details
    reflection: Optional[ProjectAssessmentReflectionOut]
    teacher_name: Optional[str] = None
    total_score: Optional[float] = None
    grade: Optional[float] = None


# ---------- Team member info ----------

class TeamMemberInfo(BaseModel):
    """Team member information"""
    id: int
    name: str
    email: str


class TeamAssessmentStatus(BaseModel):
    """Team assessment status for overview"""
    group_id: int
    group_name: str
    team_number: Optional[int]
    members: List[TeamMemberInfo]
    scores_count: int
    total_criteria: int
    status: str  # "not_started" | "in_progress" | "completed"
    updated_at: Optional[datetime]
    updated_by: Optional[str]


class ProjectAssessmentTeamOverview(BaseModel):
    """Team overview for a project assessment"""
    assessment: ProjectAssessmentOut
    rubric_title: str
    rubric_scale_min: int
    rubric_scale_max: int
    total_criteria: int
    teams: List[TeamAssessmentStatus]


# ---------- Reflections overview for teachers ----------

class ReflectionInfo(BaseModel):
    """Student reflection info for teacher view"""
    id: int
    user_id: int
    user_name: str
    text: str
    word_count: int
    submitted_at: Optional[datetime]


class ProjectAssessmentReflectionsOverview(BaseModel):
    """All reflections for a project assessment"""
    assessment: ProjectAssessmentOut
    group_name: str
    reflections: List[ReflectionInfo]


# ---------- Scores overview for teachers ----------

class CriterionScore(BaseModel):
    """Score for a specific criterion"""
    criterion_id: int
    criterion_name: str
    category: Optional[str] = None
    score: Optional[int] = None
    comment: Optional[str] = None


class TeamScoreOverview(BaseModel):
    """Complete score overview for a team"""
    team_number: int
    team_name: str
    members: List[TeamMemberInfo]
    criterion_scores: List[CriterionScore]
    total_score: Optional[float] = None
    grade: Optional[float] = None  # Calculated school grade
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None


class ScoreStatistics(BaseModel):
    """Statistics for the assessment"""
    average_per_criterion: Dict[str, float]  # criterion_name -> average
    highest_score: Optional[float] = None
    lowest_score: Optional[float] = None
    pending_assessments: int
    average_grade: Optional[float] = None
    highest_grade: Optional[float] = None
    lowest_grade: Optional[float] = None


class ProjectAssessmentScoresOverview(BaseModel):
    """Complete scores overview for a project assessment"""
    assessment: ProjectAssessmentOut
    rubric_title: str
    rubric_scale_min: int
    rubric_scale_max: int
    criteria: List[Dict[str, Any]]  # All rubric criteria
    team_scores: List[TeamScoreOverview]
    statistics: ScoreStatistics


# ---------- Individual students overview for teachers ----------

class StudentScoreOverview(BaseModel):
    """Complete score overview for an individual student"""
    student_id: int
    student_name: str
    student_email: str
    class_name: Optional[str] = None
    team_number: Optional[int] = None
    team_name: Optional[str] = None
    criterion_scores: List[CriterionScore]
    total_score: Optional[float] = None
    grade: Optional[float] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None


class StudentScoreStatistics(BaseModel):
    """Statistics for student scores"""
    average_per_criterion: Dict[str, float]  # criterion_name -> average
    average_grade: Optional[float] = None
    highest_grade: Optional[float] = None
    lowest_grade: Optional[float] = None
    pending_assessments: int
    deviating_grades: int  # Students with manually adjusted grades


class ProjectAssessmentStudentsOverview(BaseModel):
    """Complete individual students overview for a project assessment"""
    assessment: ProjectAssessmentOut
    rubric_title: str
    rubric_scale_min: int
    rubric_scale_max: int
    criteria: List[Dict[str, Any]]  # All rubric criteria
    student_scores: List[StudentScoreOverview]
    statistics: StudentScoreStatistics
