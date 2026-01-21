from __future__ import annotations

from typing import Optional, List
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from fastapi.responses import PlainTextResponse
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.api.v1.schemas.students import StudentCreate, StudentUpdate, StudentOut
from app.infra.db.models import User, CourseEnrollment, Course, ProjectTeam, Project

router = APIRouter(prefix="/students", tags=["students"])

# -------------------- helpers --------------------


def _user_is_student_scoped():
    if hasattr(User, "role"):
        return User.role == "student"
    return True


def _to_out_row(
    u: User,
    class_name: Optional[str],
    course_id: Optional[int],
    course_name: Optional[str],
) -> StudentOut:
    return StudentOut(
        id=u.id,
        name=u.name,
        email=u.email,
        class_name=class_name,
        team_id=None,  # No longer using teams
        team_name=None,
        team_number=None,
        course_id=course_id,
        course_name=course_name,
        status="inactive" if getattr(u, "archived", False) else "active",
    )


# -------------------- list --------------------


@router.get("", response_model=List[StudentOut])
def list_students(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    q: Optional[str] = Query(None, description="Zoek in naam of e-mail"),
    class_or_course: Optional[str] = Query(
        None, description="Filter op klas of course-naam"
    ),
    class_name: Optional[str] = Query(None, description="Extra filter op klas (ILIKE)"),
    status: Optional[str] = Query(None, pattern="^(active|inactive)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
):
    stmt = select(User).where(
        and_(
            User.school_id == current_user.school_id,
            _user_is_student_scoped(),
        )
    )

    if status == "active" and hasattr(User, "archived"):
        stmt = stmt.where(User.archived.is_(False))
    elif status == "inactive" and hasattr(User, "archived"):
        stmt = stmt.where(User.archived.is_(True))

    if q:
        stmt = stmt.where(or_(User.name.ilike(f"%{q}%"), User.email.ilike(f"%{q}%")))

    if class_or_course:
        val = f"%{class_or_course}%"
        class_match = User.class_name.ilike(val)
        # Also match on course name via CourseEnrollment
        course_match = select(CourseEnrollment.student_id).join(
            Course, CourseEnrollment.course_id == Course.id
        ).where(
            and_(
                CourseEnrollment.student_id == User.id,
                CourseEnrollment.active.is_(True),
                Course.school_id == current_user.school_id,
                Course.name.ilike(val),
            )
        ).exists()
        stmt = stmt.where(or_(class_match, course_match))

    if class_name:
        stmt = stmt.where(User.class_name.ilike(f"%{class_name}%"))

    stmt = stmt.order_by(User.name.asc()).limit(limit).offset((page - 1) * limit)
    users: list[User] = db.execute(stmt).scalars().all()

    # Get course enrollments for all users
    user_ids = [u.id for u in users]
    course_name_map = {}
    user_to_course = {}
    
    if user_ids:
        # Get active enrollments
        enrollments = (
            db.query(CourseEnrollment, Course.name)
            .join(Course, CourseEnrollment.course_id == Course.id)
            .filter(
                CourseEnrollment.student_id.in_(user_ids),
                CourseEnrollment.active.is_(True),
                Course.school_id == current_user.school_id,
            )
            .all()
        )
        
        for enrollment, course_name in enrollments:
            # Use first active enrollment for each student
            if enrollment.student_id not in user_to_course:
                user_to_course[enrollment.student_id] = (enrollment.course_id, course_name)

    out = []
    for u in users:
        cn = getattr(u, "class_name", None)
        course_id, course_name = user_to_course.get(u.id, (None, None))
        
        out.append(
            _to_out_row(
                u=u,
                class_name=cn,
                course_id=course_id,
                course_name=course_name,
            )
        )

    return out


# -------------------- create --------------------


@router.post("", response_model=StudentOut, status_code=status.HTTP_201_CREATED)
def create_student(
    payload: StudentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if (
        db.query(User)
        .filter(User.school_id == current_user.school_id, User.email == payload.email)
        .first()
    ):
        raise HTTPException(
            status_code=400, detail="Email already exists in this school"
        )

    u = User(
        school_id=current_user.school_id,
        name=payload.name,
        email=payload.email,
        class_name=payload.class_name,
        role="student",
        archived=False,
    )
    db.add(u)
    db.commit()
    db.refresh(u)

    course_id = None
    course_name = None

    # Enroll in course if course_id is provided
    if payload.course_id:
        c = db.get(Course, payload.course_id)
        if not c:
            raise HTTPException(status_code=404, detail="Course not found")
        
        # Create enrollment
        enrollment = CourseEnrollment(
            course_id=c.id,
            student_id=u.id,
            active=True
        )
        db.add(enrollment)
        db.commit()
        
        course_id = c.id
        course_name = c.name

    return _to_out_row(u, u.class_name, course_id, course_name)


# -------------------- update --------------------


@router.put("/{student_id}", response_model=StudentOut)
def update_student(
    student_id: int,
    payload: StudentUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    u = (
        db.query(User)
        .filter(User.id == student_id, User.school_id == current_user.school_id)
        .first()
    )
    if not u:
        raise HTTPException(status_code=404, detail="Student not found")

    if payload.email and payload.email != u.email:
        if (
            db.query(User)
            .filter(
                User.school_id == current_user.school_id, User.email == payload.email
            )
            .first()
        ):
            raise HTTPException(status_code=400, detail="Email already exists")
        u.email = payload.email
    if payload.name is not None:
        u.name = payload.name
    if payload.class_name is not None:
        u.class_name = payload.class_name
    if payload.active is not None:
        u.archived = not payload.active

    db.add(u)
    db.commit()
    db.refresh(u)

    course_id = None
    course_name = None

    # Update course enrollment if course_id is provided
    if payload.course_id:
        c = db.get(Course, payload.course_id)
        if not c:
            raise HTTPException(status_code=404, detail="Course not found")
        
        # Find existing enrollment
        enrollment = (
            db.query(CourseEnrollment)
            .filter(
                CourseEnrollment.student_id == u.id,
                CourseEnrollment.course_id == c.id
            )
            .first()
        )
        
        if enrollment:
            # Reactivate if inactive
            if not enrollment.active:
                enrollment.active = True
                db.commit()
        else:
            # Create new enrollment
            enrollment = CourseEnrollment(
                course_id=c.id,
                student_id=u.id,
                active=True
            )
            db.add(enrollment)
            db.commit()
        
        course_id = c.id
        course_name = c.name

    return _to_out_row(u, u.class_name, course_id, course_name)


# -------------------- export --------------------


@router.get("/export.csv", response_class=PlainTextResponse)
def export_students_csv(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    items = list_students(db=db, current_user=current_user, limit=10_000)
    lines = [
        "id,name,email,class,course_id,course_name,status"
    ]
    for s in items:
        lines.append(
            f"{s.id},{s.name},{s.email},{s.class_name or ''},{s.course_id or ''},{s.course_name or ''},{s.status}"
        )
    return PlainTextResponse(
        content="\n".join(lines),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="students_export.csv"'},
    )


# -------------------- dropdown endpoints --------------------


@router.get("/courses")
def list_courses(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    rows = (
        db.query(Course)
        .filter(Course.school_id == current_user.school_id, Course.is_active)
        .order_by(Course.name.asc())
        .all()
    )
    return [{"id": c.id, "name": c.name} for c in rows]


@router.get("/teams")
def list_teams(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """
    List all project teams in Group-compatible format for backward compatibility.
    Used by the project assessment creation UI.
    """
    from app.core.rbac import require_role
    require_role(current_user, ["teacher", "admin"])
    
    teams = (
        db.query(ProjectTeam)
        .join(Project, ProjectTeam.project_id == Project.id)
        .filter(
            ProjectTeam.school_id == current_user.school_id,
            Project.school_id == current_user.school_id
        )
        .order_by(ProjectTeam.team_number.asc())
        .all()
    )
    
    # Return teams in Group-compatible format
    result = []
    for team in teams:
        project = db.query(Project).filter(Project.id == team.project_id).first()
        result.append({
            "id": team.id,
            "school_id": team.school_id,
            "course_id": project.course_id if project else None,
            "name": team.display_name_at_time or f"Team {team.team_number}",
            "team_number": team.team_number,
            "created_at": team.created_at.isoformat() if team.created_at else None,
            "updated_at": team.updated_at.isoformat() if team.updated_at else None,
        })
    
    return result
