from __future__ import annotations
from typing import Optional
from datetime import datetime
from sqlalchemy import String, ForeignKey, Boolean, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
import sqlalchemy as sa
from .base import Base, id_pk

__all__ = ["School", "User", "RFIDCard"]


class School(Base):
    __tablename__ = "schools"
    id: Mapped[int] = id_pk()
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    # relaties
    users: Mapped[list["User"]] = relationship(
        back_populates="school", cascade="all,delete-orphan"
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, default="student"
    )  # "student" | "teacher" | "admin"
    auth_provider: Mapped[Optional[str]] = mapped_column(String(50), default="local")
    password_hash: Mapped[Optional[str]] = mapped_column(String(255))
    archived: Mapped[bool] = mapped_column(Boolean, default=False)

    # ✅ Klas
    class_name: Mapped[Optional[str]] = mapped_column(
        String(50), index=True, nullable=True
    )

    # ✅ Teamnummer
    team_number: Mapped[Optional[int]] = mapped_column(nullable=True, index=True)

    school: Mapped["School"] = relationship(back_populates="users")

    # 3de Blok RFID Attendance relationships
    attendance_events: Mapped[list["AttendanceEvent"]] = relationship(
        "AttendanceEvent", foreign_keys="AttendanceEvent.user_id", back_populates="user"
    )
    approved_attendance_events: Mapped[list["AttendanceEvent"]] = relationship(
        "AttendanceEvent",
        foreign_keys="AttendanceEvent.approved_by",
        back_populates="approver",
        viewonly=True,
    )
    created_attendance_events: Mapped[list["AttendanceEvent"]] = relationship(
        "AttendanceEvent",
        foreign_keys="AttendanceEvent.created_by",
        back_populates="creator",
        viewonly=True,
    )

    __table_args__ = (
        UniqueConstraint("school_id", "email", name="uq_user_email_per_school"),
        Index("ix_user_role_school", "school_id", "role"),
    )


class RFIDCard(Base):
    """
    RFID cards linked to users for attendance tracking via Raspberry Pi
    """

    __tablename__ = "rfid_cards"

    id: Mapped[int] = id_pk()
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    uid: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    label: Mapped[Optional[str]] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    user: Mapped["User"] = relationship(foreign_keys=[user_id])
    creator: Mapped[Optional["User"]] = relationship(foreign_keys=[created_by])

    __table_args__ = (
        Index("ix_rfid_cards_user_id", "user_id"),
        Index(
            "ix_rfid_cards_uid_active",
            "uid",
            postgresql_where=sa.text("is_active = true"),
        ),
    )
