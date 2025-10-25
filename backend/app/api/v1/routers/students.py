from __future__ import annotations

from typing import Optional, List, Dict, Tuple
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
    UploadFile,
    File,
    Form,
)
from fastapi.responses import PlainTextResponse
from sqlalchemy import select, and_, or_, exists
from sqlalchemy.orm import Session, aliased
import csv
import io
import re

from app.api.v1.deps import get_db, get_current_user
from app.api.v1.schemas.students import StudentCreate, StudentUpdate, StudentOut
from app.infra.db.models import (
    User,
)  # school_id, name, email, (archived), (class_name), (role)

router = APIRouter(prefix="/students", tags=["students"])

# -------------------- helpers --------------------

TEAM_RX = re.compile(r"(\d+)$")  # pakt het laatste getal uit "Team 12" of "12"


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


# --- Optionele team/cluster (course) modellen ---
try:
    from app.infra.db.models import Group as Team
    from app.infra.db.models import GroupMember as TeamMember
    from app.infra.db.models import Course  # kolommen: id, name, school_id
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
    cluster_id: Optional[int],
    cluster_name: Optional[str],
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
        cluster_id=cluster_id,
        cluster_name=cluster_name,
        status="inactive" if getattr(u, "archived", False) else "active",
    )


# -------------------- list --------------------


@router.get("", response_model=List[StudentOut])
def list_students(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    q: Optional[str] = Query(None, description="Zoek in naam of e-mail"),
    klass_or_cluster: Optional[str] = Query(
        None,
        description="Vrij filter: match op klas (user.class_name) of clusternaam (course.name)",
    ),
    class_name: Optional[str] = Query(
        None, description="(legacy) puur op klas (ILIKE)"
    ),
    team_id: Optional[int] = Query(None, description="(optioneel) filter op team id"),
    status: Optional[str] = Query(None, pattern="^(active|inactive)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
):
    """
    Lijst leerlingen binnen de school met filters & paginatie.
    - q: zoekt in name/email (ILIKE)
    - klass_or_cluster: OR filter op User.class_name of Course.name
    - class_name: (extra) AND filter puur op klas (ILIKE)
    - team_id: filter via TeamMember
    - status: active/inactive => mapped op User.archived
    Retourneert ook cluster (course) info en afgeleid team_number.
    """
    stmt = select(User).where(
        and_(
            User.school_id == current_user.school_id,
            _user_is_student_scoped(),
        )
    )

    if status == "active":
        if _supports_attr(User, "archived"):
            stmt = stmt.where(User.archived == False)  # noqa: E712
    elif status == "inactive":
        if _supports_attr(User, "archived"):
            stmt = stmt.where(User.archived == True)  # noqa: E712

    if q:
        stmt = stmt.where(or_(User.name.ilike(f"%{q}%"), User.email.ilike(f"%{q}%")))

    # Vrije OR-filter: klas of clusternaam
    if klass_or_cluster:
        val = f"%{klass_or_cluster}%"
        class_match = (
            User.class_name.ilike(val) if _supports_attr(User, "class_name") else None
        )
        course_match = None
        if TeamMember and Team and Course:
            course_match = exists().where(
                and_(
                    TeamMember.user_id == User.id,
                    TeamMember.school_id == current_user.school_id,
                    TeamMember.group_id == Team.id,
                    Team.school_id == current_user.school_id,
                    getattr(Team, "course_id") == Course.id,
                    Course.school_id == current_user.school_id,
                    Course.name.ilike(val),
                )
            )
        if class_match is not None and course_match is not None:
            stmt = stmt.where(or_(class_match, course_match))
        elif class_match is not None:
            stmt = stmt.where(class_match)
        elif course_match is not None:
            stmt = stmt.where(course_match)

    # Extra (legacy) klasfilter (AND)
    if class_name and _supports_attr(User, "class_name"):
        stmt = stmt.where(User.class_name.ilike(f"%{class_name}%"))

    # Team filter
    if team_id is not None and Team and TeamMember:
        tm_alias = aliased(TeamMember)
        stmt = stmt.join(tm_alias, tm_alias.user_id == User.id).where(
            tm_alias.group_id == team_id
        )

    stmt = stmt.order_by(User.name.asc()).limit(limit).offset((page - 1) * limit)
    users: list[User] = db.execute(stmt).scalars().all()

    # ---- Maps om team/cluster namen op te halen ----
    team_name_map: Dict[int, str] = {}
    cluster_name_map: Dict[int, str] = {}

    if Team:
        for t in db.execute(select(Team)).scalars().all():
            team_name_map[t.id] = getattr(t, "name", f"Team {t.id}")

    if Course:
        for c in db.execute(select(Course)).scalars().all():
            cluster_name_map[c.id] = getattr(c, "name", None) or f"Course {c.id}"

    # Koppel per user -> team_id en cluster_id (via group -> course)
    user_to_team_and_cluster: Dict[int, Tuple[Optional[int], Optional[int]]] = {}
    if TeamMember and Team:
        uids = [u.id for u in users] if users else []
        if uids:
            rows = (
                db.query(
                    TeamMember.user_id, TeamMember.group_id, Team.school_id, Team.id
                )
                .join(Team, TeamMember.group_id == Team.id)
                .filter(TeamMember.user_id.in_(uids))
                .all()
            )
            group_to_course: Dict[int, Optional[int]] = {}
            if Team and hasattr(Team, "course_id"):
                for gid, course_id in db.query(
                    Team.id, getattr(Team, "course_id")
                ).all():
                    group_to_course[gid] = course_id  # type: ignore

            for uid, gid, _school_id, _group_id in rows:
                if uid not in user_to_team_and_cluster:
                    user_to_team_and_cluster[uid] = (gid, group_to_course.get(gid))

    out: list[StudentOut] = []
    for u in users:
        cn = (
            getattr(u, "class_name", None)
            if _supports_attr(User, "class_name")
            else None
        )
        tid, cid = user_to_team_and_cluster.get(u.id, (None, None))
        tname = team_name_map.get(tid) if tid else None
        cname = cluster_name_map.get(cid) if cid else None
        out.append(_to_out_row(u, cn, tid, tname, cid, cname))

    return out


# -------------------- create --------------------


@router.post("", response_model=StudentOut, status_code=status.HTTP_201_CREATED)
def create_student(
    payload: StudentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    dupe = (
        db.query(User)
        .filter(User.school_id == current_user.school_id, User.email == payload.email)
        .first()
    )
    if dupe:
        raise HTTPException(
            status_code=400, detail="Email already exists in this school"
        )

    kwargs = {
        "school_id": current_user.school_id,
        "name": payload.name,
        "email": payload.email,
    }
    if _supports_attr(User, "archived"):
        kwargs["archived"] = False
    if _supports_attr(User, "role"):
        kwargs["role"] = "student"
    if _supports_attr(User, "class_name") and payload.class_name is not None:
        kwargs["class_name"] = payload.class_name

    u = User(**kwargs)  # type: ignore[arg-type]
    db.add(u)
    db.commit()
    db.refresh(u)

    # 2 paden: (A) legacy team_id of (B) vrije cluster_name + team_number
    team_id = None
    team_name = None
    cluster_id = None
    cluster_name = None

    # (A) legacy
    if getattr(payload, "team_id", None) is not None and Team and TeamMember:
        t = db.get(Team, payload.team_id)
        if not t:
            raise HTTPException(status_code=404, detail="Team not found")
        db.add(
            TeamMember(user_id=u.id, group_id=t.id, school_id=current_user.school_id)
        )
        db.commit()
        team_id, team_name = t.id, getattr(t, "name", f"Team {t.id}")
        if hasattr(t, "course_id"):
            cluster_id = getattr(t, "course_id")
            if Course and cluster_id is not None:
                c = db.get(Course, cluster_id)
                if c:
                    cluster_name = getattr(c, "name", None) or f"Course {c.id}"

    # (B) vrije velden
    cluster_name_in: Optional[str] = getattr(payload, "cluster_name", None)
    team_number_in: Optional[int] = getattr(payload, "team_number", None)

    if (cluster_name_in or team_number_in is not None) and Team and TeamMember:
        # 1) Course upsert
        course = None
        if cluster_name_in and Course:
            course = (
                db.query(Course)
                .filter(
                    and_(
                        Course.school_id == current_user.school_id,
                        Course.name == cluster_name_in.strip(),
                    )
                )
                .first()
            )
            if not course:
                course = Course(school_id=current_user.school_id, name=cluster_name_in.strip())  # type: ignore
                db.add(course)
                db.commit()
                db.refresh(course)

        # 2) Team op nummer
        grp = None
        if team_number_in is not None:
            if not course:
                raise HTTPException(
                    status_code=400,
                    detail="Geef ook een cluster (naam) op bij teamnummer.",
                )
            wanted = team_name_for_number(team_number_in)
            grp = (
                db.query(Team)
                .filter(
                    and_(
                        Team.school_id == current_user.school_id,
                        getattr(Team, "course_id") == course.id,  # type: ignore
                        Team.name == wanted,
                    )
                )
                .first()
            )
            if not grp:
                grp = Team(school_id=current_user.school_id, course_id=course.id, name=wanted)  # type: ignore
                db.add(grp)
                db.commit()
                db.refresh(grp)

            db.add(
                TeamMember(
                    user_id=u.id, group_id=grp.id, school_id=current_user.school_id
                )
            )
            db.commit()

        team_id = grp.id if grp else team_id
        team_name = grp.name if grp else team_name
        cluster_id = course.id if course else cluster_id
        cluster_name = course.name if course else cluster_name

    return _to_out_row(
        u,
        getattr(u, "class_name", None) if _supports_attr(User, "class_name") else None,
        team_id,
        team_name,
        cluster_id,
        cluster_name,
    )


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
        dupe = (
            db.query(User)
            .filter(
                User.school_id == current_user.school_id,
                User.email == payload.email,
                User.id != u.id,
            )
            .first()
        )
        if dupe:
            raise HTTPException(
                status_code=400, detail="Email already exists in this school"
            )

    if payload.name is not None:
        u.name = payload.name
    if payload.email is not None:
        u.email = payload.email
    if payload.class_name is not None and _supports_attr(User, "class_name"):
        u.class_name = payload.class_name  # type: ignore[attr-defined]
    if payload.active is not None and _supports_attr(User, "archived"):
        u.archived = not payload.active  # type: ignore[attr-defined]

    db.add(u)
    db.commit()
    db.refresh(u)

    # ---------------- team/cluster wijzigen ----------------
    team_id = None
    team_name = None
    cluster_id = None
    cluster_name = None

    # legacy pad: expliciet team_id doorgegeven
    if getattr(payload, "team_id", None) is not None and Team and TeamMember:
        tm = (
            db.query(TeamMember)
            .filter(
                TeamMember.user_id == u.id,
                TeamMember.school_id == current_user.school_id,
            )
            .first()
        )
        t = db.get(Team, payload.team_id)
        if not t:
            raise HTTPException(status_code=404, detail="Team not found")
        if tm:
            tm.group_id = t.id
            db.add(tm)
        else:
            db.add(
                TeamMember(
                    user_id=u.id, group_id=t.id, school_id=current_user.school_id
                )
            )
        team_id, team_name = t.id, getattr(t, "name", f"Team {t.id}")
        if hasattr(t, "course_id"):
            cluster_id = getattr(t, "course_id")
            if Course and cluster_id is not None:
                c = db.get(Course, cluster_id)
                cluster_name = getattr(c, "name", None) if c else None
        db.commit()

    # nieuw pad: vrije cluster_name / team_number
    cluster_name_in: Optional[str] = getattr(payload, "cluster_name", None)
    team_number_in: Optional[int] = getattr(payload, "team_number", None)

    if (cluster_name_in is not None) or (team_number_in is not None):
        if not (Team and TeamMember):
            raise HTTPException(status_code=400, detail="Team modellen ontbreken.")

        tm = (
            db.query(TeamMember)
            .filter(
                TeamMember.user_id == u.id,
                TeamMember.school_id == current_user.school_id,
            )
            .first()
        )

        # 1) cluster upsert/verwijderen
        course = None
        if cluster_name_in is not None:
            if not Course:
                raise HTTPException(status_code=400, detail="Course model ontbreekt.")
            cname = cluster_name_in.strip()
            if cname == "":
                if tm:
                    db.delete(tm)
                    db.commit()
                    tm = None
            else:
                course = (
                    db.query(Course)
                    .filter(
                        and_(
                            Course.school_id == current_user.school_id,
                            Course.name == cname,
                        )
                    )
                    .first()
                )
                if not course:
                    course = Course(school_id=current_user.school_id, name=cname)  # type: ignore
                    db.add(course)
                    db.commit()
                    db.refresh(course)

        # 2) teamnummer binnen (nieuwe/huidige) cluster
        if team_number_in is not None:
            if not course:
                if tm:
                    grp = db.get(Team, tm.group_id)
                    if grp and hasattr(grp, "course_id") and Course:
                        course = db.get(Course, getattr(grp, "course_id"))
            if not course:
                raise HTTPException(
                    status_code=400, detail="Geef een cluster op bij teamnummer."
                )

            wanted = team_name_for_number(team_number_in)
            grp = (
                db.query(Team)
                .filter(
                    and_(
                        Team.school_id == current_user.school_id,
                        getattr(Team, "course_id") == course.id,  # type: ignore
                        Team.name == wanted,
                    )
                )
                .first()
            )
            if not grp:
                grp = Team(school_id=current_user.school_id, course_id=course.id, name=wanted)  # type: ignore
                db.add(grp)
                db.commit()
                db.refresh(grp)

            if tm:
                tm.group_id = grp.id
                db.add(tm)
            else:
                db.add(
                    TeamMember(
                        user_id=u.id, group_id=grp.id, school_id=current_user.school_id
                    )
                )
            db.commit()

        # responsevelden opnieuw bepalen
        tm_now = (
            db.query(TeamMember)
            .filter(
                TeamMember.user_id == u.id,
                TeamMember.school_id == current_user.school_id,
            )
            .first()
        )
        if tm_now:
            grp = db.get(Team, tm_now.group_id)
            team_id = grp.id if grp else None
            team_name = grp.name if grp else None
            if grp and hasattr(grp, "course_id") and Course:
                c = db.get(Course, getattr(grp, "course_id"))
                if c:
                    cluster_id = c.id
                    cluster_name = getattr(c, "name", None)

    return _to_out_row(
        u,
        getattr(u, "class_name", None) if _supports_attr(User, "class_name") else None,
        team_id,
        team_name,
        cluster_id,
        cluster_name,
    )


# -------------------- archive --------------------


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_student(
    student_id: int,
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

    if not _supports_attr(User, "archived"):
        raise HTTPException(
            status_code=400, detail="Archiving not supported by User model"
        )

    if getattr(u, "archived", False):
        return

    u.archived = True  # type: ignore[attr-defined]
    db.add(u)
    db.commit()


# -------------------- export --------------------


@router.get("/export.csv", response_class=PlainTextResponse)
def export_students_csv(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    q: Optional[str] = None,
    klass_or_cluster: Optional[str] = None,
    class_name: Optional[str] = None,
    team_id: Optional[int] = None,
    status: Optional[str] = Query(None, pattern="^(active|inactive)$"),
):
    """CSV-export (zelfde filters als lijst)."""
    items = list_students(
        db=db,
        current_user=current_user,
        q=q,
        klass_or_cluster=klass_or_cluster,
        class_name=class_name,
        team_id=team_id,
        status=status,
        page=1,
        limit=10_000,
    )

    lines = [
        "id,name,email,class,team_id,team_name,team_number,cluster_id,cluster_name,status"
    ]

    def esc(v: Optional[str | int]) -> str:
        if v is None:
            return ""
        txt = str(v)
        if any(ch in txt for ch in [",", '"', "\n", "\r"]):
            txt = '"' + txt.replace('"', '""') + '"'
        return txt

    for s in items:
        lines.append(
            ",".join(
                [
                    esc(s.id),
                    esc(s.name),
                    esc(s.email),
                    esc(s.class_name),
                    esc(s.team_id),
                    esc(s.team_name),
                    esc(s.team_number),
                    esc(s.cluster_id),
                    esc(s.cluster_name),
                    esc(s.status),
                ]
            )
        )

    csv_data = "\n".join(lines)
    return PlainTextResponse(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="students_export.csv"'},
    )


# ---------- CSV TEMPLATE & IMPORT ----------


@router.get("/template.csv", response_class=PlainTextResponse)
def template_students_csv():
    content = (
        "name,email,class,team_id,active\n"
        "Alice Example,alice@example.com,2V2,1,true\n"
        "Bob Example,bob@example.com,2V2,1,true\n"
        "Cara Example,cara@example.com,2H1,,true\n"
    )
    return PlainTextResponse(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="students_template.csv"'},
    )


@router.post("/import.csv")
def import_students_csv(
    *,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    file: UploadFile = File(..., description="CSV: name,email,class,team_id,active"),
    dry_run: bool = Form(False),
    allow_update: bool = Form(False),
    default_class_name: Optional[str] = Form(None),
    default_team_id: Optional[int] = Form(None),
    activate: bool = Form(True),
):
    raw = file.file.read()
    try:
        text = raw.decode("utf-8-sig")
    except Exception:
        text = raw.decode("utf-8", errors="ignore")

    rdr = csv.DictReader(io.StringIO(text))
    required = {"name", "email"}
    missing = [c for c in required if c not in (rdr.fieldnames or [])]
    if missing:
        raise HTTPException(
            status_code=400, detail=f"Missing columns: {', '.join(missing)}"
        )

    rows_report: list[dict] = []
    created = updated = skipped = errors = total = 0

    for idx, row in enumerate(rdr, start=2):
        total += 1
        name = (row.get("name") or "").strip()
        email = (row.get("email") or "").strip().lower()
        klass = (row.get("class") or row.get("class_name") or "").strip()
        team_raw = (row.get("team_id") or "").strip()
        active_str = (row.get("active") or "").strip().lower()

        if not name or not email:
            rows_report.append(
                {
                    "row": idx,
                    "email": email,
                    "status": "error",
                    "message": "name/email ontbreekt",
                }
            )
            errors += 1
            continue

        existing: Optional[User] = (
            db.query(User)
            .filter(User.school_id == current_user.school_id, User.email == email)
            .first()
        )

        # parse booleans/numbers
        active_val: Optional[bool]
        if active_str in {"true", "1", "yes", "y"}:
            active_val = True
        elif active_str in {"false", "0", "no", "n"}:
            active_val = False
        else:
            active_val = None

        team_id_val: Optional[int] = None
        if team_raw:
            try:
                team_id_val = int(team_raw)
            except ValueError:
                rows_report.append(
                    {
                        "row": idx,
                        "email": email,
                        "status": "error",
                        "message": "team_id is geen geheel getal",
                    }
                )
                errors += 1
                continue

        if existing:
            if not allow_update:
                rows_report.append(
                    {
                        "row": idx,
                        "email": email,
                        "status": "skipped",
                        "message": "bestaat al",
                    }
                )
                skipped += 1
                continue

            if not dry_run:
                existing.name = name
                if _supports_attr(User, "class_name"):
                    existing.class_name = klass or default_class_name or getattr(existing, "class_name", None)  # type: ignore
                if _supports_attr(User, "archived") and active_val is not None:
                    existing.archived = not active_val  # type: ignore
                db.add(existing)
                db.commit()
                db.refresh(existing)

                if Team and TeamMember:
                    tm = (
                        db.query(TeamMember)
                        .filter(
                            TeamMember.user_id == existing.id,
                            TeamMember.school_id == current_user.school_id,
                        )
                        .first()
                    )
                    final_team_id = (
                        team_id_val if team_id_val is not None else default_team_id
                    )
                    if final_team_id is not None:
                        t = db.get(Team, final_team_id)
                        if not t:
                            rows_report.append(
                                {
                                    "row": idx,
                                    "email": email,
                                    "status": "error",
                                    "message": f"team {final_team_id} bestaat niet",
                                }
                            )
                            errors += 1
                            continue
                        if tm:
                            tm.group_id = t.id
                            db.add(tm)
                        else:
                            db.add(
                                TeamMember(
                                    user_id=existing.id,
                                    group_id=t.id,
                                    school_id=current_user.school_id,
                                )
                            )
                        db.commit()
                    else:
                        if tm:
                            db.delete(tm)
                            db.commit()

            updated += 1
            rows_report.append(
                {
                    "row": idx,
                    "email": email,
                    "status": "updated",
                    "message": "bijgewerkt",
                }
            )
            continue

        # nieuw
        if not dry_run:
            kwargs = {"school_id": current_user.school_id, "name": name, "email": email}
            if _supports_attr(User, "role"):
                kwargs["role"] = "student"
            if _supports_attr(User, "class_name"):
                kwargs["class_name"] = klass or default_class_name
            if _supports_attr(User, "archived"):
                active_final = active_val if active_val is not None else activate
                kwargs["archived"] = not bool(active_final)

            u = User(**kwargs)  # type: ignore[arg-type]
            db.add(u)
            db.commit()
            db.refresh(u)

            final_team_id = team_id_val if team_id_val is not None else default_team_id
            if final_team_id is not None and Team and TeamMember:
                t = db.get(Team, final_team_id)
                if not t:
                    rows_report.append(
                        {
                            "row": idx,
                            "email": email,
                            "status": "error",
                            "message": f"team {final_team_id} bestaat niet",
                        }
                    )
                    errors += 1
                    continue
                db.add(
                    TeamMember(
                        user_id=u.id, group_id=t.id, school_id=current_user.school_id
                    )
                )
                db.commit()

        created += 1
        rows_report.append(
            {"row": idx, "email": email, "status": "created", "message": "aangemaakt"}
        )

    return {
        "total_rows": total,
        "created_count": created,
        "updated_count": updated,
        "skipped_count": skipped,
        "error_count": errors,
        "rows": rows_report,
        "dry_run": dry_run,
    }


# ------ Optionele lijst-endpoints voor Cluster/Teams dropdowns ------


@router.get("/courses")
def list_courses(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """
    Return courses (clusters) that have at least one active student.
    """
    try:
        from app.infra.db.models import Course
    except Exception:
        return []

    # Check if we have the models needed to filter by active students
    if not (Team and TeamMember):
        # Fallback: return all courses if models not available
        rows = (
            db.query(Course)
            .filter(Course.school_id == current_user.school_id)
            .order_by(Course.name.asc(), Course.id.asc())
            .all()
        )
        return [
            {"id": c.id, "name": getattr(c, "name", None) or f"Course {c.id}"}
            for c in rows
        ]

    # Query courses that have at least one active student
    # Join: Course -> Group -> GroupMember -> User (where archived=False and role='student')
    rows = (
        db.query(Course)
        .join(Team, Team.course_id == Course.id)
        .join(TeamMember, TeamMember.group_id == Team.id)
        .join(User, User.id == TeamMember.user_id)
        .filter(
            Course.school_id == current_user.school_id,
            User.archived == False,  # noqa: E712
            User.role == "student",
        )
        .distinct()
        .order_by(Course.name.asc(), Course.id.asc())
        .all()
    )
    return [
        {"id": c.id, "name": getattr(c, "name", None) or f"Course {c.id}"} for c in rows
    ]


@router.get("/teams")
def list_teams(
    course_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        from app.infra.db.models import Group as Team
    except Exception:
        return []
    q = db.query(Team).filter(Team.school_id == current_user.school_id)
    if course_id is not None and hasattr(Team, "course_id"):
        q = q.filter(Team.course_id == course_id)
    rows = q.order_by(Team.name.asc(), Team.id.asc()).all()
    return [
        {
            "id": t.id,
            "name": getattr(t, "name", None) or f"Team {t.id}",
            "course_id": (
                getattr(t, "course_id", None) if hasattr(t, "course_id") else None
            ),
        }
        for t in rows
    ]
