"""
Teachers API endpoints for CRUD operations
"""

from __future__ import annotations
from typing import Optional, List, Literal
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi import status as http_status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, and_
import csv
from io import StringIO, TextIOWrapper
import bcrypt

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import User, TeacherCourse, Course
from app.api.v1.schemas.teachers import (
    TeacherOut,
    TeacherCreate,
    TeacherUpdate,
    TeacherListOut,
    TeacherCourseAssignment,
    CSVImportResult,
    CourseInfo,
)
from app.core.rbac import require_role

router = APIRouter(prefix="/teachers", tags=["teachers"])

SortKey = Literal["name", "email", "role"]
Dir = Literal["asc", "desc"]


def _hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


@router.get("", response_model=TeacherListOut)
def list_teachers(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["admin", "teacher"])),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by name or email"),
    role: Optional[str] = Query(None, description="Filter by role: teacher, admin"),
    status: Optional[str] = Query(
        None, description="Filter by status: active, inactive"
    ),
    sort: Optional[SortKey] = Query("name", description="Sort by field"),
    direction: Optional[Dir] = Query("asc", description="Sort direction"),
):
    """
    List all teachers in the school with pagination and filters
    
    Only accessible by admins and teachers
    """
    # Base query: only teacher and admin roles, scoped to school
    query = db.query(User).filter(
        User.school_id == user.school_id, User.role.in_(["teacher", "admin"])
    )

    # Apply search filter
    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(User.name.ilike(search_pattern), User.email.ilike(search_pattern))
        )

    # Apply role filter
    if role and role in ["teacher", "admin"]:
        query = query.filter(User.role == role)

    # Apply status filter
    if status == "active":
        query = query.filter(User.archived == False)
    elif status == "inactive":
        query = query.filter(User.archived == True)

    # Apply sorting
    sort_col = getattr(User, sort or "name", User.name)
    if direction == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    # Get total count
    total = query.count()

    # Apply pagination
    offset = (page - 1) * per_page
    teachers_db = query.offset(offset).limit(per_page).all()

    # Build teacher output with courses
    teachers = []
    for teacher in teachers_db:
        # Get courses for this teacher
        teacher_courses = (
            db.query(Course)
            .join(TeacherCourse, TeacherCourse.course_id == Course.id)
            .filter(
                TeacherCourse.teacher_id == teacher.id,
                TeacherCourse.is_active == True,
            )
            .all()
        )

        courses = [CourseInfo.model_validate(c) for c in teacher_courses]

        teachers.append(
            TeacherOut(
                id=teacher.id,
                school_id=teacher.school_id,
                name=teacher.name,
                email=teacher.email,
                role=teacher.role,
                archived=teacher.archived,
                courses=courses,
                created_at=getattr(teacher, "created_at", None),
                last_login=getattr(teacher, "last_login", None),
            )
        )

    return TeacherListOut(
        teachers=teachers, total=total, page=page, per_page=per_page
    )


@router.post("", response_model=TeacherOut, status_code=http_status.HTTP_201_CREATED)
def create_teacher(
    teacher_data: TeacherCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["admin"])),
):
    """
    Create a new teacher
    
    Only accessible by admins
    """
    # Check if email already exists in school
    existing = (
        db.query(User)
        .filter(User.school_id == user.school_id, User.email == teacher_data.email)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists in your school",
        )

    # Validate role
    if teacher_data.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'teacher' or 'admin'",
        )

    # Create new teacher
    password_hash = None
    if teacher_data.password:
        password_hash = _hash_password(teacher_data.password)

    new_teacher = User(
        school_id=user.school_id,
        name=teacher_data.name,
        email=teacher_data.email,
        role=teacher_data.role,
        password_hash=password_hash,
        archived=False,
    )

    db.add(new_teacher)
    db.commit()
    db.refresh(new_teacher)

    return TeacherOut(
        id=new_teacher.id,
        school_id=new_teacher.school_id,
        name=new_teacher.name,
        email=new_teacher.email,
        role=new_teacher.role,
        archived=new_teacher.archived,
        courses=[],
        created_at=getattr(new_teacher, "created_at", None),
        last_login=getattr(new_teacher, "last_login", None),
    )


@router.get("/{teacher_id}", response_model=TeacherOut)
def get_teacher(
    teacher_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["admin", "teacher"])),
):
    """
    Get a specific teacher by ID
    
    Only accessible by admins and teachers
    """
    teacher = (
        db.query(User)
        .filter(
            User.id == teacher_id,
            User.school_id == user.school_id,
            User.role.in_(["teacher", "admin"]),
        )
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Teacher not found"
        )

    # Get courses
    teacher_courses = (
        db.query(Course)
        .join(TeacherCourse, TeacherCourse.course_id == Course.id)
        .filter(
            TeacherCourse.teacher_id == teacher.id, TeacherCourse.is_active == True
        )
        .all()
    )

    courses = [CourseInfo.model_validate(c) for c in teacher_courses]

    return TeacherOut(
        id=teacher.id,
        school_id=teacher.school_id,
        name=teacher.name,
        email=teacher.email,
        role=teacher.role,
        archived=teacher.archived,
        courses=courses,
        created_at=getattr(teacher, "created_at", None),
        last_login=getattr(teacher, "last_login", None),
    )


@router.put("/{teacher_id}", response_model=TeacherOut)
def update_teacher(
    teacher_id: int,
    teacher_data: TeacherUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["admin"])),
):
    """
    Update a teacher
    
    Only accessible by admins
    """
    teacher = (
        db.query(User)
        .filter(
            User.id == teacher_id,
            User.school_id == user.school_id,
            User.role.in_(["teacher", "admin"]),
        )
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Teacher not found"
        )

    # Update fields
    if teacher_data.name is not None:
        teacher.name = teacher_data.name
    if teacher_data.email is not None:
        # Check if email is already taken by another user
        existing = (
            db.query(User)
            .filter(
                User.school_id == user.school_id,
                User.email == teacher_data.email,
                User.id != teacher_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Email already in use by another user",
            )
        teacher.email = teacher_data.email
    if teacher_data.role is not None:
        if teacher_data.role not in ["teacher", "admin"]:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Role must be 'teacher' or 'admin'",
            )
        teacher.role = teacher_data.role
    if teacher_data.archived is not None:
        teacher.archived = teacher_data.archived

    db.commit()
    db.refresh(teacher)

    # Get courses
    teacher_courses = (
        db.query(Course)
        .join(TeacherCourse, TeacherCourse.course_id == Course.id)
        .filter(
            TeacherCourse.teacher_id == teacher.id, TeacherCourse.is_active == True
        )
        .all()
    )

    courses = [CourseInfo.model_validate(c) for c in teacher_courses]

    return TeacherOut(
        id=teacher.id,
        school_id=teacher.school_id,
        name=teacher.name,
        email=teacher.email,
        role=teacher.role,
        archived=teacher.archived,
        courses=courses,
        created_at=getattr(teacher, "created_at", None),
        last_login=getattr(teacher, "last_login", None),
    )


@router.delete("/{teacher_id}", status_code=http_status.HTTP_204_NO_CONTENT)
def delete_teacher(
    teacher_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["admin"])),
):
    """
    Archive (soft delete) a teacher
    
    Only accessible by admins
    """
    teacher = (
        db.query(User)
        .filter(
            User.id == teacher_id,
            User.school_id == user.school_id,
            User.role.in_(["teacher", "admin"]),
        )
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Teacher not found"
        )

    teacher.archived = True
    db.commit()


@router.post("/{teacher_id}/courses", response_model=TeacherOut)
def assign_course_to_teacher(
    teacher_id: int,
    assignment: TeacherCourseAssignment,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["admin"])),
):
    """
    Assign a course to a teacher
    
    Only accessible by admins
    """
    # Verify teacher exists and is in same school
    teacher = (
        db.query(User)
        .filter(
            User.id == teacher_id,
            User.school_id == user.school_id,
            User.role.in_(["teacher", "admin"]),
        )
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Teacher not found"
        )

    # Verify course exists and is in same school
    course = (
        db.query(Course)
        .filter(Course.id == assignment.course_id, Course.school_id == user.school_id)
        .first()
    )

    if not course:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Course not found"
        )

    # Check if assignment already exists
    existing = (
        db.query(TeacherCourse)
        .filter(
            TeacherCourse.teacher_id == teacher_id,
            TeacherCourse.course_id == assignment.course_id,
        )
        .first()
    )

    if existing:
        # Reactivate if it was inactive
        existing.is_active = True
        existing.role = assignment.role
    else:
        # Create new assignment
        new_assignment = TeacherCourse(
            school_id=user.school_id,
            teacher_id=teacher_id,
            course_id=assignment.course_id,
            role=assignment.role,
            is_active=True,
        )
        db.add(new_assignment)

    db.commit()

    # Return updated teacher
    return get_teacher(teacher_id, db, user)


@router.delete("/{teacher_id}/courses/{course_id}", status_code=http_status.HTTP_204_NO_CONTENT)
def remove_course_from_teacher(
    teacher_id: int,
    course_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["admin"])),
):
    """
    Remove a course assignment from a teacher
    
    Only accessible by admins
    """
    # Verify teacher exists and is in same school
    teacher = (
        db.query(User)
        .filter(
            User.id == teacher_id,
            User.school_id == user.school_id,
            User.role.in_(["teacher", "admin"]),
        )
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Teacher not found"
        )

    # Find and deactivate the assignment
    assignment = (
        db.query(TeacherCourse)
        .filter(
            TeacherCourse.teacher_id == teacher_id,
            TeacherCourse.course_id == course_id,
            TeacherCourse.school_id == user.school_id,
        )
        .first()
    )

    if not assignment:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Course assignment not found",
        )

    assignment.is_active = False
    db.commit()


@router.post("/import-csv", response_model=CSVImportResult)
async def import_teachers_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["admin"])),
):
    """
    Import teachers from CSV file
    
    Expected CSV format: name,email,role
    - role should be 'teacher' or 'admin'
    
    Only accessible by admins
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV",
        )

    result = CSVImportResult(success_count=0, error_count=0, errors=[], created=[], updated=[])

    try:
        # Read CSV content
        content = await file.read()
        csv_text = content.decode("utf-8")
        csv_file = StringIO(csv_text)
        reader = csv.DictReader(csv_file)

        # Validate headers
        required_headers = {"name", "email", "role"}
        if not required_headers.issubset(set(reader.fieldnames or [])):
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"CSV must contain columns: {', '.join(required_headers)}",
            )

        row_num = 1
        for row in reader:
            row_num += 1
            try:
                name = row.get("name", "").strip()
                email = row.get("email", "").strip().lower()
                role = row.get("role", "teacher").strip().lower()

                # Validate data
                if not name or not email:
                    result.errors.append(f"Row {row_num}: Name and email are required")
                    result.error_count += 1
                    continue

                if role not in ["teacher", "admin"]:
                    result.errors.append(
                        f"Row {row_num}: Role must be 'teacher' or 'admin', got '{role}'"
                    )
                    result.error_count += 1
                    continue

                # Check if user exists
                existing = (
                    db.query(User)
                    .filter(User.school_id == user.school_id, User.email == email)
                    .first()
                )

                if existing:
                    # Update existing teacher
                    existing.name = name
                    existing.role = role
                    existing.archived = False
                    result.updated.append(existing.id)
                    result.success_count += 1
                else:
                    # Create new teacher
                    new_teacher = User(
                        school_id=user.school_id,
                        name=name,
                        email=email,
                        role=role,
                        archived=False,
                    )
                    db.add(new_teacher)
                    db.flush()
                    result.created.append(new_teacher.id)
                    result.success_count += 1

            except Exception as e:
                result.errors.append(f"Row {row_num}: {str(e)}")
                result.error_count += 1

        db.commit()

    except UnicodeDecodeError:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Invalid CSV encoding. Please use UTF-8",
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing CSV: {str(e)}",
        )

    return result


@router.get("/export-csv", response_class=StreamingResponse)
def export_teachers_csv(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(["admin", "teacher"])),
    status: Optional[str] = Query(None, description="Filter by status: active, inactive"),
):
    """
    Export teachers to CSV
    
    Only accessible by admins and teachers
    """
    # Get teachers
    query = db.query(User).filter(
        User.school_id == user.school_id, User.role.in_(["teacher", "admin"])
    )

    if status == "active":
        query = query.filter(User.archived == False)
    elif status == "inactive":
        query = query.filter(User.archived == True)

    teachers = query.order_by(User.name).all()

    # Generate CSV
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "name", "email", "role", "status"])

    for teacher in teachers:
        writer.writerow([
            teacher.id,
            teacher.name,
            teacher.email,
            teacher.role,
            "active" if not teacher.archived else "inactive",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=teachers.csv"},
    )
