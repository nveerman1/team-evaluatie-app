from __future__ import annotations

from typing import Optional, List, Dict, Tuple
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from fastapi.responses import PlainTextResponse
from sqlalchemy import select, and_, or_, exists
from sqlalchemy.orm import Session, aliased
import re

from app.api.v1.deps import get_db, get_current_user
from app.api.v1.schemas.students import StudentCreate, StudentUpdate, StudentOut
from app.infra.db.models import User

router = APIRouter(prefix="/students", tags=["students"])

# -------------------- helpers --------------------

TEAM_RX = re.compile(r"(\d+)$")


def extract_team_number(name: Optional[str]) -> Optional[int]:
    if not name:
        return None
    m = TEAM_RX.search(name.strip())
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


def team_name_for_number(n: int) -> str:
    return f"Team {n}"


try:
    from app.infra.db.models import Group as Team
    from app.infra.db.models import GroupMember as TeamMember
    from app.infra.db.models import Course
except Exception:  # pragma: no cover
    Team = None  # type: ignore
    TeamMember = None  # type: ignore
    Course = None  # type: ignore


def _supports_attr(model, attr: str) -> bool:
    return hasattr(model, attr)


def _user_is_student_scoped():
    if _supports_attr(User, "role"):
        return User.role == "student"
    return True


def _to_out_row(
    u: User,
    class_name: Optional[str],
    team_id: Optional[int],
    team_name: Optional[str],
    course_id: Optional[int],
    course_name: Optional[str],
) -> StudentOut:
    tnum = extract_team_number(team_name)
    return StudentOut(
        id=u.id,
        name=u.name,
        email=u.email,
        class_name=class_name,
        team_id=team_id,
        team_name=team_name,
        team_number=tnum,
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
    team_id: Optional[int] = Query(None, description="Filter op team-id"),
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

    if status == "active" and _supports_attr(User, "archived"):
        stmt = stmt.where(User.archived == False)  # noqa
    elif status == "inactive" and _supports_attr(User, "archived"):
        stmt = stmt.where(User.archived == True)  # noqa

    if q:
        stmt = stmt.where(or_(User.name.ilike(f"%{q}%"), User.email.ilike(f"%{q}%")))

    if class_or_course:
        val = f"%{class_or_course}%"
        class_match = User.class_name.ilike(val)
        course_match = None
        if TeamMember and Team and Course:
            course_match = exists().where(
                and_(
                    TeamMember.user_id == User.id,
                    TeamMember.school_id == current_user.school_id,
                    TeamMember.active,
                    TeamMember.group_id == Team.id,
                    Team.school_id == current_user.school_id,
                    Team.course_id == Course.id,
                    Course.school_id == current_user.school_id,
                    Course.name.ilike(val),
                )
            )
        stmt = (
            stmt.where(or_(class_match, course_match))
            if course_match
            else stmt.where(class_match)
        )

    if class_name:
        stmt = stmt.where(User.class_name.ilike(f"%{class_name}%"))

    if team_id and Team and TeamMember:
        tm_alias = aliased(TeamMember)
        stmt = stmt.join(tm_alias, tm_alias.user_id == User.id).where(
            tm_alias.group_id == team_id,
            tm_alias.school_id == current_user.school_id,
            tm_alias.active,
        )

    stmt = stmt.order_by(User.name.asc()).limit(limit).offset((page - 1) * limit)
    users: list[User] = db.execute(stmt).scalars().all()

    user_to_team_course: Dict[int, Tuple[Optional[int], Optional[int]]] = {}
    team_name_map: Dict[int, str] = {}
    course_name_map: Dict[int, str] = {}

    if TeamMember and Team:
        uids = [u.id for u in users]
        if uids:
            rows = (
                db.query(
                    TeamMember.user_id,
                    TeamMember.group_id,
                    Team.course_id.label("course_id"),
                )
                .join(Team, TeamMember.group_id == Team.id)
                .filter(
                    TeamMember.user_id.in_(uids),
                    TeamMember.school_id == current_user.school_id,
                    TeamMember.active,
                )
                .all()
            )
            for uid, gid, cid in rows:
                if uid not in user_to_team_course:
                    user_to_team_course[uid] = (gid, cid)

    if Team:
        rows = db.execute(
            select(Team.id, Team.name).where(Team.school_id == current_user.school_id)
        ).all()
        team_name_map = {tid: tname or f"Team {tid}" for tid, tname in rows}

    if Course:
        rows = db.execute(
            select(Course.id, Course.name).where(
                Course.school_id == current_user.school_id
            )
        ).all()
        course_name_map = {cid: cname or f"Course {cid}" for cid, cname in rows}

    out = []
    for u in users:
        cn = getattr(u, "class_name", None)

        # Haal gekoppelde team- en course-id's op
        tid, cid = user_to_team_course.get(u.id, (None, None))

        # Haal namen op met veilige defaults
        tname: Optional[str] = team_name_map.get(tid) if tid is not None else None
        cname: Optional[str] = course_name_map.get(cid) if cid is not None else None

        # Bouw StudentOut veilig op
        out.append(
            _to_out_row(
                u=u,
                class_name=cn,
                team_id=tid,
                team_name=tname,
                course_id=cid,
                course_name=cname,
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

    team_id = None
    team_name = None
    course_id = None
    course_name = None

    # koppelen via team_id
    if payload.team_id and Team and TeamMember:
        t = db.get(Team, payload.team_id)
        if not t:
            raise HTTPException(status_code=404, detail="Team not found")
        db.add(
            TeamMember(
                user_id=u.id,
                group_id=t.id,
                school_id=current_user.school_id,
                active=True,
            )
        )
        db.commit()
        team_id, team_name = t.id, t.name
        if hasattr(t, "course_id") and Course:
            c = db.get(Course, t.course_id)
            if c:
                course_id = c.id
                course_name = c.name
            else:
                course_id = None
                course_name = None

    # koppelen via course_id + team_number
    elif payload.course_id and payload.team_number is not None and Team and TeamMember:
        c = db.get(Course, payload.course_id)
        if not c:
            raise HTTPException(status_code=404, detail="Course not found")

        wanted = team_name_for_number(payload.team_number)
        grp = (
            db.query(Team)
            .filter(
                and_(
                    Team.school_id == current_user.school_id,
                    Team.course_id == c.id,
                    Team.name == wanted,
                )
            )
            .first()
        )
        if not grp:
            grp = Team(school_id=current_user.school_id, course_id=c.id, name=wanted)
            db.add(grp)
            db.commit()
            db.refresh(grp)

        db.add(
            TeamMember(
                user_id=u.id,
                group_id=grp.id,
                school_id=current_user.school_id,
                active=True,
            )
        )
        db.commit()

        team_id = grp.id
        team_name = grp.name
        # type-safe: geen tuple-fallback meer
        if c:
            course_id = c.id
            course_name = c.name
        else:
            course_id = None
            course_name = None

    return _to_out_row(u, u.class_name, team_id, team_name, course_id, course_name)


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

    team_id = None
    team_name = None
    course_id = None
    course_name = None

    # wijziging via team_id
    if payload.team_id and Team and TeamMember:
        t = db.get(Team, payload.team_id)
        if not t:
            raise HTTPException(status_code=404, detail="Team not found")
        tm = (
            db.query(TeamMember)
            .filter(
                TeamMember.user_id == u.id,
                TeamMember.school_id == current_user.school_id,
            )
            .first()
        )
        if tm:
            tm.group_id = t.id
            tm.active = True
            db.add(tm)
        else:
            db.add(
                TeamMember(
                    user_id=u.id,
                    group_id=t.id,
                    school_id=current_user.school_id,
                    active=True,
                )
            )
        db.commit()
        team_id, team_name = t.id, t.name
        if hasattr(t, "course_id") and Course:
            c = db.get(Course, t.course_id)
            if c:
                course_id = c.id
                course_name = c.name
            else:
                course_id = None
                course_name = None

    # wijziging via course_id + team_number
    elif payload.course_id and payload.team_number is not None and Team and TeamMember:
        c = db.get(Course, payload.course_id)
        if not c:
            raise HTTPException(status_code=404, detail="Course not found")

        wanted = team_name_for_number(payload.team_number)
        grp = (
            db.query(Team)
            .filter(
                and_(
                    Team.school_id == current_user.school_id,
                    Team.course_id == c.id,
                    Team.name == wanted,
                )
            )
            .first()
        )
        if not grp:
            grp = Team(school_id=current_user.school_id, course_id=c.id, name=wanted)
            db.add(grp)
            db.commit()
            db.refresh(grp)

        tm = (
            db.query(TeamMember)
            .filter(
                TeamMember.user_id == u.id,
                TeamMember.school_id == current_user.school_id,
            )
            .first()
        )
        if tm:
            tm.group_id = grp.id
            tm.active = True
            db.add(tm)
        else:
            db.add(
                TeamMember(
                    user_id=u.id,
                    group_id=grp.id,
                    school_id=current_user.school_id,
                    active=True,
                )
            )
        db.commit()

        team_id = grp.id
        team_name = grp.name
        # type-safe
        if c:
            course_id = c.id
            course_name = c.name
        else:
            course_id = None
            course_name = None

    return _to_out_row(u, u.class_name, team_id, team_name, course_id, course_name)


# -------------------- export --------------------


@router.get("/export.csv", response_class=PlainTextResponse)
def export_students_csv(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    items = list_students(db=db, current_user=current_user, limit=10_000)
    lines = [
        "id,name,email,class,team_id,team_name,team_number,course_id,course_name,status"
    ]
    for s in items:
        lines.append(
            f'{s.id},{s.name},{s.email},{s.class_name or ""},{s.team_id or ""},{s.team_name or ""},{s.team_number or ""},{s.course_id or ""},{s.course_name or ""},{s.status}'
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
def list_teams(
    course_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(Team).filter(Team.school_id == current_user.school_id)
    if course_id:
        q = q.filter(Team.course_id == course_id)
    rows = q.order_by(Team.name.asc()).all()
    return [{"id": t.id, "name": t.name, "course_id": t.course_id} for t in rows]
