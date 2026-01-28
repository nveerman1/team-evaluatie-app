"""
Pydantic schemas for 3de Blok RFID Attendance module
"""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field, field_validator


# ============ Timezone Helper Functions ============


def ensure_aware_utc(dt: datetime) -> datetime:
    """
    Ensure datetime is timezone-aware in UTC.
    
    If datetime is naive, assume it's UTC and add timezone info.
    If datetime is aware, convert to UTC.
    
    This prevents "can't compare offset-naive and offset-aware datetimes" errors.
    """
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        # Naive datetime - assume UTC
        return dt.replace(tzinfo=timezone.utc)
    # Already aware - ensure it's UTC
    return dt.astimezone(timezone.utc)


# ============ RFID Card Schemas ============


class RFIDCardBase(BaseModel):
    uid: str = Field(..., max_length=50, description="RFID card UID")
    label: Optional[str] = Field(
        None, max_length=100, description="Card label/description"
    )
    is_active: bool = Field(True, description="Whether card is active")


class RFIDCardCreate(RFIDCardBase):
    pass


class RFIDCardUpdate(BaseModel):
    label: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


class RFIDCardOut(RFIDCardBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None

    class Config:
        from_attributes = True


# ============ Attendance Event Schemas ============


class AttendanceEventBase(BaseModel):
    check_in: datetime = Field(..., description="Check-in timestamp")
    check_out: Optional[datetime] = Field(None, description="Check-out timestamp")
    project_id: Optional[int] = Field(None, description="Optional project link")
    is_external: bool = Field(False, description="External work flag")
    location: Optional[str] = Field(
        None, max_length=200, description="Location for external work"
    )
    description: Optional[str] = Field(
        None, description="Description for external work"
    )


class AttendanceEventCreate(AttendanceEventBase):
    user_id: int = Field(..., description="User ID")
    source: str = Field("manual", description="Source: rfid|manual|import|api")

    @field_validator("check_out")
    @classmethod
    def check_out_after_check_in(cls, v, info):
        if v and info.data.get("check_in"):
            # Ensure both datetimes are timezone-aware for comparison
            check_in_aware = ensure_aware_utc(info.data["check_in"])
            check_out_aware = ensure_aware_utc(v)
            if check_out_aware <= check_in_aware:
                raise ValueError("check_out must be after check_in")
        return v


class AttendanceEventUpdate(BaseModel):
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    project_id: Optional[int] = None
    location: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None

    @field_validator("check_out")
    @classmethod
    def check_out_after_check_in(cls, v, info):
        if v and info.data.get("check_in"):
            # Ensure both datetimes are timezone-aware for comparison
            check_in_aware = ensure_aware_utc(info.data["check_in"])
            check_out_aware = ensure_aware_utc(v)
            if check_out_aware <= check_in_aware:
                raise ValueError("check_out must be after check_in")
        return v


class AttendanceEventOut(AttendanceEventBase):
    id: int
    user_id: int
    approval_status: Optional[str] = None
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    source: str
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None

    # Computed fields
    duration_seconds: Optional[int] = None
    user_name: Optional[str] = None
    user_class: Optional[str] = None

    class Config:
        from_attributes = True


class AttendanceEventListOut(BaseModel):
    """Response for list endpoint with pagination"""

    events: list[AttendanceEventOut]
    total: int
    page: int
    per_page: int


# ============ External Work Schemas ============


class ExternalWorkCreate(BaseModel):
    """Create external work registration (student-facing)"""

    check_in: datetime = Field(..., description="Start time")
    check_out: datetime = Field(..., description="End time")
    location: str = Field(..., max_length=200, description="Work location")
    description: str = Field(..., description="Description of work done")
    project_id: Optional[int] = Field(None, description="Optional project link")

    @field_validator("check_out")
    @classmethod
    def check_out_after_check_in(cls, v, info):
        # Ensure both datetimes are timezone-aware for comparison
        check_in_aware = ensure_aware_utc(info.data["check_in"])
        check_out_aware = ensure_aware_utc(v)
        if check_out_aware <= check_in_aware:
            raise ValueError("End time must be after start time")
        return v


class ExternalWorkApprove(BaseModel):
    """Approve external work"""

    pass


class ExternalWorkReject(BaseModel):
    """Reject external work"""

    reason: Optional[str] = Field(None, description="Rejection reason")


# ============ RFID Scan Schemas ============


class RFIDScanRequest(BaseModel):
    """Request from Raspberry Pi RFID reader"""

    uid: str = Field(..., max_length=50, description="RFID card UID")
    device_id: Optional[str] = Field(
        None, max_length=50, description="Device identifier"
    )


class RFIDScanResponse(BaseModel):
    """Response to RFID scan"""

    status: str = Field(..., description="ok | not_found | error")
    action: Optional[str] = Field(None, description="check_in | check_out")
    user: Optional[dict] = Field(None, description="User info")
    event: Optional[dict] = Field(None, description="Event info")
    message: Optional[str] = Field(None, description="Error message")


# ============ Stats & Overview Schemas ============


class AttendanceTotals(BaseModel):
    """Attendance totals for a user"""

    user_id: int
    total_school_seconds: int
    total_external_approved_seconds: int
    total_external_pending_seconds: int
    lesson_blocks: float


class UserAttendanceOverview(AttendanceTotals):
    """Extended overview with user info"""

    user_name: str
    user_email: str
    class_name: Optional[str] = None


class OpenSession(BaseModel):
    """Currently open attendance session"""

    id: int
    user_id: int
    user_name: str
    user_email: str
    class_name: Optional[str] = None
    check_in: datetime
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    duration_seconds: int

    class Config:
        from_attributes = True


# ============ Filter Schemas ============


class AttendanceEventFilters(BaseModel):
    """Query parameters for filtering attendance events"""

    user_id: Optional[int] = None
    project_id: Optional[int] = None
    class_name: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_external: Optional[bool] = None
    status_open: Optional[bool] = None  # Only open sessions
    approval_status: Optional[str] = None  # pending | approved | rejected
    page: int = Field(1, ge=1)
    per_page: int = Field(30, ge=1, le=100)


class StatsFilters(BaseModel):
    """Query parameters for stats endpoint"""

    class_name: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


# ============ Bulk Operations ============


class BulkDeleteRequest(BaseModel):
    """Bulk delete attendance events"""

    event_ids: list[int] = Field(..., min_length=1, description="Event IDs to delete")


class BulkApproveRequest(BaseModel):
    """Bulk approve external work"""

    event_ids: list[int] = Field(..., min_length=1, description="Event IDs to approve")


# ============ Statistics Schemas ============


class CourseOut(BaseModel):
    """Course for dropdown filters"""

    id: int
    name: str
    code: Optional[str] = None

    class Config:
        from_attributes = True


class StatsSummary(BaseModel):
    """Summary statistics for school vs external work"""

    school_minutes: int
    school_blocks: float
    extern_approved_minutes: int
    extern_approved_blocks: float
    total_blocks: float
    school_percentage: float
    extern_percentage: float


class WeeklyStats(BaseModel):
    """Weekly attendance trend data"""

    week_start: str  # ISO date format YYYY-MM-DD
    total_blocks: float
    school_blocks: float
    extern_blocks: float


class DailyStats(BaseModel):
    """Daily unique student attendance"""

    date: str  # ISO date format YYYY-MM-DD
    unique_students: int


class HeatmapCell(BaseModel):
    """Single heatmap cell data"""

    weekday: int  # 0=Monday, 4=Friday
    hour: int  # 8-18
    avg_students: float
    label: str  # e.g., "ma 08:00"


class HeatmapData(BaseModel):
    """Heatmap response"""

    cells: list[HeatmapCell]


class StudentSignal(BaseModel):
    """Student matching a signal/anomaly criteria"""

    student_id: int
    student_name: str
    course: Optional[str] = None
    value_text: str  # Human-readable value, e.g., "extern 6h / school 1 blok"


class SignalsData(BaseModel):
    """Signals/anomalies for attention"""

    extern_low_school: list[StudentSignal]
    many_pending: list[StudentSignal]
    long_open: list[StudentSignal]


class EngagementStudent(BaseModel):
    """Student engagement ranking"""

    student_id: int
    student_name: str
    course: Optional[str] = None
    total_blocks: float


class TopBottomData(BaseModel):
    """Top and bottom engagement students"""

    top: list[EngagementStudent]
    bottom: list[EngagementStudent]
