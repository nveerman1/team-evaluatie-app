from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from fastapi import APIRouter
from app.api.middleware.security_headers import SecurityHeadersMiddleware
from app.api.middleware.rate_limit import RateLimitMiddleware
import logging

from app.api.v1.routers import rubrics as rubrics_router
from app.api.v1.routers import evaluations as evaluations_router
from app.api.v1.routers import allocations as allocations_router
from app.api.v1.routers import scores as scores_router
from app.api.v1.routers import grades as grades_router
from app.api.v1.routers import dashboard as dashboard_router
from app.api.v1.routers import matrix as matrix_router
from app.api.v1.routers import flags as flags_router
from app.api.v1.routers import flags_explain as flags_explain_router
from app.api.v1.routers import student_overview as student_overview_router
from app.api.v1.routers import students as students_router
from app.api.v1.routers import reflections_me as reflections_me_router
from app.api.v1.routers import admin_students as admin_students_router
from app.api.v1.routers import clusters as clusters_router
from app.api.v1.routers import project_assessments as project_assessments_router
from app.api.v1.routers import competencies as competencies_router
from app.api.v1.routers import external_invites as external_invites_router
from app.api.v1.routers import external_assessments as external_assessments_router
from app.api.v1.routers import external_management as external_management_router
from app.api.v1.routers import overview as overview_router
from app.api.v1.routers import feedback_summary as feedback_summary_router
from app.api.v1.routers import learning_objectives as learning_objectives_router
from app.api.v1.routers import auth as auth_router
from app.api.v1.routers import courses as courses_router
from app.api.v1.routers import subjects as subjects_router
from app.api.v1.routers import users as users_router
from app.api.v1.routers import teachers as teachers_router
from app.api.v1.routers import project_notes as project_notes_router
from app.api.v1.routers import clients as clients_router
from app.api.v1.routers import projects as projects_router
from app.api.v1.routers import project_teams as project_teams_router
from app.api.v1.routers import projectplans as projectplans_router
from app.api.v1.routers import omza as omza_router
from app.api.v1.routers import templates as templates_router
from app.api.v1.routers import (
    student_competency_growth as student_competency_growth_router,
)
from app.api.v1.routers import academic_years as academic_years_router
from app.api.v1.routers import classes as classes_router
from app.api.v1.routers import course_enrollments as course_enrollments_router
from app.api.v1.routers import submissions as submissions_router
from app.api.v1.routers import notifications as notifications_router
from app.api.v1.routers import attendance as attendance_router
from app.api.v1.routers import rfid as rfid_router
from app.api.v1.routers import tasks as tasks_router
from app.api.v1.routers import skill_trainings as skill_trainings_router
from app.integrations.somtoday import router as somtoday_router

# Configure logging to show INFO level messages
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Disable API documentation in production for security
# Swagger UI has historical vulnerabilities (CVE-2023-27322, CVE-2022-31677)
# Exposing API structure aids attackers in reconnaissance
app = FastAPI(
    title="Team Evaluatie App",
    docs_url=None if settings.NODE_ENV == "production" else "/docs",
    redoc_url=None if settings.NODE_ENV == "production" else "/redoc",
    openapi_url=None if settings.NODE_ENV == "production" else "/openapi.json",
)

# Security headers (apply first)
app.add_middleware(SecurityHeadersMiddleware)

# Rate limiting (apply before CORS)
app.add_middleware(RateLimitMiddleware)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-User-Email"],
    expose_headers=[
        "Content-Type",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
    ],
)


@app.get("/health")
def health():
    return {"status": "ok"}


# Mount v1
api_v1 = APIRouter(prefix=settings.API_V1_PREFIX)
api_v1.include_router(rubrics_router.router)
api_v1.include_router(evaluations_router.router)
api_v1.include_router(allocations_router.router)
api_v1.include_router(scores_router.router)
api_v1.include_router(grades_router.router)
api_v1.include_router(dashboard_router.router)
api_v1.include_router(matrix_router.router)
api_v1.include_router(flags_router.router)
api_v1.include_router(flags_explain_router.router)
api_v1.include_router(student_overview_router.router)
api_v1.include_router(students_router.router)
api_v1.include_router(reflections_me_router.router)
api_v1.include_router(admin_students_router.router)
api_v1.include_router(clusters_router.router)
api_v1.include_router(project_assessments_router.router)
api_v1.include_router(competencies_router.router)
api_v1.include_router(external_invites_router.router)
api_v1.include_router(external_assessments_router.router)
api_v1.include_router(external_management_router.router)
api_v1.include_router(overview_router.router)
api_v1.include_router(feedback_summary_router.router)
api_v1.include_router(learning_objectives_router.router)
api_v1.include_router(auth_router.router)
api_v1.include_router(courses_router.router)
api_v1.include_router(subjects_router.router)
api_v1.include_router(users_router.router)
api_v1.include_router(teachers_router.router)
api_v1.include_router(project_notes_router.router)
api_v1.include_router(clients_router.router)
api_v1.include_router(projects_router.router)
api_v1.include_router(project_teams_router.router)
api_v1.include_router(projectplans_router.router)
api_v1.include_router(projectplans_router.student_router)  # Student routes without /projectplans prefix
api_v1.include_router(omza_router.router)
api_v1.include_router(templates_router.router)
api_v1.include_router(student_competency_growth_router.router)
api_v1.include_router(academic_years_router.router)
api_v1.include_router(classes_router.router)
api_v1.include_router(course_enrollments_router.router)
api_v1.include_router(submissions_router.router)
api_v1.include_router(notifications_router.router)
api_v1.include_router(attendance_router.router)
api_v1.include_router(rfid_router.router)
api_v1.include_router(tasks_router.router)
api_v1.include_router(skill_trainings_router.router)
api_v1.include_router(somtoday_router.router)
app.include_router(api_v1)
