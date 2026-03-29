from __future__ import annotations

from pydantic import BaseModel


class CalendarTokenResponse(BaseModel):
    token: str
    webcal_url: str
    https_url: str
    google_calendar_url: str
    outlook_url: str
