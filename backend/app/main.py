from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from fastapi import APIRouter

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


app = FastAPI(title=settings.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
app.include_router(api_v1)
