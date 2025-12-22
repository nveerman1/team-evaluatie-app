"""
3de Blok RFID Attendance API endpoints
"""

from __future__ import annotations
from typing import Optional
from datetime import datetime, timedelta, date, timezone
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, aliased
from sqlalchemy import func, and_, or_

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
