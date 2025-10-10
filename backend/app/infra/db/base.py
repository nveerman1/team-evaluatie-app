from __future__ import annotations
from datetime import datetime, timezone
from typing import Annotated
from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

UTCDateTime = Annotated[
    datetime,
    mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)),
]


class Base(DeclarativeBase):
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
