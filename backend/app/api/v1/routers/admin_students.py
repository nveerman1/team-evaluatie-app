from typing import List, Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile, File
from fastapi import status as http_status  # <-- module alias
from fastapi.responses import StreamingResponse
from sqlalchemy import or_, func, asc, desc
from sqlalchemy.orm import Session
import csv
from io import StringIO, TextIOWrapper

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import User
from app.api.v1.schemas.admin_students import AdminStudentOut, AdminStudentUpdate, AdminStudentCreate

router = APIRouter(prefix="/admin/students", tags=["admin-students"])

SortKey = Literal["name", "class_name", "cluster", "team_number"]
Dir = Literal["asc", "desc"]


# ===== Helpers =====
def _col(model, name: str):
    try:
        return getattr(model, name)
    except AttributeError:
        return None


def _apply_filters(q, search: Optional[str], status_param: Optional[str]):
    if search:
        like = f"%{search.strip()}%"
        c_class = _col(User, "class_name")
        c_cluster = _col(User, "cluster")
        parts = [User.name.ilike(like), User.email.ilike(like)]
        if c_class is not None:
            parts.append(c_class.ilike(like))
        if c_cluster is not None:
            parts.append(c_cluster.ilike(like))
        q = q.filter(or_(*parts))
    if status_param in ("active", "inactive"):
        q = q.filter(User.archived.is_(status_param == "inactive"))
    return q


def _apply_sort(q, sort: Optional[SortKey], direction: Optional[Dir]):
    colmap = {
        "name": _col(User, "name"),
        "class_name": _col(User, "class_name"),
        "cluster": _col(User, "cluster"),
        "team_number": _col(User, "team_number"),
    }
    sort_col = colmap.get(sort or "name") or User.name
    if (direction or "asc") == "desc":
        return q.order_by(desc(sort_col).nullslast())
    return q.order_by(asc(sort_col).nullsfirst())


# ===== Endpoints =====
@router.get("", response_model=list[AdminStudentOut])
def list_admin_students(
    response: Response,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    q: str | None = Query(None),
    status_filter: str | None = Query("active"),  # <-- hernoemd
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    sort: SortKey | None = Query("name"),
    dir: Dir | None = Query("asc"),
):
    if current_user is None or getattr(current_user, "school_id", None) is None:
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Niet ingelogd"
        )

    qry = db.query(User).filter(
        User.school_id == current_user.school_id, User.role == "student"
    )
    qry = _apply_filters(qry, q, status_filter)  # <-- doorgeven
    qry = _apply_sort(qry, sort, dir)
    total = qry.order_by(None).with_entities(func.count()).scalar() or 0
    rows = qry.offset((page - 1) * limit).limit(limit).all()
    response.headers["X-Total-Count"] = str(total)
    return [
        AdminStudentOut(
            id=u.id,
            name=u.name,
            email=u.email,
            class_name=getattr(u, "class_name", None),
            cluster=getattr(u, "cluster", None),
            team_number=getattr(u, "team_number", None),
            status="inactive" if getattr(u, "archived", False) else "active",
        )
        for u in rows
    ]


@router.post("", response_model=AdminStudentOut, status_code=201)
def create_admin_student(
    payload: AdminStudentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user is None or getattr(current_user, "school_id", None) is None:
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED,
            detail="Niet ingelogd",
        )

    # Check if email already exists
    existing = (
        db.query(User)
        .filter(
            User.school_id == current_user.school_id,
            User.email == payload.email,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Email bestaat al")

    # Create new student
    new_student = User(
        school_id=current_user.school_id,
        email=payload.email,
        name=payload.name,
        role="student",
        class_name=payload.class_name or None,
        cluster=payload.cluster or None,
        team_number=payload.team_number,
        archived=payload.status == "inactive",
        auth_provider="local",
    )
    db.add(new_student)
    db.commit()
    db.refresh(new_student)

    return AdminStudentOut(
        id=new_student.id,
        name=new_student.name,
        email=new_student.email,
        class_name=getattr(new_student, "class_name", None),
        cluster=getattr(new_student, "cluster", None),
        team_number=getattr(new_student, "team_number", None),
        status="inactive" if getattr(new_student, "archived", False) else "active",
    )


@router.put("/{student_id}", response_model=AdminStudentOut)
def update_admin_student(
    student_id: int,
    payload: AdminStudentUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user is None or getattr(current_user, "school_id", None) is None:
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED,
            detail="Niet ingelogd",
        )

    u: User = (
        db.query(User)
        .filter(
            User.id == student_id,
            User.school_id == current_user.school_id,
            User.role == "student",
        )
        .one_or_none()
    )
    if not u:
        raise HTTPException(status_code=404, detail="Student niet gevonden")

    if payload.email and payload.email != u.email:
        dup = (
            db.query(User)
            .filter(
                User.school_id == current_user.school_id,
                User.email == payload.email,
            )
            .first()
        )
        if dup:
            raise HTTPException(status_code=409, detail="Email bestaat al")

    # === Updates ===
    if payload.name is not None:
        u.name = payload.name
    if payload.email is not None:
        u.email = payload.email
    if payload.class_name is not None:
        u.class_name = payload.class_name or None
    if payload.cluster is not None:
        u.cluster = payload.cluster or None
    if payload.team_number is not None:
        u.team_number = payload.team_number
    if payload.status is not None:
        u.archived = payload.status == "inactive"

    db.commit()
    db.refresh(u)

    return AdminStudentOut(
        id=u.id,
        name=u.name,
        email=u.email,
        class_name=getattr(u, "class_name", None),
        cluster=getattr(u, "cluster", None),
        team_number=getattr(u, "team_number", None),
        status="inactive" if getattr(u, "archived", False) else "active",
    )


@router.delete("/{student_id}", status_code=204)
def delete_admin_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user is None or getattr(current_user, "school_id", None) is None:
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED,
            detail="Niet ingelogd",
        )

    u: User = (
        db.query(User)
        .filter(
            User.id == student_id,
            User.school_id == current_user.school_id,
            User.role == "student",
        )
        .one_or_none()
    )
    if not u:
        raise HTTPException(status_code=404, detail="Student niet gevonden")

    db.delete(u)
    db.commit()
    return Response(status_code=204)


@router.get("/export.csv")
def export_students_csv(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    q: Optional[str] = Query(None),
    status: Optional[str] = Query("active"),
    sort: Optional[SortKey] = Query("name"),
    dir: Optional[Dir] = Query("asc"),
):
    if current_user is None or getattr(current_user, "school_id", None) is None:
        raise HTTPException(status_code=401)

    qry = db.query(User).filter(
        User.school_id == current_user.school_id, User.role == "student"
    )
    qry = _apply_filters(qry, q, status)
    qry = _apply_sort(qry, sort, dir)
    rows: List[User] = qry.all()

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(
        ["id", "name", "email", "class_name", "cluster", "team_number", "status"]
    )
    for u in rows:
        writer.writerow(
            [
                u.id,
                u.name or "",
                u.email,
                getattr(u, "class_name", "") or "",
                getattr(u, "cluster", "") or "",
                (
                    ""
                    if getattr(u, "team_number", None) is None
                    else getattr(u, "team_number")
                ),
                "inactive" if getattr(u, "archived", False) else "active",
            ]
        )
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="students.csv"'},
    )


@router.post("/import.csv")
def import_students_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Verwacht CSV met header:
    id,name,email,class_name,cluster,team_number,status
    - id mag leeg blijven (dan nieuw)
    - status: active|inactive
    - team_number: leeg of integer
    """
    if current_user is None or getattr(current_user, "school_id", None) is None:
        raise HTTPException(status_code=401)

    # Alleen text/csv accepteren
    if not (file.content_type or "").startswith("text"):
        raise HTTPException(status_code=400, detail="Upload een .csv bestand")

    created, updated, skipped = 0, 0, 0
    # Decode als tekst
    wrapper = TextIOWrapper(file.file, encoding="utf-8")
    reader = csv.DictReader(wrapper)

    for row in reader:
        email = (row.get("email") or "").strip().lower()
        name = (row.get("name") or "").strip()
        class_name = (row.get("class_name") or "").strip() or None
        cluster = (row.get("cluster") or "").strip() or None
        team_number_raw = (row.get("team_number") or "").strip()
        status_raw = (row.get("status") or "active").strip().lower()

        if not email or not name:
            skipped += 1
            continue

        team_number = None
        if team_number_raw != "":
            try:
                team_number = int(team_number_raw)
            except ValueError:
                skipped += 1
                continue

        archived = status_raw == "inactive"

        # Zoek binnen school op email
        u: Optional[User] = (
            db.query(User)
            .filter(User.school_id == current_user.school_id, User.email == email)
            .one_or_none()
        )

        if u:
            u.name = name
            u.class_name = class_name
            u.cluster = cluster
            u.team_number = team_number
            u.archived = archived
            updated += 1
        else:
            u = User(
                school_id=current_user.school_id,
                email=email,
                name=name,
                role="student",
                class_name=class_name,
                cluster=cluster,
                team_number=team_number,
                archived=archived,
                auth_provider="local",
            )
            db.add(u)
            created += 1

    db.commit()
    return {"created": created, "updated": updated, "skipped": skipped}
