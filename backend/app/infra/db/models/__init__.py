"""
Modular ORM models for the team-evaluatie-app.

This package re-exports all models from domain-specific modules to maintain
backward compatibility with existing imports like:
    from app.infra.db.models import User, Project, etc.

All models are organized by domain:
- base: Base class and common helpers
- user: User, School, RFIDCard
- courses: Course, Subject, AcademicYear, Class, etc.
- projects: Project, Subproject, ProjectTeam, ProjectTeamMember, ProjectTeamExternal
- project_plan: ProjectPlan, ProjectPlanTeam, ProjectPlanSection
- rubrics: Rubric, RubricCriterion
- grading: Grade, PublishedGrade
- assessments: Evaluation, Allocation, Score, ProjectAssessment, etc.
- competencies: Competency, CompetencyCategory, CompetencyWindow, etc.
- learning: LearningObjective, RubricCriterionLearningObjective
- templates: All template models
- clients: Client, ClientLog, ClientProjectLink
- notes: ProjectNotesContext, ProjectNote
- skills: SkillTraining, SkillTrainingProgress, Task
- attendance: AttendanceEvent, AttendanceAggregate
- submissions: AssignmentSubmission, SubmissionEvent
- external: ExternalEvaluator
- system: FeedbackSummary, SummaryGenerationJob, ScheduledJob, Notification, AuditLog
"""

from __future__ import annotations

# Base and helpers
from .base import Base, id_pk, tenant_fk

# User and authentication
from .user import School, User, RFIDCard

# Courses and academic structure
from .courses import (
    Subject,
    AcademicYear,
    Class,
    StudentClassMembership,
    Course,
    TeacherCourse,
    CourseEnrollment,
)

# Projects
from .projects import (
    Project,
    Subproject,
    ProjectTeam,
    ProjectTeamMember,
    ProjectTeamExternal,
)

# Project planning
from .project_plan import (
    ProjectPlan,
    ProjectPlanTeam,
    ProjectPlanSection,
)

# Rubrics
from .rubrics import Rubric, RubricCriterion

# Grading
from .grading import Grade, PublishedGrade

# Assessments and evaluations
from .assessments import (
    Evaluation,
    Allocation,
    Score,
    ReviewerRating,
    Reflection,
    ProjectAssessment,
    ProjectAssessmentTeam,
    ProjectAssessmentScore,
    ProjectAssessmentReflection,
    ProjectAssessmentSelfAssessment,
    ProjectAssessmentSelfAssessmentScore,
)

# Competencies
from .competencies import (
    CompetencyCategory,
    Competency,
    CompetencyRubricLevel,
    CompetencyWindow,
    CompetencySelfScore,
    CompetencyPeerLabel,
    CompetencyTeacherObservation,
    CompetencyGoal,
    CompetencyReflection,
    CompetencyExternalInvite,
    CompetencyExternalScore,
)

# Learning objectives
from .learning import (
    LearningObjective,
    RubricCriterionLearningObjective,
)

# Templates
from .templates import (
    PeerEvaluationCriterionTemplate,
    ProjectAssessmentCriterionTemplate,
    ProjectRubricTemplate,
    ProjectRubricCriterionTemplate,
    CompetencyTemplate,
    CompetencyLevelDescriptorTemplate,
    CompetencyReflectionQuestionTemplate,
    MailTemplate,
    StandardRemark,
    TemplateTag,
    TemplateTagLink,
)

# Clients
from .clients import Client, ClientLog, ClientProjectLink

# Project notes
from .notes import ProjectNotesContext, ProjectNote

# Skills and tasks
from .skills import SkillTraining, SkillTrainingProgress, Task

# Attendance
from .attendance import AttendanceEvent, AttendanceAggregate

# Submissions
from .submissions import AssignmentSubmission, SubmissionEvent

# External evaluators
from .external import ExternalEvaluator

# System models
from .system import (
    FeedbackSummary,
    SummaryGenerationJob,
    ScheduledJob,
    Notification,
    AuditLog,
)

__all__ = [
    # Base
    "Base",
    "id_pk",
    "tenant_fk",
    # User
    "School",
    "User",
    "RFIDCard",
    # Courses
    "Subject",
    "AcademicYear",
    "Class",
    "StudentClassMembership",
    "Course",
    "TeacherCourse",
    "CourseEnrollment",
    # Projects
    "Project",
    "Subproject",
    "ProjectTeam",
    "ProjectTeamMember",
    "ProjectTeamExternal",
    # Project planning
    "ProjectPlan",
    "ProjectPlanTeam",
    "ProjectPlanSection",
    # Rubrics
    "Rubric",
    "RubricCriterion",
    # Grading
    "Grade",
    "PublishedGrade",
    # Assessments
    "Evaluation",
    "Allocation",
    "Score",
    "ReviewerRating",
    "Reflection",
    "ProjectAssessment",
    "ProjectAssessmentTeam",
    "ProjectAssessmentScore",
    "ProjectAssessmentReflection",
    "ProjectAssessmentSelfAssessment",
    "ProjectAssessmentSelfAssessmentScore",
    # Competencies
    "CompetencyCategory",
    "Competency",
    "CompetencyRubricLevel",
    "CompetencyWindow",
    "CompetencySelfScore",
    "CompetencyPeerLabel",
    "CompetencyTeacherObservation",
    "CompetencyGoal",
    "CompetencyReflection",
    "CompetencyExternalInvite",
    "CompetencyExternalScore",
    # Learning
    "LearningObjective",
    "RubricCriterionLearningObjective",
    # Templates
    "PeerEvaluationCriterionTemplate",
    "ProjectAssessmentCriterionTemplate",
    "ProjectRubricTemplate",
    "ProjectRubricCriterionTemplate",
    "CompetencyTemplate",
    "CompetencyLevelDescriptorTemplate",
    "CompetencyReflectionQuestionTemplate",
    "MailTemplate",
    "StandardRemark",
    "TemplateTag",
    "TemplateTagLink",
    # Clients
    "Client",
    "ClientLog",
    "ClientProjectLink",
    # Notes
    "ProjectNotesContext",
    "ProjectNote",
    # Skills
    "SkillTraining",
    "SkillTrainingProgress",
    "Task",
    # Attendance
    "AttendanceEvent",
    "AttendanceAggregate",
    # Submissions
    "AssignmentSubmission",
    "SubmissionEvent",
    # External
    "ExternalEvaluator",
    # System
    "FeedbackSummary",
    "SummaryGenerationJob",
    "ScheduledJob",
    "Notification",
    "AuditLog",
]
