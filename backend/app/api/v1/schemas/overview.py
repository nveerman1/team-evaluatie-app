from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class OverviewItemOut(BaseModel):
    """
    Single item in the overview table combining projects, peer evaluations, and competency windows
    """

    # Core fields
    id: int
    type: str  # "project" | "peer" | "competency"

    # Student info
    student_id: int
    student_name: str
    student_class: Optional[str] = None

    # Item info
    title: str
    course_name: Optional[str] = None
    course_id: Optional[int] = None
    teacher_name: Optional[str] = None
    teacher_id: Optional[int] = None
    date: Optional[datetime] = (
        None  # published_at for projects, end_date for competency, created_at for peer
    )

    # Score (normalized representation)
    score: Optional[float] = None
    score_label: Optional[str] = None  # Human-readable score representation

    # Status
    status: str  # "open" | "closed" | "draft" | "published"

    # Navigation
    detail_url: str  # Frontend route to navigate to

    # Optional metadata
    team_number: Optional[int] = None
    team_name: Optional[str] = None


class OverviewListResponse(BaseModel):
    """
    Paginated list of overview items with filters applied
    """

    items: List[OverviewItemOut]
    total: int
    page: int
    limit: int

    # Optional summary stats
    total_projects: int = 0
    total_peers: int = 0
    total_competencies: int = 0


class OverviewFilters(BaseModel):
    """
    Filters for overview items
    """

    student_id: Optional[int] = None
    course_id: Optional[int] = None
    teacher_id: Optional[int] = None
    type: Optional[str] = None  # "project" | "peer" | "competency"
    status: Optional[str] = None
    date_from: Optional[str] = None  # ISO date
    date_to: Optional[str] = None  # ISO date
    team_number: Optional[int] = None
    search: Optional[str] = None  # Search in title or student name

    # Sorting
    sort_by: str = "date"  # "date" | "student" | "score"
    sort_order: str = "desc"  # "asc" | "desc"

    # Pagination
    page: int = 1
    limit: int = 50


# ==================== Matrix View Schemas ====================


class MatrixCellOut(BaseModel):
    """
    Single cell in the matrix representing one evaluation for one student
    """

    evaluation_id: int
    type: str  # "project" | "peer" | "competency"
    title: str
    score: Optional[float] = None
    status: str
    date: Optional[datetime] = None
    teacher_name: Optional[str] = None
    detail_url: str


class MatrixColumnOut(BaseModel):
    """
    Column header information for the matrix
    """

    key: str  # Unique key for the column (e.g., "project_1", "peer_2")
    type: str  # "project" | "peer" | "competency"
    title: str
    date: Optional[datetime] = None
    order: int  # For sorting columns chronologically


class StudentMatrixRowOut(BaseModel):
    """
    One row in the matrix representing a student with all their evaluations
    """

    student_id: int
    student_name: str
    student_class: Optional[str] = None
    cells: dict[str, Optional[MatrixCellOut]]  # key -> cell data (None if no data)
    average: Optional[float] = None  # Overall average across all evaluations


class OverviewMatrixResponse(BaseModel):
    """
    Matrix view of all evaluations organized by students
    """

    columns: List[MatrixColumnOut]  # Ordered list of column headers
    rows: List[StudentMatrixRowOut]  # List of student rows

    # Column averages
    column_averages: dict[str, Optional[float]] = {}

    # Metadata
    total_students: int = 0


# ==================== Project Overview Schemas ====================


class CategoryStatistics(BaseModel):
    """
    Statistical data for a category
    """

    mean: Optional[float] = None
    median: Optional[float] = None
    p25: Optional[float] = None  # 25th percentile
    p75: Optional[float] = None  # 75th percentile
    p10: Optional[float] = None  # 10th percentile (optional whisker)
    p90: Optional[float] = None  # 90th percentile (optional whisker)
    min: Optional[float] = None
    max: Optional[float] = None
    iqr: Optional[float] = None  # Interquartile range (P75 - P25)
    count_teams: int = 0
    count_assessments: int = 0


class ProjectOverviewItem(BaseModel):
    """
    Single project in the teacher's project overview
    """

    project_id: int
    project_name: str
    course_name: Optional[str] = None
    client_name: Optional[str] = None
    period_label: str  # e.g., "Q1 2025"
    year: int
    num_teams: int
    average_score_overall: Optional[float] = None
    average_scores_by_category: dict[str, float] = {}  # category -> average score
    status: str  # "active" | "completed"
    # Statistics for overall and by category
    overall_statistics: Optional[CategoryStatistics] = None
    category_statistics: dict[str, CategoryStatistics] = {}  # category -> statistics


class ProjectOverviewListResponse(BaseModel):
    """
    List of projects for the overview page
    """

    projects: List[ProjectOverviewItem]
    total: int


class CategoryTrendData(BaseModel):
    """
    Trend data point for category scores across projects
    """

    project_label: str  # e.g., "Q1 2025 - Web"
    project_id: int  # For filtering/linking
    scores: dict[str, float]  # category -> score (mean)
    statistics: dict[str, CategoryStatistics] = {}  # category -> statistics


class ProjectTrendResponse(BaseModel):
    """
    Trend data for project categories over time
    """

    trend_data: List[CategoryTrendData]


class ProjectTeamScore(BaseModel):
    """
    Score details for a single team in a project
    """

    team_number: int
    team_name: Optional[str] = None
    team_members: List[str] = []  # Student names
    overall_score: Optional[float] = None
    category_scores: dict[str, float] = {}  # category -> score


class ProjectTeamsResponse(BaseModel):
    """
    Team scores for a specific project
    """

    project_id: int
    project_name: str
    teams: List[ProjectTeamScore]


# ==================== Peer Evaluation Overview Schemas ====================


class OmzaTrendDataPoint(BaseModel):
    """
    Single data point for OMZA trend chart
    """

    date: str  # e.g., "Sep 2024"
    label: str  # e.g., "Project X - 10 Jan 2024" or evaluation title
    organiseren: float
    meedoen: float
    zelfvertrouwen: float
    autonomie: float


class OmzaCategoryScore(BaseModel):
    """
    Score for one OMZA category with trend indicator
    """

    current: float
    trend: str  # "up" | "down" | "neutral"
    teacher_score: Optional[int] = None  # Teacher emoticon score (1-3)


class PeerEvaluationDetail(BaseModel):
    """
    Individual peer evaluation with OMZA scores
    """

    id: int
    date: str  # ISO format date
    label: str  # Project/evaluation name
    scores: dict[str, float]  # category -> score value (O, M, Z, A)
    teacher_scores: Optional[dict[str, int]] = (
        None  # category -> teacher emoticon score (1-3)
    )


class StudentHeatmapRow(BaseModel):
    """
    One row in the student heatmap showing OMZA scores
    """

    student_id: int
    student_name: str
    class_name: Optional[str] = None
    scores: dict[str, OmzaCategoryScore]  # category -> score data
    self_vs_peer_diff: Optional[float] = (
        None  # Self-assessment vs peer average difference
    )
    teacher_comment: Optional[str] = None  # General teacher feedback for this student
    evaluations: Optional[List[PeerEvaluationDetail]] = (
        None  # List of individual evaluations for row expansion
    )


class KpiStudent(BaseModel):
    """
    Student entry in KPI cards (top/bottom performers)
    """

    student_id: int
    student_name: str
    value: float  # Score or difference value


class KpiData(BaseModel):
    """
    KPI data for dashboard cards
    """

    grootsteStijgers: List[KpiStudent] = []
    grootsteDalers: List[KpiStudent] = []
    structureelLaag: List[KpiStudent] = []
    inconsistenties: List[KpiStudent] = []


class PeerOverviewDashboardResponse(BaseModel):
    """
    Dashboard data for peer evaluations overview
    """

    trendData: List[OmzaTrendDataPoint]
    heatmapData: List[StudentHeatmapRow]
    kpiData: KpiData


class FeedbackItem(BaseModel):
    """
    Individual feedback item from peer evaluations
    """

    id: str
    student_id: int
    student_name: str
    project_name: str
    date: datetime
    category: str  # "organiseren" | "meedoen" | "zelfvertrouwen" | "autonomie"
    sentiment: str  # "positief" | "kritiek" | "waarschuwing"
    text: str
    keywords: List[str] = []
    is_risk_behavior: bool = False
    # Enhanced fields for sortable table
    feedback_type: str = "peer"  # "self" | "peer"
    score: Optional[float] = None  # The score given with this feedback
    from_student_name: Optional[str] = (
        None  # Name of student who gave this feedback (for peer feedback)
    )


class FeedbackCollectionResponse(BaseModel):
    """
    Feedback collection data for peer evaluations
    """

    feedbackItems: List[FeedbackItem]
    totalCount: int


class TeacherFeedbackItem(BaseModel):
    """
    Single teacher feedback/assessment entry from OMZA evaluations
    """

    id: int
    student_id: int
    student_name: str
    project_name: str
    evaluation_id: int
    date: datetime  # When the teacher assessment was given
    # OMZA category scores (icon levels 1-3)
    organiseren_score: Optional[int] = None
    meedoen_score: Optional[int] = None
    zelfvertrouwen_score: Optional[int] = None
    autonomie_score: Optional[int] = None
    # General teacher comment
    teacher_comment: Optional[str] = None


class TeacherFeedbackResponse(BaseModel):
    """
    Teacher feedback/assessment data
    """

    feedbackItems: List[TeacherFeedbackItem]
    totalCount: int


class ReflectionItem(BaseModel):
    """
    Single reflection from a peer evaluation
    """

    id: int
    student_id: int
    student_name: str
    project_name: str
    evaluation_id: int
    date: datetime  # When the reflection was submitted
    reflection_text: str
    word_count: int


class ReflectionResponse(BaseModel):
    """
    Collection of reflections from peer evaluations
    """

    reflectionItems: List[ReflectionItem]
    totalCount: int


class CriterionDetail(BaseModel):
    """
    Individual criterion score and feedback within an aggregated feedback item
    """

    criterion_id: int
    criterion_name: str
    category: str  # O, M, Z, or A
    score: Optional[float] = None
    feedback: Optional[str] = None


class AggregatedFeedbackItem(BaseModel):
    """
    Aggregated feedback per allocation (per peer review instance)
    Shows OMZA category scores and combined feedback for one peer review
    """

    allocation_id: int
    student_id: int
    student_name: str
    project_name: str
    evaluation_id: int
    date: datetime
    feedback_type: str  # "self" | "peer"
    from_student_id: Optional[int] = None
    from_student_name: Optional[str] = None

    # OMZA category scores (averaged from criteria in that category)
    score_O: Optional[float] = None  # Organiseren
    score_M: Optional[float] = None  # Meedoen
    score_Z: Optional[float] = None  # Zelfvertrouwen
    score_A: Optional[float] = None  # Autonomie

    # Combined feedback text from all criteria
    combined_feedback: str

    # Detailed breakdown for expansion
    criteria_details: List[CriterionDetail] = []


class AggregatedFeedbackResponse(BaseModel):
    """
    Collection of aggregated feedback items
    """

    feedbackItems: List[AggregatedFeedbackItem]
    totalCount: int
