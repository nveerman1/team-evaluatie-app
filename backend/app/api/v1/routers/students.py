from __future__ import annotations

from typing import Optional, List
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
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import Session, aliased
import csv
import io

from app.api.v1.deps import get_db, get_current_user
from app.api.v1.schemas.students import StudentCreate, StudentUpdate, StudentOut
from app.infra.db.models import (
    User,
)  # heeft school_id, name, email, (archived), (class_name), (role)

router = APIRouter(prefix="/students", tags=["students"])

# --- Optionele team-modellen ---
try:
    from app.infra.db.models import Group as Team
    from app.infra.db.models import GroupMember as TeamMember
except Exception:  # pragma: no cover
    Team = None  # type: ignore
    TeamMember = None  # type: ignore


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
) -> StudentOut:
    return StudentOut(
        id=u.id,
        name=u.name,
        email=u.email,
        class_name=class_name,
        team_id=team_id,
        team_name=team_name,
        status="inactive" if getattr(u, "archived", False) else "active",
    )


@router.get("", response_model=List[StudentOut])
def list_students(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    q: Optional[str] = Query(None, description="Zoek in naam of e-mail"),
    class_name: Optional[str] = Query(None, description="Filter op klas"),
    team_id: Optional[int] = Query(None, description="Filter op team-id"),
    status: Optional[str] = Query(None, pattern="^(active|inactive)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
):
    """
    Lijst leerlingen binnen de school met filters & eenvoudige paginatie.
    - q: zoekt in name/email (ILIKE)
    - class_name: match op User.class_name ALS kolom bestaat
    - team_id: filter via TeamMember als team-modellen bestaan
    - status: active/inactive => mapped op User.archived
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
        stmt = stmt.where(
            or_(
                User.name.ilike(f"%{q}%"),
                User.email.ilike(f"%{q}%"),
            )
        )

    if class_name and _supports_attr(User, "class_name"):
        stmt = stmt.where(User.class_name == class_name)

    if team_id is not None and Team and TeamMember:
        tm_alias = aliased(TeamMember)
        stmt = stmt.join(tm_alias, tm_alias.user_id == User.id).where(
            tm_alias.group_id == team_id
        )

    stmt = stmt.order_by(User.name.asc()).limit(limit).offset((page - 1) * limit)
    users: list[User] = db.execute(stmt).scalars().all()

    out: list[StudentOut] = []
    team_name_map: dict[int, str] = {}
    if Team:
        for t in db.execute(select(Team)).scalars().all():
            team_name_map[t.id] = getattr(t, "name", f"Team {t.id}")

    user_to_team_id: dict[int, Optional[int]] = {}
    if TeamMember and users:
        uids = [u.id for u in users]
        for tm in (
            db.execute(select(TeamMember).where(TeamMember.user_id.in_(uids)))
            .scalars()
            .all()
        ):
            user_to_team_id.setdefault(tm.user_id, tm.group_id)

    for u in users:
        cn = (
            getattr(u, "class_name", None)
            if _supports_attr(User, "class_name")
            else None
        )
        tid = user_to_team_id.get(u.id) if user_to_team_id else None
        tname = team_name_map.get(tid) if tid else None
        out.append(_to_out_row(u, cn, tid, tname))

    return out


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

    team_id = None
    team_name = None
    if payload.team_id is not None and Team and TeamMember:
        t = db.get(Team, payload.team_id)
        if not t:
            raise HTTPException(status_code=404, detail="Team not found")
        db.add(
            TeamMember(user_id=u.id, group_id=t.id, school_id=current_user.school_id)
        )
        db.commit()
        team_id, team_name = t.id, getattr(t, "name", f"Team {t.id}")

    return _to_out_row(
        u,
        getattr(u, "class_name", None) if _supports_attr(User, "class_name") else None,
        team_id,
        team_name,
    )


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

    team_id = None
    team_name = None
    if Team and TeamMember:
        tm = (
            db.query(TeamMember)
            .filter(
                TeamMember.user_id == u.id,
                TeamMember.school_id == current_user.school_id,
            )
            .first()
        )
        if payload.team_id is not None:
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
            db.commit()
        else:
            if tm:
                db.delete(tm)
                db.commit()

    return _to_out_row(
        u,
        getattr(u, "class_name", None) if _supports_attr(User, "class_name") else None,
        team_id,
        team_name,
    )


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

    if u.archived:  # type: ignore[attr-defined]
        return

    u.archived = True  # type: ignore[attr-defined]
    db.add(u)
    db.commit()


@router.get("/export.csv", response_class=PlainTextResponse)
def export_students_csv(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    q: Optional[str] = None,
    class_name: Optional[str] = None,
    team_id: Optional[int] = None,
    status: Optional[str] = Query(None, pattern="^(active|inactive)$"),
):
    """CSV-export (zelfde filters als lijst)."""
    items = list_students(
        db=db,
        current_user=current_user,
        q=q,
        class_name=class_name,
        team_id=team_id,
        status=status,
        page=1,
        limit=10_000,
    )

    lines = ["id,name,email,class,team_id,team_name,status"]

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
    """Voorbeeld CSV-kop + 3 rijen."""
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
    """
    Importeer leerlingen uit CSV (separator=','):
    - Unieke sleutel: email binnen school
    - Kolommen: name,email,class,team_id,active (boolean)
    - Flags: dry_run (geen writes), allow_update (naam/klas/team bijwerken voor bestaande)
    - Defaults: default_class_name, default_team_id, activate
    """
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

    for idx, row in enumerate(rdr, start=2):  # start=2 vanwege header
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
            kwargs = {
                "school_id": current_user.school_id,
                "name": name,
                "email": email,
            }
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
