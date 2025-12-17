from __future__ import annotations

from typing import List, Optional, Literal, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile, File
from fastapi import status as http_status
from fastapi.responses import StreamingResponse
from sqlalchemy import or_, func, asc, desc, literal
from sqlalchemy.orm import Session
import csv
from io import StringIO, TextIOWrapper

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    User, 
    StudentClassMembership, 
    Class, 
    AcademicYear,
    CourseEnrollment,
    Course,
    Subject,
)

router = APIRouter(prefix="/admin/students", tags=["admin-students"])

SortKey = Literal["name", "class_name", "team_number", "course_name"]
Dir = Literal["asc", "desc"]


def _enrich_student_with_class_and_courses(db: Session, student_id: int, school_id: int) -> Dict[str, Any]:
    """
    Enrich student data with class info and course enrollments.
    Returns dict with 'class_info' and 'course_enrollments'.
    """
    result = {
        "class_info": None,
        "course_enrollments": [],
    }
    
    # Get student's class membership (most recent academic year)
    membership = (
        db.query(StudentClassMembership)
        .join(Class, StudentClassMembership.class_id == Class.id)
        .join(AcademicYear, StudentClassMembership.academic_year_id == AcademicYear.id)
        .filter(StudentClassMembership.student_id == student_id)
        .order_by(AcademicYear.start_date.desc())
        .first()
    )
    
    if membership:
        class_obj = membership.class_
        academic_year = membership.academic_year
        result["class_info"] = f"{class_obj.name} ({academic_year.label})"
    
    # Get student's course enrollments
    enrollments = (
        db.query(CourseEnrollment)
        .join(Course, CourseEnrollment.course_id == Course.id)
        .outerjoin(Subject, Course.subject_id == Subject.id)
        .filter(
            CourseEnrollment.student_id == student_id,
            CourseEnrollment.active.is_(True),
            Course.school_id == school_id,
        )
        .all()
    )
    
    for enrollment in enrollments:
        course = enrollment.course
        result["course_enrollments"].append({
            "course_id": course.id,
            "course_name": course.name,
            "subject_code": course.subject.code if course.subject else None,
        })
    
    return result


# ---------- helpers ----------


def _apply_filters(
    q,
    search: Optional[str],
    status_param: Optional[str],
    course_filter: Optional[str],
    csub_alias,
):
    # q zoekt in name/email/klassenaam/ coursenaam
    if search:
        like = f"%{search.strip()}%"
        parts = [User.name.ilike(like), User.email.ilike(like)]
        if hasattr(User, "class_name"):
            parts.append(User.class_name.ilike(like))
        if csub_alias is not None:
            parts.append(csub_alias.c.course_name.ilike(like))
        q = q.filter(or_(*parts))

    # status filter
    if status_param in ("active", "inactive"):
        q = q.filter(User.archived.is_(status_param == "inactive"))

    # course filter (was “cluster”)
    if course_filter:
        q = q.filter((csub_alias.c.course_name == course_filter))
    return q


def _apply_sort(q, sort: Optional[SortKey], direction: Optional[Dir], csub_alias):
    sort_key = sort or "name"
    direction = direction or "asc"

    colmap = {
        "name": User.name,
        "class_name": getattr(User, "class_name", None) or User.name,
        "team_number": getattr(User, "team_number", None) or User.name,
        "course_name": csub_alias.c.course_name,
    }
    sort_col = colmap.get(sort_key, User.name)
    if direction == "desc":
        return q.order_by(desc(sort_col).nullslast())
    return q.order_by(asc(sort_col).nullsfirst())


def _course_name_subquery(db: Session, school_id: int):
    """
    Bepaalt per user de (eerste/belangrijkste) course_name via group_members -> groups -> courses.
    Resultaat: (user_id, course_name)
    """
    from app.infra.db.models import Group as Team, GroupMember as TM, Course

    csub = (
        db.query(
            TM.user_id.label("user_id"),
            func.min(Course.name).label("course_name"),
        )
        .join(Team, Team.id == TM.group_id)
        .join(Course, Course.id == Team.course_id)
        .filter(TM.school_id == school_id, Course.school_id == school_id, TM.active.is_(True))
        .group_by(TM.user_id)
        .subquery()
    )
    return csub


def _get_or_create_course_and_group(db: Session, school_id: int, course_name: str):
    from app.infra.db.models import Course, Group as Team

    course = (
        db.query(Course)
        .filter(Course.school_id == school_id, Course.name == course_name)
        .first()
    )
    if not course:
        course = Course(school_id=school_id, name=course_name)
        db.add(course)
        db.flush()  # krijgt id

    team = (
        db.query(Team)
        .filter(Team.course_id == course.id, Team.school_id == school_id)
        .first()
    )
    if not team:
        team = Team(school_id=school_id, course_id=course.id, name=course.name)
        db.add(team)
        db.flush()
    return course, team


def _set_user_course_membership(
    db: Session, school_id: int, user_id: int, course_name: Optional[str]
):
    """
    Zorgt dat user actief gekoppeld is aan group van course_name.
    - Als course_name leeg/None is: doe niets aan membership.
    - Als al gekoppeld aan juiste group: niets doen.
    - Anders: bestaande actieve memberships deactiveren en nieuwe toevoegen (of bestaande reactiveren).
    """
    if not course_name:
        return

    from app.infra.db.models import GroupMember as TM

    # doel-group
    _, team = _get_or_create_course_and_group(db, school_id, course_name)

    # huidige actieve memberships
    actives = (
        db.query(TM)
        .filter(TM.school_id == school_id, TM.user_id == user_id, TM.active.is_(True))
        .all()
    )

    # al goed?
    for m in actives:
        if m.group_id == team.id:
            return  # al op de juiste plek

    # deactivate oud
    for m in actives:
        m.active = False
        db.add(m)

    # check of er al een (inactieve) membership bestaat voor deze group
    existing = (
        db.query(TM)
        .filter(
            TM.school_id == school_id,
            TM.user_id == user_id,
            TM.group_id == team.id
        )
        .first()
    )
    
    if existing:
        # reactivate bestaande membership
        existing.active = True
        db.add(existing)
    else:
        # add nieuwe membership
        new_m = TM(school_id=school_id, group_id=team.id, user_id=user_id, active=True)
        db.add(new_m)



# ---------- routes ----------


@router.get("", response_model=List[dict])
def list_admin_students(
    response: Response,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    q: str | None = Query(None, description="Zoek in naam/email/klas/course"),
    status_filter: str | None = Query("active"),
    course: str | None = Query(
        None, description="Filter op course_name (voorheen cluster)"
    ),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    sort: SortKey | None = Query("name"),
    dir: Dir | None = Query("asc"),
):
    if current_user is None or getattr(current_user, "school_id", None) is None:
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Niet ingelogd"
        )

    csub = _course_name_subquery(db, current_user.school_id)

    qry = (
        db.query(
            User.id,
            User.name,
            User.email,
            getattr(User, "class_name", literal(None)).label("class_name"),
            getattr(User, "team_number", literal(None)).label("team_number"),
            getattr(User, "archived", literal(False)).label("archived"),
            getattr(User, "auth_provider", literal("local")).label("auth_provider"),
            getattr(User, "password_hash", literal(None)).label("password_hash"),
            csub.c.course_name.label("course_name"),
        )
        .outerjoin(csub, csub.c.user_id == User.id)
        .filter(User.school_id == current_user.school_id, User.role == "student")
    )

    qry = _apply_filters(qry, q, status_filter, course, csub)
    total = qry.order_by(None).with_entities(func.count()).scalar() or 0
    qry = _apply_sort(qry, sort, dir, csub)

    rows = qry.offset((page - 1) * limit).limit(limit).all()
    response.headers["X-Total-Count"] = str(total)

    out = []
    for r in rows:
        # Determine if user has logged in
        # User has logged in if they have a password_hash (local) or auth_provider is not 'local'
        has_logged_in = bool(r.password_hash) or (r.auth_provider and r.auth_provider != "local")
        
        # Enrich with class and course info
        enrichment = _enrich_student_with_class_and_courses(db, r.id, current_user.school_id)
        
        out.append(
            {
                "id": r.id,
                "name": r.name,
                "email": r.email,
                "class_name": r.class_name,
                "course_name": r.course_name,
                "team_number": r.team_number,
                "status": "inactive" if r.archived else "active",
                "has_logged_in": has_logged_in,
                # New fields
                "class_info": enrichment["class_info"],
                "course_enrollments": enrichment["course_enrollments"],
            }
        )
    return out


@router.post("", response_model=dict, status_code=http_status.HTTP_201_CREATED)
def create_admin_student(
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user is None or getattr(current_user, "school_id", None) is None:
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Niet ingelogd"
        )

    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    if not name or not email:
        raise HTTPException(status_code=400, detail="name en email zijn verplicht")

    # unieke email binnen school
    dup = (
        db.query(User)
        .filter(User.school_id == current_user.school_id, User.email == email)
        .first()
    )
    if dup:
        raise HTTPException(status_code=409, detail="Email bestaat al")

    class_name = (payload.get("class_name") or None) or None
    team_number = payload.get("team_number", None)
    status_val = (payload.get("status") or "active").strip().lower()
    archived = status_val == "inactive"

    u = User(
        school_id=current_user.school_id,
        role="student",
        name=name,
        email=email,
        class_name=class_name,
        team_number=team_number,
        archived=archived,
        auth_provider="local",
    )
    db.add(u)
    db.flush()  # krijgt id

    # optioneel: course_name -> membership zetten
    course_name = (payload.get("course_name") or "").strip() or None
    if course_name:
        _set_user_course_membership(db, current_user.school_id, u.id, course_name)

    db.commit()
    db.refresh(u)

    # course_name voor response bepalen via subquery (zelfde als list/update)
    csub = _course_name_subquery(db, current_user.school_id)
    row = db.query(csub.c.course_name).filter(csub.c.user_id == u.id).first()
    course_name_out = row[0] if row else None

    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "class_name": getattr(u, "class_name", None),
        "course_name": course_name_out,
        "team_number": getattr(u, "team_number", None),
        "status": "inactive" if getattr(u, "archived", False) else "active",
    }


@router.put("/{student_id}", response_model=dict)
def update_admin_student(
    student_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user is None or getattr(current_user, "school_id", None) is None:
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Niet ingelogd"
        )

    u: Optional[User] = (
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

    # unique email binnen school
    new_email = payload.get("email")
    if new_email and new_email != u.email:
        dup = (
            db.query(User)
            .filter(User.school_id == current_user.school_id, User.email == new_email)
            .first()
        )
        if dup:
            raise HTTPException(status_code=409, detail="Email bestaat al")
        u.email = new_email

    if "name" in payload:
        u.name = payload["name"] or u.name
    if "class_name" in payload:
        u.class_name = payload["class_name"] or None
    if "team_number" in payload:
        u.team_number = payload["team_number"]
    if "status" in payload:
        u.archived = payload["status"] == "inactive"

    # optioneel: course_name wijzigen via update
    course_name = payload.get("course_name")
    if course_name:
        _set_user_course_membership(
            db, current_user.school_id, u.id, course_name.strip()
        )

    db.commit()
    db.refresh(u)

    # course_name voor response
    csub = _course_name_subquery(db, current_user.school_id)
    row = db.query(csub.c.course_name).filter(csub.c.user_id == u.id).first()
    course_name_out = row[0] if row else None

    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "class_name": getattr(u, "class_name", None),
        "course_name": course_name_out,
        "team_number": getattr(u, "team_number", None),
        "status": "inactive" if getattr(u, "archived", False) else "active",
    }


@router.delete("/{student_id}", status_code=204)
def delete_admin_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user is None or getattr(current_user, "school_id", None) is None:
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Niet ingelogd"
        )

    u: Optional[User] = (
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
    course: Optional[str] = Query(None),
    sort: Optional[SortKey] = Query("name"),
    dir: Optional[Dir] = Query("asc"),
):
    if current_user is None or getattr(current_user, "school_id", None) is None:
        raise HTTPException(status_code=401)

    csub = _course_name_subquery(db, current_user.school_id)
    qry = (
        db.query(
            User.id,
            User.name,
            User.email,
            getattr(User, "class_name", literal(None)).label("class_name"),
            getattr(User, "team_number", literal(None)).label("team_number"),
            getattr(User, "archived", literal(False)).label("archived"),
            csub.c.course_name.label("course_name"),
        )
        .outerjoin(csub, csub.c.user_id == User.id)
        .filter(User.school_id == current_user.school_id, User.role == "student")
    )
    qry = _apply_filters(qry, q, status, course, csub)
    qry = _apply_sort(qry, sort, dir, csub)
    rows = qry.all()

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(
        ["id", "name", "email", "class_name", "course_name", "team_number", "status"]
    )
    for r in rows:
        writer.writerow(
            [
                r.id,
                r.name or "",
                r.email,
                r.class_name or "",
                r.course_name or "",
                "" if r.team_number is None else r.team_number,
                "inactive" if r.archived else "active",
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
    CSV-kolommen (header, volgorde vrij):
    - name, email (verplicht)
    - class_name (optioneel)
    - course of course_name (optioneel)  <-- vervangt oude 'cluster'
    - team_number (optioneel)
    - status: active|inactive (optioneel; default active)

    Werking:
    - Bestaat email binnen school? -> update.
    - Anders -> create.
    - Als course/course_name aanwezig -> membership updaten/aanmaken.
    """
    if current_user is None or getattr(current_user, "school_id", None) is None:
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Niet ingelogd"
        )

    # CSV lezen
    try:
        text_stream = TextIOWrapper(file.file, encoding="utf-8")
        reader = csv.DictReader(text_stream)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV kon niet gelezen worden: {e}")

    created = 0
    updated = 0
    errors: List[Dict[str, Any]] = []

    for i, row in enumerate(reader, start=2):  # start=2 vanwege header op regel 1
        try:
            name = (row.get("name") or "").strip()
            email = (row.get("email") or "").strip().lower()
            if not name or not email:
                raise ValueError("name en email zijn verplicht")

            class_name = (row.get("class_name") or "").strip() or None
            team_number_raw = (row.get("team_number") or "").strip()
            team_number = int(team_number_raw) if team_number_raw.isdigit() else None

            status_val = (row.get("status") or "active").strip().lower()
            archived = status_val == "inactive"

            course_name = (
                row.get("course") or row.get("course_name") or ""
            ).strip() or None

            # upsert user binnen school
            u: Optional[User] = (
                db.query(User)
                .filter(User.school_id == current_user.school_id, User.email == email)
                .first()
            )
            if u:
                # update
                u.name = name or u.name
                u.class_name = class_name if class_name is not None else u.class_name
                u.team_number = (
                    team_number if team_number is not None else u.team_number
                )
                u.archived = archived
                updated += 1
            else:
                u = User(
                    school_id=current_user.school_id,
                    role="student",
                    name=name,
                    email=email,
                    class_name=class_name,
                    team_number=team_number,
                    archived=archived,
                    auth_provider="local",
                )
                db.add(u)
                db.flush()  # krijg id
                created += 1

            # membership
            if course_name:
                _set_user_course_membership(
                    db, current_user.school_id, u.id, course_name
                )

        except Exception as e:
            errors.append({"row": i, "error": str(e)})
            continue

    db.commit()

    return {
        "created": created,
        "updated": updated,
        "errors": errors,
    }
