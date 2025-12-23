"""
3de Blok RFID Attendance API endpoints
"""

from __future__ import annotations
from typing import Optional
from datetime import datetime, timedelta, date, timezone
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, aliased
from sqlalchemy import func, and_, or_, case

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    User,
    RFIDCard,
    AttendanceEvent,
    AttendanceAggregate,
    Project,
    CourseEnrollment,
    Course,
)
from app.api.v1.schemas.attendance import (
    RFIDScanRequest,
    RFIDScanResponse,
    AttendanceEventOut,
    AttendanceEventCreate,
    AttendanceEventUpdate,
    AttendanceEventListOut,
    ExternalWorkCreate,
    ExternalWorkApprove,
    ExternalWorkReject,
    BulkDeleteRequest,
    BulkApproveRequest,
    AttendanceTotals,
    OpenSession,
    CourseOut,
    StatsSummary,
    WeeklyStats,
    DailyStats,
    HeatmapData,
    HeatmapCell,
    SignalsData,
    StudentSignal,
    TopBottomData,
    EngagementStudent,
)
from app.core.rbac import require_role

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/attendance", tags=["attendance"])


# ============ Helper Functions ============


def apply_project_date_filter(query, project: Project):
    """
    Apply project date range filter to an attendance query.
    Filters events where check_in falls within project start and end dates.
    """
    if project.start_date:
        query = query.filter(AttendanceEvent.check_in >= project.start_date)
    if project.end_date:
        # Filter events before the start of the next day
        next_day = project.end_date + timedelta(days=1)
        query = query.filter(AttendanceEvent.check_in < next_day)
    return query


# ============ RFID Scan Endpoint ============


@router.post("/scan", response_model=RFIDScanResponse)
def rfid_scan(
    request: RFIDScanRequest,
    db: Session = Depends(get_db),
):
    """
    RFID scan endpoint for Raspberry Pi

    Handles check-in/check-out logic:
    - If no open session: create new check-in
    - If open session exists: close it (check-out)

    Returns user info and action taken
    """
    try:
        # Find RFID card
        card = (
            db.query(RFIDCard)
            .filter(RFIDCard.uid == request.uid, RFIDCard.is_active == True)
            .first()
        )

        if not card:
            return RFIDScanResponse(
                status="not_found",
                message="Geen gebruiker gevonden met deze kaart. Vraag een docent om de kaart te activeren.",
            )

        # Get user
        user = db.query(User).filter(User.id == card.user_id).first()
        if not user:
            return RFIDScanResponse(status="error", message="Gebruiker niet gevonden")

        # Check for open session
        open_session = (
            db.query(AttendanceEvent)
            .filter(
                AttendanceEvent.user_id == user.id,
                AttendanceEvent.is_external == False,
                AttendanceEvent.check_out.is_(None),
            )
            .order_by(AttendanceEvent.check_in.desc())
            .first()
        )

        if open_session:
            # Check-out: close the session
            open_session.check_out = datetime.now(timezone.utc)
            db.commit()
            db.refresh(open_session)

            duration_seconds = int(
                (open_session.check_out - open_session.check_in).total_seconds()
            )

            return RFIDScanResponse(
                status="ok",
                action="check_out",
                user={
                    "id": user.id,
                    "name": user.name,
                    "email": user.email,
                    "class_name": user.class_name,
                },
                event={
                    "id": open_session.id,
                    "check_in": open_session.check_in.isoformat(),
                    "check_out": open_session.check_out.isoformat(),
                    "duration_seconds": duration_seconds,
                },
            )
        else:
            # Check-in: create new session
            new_event = AttendanceEvent(
                user_id=user.id,
                check_in=datetime.now(timezone.utc),
                is_external=False,
                source="rfid",
            )
            db.add(new_event)
            db.commit()
            db.refresh(new_event)

            return RFIDScanResponse(
                status="ok",
                action="check_in",
                user={
                    "id": user.id,
                    "name": user.name,
                    "email": user.email,
                    "class_name": user.class_name,
                },
                event={
                    "id": new_event.id,
                    "check_in": new_event.check_in.isoformat(),
                    "check_out": None,
                },
            )

    except Exception as e:
        logger.error(f"Error in RFID scan: {str(e)}")
        return RFIDScanResponse(
            status="error", message="Er is een onverwachte fout opgetreden"
        )


# ============ Attendance Events ============


@router.get("/events", response_model=AttendanceEventListOut)
def list_attendance_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    class_name: Optional[str] = Query(None, description="Filter by class name"),
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date"),
    is_external: Optional[bool] = Query(None, description="Filter external work"),
    status_open: Optional[bool] = Query(None, description="Show only open sessions"),
    approval_status: Optional[str] = Query(
        None, description="Filter by approval status"
    ),
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
):
    """
    List attendance events with filters

    - Students: Can only view their own events
    - Teachers/Admins: Can view all events in their school
    """
    # Base query - scope to school via explicit user join
    query = (
        db.query(AttendanceEvent)
        .join(User, AttendanceEvent.user_id == User.id)
        .filter(User.school_id == current_user.school_id)
    )

    # Students can only see their own events
    if current_user.role == "student":
        query = query.filter(AttendanceEvent.user_id == current_user.id)
    # Teachers/admins can filter by user_id if specified
    elif user_id:
        query = query.filter(AttendanceEvent.user_id == user_id)

    # Apply other filters (class_name only for teachers/admins)
    if class_name and current_user.role in ["teacher", "admin"]:
        query = query.filter(User.class_name == class_name)

    if project_id:
        query = query.filter(AttendanceEvent.project_id == project_id)

    if start_date:
        query = query.filter(AttendanceEvent.check_in >= start_date)

    if end_date:
        query = query.filter(AttendanceEvent.check_in <= end_date)

    if is_external is not None:
        query = query.filter(AttendanceEvent.is_external == is_external)

    if status_open:
        query = query.filter(AttendanceEvent.check_out.is_(None))

    if approval_status:
        query = query.filter(AttendanceEvent.approval_status == approval_status)

    # Get total count using distinct on AttendanceEvent.id
    total = query.with_entities(AttendanceEvent.id).distinct().count()

    # Pagination
    offset = (page - 1) * per_page
    events = (
        query.order_by(AttendanceEvent.check_in.desc())
        .offset(offset)
        .limit(per_page)
        .all()
    )

    # Convert to output schema and add duration + user info
    events_out = []
    for event in events:
        event_dict = AttendanceEventOut.model_validate(event).model_dump()
        if event.check_out and event.check_in:
            event_dict["duration_seconds"] = int(
                (event.check_out - event.check_in).total_seconds()
            )

        # Add user info (joined in query, accessible via event.user)
        event_dict["user_name"] = (
            event.user.name if hasattr(event, "user") and event.user else None
        )
        event_dict["user_class"] = (
            event.user.class_name if hasattr(event, "user") and event.user else None
        )

        events_out.append(AttendanceEventOut(**event_dict))

    return AttendanceEventListOut(
        events=events_out, total=total, page=page, per_page=per_page
    )


@router.patch("/events/{event_id}", response_model=AttendanceEventOut)
def update_attendance_event(
    event_id: int,
    update: AttendanceEventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update an attendance event (teacher/admin only)
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can update events",
        )

    # Find event and verify school
    event = (
        db.query(AttendanceEvent)
        .join(User, AttendanceEvent.user_id == User.id)
        .filter(
            AttendanceEvent.id == event_id, User.school_id == current_user.school_id
        )
        .first()
    )

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
        )

    # Apply updates
    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(event, field, value)

    event.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(event)

    event_out = AttendanceEventOut.model_validate(event)
    if event.check_out and event.check_in:
        event_out.duration_seconds = int(
            (event.check_out - event.check_in).total_seconds()
        )

    return event_out


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attendance_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete an attendance event (teacher/admin only)
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can delete events",
        )

    event = (
        db.query(AttendanceEvent)
        .join(User, AttendanceEvent.user_id == User.id)
        .filter(
            AttendanceEvent.id == event_id, User.school_id == current_user.school_id
        )
        .first()
    )

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
        )

    db.delete(event)
    db.commit()


@router.post("/events/bulk-delete", status_code=status.HTTP_204_NO_CONTENT)
def bulk_delete_events(
    request: BulkDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Bulk delete attendance events (teacher/admin only)
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can delete events",
        )

    # First, get the valid event IDs that belong to users in the same school
    valid_event_ids = (
        db.query(AttendanceEvent.id)
        .join(User, AttendanceEvent.user_id == User.id)
        .filter(
            AttendanceEvent.id.in_(request.event_ids),
            User.school_id == current_user.school_id,
        )
        .all()
    )

    # Extract the IDs from the result tuples
    valid_ids = [event_id[0] for event_id in valid_event_ids]

    # Now delete without join
    if valid_ids:
        deleted_count = (
            db.query(AttendanceEvent)
            .filter(AttendanceEvent.id.in_(valid_ids))
            .delete(synchronize_session=False)
        )

        db.commit()

        logger.info(
            f"Bulk deleted {deleted_count} attendance events by user {current_user.id}"
        )
    else:
        logger.info(f"No valid events to delete for user {current_user.id}")


# ============ External Work ============


@router.post(
    "/external", response_model=AttendanceEventOut, status_code=status.HTTP_201_CREATED
)
def create_external_work(
    work: ExternalWorkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Register external work (student-facing)
    """
    # Students can only register for themselves
    if current_user.role not in ["student", "teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students, teachers, and admins can register external work",
        )

    new_event = AttendanceEvent(
        user_id=current_user.id,
        check_in=work.check_in,
        check_out=work.check_out,
        is_external=True,
        location=work.location,
        description=work.description,
        project_id=work.project_id,
        approval_status="pending",
        source="manual",
        created_by=current_user.id,
    )

    db.add(new_event)
    db.commit()
    db.refresh(new_event)

    event_out = AttendanceEventOut.model_validate(new_event)
    event_out.duration_seconds = int(
        (new_event.check_out - new_event.check_in).total_seconds()
    )

    return event_out


@router.patch("/external/{event_id}/approve", response_model=AttendanceEventOut)
def approve_external_work(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Approve external work (teacher/admin only)
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can approve external work",
        )

    event = (
        db.query(AttendanceEvent)
        .join(User, AttendanceEvent.user_id == User.id)
        .filter(
            AttendanceEvent.id == event_id,
            AttendanceEvent.is_external == True,
            User.school_id == current_user.school_id,
        )
        .first()
    )

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="External work not found"
        )

    event.approval_status = "approved"
    event.approved_by = current_user.id
    event.approved_at = datetime.now(timezone.utc)
    event.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(event)

    return AttendanceEventOut.model_validate(event)


@router.patch("/external/{event_id}/reject", response_model=AttendanceEventOut)
def reject_external_work(
    event_id: int,
    rejection: ExternalWorkReject,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reject external work (teacher/admin only)
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can reject external work",
        )

    event = (
        db.query(AttendanceEvent)
        .join(User, AttendanceEvent.user_id == User.id)
        .filter(
            AttendanceEvent.id == event_id,
            AttendanceEvent.is_external == True,
            User.school_id == current_user.school_id,
        )
        .first()
    )

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="External work not found"
        )

    event.approval_status = "rejected"
    event.approved_by = current_user.id
    event.approved_at = datetime.now(timezone.utc)
    event.updated_at = datetime.now(timezone.utc)

    # Store rejection reason in description if provided
    if rejection.reason:
        event.description = f"{event.description}\n\n[Afgewezen: {rejection.reason}]"

    db.commit()
    db.refresh(event)

    return AttendanceEventOut.model_validate(event)


@router.post("/external/bulk-approve", status_code=status.HTTP_204_NO_CONTENT)
def bulk_approve_external_work(
    request: BulkApproveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Bulk approve external work (teacher/admin only)
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can approve external work",
        )

    # First, get the valid event IDs that belong to users in the same school
    valid_event_ids = (
        db.query(AttendanceEvent.id)
        .join(User, AttendanceEvent.user_id == User.id)
        .filter(
            AttendanceEvent.id.in_(request.event_ids),
            AttendanceEvent.is_external == True,
            User.school_id == current_user.school_id,
        )
        .all()
    )

    # Extract the IDs from the result tuples
    valid_ids = [event_id[0] for event_id in valid_event_ids]

    # Now update without join
    if valid_ids:
        updated_count = (
            db.query(AttendanceEvent)
            .filter(AttendanceEvent.id.in_(valid_ids))
            .update(
                {
                    "approval_status": "approved",
                    "approved_by": current_user.id,
                    "approved_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                },
                synchronize_session=False,
            )
        )

        db.commit()

        logger.info(
            f"Bulk approved {updated_count} external work events by user {current_user.id}"
        )
    else:
        logger.info(f"No valid events to approve for user {current_user.id}")


# ============ Student Endpoints ============


@router.get("/me", response_model=AttendanceTotals)
def get_my_attendance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get current user's attendance totals and recent events
    """
    # Calculate totals
    school_seconds = (
        db.query(
            func.sum(
                func.extract(
                    "epoch", AttendanceEvent.check_out - AttendanceEvent.check_in
                )
            )
        )
        .filter(
            AttendanceEvent.user_id == current_user.id,
            AttendanceEvent.is_external == False,
            AttendanceEvent.check_out.isnot(None),
        )
        .scalar()
        or 0
    )

    external_approved_seconds = (
        db.query(
            func.sum(
                func.extract(
                    "epoch", AttendanceEvent.check_out - AttendanceEvent.check_in
                )
            )
        )
        .filter(
            AttendanceEvent.user_id == current_user.id,
            AttendanceEvent.is_external == True,
            AttendanceEvent.approval_status == "approved",
            AttendanceEvent.check_out.isnot(None),
        )
        .scalar()
        or 0
    )

    external_pending_seconds = (
        db.query(
            func.sum(
                func.extract(
                    "epoch", AttendanceEvent.check_out - AttendanceEvent.check_in
                )
            )
        )
        .filter(
            AttendanceEvent.user_id == current_user.id,
            AttendanceEvent.is_external == True,
            AttendanceEvent.approval_status == "pending",
            AttendanceEvent.check_out.isnot(None),
        )
        .scalar()
        or 0
    )

    total_seconds = int(school_seconds) + int(external_approved_seconds)
    lesson_blocks = round(total_seconds / (75 * 60), 1)

    return AttendanceTotals(
        user_id=current_user.id,
        total_school_seconds=int(school_seconds),
        total_external_approved_seconds=int(external_approved_seconds),
        total_external_pending_seconds=int(external_pending_seconds),
        lesson_blocks=lesson_blocks,
    )


# ============ Presence (Real-time) ============


@router.get("/presence", response_model=list[OpenSession])
def get_current_presence(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get list of currently present students (open sessions)
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can view presence",
        )

    # Query open sessions for users in the same school
    open_sessions = (
        db.query(AttendanceEvent, User)
        .join(User, AttendanceEvent.user_id == User.id)
        .filter(
            User.school_id == current_user.school_id,
            AttendanceEvent.is_external == False,
            AttendanceEvent.check_out.is_(None),
        )
        .order_by(AttendanceEvent.check_in.desc())
        .all()
    )

    result = []
    for event, user in open_sessions:
        duration_seconds = int(
            (datetime.now(timezone.utc) - event.check_in).total_seconds()
        )
        result.append(
            OpenSession(
                id=event.id,
                user_id=user.id,
                user_name=user.name,
                user_email=user.email,
                class_name=user.class_name,
                check_in=event.check_in,
                project_id=event.project_id,
                project_name=None,  # TODO: Join project if needed
                duration_seconds=duration_seconds,
            )
        )

    return result


# ============ CSV Export ============


@router.get("/export")
def export_attendance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    class_name: Optional[str] = Query(None),
):
    """
    Export attendance events to CSV (teacher/admin only)
    """
    from fastapi.responses import StreamingResponse
    import io
    import csv

    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can export data",
        )

    # Build query
    query = (
        db.query(AttendanceEvent, User)
        .join(User, AttendanceEvent.user_id == User.id)
        .filter(User.school_id == current_user.school_id)
    )

    if start_date:
        query = query.filter(AttendanceEvent.check_in >= start_date)
    if end_date:
        query = query.filter(AttendanceEvent.check_in <= end_date)
    if class_name:
        query = query.filter(User.class_name == class_name)

    events = query.order_by(AttendanceEvent.check_in.desc()).all()

    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow(
        [
            "ID",
            "Student",
            "Email",
            "Klas",
            "Check-in",
            "Check-out",
            "Duur (minuten)",
            "Type",
            "Locatie",
            "Beschrijving",
            "Status",
            "Bron",
            "Aangemaakt op",
        ]
    )

    # Data rows
    for event, user in events:
        duration_minutes = None
        if event.check_out and event.check_in:
            duration_seconds = (event.check_out - event.check_in).total_seconds()
            duration_minutes = int(duration_seconds / 60)

        event_type = "Extern werk" if event.is_external else "School"

        writer.writerow(
            [
                event.id,
                user.name,
                user.email,
                user.class_name or "",
                event.check_in.strftime("%Y-%m-%d %H:%M:%S"),
                (
                    event.check_out.strftime("%Y-%m-%d %H:%M:%S")
                    if event.check_out
                    else ""
                ),
                duration_minutes or "",
                event_type,
                event.location or "",
                event.description or "",
                event.approval_status or "",
                event.source,
                event.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            ]
        )

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=aanwezigheid_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        },
    )


# ============ Overview (All Students) ============


@router.get("/overview")
def get_attendance_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    course_id: Optional[int] = Query(None),
    project_id: Optional[int] = Query(None),
):
    """
    Get attendance overview for all students (teacher/admin only)
    Returns totals per student
    When project_id is provided, only counts events within the project's date range
    When course_id is provided, filters to students enrolled in that course
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can view overview",
        )

    # If project_id is provided, get project details for date filtering
    project = None
    if project_id:
        project = (
            db.query(Project)
            .filter(
                Project.id == project_id, Project.school_id == current_user.school_id
            )
            .first()
        )
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
            )

    # Get students based on course filter
    if course_id:
        # Get students enrolled in the specified course
        student_ids = (
            db.query(CourseEnrollment.student_id)
            .filter(
                CourseEnrollment.course_id == course_id, CourseEnrollment.active == True
            )
            .subquery()
        )

        query = db.query(User).filter(
            User.id.in_(student_ids),
            User.school_id == current_user.school_id,
            User.role == "student",
            User.archived.is_(False),
        )
    else:
        # Get all students in school
        query = db.query(User).filter(
            User.school_id == current_user.school_id,
            User.role == "student",
            User.archived.is_(False),
        )

    students = query.all()

    result = []
    for student in students:
        # Build base query for school hours with optional date filter
        school_query = db.query(
            func.sum(
                func.extract(
                    "epoch", AttendanceEvent.check_out - AttendanceEvent.check_in
                )
            )
        ).filter(
            AttendanceEvent.user_id == student.id,
            AttendanceEvent.is_external == False,
            AttendanceEvent.check_out.isnot(None),
        )

        # Apply project date range filter if project is provided
        if project:
            school_query = apply_project_date_filter(school_query, project)

        school_seconds = school_query.scalar() or 0

        # Build base query for external approved hours with optional date filter
        external_approved_query = db.query(
            func.sum(
                func.extract(
                    "epoch", AttendanceEvent.check_out - AttendanceEvent.check_in
                )
            )
        ).filter(
            AttendanceEvent.user_id == student.id,
            AttendanceEvent.is_external == True,
            AttendanceEvent.approval_status == "approved",
            AttendanceEvent.check_out.isnot(None),
        )

        # Apply project date range filter if project is provided
        if project:
            external_approved_query = apply_project_date_filter(
                external_approved_query, project
            )

        external_approved_seconds = external_approved_query.scalar() or 0

        # Build base query for external pending hours with optional date filter
        external_pending_query = db.query(
            func.sum(
                func.extract(
                    "epoch", AttendanceEvent.check_out - AttendanceEvent.check_in
                )
            )
        ).filter(
            AttendanceEvent.user_id == student.id,
            AttendanceEvent.is_external == True,
            AttendanceEvent.approval_status == "pending",
            AttendanceEvent.check_out.isnot(None),
        )

        # Apply project date range filter if project is provided
        if project:
            external_pending_query = apply_project_date_filter(
                external_pending_query, project
            )

        external_pending_seconds = external_pending_query.scalar() or 0

        total_seconds = int(school_seconds) + int(external_approved_seconds)
        lesson_blocks = round(total_seconds / (75 * 60), 1)

        result.append(
            {
                "user_id": student.id,
                "user_name": student.name,
                "user_email": student.email,
                "class_name": student.class_name,
                "total_school_seconds": int(school_seconds),
                "total_external_approved_seconds": int(external_approved_seconds),
                "total_external_pending_seconds": int(external_pending_seconds),
                "lesson_blocks": lesson_blocks,
            }
        )

    # Sort by lesson blocks descending
    result.sort(key=lambda x: x["lesson_blocks"], reverse=True)

    return result


# ============ Students List with RFID Cards ============


@router.get("/students")
def list_students_with_cards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    search: Optional[str] = Query(None),
):
    """
    Get list of students with their RFID cards (teacher/admin only)
    For RFID admin panel
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can view students",
        )

    # Get students
    query = db.query(User).filter(
        User.school_id == current_user.school_id,
        User.role == "student",
        User.archived.is_(False),
    )

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                User.name.ilike(search_pattern),
                User.email.ilike(search_pattern),
                User.class_name.ilike(search_pattern),
            )
        )

    students = query.order_by(User.class_name, User.name).all()

    # Get RFID cards for all students
    result = []
    for student in students:
        cards = (
            db.query(RFIDCard)
            .filter(RFIDCard.user_id == student.id)
            .order_by(RFIDCard.created_at.desc())
            .all()
        )

        result.append(
            {
                "user_id": student.id,
                "user_name": student.name,
                "user_email": student.email,
                "class_name": student.class_name,
                "cards": [
                    {
                        "id": card.id,
                        "uid": card.uid,
                        "label": card.label,
                        "is_active": card.is_active,
                        "created_at": card.created_at,
                        "updated_at": card.updated_at,
                        "created_by": card.created_by,
                    }
                    for card in cards
                ],
            }
        )

    return result


# ============ Courses and Projects for Filtering ============


@router.get("/courses")
def get_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get active courses for the school (teacher/admin only)
    Used for populating course dropdown in overview filter
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can view courses",
        )

    courses = (
        db.query(Course)
        .filter(Course.school_id == current_user.school_id, Course.is_active == True)
        .order_by(Course.name)
        .all()
    )

    return [
        {
            "id": c.id,
            "name": c.name,
            "code": c.code,
            "period": c.period,
            "level": c.level,
        }
        for c in courses
    ]


@router.get("/projects-by-course")
def get_projects_by_course(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    course_id: Optional[int] = Query(None),
):
    """
    Get projects for dropdown (teacher/admin only)
    Returns projects with various statuses including concept
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can view projects",
        )

    # Get projects including concept status
    # We include "concept" because projects in development should be visible
    query = db.query(Project).filter(
        Project.school_id == current_user.school_id,
        Project.status.in_(["concept", "active", "completed"]),
    )

    if course_id:
        # Filter by course_id when provided
        query = query.filter(Project.course_id == course_id)

    projects = query.order_by(Project.start_date.desc().nulls_last()).all()

    logger.info(
        f"Fetching projects for school {current_user.school_id}, course {course_id}: found {len(projects)} projects"
    )

    return [
        {
            "id": p.id,
            "title": p.title,
            "class_name": p.class_name,
            "course_id": p.course_id,
            "start_date": p.start_date.isoformat() if p.start_date else None,
            "end_date": p.end_date.isoformat() if p.end_date else None,
            "status": p.status,
        }
        for p in projects
    ]


# ============ Statistics Endpoints ============


@router.get("/courses", response_model=list[CourseOut])
def list_courses_for_filters(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get list of courses for dropdown filters in statistics tab.
    Only returns courses relevant to the current school.
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can view statistics",
        )

    courses = (
        db.query(Course)
        .filter(Course.school_id == current_user.school_id)
        .order_by(Course.name)
        .all()
    )

    return courses


def _parse_period(period: str) -> tuple[Optional[datetime], Optional[datetime]]:
    """Parse period parameter to date range"""
    now = datetime.now(timezone.utc)
    
    if period == "4w":
        start_date = now - timedelta(weeks=4)
        return start_date, now
    elif period == "8w":
        start_date = now - timedelta(weeks=8)
        return start_date, now
    elif period == "all":
        return None, None
    else:
        # Default to 4 weeks
        start_date = now - timedelta(weeks=4)
        return start_date, now


@router.get("/stats/summary", response_model=StatsSummary)
def get_stats_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    period: str = Query("4w", pattern=r"^(4w|8w|all)$"),
    course_id: Optional[int] = Query(None),
    project_id: Optional[int] = Query(None),
):
    """
    Get summary statistics: school vs external work breakdown.
    Returns minutes and blocks for each category.
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can view statistics",
        )

    start_date, end_date = _parse_period(period)

    # Base query for school work
    school_query = (
        db.query(
            func.coalesce(
                func.sum(
                    func.extract("epoch", AttendanceEvent.check_out - AttendanceEvent.check_in)
                ),
                0
            )
        )
        .join(User, AttendanceEvent.user_id == User.id)
        .filter(
            User.school_id == current_user.school_id,
            AttendanceEvent.is_external == False,
            AttendanceEvent.check_out.isnot(None),
        )
    )

    # Base query for external work (approved only)
    external_query = (
        db.query(
            func.coalesce(
                func.sum(
                    func.extract("epoch", AttendanceEvent.check_out - AttendanceEvent.check_in)
                ),
                0
            )
        )
        .join(User, AttendanceEvent.user_id == User.id)
        .filter(
            User.school_id == current_user.school_id,
            AttendanceEvent.is_external == True,
            AttendanceEvent.approval_status == "approved",
            AttendanceEvent.check_out.isnot(None),
        )
    )

    # Apply date filters
    if start_date:
        school_query = school_query.filter(AttendanceEvent.check_in >= start_date)
        external_query = external_query.filter(AttendanceEvent.check_in >= start_date)
    if end_date:
        school_query = school_query.filter(AttendanceEvent.check_in <= end_date)
        external_query = external_query.filter(AttendanceEvent.check_in <= end_date)

    # Apply course filter
    if course_id:
        school_query = school_query.join(
            CourseEnrollment, CourseEnrollment.student_id == AttendanceEvent.user_id
        ).filter(CourseEnrollment.course_id == course_id)
        external_query = external_query.join(
            CourseEnrollment, CourseEnrollment.student_id == AttendanceEvent.user_id
        ).filter(CourseEnrollment.course_id == course_id)

    # Apply project filter
    if project_id:
        school_query = school_query.filter(AttendanceEvent.project_id == project_id)
        external_query = external_query.filter(AttendanceEvent.project_id == project_id)

    school_seconds = school_query.scalar() or 0
    external_seconds = external_query.scalar() or 0

    # Convert to minutes and blocks
    school_minutes = int(school_seconds / 60)
    extern_minutes = int(external_seconds / 60)
    school_blocks = round(school_seconds / (75 * 60), 2)
    extern_blocks = round(external_seconds / (75 * 60), 2)
    total_blocks = school_blocks + extern_blocks

    # Calculate percentages
    if total_blocks > 0:
        school_pct = round((school_blocks / total_blocks) * 100, 1)
        extern_pct = round((extern_blocks / total_blocks) * 100, 1)
    else:
        school_pct = 0.0
        extern_pct = 0.0

    return StatsSummary(
        school_minutes=school_minutes,
        school_blocks=school_blocks,
        extern_approved_minutes=extern_minutes,
        extern_approved_blocks=extern_blocks,
        total_blocks=total_blocks,
        school_percentage=school_pct,
        extern_percentage=extern_pct,
    )


@router.get("/stats/weekly", response_model=list[WeeklyStats])
def get_stats_weekly(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    period: str = Query("4w", pattern=r"^(4w|8w|all)$"),
    course_id: Optional[int] = Query(None),
    project_id: Optional[int] = Query(None),
):
    """
    Get weekly attendance trend data.
    Returns total blocks per week (school + approved external).
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can view statistics",
        )

    start_date, end_date = _parse_period(period)

    # Query to get data grouped by week
    # Using PostgreSQL date_trunc to group by week
    query = (
        db.query(
            func.date_trunc("week", AttendanceEvent.check_in).label("week_start"),
            func.sum(
                case(
                    (AttendanceEvent.is_external == False, 
                     func.extract("epoch", AttendanceEvent.check_out - AttendanceEvent.check_in)),
                    else_=0
                )
            ).label("school_seconds"),
            func.sum(
                case(
                    (and_(AttendanceEvent.is_external == True, AttendanceEvent.approval_status == "approved"),
                     func.extract("epoch", AttendanceEvent.check_out - AttendanceEvent.check_in)),
                    else_=0
                )
            ).label("extern_seconds"),
        )
        .join(User, AttendanceEvent.user_id == User.id)
        .filter(
            User.school_id == current_user.school_id,
            AttendanceEvent.check_out.isnot(None),
        )
    )

    # Apply date filters
    if start_date:
        query = query.filter(AttendanceEvent.check_in >= start_date)
    if end_date:
        query = query.filter(AttendanceEvent.check_in <= end_date)

    # Apply course filter
    if course_id:
        query = query.join(
            CourseEnrollment, CourseEnrollment.student_id == AttendanceEvent.user_id
        ).filter(CourseEnrollment.course_id == course_id)

    # Apply project filter
    if project_id:
        query = query.filter(AttendanceEvent.project_id == project_id)

    query = query.group_by("week_start").order_by("week_start")

    results = query.all()

    weekly_data = []
    for row in results:
        school_secs = float(row.school_seconds or 0)
        extern_secs = float(row.extern_seconds or 0)
        school_blocks = round(school_secs / (75 * 60), 2)
        extern_blocks = round(extern_secs / (75 * 60), 2)
        total_blocks = school_blocks + extern_blocks

        weekly_data.append(
            WeeklyStats(
                week_start=row.week_start.date().isoformat(),
                total_blocks=total_blocks,
                school_blocks=school_blocks,
                extern_blocks=extern_blocks,
            )
        )

    return weekly_data


@router.get("/stats/daily", response_model=list[DailyStats])
def get_stats_daily(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    period: str = Query("4w", pattern=r"^(4w|8w|all)$"),
    course_id: Optional[int] = Query(None),
    project_id: Optional[int] = Query(None),
):
    """
    Get daily unique student count.
    Only counts school check-ins (not external).
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can view statistics",
        )

    start_date, end_date = _parse_period(period)

    # Query to count unique students per day
    query = (
        db.query(
            func.date(AttendanceEvent.check_in).label("date"),
            func.count(func.distinct(AttendanceEvent.user_id)).label("unique_students"),
        )
        .join(User, AttendanceEvent.user_id == User.id)
        .filter(
            User.school_id == current_user.school_id,
            AttendanceEvent.is_external == False,
        )
    )

    # Apply date filters
    if start_date:
        query = query.filter(AttendanceEvent.check_in >= start_date)
    if end_date:
        query = query.filter(AttendanceEvent.check_in <= end_date)

    # Apply course filter
    if course_id:
        query = query.join(
            CourseEnrollment, CourseEnrollment.student_id == AttendanceEvent.user_id
        ).filter(CourseEnrollment.course_id == course_id)

    # Apply project filter
    if project_id:
        query = query.filter(AttendanceEvent.project_id == project_id)

    query = query.group_by("date").order_by("date")

    results = query.all()

    daily_data = []
    for row in results:
        daily_data.append(
            DailyStats(
                date=row.date.isoformat(),
                unique_students=row.unique_students,
            )
        )

    return daily_data


@router.get("/stats/heatmap", response_model=HeatmapData)
def get_stats_heatmap(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    period: str = Query("4w", pattern=r"^(4w|8w|all)$"),
    course_id: Optional[int] = Query(None),
    project_id: Optional[int] = Query(None),
):
    """
    Get heatmap data: average unique students per hour per weekday.
    Only uses school check-ins (not external).
    Hours: 8-18, Weekdays: Monday-Friday (0-4).
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can view statistics",
        )

    start_date, end_date = _parse_period(period)

    # Query to get data for heatmap
    # We need to find all unique students present during each hour/weekday combo
    # This requires checking if check_in <= hour_start AND (check_out IS NULL OR check_out > hour_start)
    
    # For simplicity, we'll aggregate by extracting weekday and hour from check_in
    # and count unique students, then average across the period
    query = (
        db.query(
            func.extract("dow", AttendanceEvent.check_in).label("weekday"),  # 0=Sunday, 1=Monday, etc.
            func.extract("hour", AttendanceEvent.check_in).label("hour"),
            func.count(func.distinct(
                func.concat(
                    func.date(AttendanceEvent.check_in),
                    "-",
                    AttendanceEvent.user_id
                )
            )).label("student_hours"),
            func.count(func.distinct(func.date(AttendanceEvent.check_in))).label("day_count"),
        )
        .join(User, AttendanceEvent.user_id == User.id)
        .filter(
            User.school_id == current_user.school_id,
            AttendanceEvent.is_external == False,
            func.extract("dow", AttendanceEvent.check_in).between(1, 5),  # Monday-Friday
            func.extract("hour", AttendanceEvent.check_in).between(8, 18),
        )
    )

    # Apply date filters
    if start_date:
        query = query.filter(AttendanceEvent.check_in >= start_date)
    if end_date:
        query = query.filter(AttendanceEvent.check_in <= end_date)

    # Apply course filter
    if course_id:
        query = query.join(
            CourseEnrollment, CourseEnrollment.student_id == AttendanceEvent.user_id
        ).filter(CourseEnrollment.course_id == course_id)

    # Apply project filter
    if project_id:
        query = query.filter(AttendanceEvent.project_id == project_id)

    query = query.group_by("weekday", "hour")

    results = query.all()

    # Process results into heatmap cells
    cells = []
    weekday_labels = ["ma", "di", "wo", "do", "vr"]
    
    for row in results:
        # Convert PostgreSQL dow (1=Monday, 5=Friday) to our 0-based index
        weekday_idx = int(row.weekday) - 1  # 1->0, 2->1, etc.
        hour = int(row.hour)
        
        # Calculate average students per occurrence of this weekday/hour
        avg_students = round(float(row.student_hours) / max(float(row.day_count), 1), 1)
        
        cells.append(
            HeatmapCell(
                weekday=weekday_idx,
                hour=hour,
                avg_students=avg_students,
                label=f"{weekday_labels[weekday_idx]} {hour:02d}:00",
            )
        )

    return HeatmapData(cells=cells)


@router.get("/stats/signals", response_model=SignalsData)
def get_stats_signals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    period: str = Query("4w", pattern=r"^(4w|8w|all)$"),
    course_id: Optional[int] = Query(None),
    project_id: Optional[int] = Query(None),
):
    """
    Get signals/anomalies for students that need attention.
    Returns three lists: extern_low_school, many_pending, long_open.
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can view statistics",
        )

    start_date, end_date = _parse_period(period)

    # Thresholds (constants)
    MIN_EXTERN_HOURS = 4  # 4+ hours external
    MAX_SCHOOL_BLOCKS = 2  # but <=2 blocks school
    MIN_PENDING_COUNT = 3  # 3+ pending external registrations
    LONG_OPEN_HOURS = 12  # Open session for 12+ hours

    # Signal 1: High external, low school
    extern_low_school = []
    
    # Build subquery for external minutes
    extern_subq = (
        db.query(
            User.id.label("user_id"),
            func.sum(
                func.extract("epoch", AttendanceEvent.check_out - AttendanceEvent.check_in)
            ).label("extern_seconds"),
        )
        .join(AttendanceEvent, AttendanceEvent.user_id == User.id)
        .filter(
            User.school_id == current_user.school_id,
            AttendanceEvent.is_external == True,
            AttendanceEvent.approval_status == "approved",
            AttendanceEvent.check_out.isnot(None),
        )
    )
    
    # Build subquery for school minutes
    school_subq = (
        db.query(
            User.id.label("user_id"),
            func.sum(
                func.extract("epoch", AttendanceEvent.check_out - AttendanceEvent.check_in)
            ).label("school_seconds"),
        )
        .join(AttendanceEvent, AttendanceEvent.user_id == User.id)
        .filter(
            User.school_id == current_user.school_id,
            AttendanceEvent.is_external == False,
            AttendanceEvent.check_out.isnot(None),
        )
    )
    
    # Apply filters to subqueries
    if start_date:
        extern_subq = extern_subq.filter(AttendanceEvent.check_in >= start_date)
        school_subq = school_subq.filter(AttendanceEvent.check_in >= start_date)
    if end_date:
        extern_subq = extern_subq.filter(AttendanceEvent.check_in <= end_date)
        school_subq = school_subq.filter(AttendanceEvent.check_in <= end_date)
    if project_id:
        extern_subq = extern_subq.filter(AttendanceEvent.project_id == project_id)
        school_subq = school_subq.filter(AttendanceEvent.project_id == project_id)
    
    extern_subq = extern_subq.group_by(User.id).subquery()
    school_subq = school_subq.group_by(User.id).subquery()
    
    # Main query joining subqueries
    query = (
        db.query(
            User.id,
            User.name,
            extern_subq.c.extern_seconds,
            school_subq.c.school_seconds,
        )
        .outerjoin(extern_subq, User.id == extern_subq.c.user_id)
        .outerjoin(school_subq, User.id == school_subq.c.user_id)
        .filter(User.school_id == current_user.school_id)
    )
    
    if course_id:
        query = query.join(CourseEnrollment, CourseEnrollment.student_id == AttendanceEvent.user_id).filter(
            CourseEnrollment.course_id == course_id
        )
    
    results = query.all()
    
    for row in results:
        extern_secs = float(row.extern_seconds or 0)
        school_secs = float(row.school_seconds or 0)
        extern_hours = extern_secs / 3600
        school_blocks = school_secs / (75 * 60)
        
        if extern_hours >= MIN_EXTERN_HOURS and school_blocks <= MAX_SCHOOL_BLOCKS:
            # Get user's course
            user_course = (
                db.query(Course.name)
                .join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
                .filter(CourseEnrollment.student_id == row.id)
                .first()
            )
            course_name = user_course[0] if user_course else None
            
            extern_low_school.append(
                StudentSignal(
                    student_id=row.id,
                    student_name=row.name,
                    course=course_name,
                    value_text=f"extern {extern_hours:.1f}u / school {school_blocks:.1f} blok",
                )
            )

    # Limit to top 5
    extern_low_school = extern_low_school[:5]

    # Signal 2: Many pending external work registrations
    many_pending = []
    
    pending_query = (
        db.query(
            User.id,
            User.name,
            func.count(AttendanceEvent.id).label("pending_count"),
        )
        .join(AttendanceEvent, AttendanceEvent.user_id == User.id)
        .filter(
            User.school_id == current_user.school_id,
            AttendanceEvent.is_external == True,
            AttendanceEvent.approval_status == "pending",
        )
    )
    
    if start_date:
        pending_query = pending_query.filter(AttendanceEvent.check_in >= start_date)
    if end_date:
        pending_query = pending_query.filter(AttendanceEvent.check_in <= end_date)
    if course_id:
        pending_query = pending_query.join(
            CourseEnrollment, CourseEnrollment.student_id == AttendanceEvent.user_id
        ).filter(CourseEnrollment.course_id == course_id)
    if project_id:
        pending_query = pending_query.filter(AttendanceEvent.project_id == project_id)
    
    pending_query = pending_query.group_by(User.id, User.name).having(
        func.count(AttendanceEvent.id) >= MIN_PENDING_COUNT
    )
    
    pending_results = pending_query.all()
    
    for row in pending_results:
        # Get user's course
        user_course = (
            db.query(Course.name)
            .join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
            .filter(CourseEnrollment.student_id == row.id)
            .first()
        )
        course_name = user_course[0] if user_course else None
        
        many_pending.append(
            StudentSignal(
                student_id=row.id,
                student_name=row.name,
                course=course_name,
                value_text=f"pending {row.pending_count}",
            )
        )
    
    # Limit to top 5
    many_pending = many_pending[:5]

    # Signal 3: Long open check-ins
    long_open = []
    
    now = datetime.now(timezone.utc)
    threshold_time = now - timedelta(hours=LONG_OPEN_HOURS)
    
    open_query = (
        db.query(
            User.id,
            User.name,
            AttendanceEvent.check_in,
        )
        .join(AttendanceEvent, AttendanceEvent.user_id == User.id)
        .filter(
            User.school_id == current_user.school_id,
            AttendanceEvent.is_external == False,
            AttendanceEvent.check_out.is_(None),
            AttendanceEvent.check_in <= threshold_time,
        )
    )
    
    if course_id:
        open_query = open_query.join(
            CourseEnrollment, CourseEnrollment.student_id == AttendanceEvent.user_id
        ).filter(CourseEnrollment.course_id == course_id)
    if project_id:
        open_query = open_query.filter(AttendanceEvent.project_id == project_id)
    
    open_results = open_query.all()
    
    for row in open_results:
        # Get user's course
        user_course = (
            db.query(Course.name)
            .join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
            .filter(CourseEnrollment.student_id == row.id)
            .first()
        )
        course_name = user_course[0] if user_course else None
        
        # Format check-in time
        check_in_str = row.check_in.strftime("%d-%m %H:%M")
        
        long_open.append(
            StudentSignal(
                student_id=row.id,
                student_name=row.name,
                course=course_name,
                value_text=f"open sinds {check_in_str}",
            )
        )
    
    # Limit to top 5
    long_open = long_open[:5]

    return SignalsData(
        extern_low_school=extern_low_school,
        many_pending=many_pending,
        long_open=long_open,
    )


@router.get("/stats/top-bottom", response_model=TopBottomData)
def get_stats_top_bottom(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    period: str = Query("4w", pattern=r"^(4w|8w|all)$"),
    course_id: Optional[int] = Query(None),
    project_id: Optional[int] = Query(None),
    mode: str = Query("4w", pattern=r"^(4w|scope)$"),
):
    """
    Get top 5 and bottom 5 students by engagement (total blocks).
    Mode: '4w' always uses last 4 weeks, 'scope' uses the selected period.
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can view statistics",
        )

    # Determine date range based on mode
    if mode == "4w":
        now = datetime.now(timezone.utc)
        start_date = now - timedelta(weeks=4)
        end_date = now
    else:  # scope
        start_date, end_date = _parse_period(period)

    # Query to calculate total blocks per student
    query = (
        db.query(
            User.id,
            User.name,
            func.sum(
                func.extract("epoch", AttendanceEvent.check_out - AttendanceEvent.check_in)
            ).label("total_seconds"),
        )
        .join(AttendanceEvent, AttendanceEvent.user_id == User.id)
        .filter(
            User.school_id == current_user.school_id,
            AttendanceEvent.check_out.isnot(None),
            or_(
                AttendanceEvent.is_external == False,
                and_(
                    AttendanceEvent.is_external == True,
                    AttendanceEvent.approval_status == "approved"
                )
            ),
        )
    )

    # Apply date filters
    if start_date:
        query = query.filter(AttendanceEvent.check_in >= start_date)
    if end_date:
        query = query.filter(AttendanceEvent.check_in <= end_date)

    # Apply course filter
    if course_id:
        query = query.join(
            CourseEnrollment, CourseEnrollment.student_id == AttendanceEvent.user_id
        ).filter(CourseEnrollment.course_id == course_id)

    # Apply project filter
    if project_id:
        query = query.filter(AttendanceEvent.project_id == project_id)

    query = query.group_by(User.id, User.name)

    results = query.all()

    # Convert to engagement students with blocks
    engagement_list = []
    for row in results:
        total_secs = float(row.total_seconds or 0)
        total_blocks = round(total_secs / (75 * 60), 2)
        
        # Get user's course
        user_course = (
            db.query(Course.name)
            .join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
            .filter(CourseEnrollment.student_id == row.id)
            .first()
        )
        course_name = user_course[0] if user_course else None
        
        engagement_list.append(
            EngagementStudent(
                student_id=row.id,
                student_name=row.name,
                course=course_name,
                total_blocks=total_blocks,
            )
        )

    # Sort by total_blocks
    engagement_list.sort(key=lambda x: x.total_blocks, reverse=True)

    # Get top 5 and bottom 5
    top = engagement_list[:5]
    bottom = engagement_list[-5:] if len(engagement_list) > 5 else []
    bottom.reverse()  # Show lowest first

    return TopBottomData(top=top, bottom=bottom)
