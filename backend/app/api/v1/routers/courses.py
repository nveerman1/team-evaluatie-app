"""
Courses API endpoints
"""

from __future__ import annotations
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import Course, User, TeacherCourse, Group, GroupMember, AcademicYear
from app.api.v1.schemas.courses import (
    CourseCreate,
    CourseUpdate,
    CourseOut,
    CourseListOut,
    TeacherCourseCreate,
    TeacherCourseOut,
    CourseStudentOut,
    CourseStudentCreate,
    BulkStudentTeamUpdate,
)
from app.core.rbac import require_role, scope_query_by_school, require_course_access
from app.core.audit import log_create, log_update, log_delete
from app.infra.services.archive_guards import require_year_not_archived, require_course_year_not_archived

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("", response_model=CourseListOut)
def list_courses(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    level: Optional[str] = None,
    year: Optional[int] = None,
    is_active: Optional[bool] = True,
    search: Optional[str] = None,
):
    """
    List all courses accessible to the user

    - Admin: sees all courses in their school
    - Teacher: sees courses they teach
    - Student: sees courses they're enrolled in
    """
    if not user or not user.school_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )

    # Base query scoped to school
    query = db.query(Course).filter(Course.school_id == user.school_id)

    # Apply filters
    if level:
        query = query.filter(Course.level == level)
    if year:
        query = query.filter(Course.year == year)
    if is_active is not None:
        query = query.filter(Course.is_active == is_active)
    if search:
        query = query.filter(
            (Course.name.ilike(f"%{search}%"))
            | (Course.code.ilike(f"%{search}%"))
            | (Course.description.ilike(f"%{search}%"))
        )

    # Filter by user role
    if user.role == "teacher":
        # Only show courses the teacher is assigned to
        query = query.join(
            TeacherCourse,
            (TeacherCourse.course_id == Course.id)
            & (TeacherCourse.teacher_id == user.id)
            & (TeacherCourse.is_active == True),
        )
    elif user.role == "student":
        # Only show courses the student is enrolled in
        from app.infra.db.models import Group, GroupMember

        query = query.join(Group, Group.course_id == Course.id).join(
            GroupMember,
            (GroupMember.group_id == Group.id)
            & (GroupMember.user_id == user.id)
            & (GroupMember.active == True),
        )

    # Get total count
    total = query.count()

    # Pagination
    offset = (page - 1) * per_page
    courses = query.order_by(Course.name).offset(offset).limit(per_page).all()

    # Enrich courses with teacher names and academic year labels
    course_outputs = []
    for course in courses:
        course_dict = CourseOut.model_validate(course).model_dump()

        # Get teacher names for this course
        teachers = (
            db.query(User.name)
            .join(TeacherCourse, TeacherCourse.teacher_id == User.id)
            .filter(
                TeacherCourse.course_id == course.id,
                TeacherCourse.is_active == True,
            )
            .all()
        )
        course_dict["teacher_names"] = [t[0] for t in teachers]
        
        # Get academic year label if course has academic_year_id
        if course.academic_year_id:
            academic_year = db.query(AcademicYear).filter(
                AcademicYear.id == course.academic_year_id
            ).first()
            if academic_year:
                course_dict["academic_year_label"] = academic_year.label
        
        course_outputs.append(CourseOut(**course_dict))

    return CourseListOut(
        courses=course_outputs,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
def create_course(
    payload: CourseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Create a new course

    Only admins and teachers can create courses
    """
    require_role(user, ["admin", "teacher"])

    # Check if academic year is archived
    if payload.academic_year_id:
        require_year_not_archived(db, payload.academic_year_id)

    # Check for duplicate code
    if payload.code:
        existing = (
            db.query(Course)
            .filter(
                Course.school_id == user.school_id,
                Course.code == payload.code,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Course with code '{payload.code}' already exists",
            )

    # Create course
    course = Course(
        school_id=user.school_id,
        name=payload.name,
        code=payload.code,
        period=payload.period,
        level=payload.level,
        year=payload.year,
        description=payload.description,
        subject_id=payload.subject_id,
        academic_year_id=payload.academic_year_id,
        is_active=True,
    )

    db.add(course)
    db.flush()  # Get the ID

    # If teacher creates course, automatically assign them to it
    if user.role == "teacher":
        teacher_course = TeacherCourse(
            school_id=user.school_id,
            teacher_id=user.id,
            course_id=course.id,
            role="teacher",
            is_active=True,
        )
        db.add(teacher_course)

    # Log the action
    log_create(
        db=db,
        user=user,
        entity_type="course",
        entity_id=course.id,
        details={"name": course.name, "code": course.code},
        request=request,
    )

    db.commit()
    db.refresh(course)

    return CourseOut.model_validate(course)


@router.get("/{course_id}", response_model=CourseOut)
def get_course(
    course_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a specific course"""
    require_course_access(db, user, course_id)

    course = (
        db.query(Course)
        .filter(Course.id == course_id, Course.school_id == user.school_id)
        .first()
    )

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course not found"
        )

    # Get teacher names
    teachers = (
        db.query(User.name)
        .join(TeacherCourse, TeacherCourse.teacher_id == User.id)
        .filter(
            TeacherCourse.course_id == course.id,
            TeacherCourse.is_active == True,
        )
        .all()
    )

    course_dict = CourseOut.model_validate(course).model_dump()
    course_dict["teacher_names"] = [t[0] for t in teachers]

    return CourseOut(**course_dict)


@router.patch("/{course_id}", response_model=CourseOut)
def update_course(
    course_id: int,
    payload: CourseUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Update a course

    Only admins and course coordinators can update courses
    """
    require_role(user, ["admin", "teacher"])
    require_course_access(db, user, course_id)

    course = (
        db.query(Course)
        .filter(Course.id == course_id, Course.school_id == user.school_id)
        .first()
    )

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course not found"
        )

    # Check if course's current year is archived
    require_course_year_not_archived(db, course_id)

    # Update fields
    update_data = payload.model_dump(exclude_unset=True)

    # If updating academic_year_id, check if new year is archived
    if "academic_year_id" in update_data and update_data["academic_year_id"]:
        require_year_not_archived(db, update_data["academic_year_id"])

    # Check for duplicate code if changing it
    if "code" in update_data and update_data["code"] != course.code:
        existing = (
            db.query(Course)
            .filter(
                Course.school_id == user.school_id,
                Course.code == update_data["code"],
                Course.id != course_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Course with code '{update_data['code']}' already exists",
            )

    for field, value in update_data.items():
        setattr(course, field, value)

    # Log the action
    log_update(
        db=db,
        user=user,
        entity_type="course",
        entity_id=course.id,
        details=update_data,
        request=request,
    )

    db.commit()
    db.refresh(course)

    return CourseOut.model_validate(course)


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Soft delete a course (set is_active = False)

    Only admins can delete courses
    """
    require_role(user, ["admin"])

    course = (
        db.query(Course)
        .filter(Course.id == course_id, Course.school_id == user.school_id)
        .first()
    )

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course not found"
        )

    # Check if course's year is archived
    require_course_year_not_archived(db, course_id)

    course.is_active = False

    # Log the action
    log_delete(
        db=db,
        user=user,
        entity_type="course",
        entity_id=course.id,
        details={"name": course.name},
        request=request,
    )

    db.commit()


@router.get("/{course_id}/teachers", response_model=List[TeacherCourseOut])
def list_course_teachers(
    course_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all teachers assigned to a course"""
    require_course_access(db, user, course_id)

    teachers = (
        db.query(TeacherCourse, User)
        .join(User, User.id == TeacherCourse.teacher_id)
        .filter(
            TeacherCourse.course_id == course_id,
            TeacherCourse.is_active == True,
        )
        .all()
    )

    return [
        TeacherCourseOut(
            id=tc.id,
            teacher_id=tc.teacher_id,
            course_id=tc.course_id,
            role=tc.role,
            is_active=tc.is_active,
            teacher_name=t.name,
            teacher_email=t.email,
        )
        for tc, t in teachers
    ]


@router.post("/{course_id}/teachers", response_model=TeacherCourseOut)
def assign_teacher_to_course(
    course_id: int,
    payload: TeacherCourseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Assign a teacher to a course

    Only admins can assign teachers
    """
    require_role(user, ["admin"])

    # Verify course exists and is in the same school
    course = (
        db.query(Course)
        .filter(Course.id == course_id, Course.school_id == user.school_id)
        .first()
    )

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course not found"
        )

    # Verify teacher exists and is in the same school
    teacher = (
        db.query(User)
        .filter(
            User.id == payload.teacher_id,
            User.school_id == user.school_id,
            User.role == "teacher",
        )
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found"
        )

    # Check if already assigned
    existing = (
        db.query(TeacherCourse)
        .filter(
            TeacherCourse.teacher_id == payload.teacher_id,
            TeacherCourse.course_id == course_id,
        )
        .first()
    )

    if existing:
        # Reactivate if inactive
        if not existing.is_active:
            existing.is_active = True
            existing.role = payload.role
            db.commit()
            db.refresh(existing)

            return TeacherCourseOut(
                id=existing.id,
                teacher_id=existing.teacher_id,
                course_id=existing.course_id,
                role=existing.role,
                is_active=existing.is_active,
                teacher_name=teacher.name,
                teacher_email=teacher.email,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Teacher already assigned to this course",
            )

    # Create new assignment
    teacher_course = TeacherCourse(
        school_id=user.school_id,
        teacher_id=payload.teacher_id,
        course_id=course_id,
        role=payload.role,
        is_active=True,
    )

    db.add(teacher_course)
    db.flush()

    # Log the action
    log_create(
        db=db,
        user=user,
        entity_type="teacher_course",
        entity_id=teacher_course.id,
        details={
            "teacher_id": payload.teacher_id,
            "course_id": course_id,
            "role": payload.role,
        },
        request=request,
    )

    db.commit()
    db.refresh(teacher_course)

    return TeacherCourseOut(
        id=teacher_course.id,
        teacher_id=teacher_course.teacher_id,
        course_id=teacher_course.course_id,
        role=teacher_course.role,
        is_active=teacher_course.is_active,
        teacher_name=teacher.name,
        teacher_email=teacher.email,
    )


@router.delete(
    "/{course_id}/teachers/{teacher_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_teacher_from_course(
    course_id: int,
    teacher_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Remove a teacher from a course (soft delete)

    Only admins can remove teachers
    """
    require_role(user, ["admin"])

    teacher_course = (
        db.query(TeacherCourse)
        .filter(
            TeacherCourse.course_id == course_id,
            TeacherCourse.teacher_id == teacher_id,
        )
        .first()
    )

    if not teacher_course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher assignment not found",
        )

    teacher_course.is_active = False

    # Log the action
    log_delete(
        db=db,
        user=user,
        entity_type="teacher_course",
        entity_id=teacher_course.id,
        details={"teacher_id": teacher_id, "course_id": course_id},
        request=request,
    )

    db.commit()


@router.get("/{course_id}/students", response_model=List[CourseStudentOut])
def list_course_students(
    course_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get all students enrolled in a course

    Returns students with their class_name and team_number
    """
    require_course_access(db, user, course_id)

    # Verify course exists and is in the same school
    course = (
        db.query(Course)
        .filter(Course.id == course_id, Course.school_id == user.school_id)
        .first()
    )

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course not found"
        )

    # Get students through groups
    students = (
        db.query(User)
        .join(GroupMember, GroupMember.user_id == User.id)
        .join(Group, Group.id == GroupMember.group_id)
        .filter(
            Group.course_id == course_id,
            User.school_id == user.school_id,
            User.role == "student",
            GroupMember.active == True,
        )
        .distinct()
        .order_by(User.class_name, User.name)
        .all()
    )

    return [CourseStudentOut.model_validate(s) for s in students]


@router.post(
    "/{course_id}/students",
    response_model=CourseStudentOut,
    status_code=status.HTTP_201_CREATED,
)
def add_student_to_course(
    course_id: int,
    payload: CourseStudentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Add/enroll a student to a course

    Creates a new user if email doesn't exist, or updates existing user.
    Enrolls the student in a default group for the course.
    """
    require_role(user, ["admin", "teacher"])
    require_course_access(db, user, course_id)

    # Verify course exists
    course = (
        db.query(Course)
        .filter(Course.id == course_id, Course.school_id == user.school_id)
        .first()
    )

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course not found"
        )

    # Check if user with this email already exists in the school
    student = (
        db.query(User)
        .filter(
            User.email == payload.email,
            User.school_id == user.school_id,
        )
        .first()
    )

    if student:
        # Update existing student
        student.name = payload.name
        student.class_name = payload.class_name
        student.team_number = payload.team_number
    else:
        # Create new student
        student = User(
            school_id=user.school_id,
            email=payload.email,
            name=payload.name,
            role="student",
            class_name=payload.class_name,
            team_number=payload.team_number,
            password_hash=None,  # No password for students initially
        )
        db.add(student)
        db.flush()  # Get the student ID

    # Enroll student in a course group (find or create default group)
    # Find or create a default group for this course
    default_group = (
        db.query(Group)
        .filter(
            Group.course_id == course_id,
            Group.name == "Alle studenten",
        )
        .first()
    )

    if not default_group:
        default_group = Group(
            school_id=user.school_id,
            course_id=course_id,
            name="Alle studenten",
        )
        db.add(default_group)
        db.flush()

    # Check if student is already a member
    existing_membership = (
        db.query(GroupMember)
        .filter(
            GroupMember.group_id == default_group.id,
            GroupMember.user_id == student.id,
        )
        .first()
    )

    if not existing_membership:
        # Add student to the group
        membership = GroupMember(
            school_id=user.school_id,
            group_id=default_group.id,
            user_id=student.id,
            active=True,
        )
        db.add(membership)

    db.commit()
    db.refresh(student)

    # Log the action
    log_create(
        db=db,
        user=user,
        entity_type="user",
        entity_id=student.id,
        details={"name": student.name, "course": course.name},
        request=request,
    )

    return CourseStudentOut.model_validate(student)


@router.patch("/{course_id}/students/bulk-update", status_code=status.HTTP_200_OK)
def bulk_update_student_teams(
    course_id: int,
    payload: BulkStudentTeamUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    Bulk update team assignments for students in a course

    Only teachers and admins can update team assignments
    """
    require_role(user, ["admin", "teacher"])
    require_course_access(db, user, course_id)

    # Verify course exists
    course = (
        db.query(Course)
        .filter(Course.id == course_id, Course.school_id == user.school_id)
        .first()
    )

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course not found"
        )

    # Update each student
    updated_count = 0
    for update in payload.updates:
        student = (
            db.query(User)
            .filter(
                User.id == update.student_id,
                User.school_id == user.school_id,
                User.role == "student",
            )
            .first()
        )

        if student:
            student.team_number = update.team_number
            updated_count += 1

    # Log the action
    log_update(
        db=db,
        user=user,
        entity_type="course_students",
        entity_id=course_id,
        details={"updated_count": updated_count, "updates": len(payload.updates)},
        request=request,
    )

    db.commit()

    return {
        "message": f"Updated {updated_count} students",
        "updated_count": updated_count,
    }
