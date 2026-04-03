"""
Calendar Feed API endpoints — iCal subscription feed for external calendar apps.

Endpoints:
  POST   /calendar/generate-token  — generate or regenerate a personal feed token
  DELETE /calendar/revoke-token    — revoke the feed token (invalidates subscriptions)
  GET    /calendar/feed.ics        — dynamic iCal feed authenticated via ?token=
"""

from __future__ import annotations

import uuid
import logging
from typing import Any, Optional
from datetime import datetime, timedelta, timezone, date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from icalendar import Calendar, Event, Alarm, Timezone, TimezoneStandard, vText

from app.api.v1.deps import get_current_user, get_db
from app.api.v1.schemas.calendar_feed import CalendarTokenResponse
from app.core.rbac import require_role
from app.infra.db.models import (
    User,
    Evaluation,
    Project,
    CompetencyWindow,
    Task,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/calendar", tags=["calendar-feed"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

AMS_TZ = "Europe/Amsterdam"
UID_DOMAIN = "team-evaluatie-app"


def _build_urls(request: Request, token: str) -> CalendarTokenResponse:
    """Build the various subscription URLs for a given token."""
    host = request.headers.get("host", request.url.hostname or "localhost")
    # Use https scheme from request, fall back to https
    scheme = request.url.scheme or "https"
    feed_path = f"/api/v1/calendar/feed.ics?token={token}"
    https_url = f"{scheme}://{host}{feed_path}"
    webcal_url = f"webcal://{host}{feed_path}"
    google_url = (
        f"https://calendar.google.com/calendar/r?cid={webcal_url}"
    )
    outlook_url = (
        f"https://outlook.live.com/calendar/0/addfromweb?url={https_url}"
    )
    return CalendarTokenResponse(
        token=token,
        webcal_url=webcal_url,
        https_url=https_url,
        google_calendar_url=google_url,
        outlook_url=outlook_url,
    )


def _extract_deadlines(settings: Any) -> Optional[dict]:
    """Extract review/reflection deadlines from evaluation settings JSON."""
    if not isinstance(settings, dict):
        return None
    review = settings.get("review_deadline") or settings.get("deadlines", {}).get(
        "review"
    )
    reflection = settings.get("reflection_deadline") or settings.get(
        "deadlines", {}
    ).get("reflection")
    if review or reflection:
        return {"review": review, "reflection": reflection}
    return None


def _to_dt(value: Any) -> Optional[datetime]:
    """Coerce a date/datetime string or object to an aware datetime."""
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
    if isinstance(value, str):
        for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
            try:
                dt = datetime.strptime(value, fmt)
                return dt.replace(tzinfo=timezone.utc)
            except ValueError:
                continue
    return None


def _add_valarm(event: Event) -> None:
    """Add a 1-day-before reminder alarm to an iCal event."""
    alarm = Alarm()
    alarm.add("action", "DISPLAY")
    alarm.add("description", "Deadline herinnering")
    alarm.add("trigger", timedelta(days=-1))
    event.add_component(alarm)


def _make_ams_timezone() -> Timezone:
    """Build a basic VTIMEZONE component for Europe/Amsterdam (CET/CEST)."""
    tz = Timezone()
    tz.add("tzid", AMS_TZ)

    standard = TimezoneStandard()
    standard.add("dtstart", datetime(1970, 10, 25, 3, 0, 0))
    standard.add("tzoffsetfrom", timedelta(hours=2))
    standard.add("tzoffsetto", timedelta(hours=1))
    standard.add("tzname", "CET")
    tz.add_component(standard)

    return tz


def _build_ical(school_id: int, db: Session) -> bytes:
    """
    Generate an iCal feed for all relevant events of the given school.

    Includes:
    - Project start and end dates
    - Evaluation review and reflection deadlines
    - Competency window end dates
    - Open task due dates
    """
    cal = Calendar()
    cal.add("prodid", "-//Team Evaluatie App//NL")
    cal.add("version", "2.0")
    cal.add("calscale", "GREGORIAN")
    cal.add("method", "PUBLISH")
    cal.add("x-wr-calname", "Team Evaluatie Kalender")
    cal.add("x-wr-timezone", AMS_TZ)
    cal.add_component(_make_ams_timezone())

    now = datetime.now(tz=timezone.utc)

    # ---- Projects ----
    projects = (
        db.query(Project)
        .filter(Project.school_id == school_id)
        .all()
    )
    for project in projects:
        if project.start_date:
            dt = _to_dt(project.start_date)
            if dt:
                ev = Event()
                ev.add("uid", vText(f"project-start-{project.id}@{UID_DOMAIN}"))
                ev.add("summary", f"🚀 {project.title} — Start")
                ev.add("dtstart", dt.date())
                ev.add("dtend", (dt + timedelta(days=1)).date())
                ev.add("dtstamp", now)
                ev.add("description", f"Project start: {project.title}")
                _add_valarm(ev)
                cal.add_component(ev)

        if project.end_date:
            dt = _to_dt(project.end_date)
            if dt:
                ev = Event()
                ev.add("uid", vText(f"project-end-{project.id}@{UID_DOMAIN}"))
                ev.add("summary", f"🏁 {project.title} — Einde")
                ev.add("dtstart", dt.date())
                ev.add("dtend", (dt + timedelta(days=1)).date())
                ev.add("dtstamp", now)
                ev.add("description", f"Project einde: {project.title}")
                _add_valarm(ev)
                cal.add_component(ev)

    # ---- Evaluations ----
    evaluations = (
        db.query(Evaluation)
        .filter(Evaluation.school_id == school_id)
        .all()
    )
    for evaluation in evaluations:
        deadlines = _extract_deadlines(evaluation.settings)
        if not deadlines:
            continue

        review_dt = _to_dt(deadlines.get("review"))
        if review_dt:
            ev = Event()
            ev.add("uid", vText(f"eval-review-{evaluation.id}@{UID_DOMAIN}"))
            ev.add("summary", f"📝 {evaluation.title} — Review deadline")
            ev.add("dtstart", review_dt.date())
            ev.add("dtend", (review_dt + timedelta(days=1)).date())
            ev.add("dtstamp", now)
            ev.add("description", f"Peer-evaluatie review deadline: {evaluation.title}")
            _add_valarm(ev)
            cal.add_component(ev)

        reflection_dt = _to_dt(deadlines.get("reflection"))
        if reflection_dt:
            ev = Event()
            ev.add(
                "uid",
                vText(f"eval-reflection-{evaluation.id}@{UID_DOMAIN}"),
            )
            ev.add("summary", f"💭 {evaluation.title} — Reflectie deadline")
            ev.add("dtstart", reflection_dt.date())
            ev.add("dtend", (reflection_dt + timedelta(days=1)).date())
            ev.add("dtstamp", now)
            ev.add(
                "description",
                f"Peer-evaluatie reflectie deadline: {evaluation.title}",
            )
            _add_valarm(ev)
            cal.add_component(ev)

    # ---- Competency windows ----
    windows = (
        db.query(CompetencyWindow)
        .filter(CompetencyWindow.school_id == school_id)
        .all()
    )
    for window in windows:
        if window.end_date:
            dt = _to_dt(window.end_date)
            if dt:
                ev = Event()
                ev.add(
                    "uid",
                    vText(f"competency-window-{window.id}@{UID_DOMAIN}"),
                )
                ev.add("summary", f"🎯 {window.title} — Deadline")
                ev.add("dtstart", dt.date())
                ev.add("dtend", (dt + timedelta(days=1)).date())
                ev.add("dtstamp", now)
                ev.add("description", f"Competentiescan deadline: {window.title}")
                _add_valarm(ev)
                cal.add_component(ev)

    # ---- Open tasks ----
    tasks = (
        db.query(Task)
        .filter(Task.school_id == school_id, Task.status == "open")
        .all()
    )
    for task in tasks:
        if task.due_date:
            dt = _to_dt(task.due_date)
            if dt:
                ev = Event()
                ev.add("uid", vText(f"task-{task.id}@{UID_DOMAIN}"))
                ev.add("summary", f"✅ {task.title}")
                ev.add("dtstart", dt.date())
                ev.add("dtend", (dt + timedelta(days=1)).date())
                ev.add("dtstamp", now)
                ev.add("description", task.description or task.title)
                _add_valarm(ev)
                cal.add_component(ev)

    return cal.to_ical()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/generate-token", response_model=CalendarTokenResponse)
def generate_token(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CalendarTokenResponse:
    """
    Generate (or regenerate) a personal iCal feed token for the current user.
    Requires teacher or admin role.
    """
    require_role(current_user, ["teacher", "admin"])

    token = str(uuid.uuid4())
    current_user.calendar_feed_token = token
    db.commit()
    db.refresh(current_user)

    logger.info(
        "Calendar feed token generated for user %s (school %s)",
        current_user.email,
        current_user.school_id,
    )

    return _build_urls(request, token)


@router.delete("/revoke-token", status_code=status.HTTP_204_NO_CONTENT)
def revoke_token(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Revoke the iCal feed token for the current user.
    Existing calendar subscriptions using the old token will stop working.
    """
    current_user.calendar_feed_token = None
    db.commit()

    logger.info(
        "Calendar feed token revoked for user %s (school %s)",
        current_user.email,
        current_user.school_id,
    )


@router.get("/token-status", response_model=Optional[CalendarTokenResponse])
def get_token_status(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Optional[CalendarTokenResponse]:
    """
    Return the current user's token and subscription URLs, or null if no token.
    """
    if not current_user.calendar_feed_token:
        return None
    return _build_urls(request, current_user.calendar_feed_token)


@router.get("/feed.ics")
def get_calendar_feed(
    token: str = Query(..., description="Personal feed token"),
    db: Session = Depends(get_db),
) -> Response:
    """
    Dynamic iCal subscription feed.  Authenticated via ?token= query parameter
    (no session cookie needed — calendar apps cannot send cookies).
    Returns a fresh .ics file every time it is polled.
    """
    user = (
        db.query(User)
        .filter(User.calendar_feed_token == token)
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or expired calendar token",
        )

    ical_bytes = _build_ical(user.school_id, db)

    return Response(
        content=ical_bytes,
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="team-evaluatie-kalender.ics"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )
