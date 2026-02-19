from __future__ import annotations
from typing import Optional
from datetime import datetime, date
from sqlalchemy import (
    String,
    Integer,
    ForeignKey,
    Boolean,
    UniqueConstraint,
    Index,
    Date,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import ARRAY

from .base import Base, id_pk

__all__ = [
    "Client",
    "ClientLog",
    "ClientProjectLink",
]


class Client(Base):
    """
    Client/Opdrachtgever - External organizations providing projects to students
    """

    __tablename__ = "clients"

    id: Mapped[int] = id_pk()
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), index=True
    )

    # Organization info
    organization: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_name: Mapped[Optional[str]] = mapped_column(String(200))
    email: Mapped[Optional[str]] = mapped_column(String(320))
    phone: Mapped[Optional[str]] = mapped_column(String(50))

    # Classification
    level: Mapped[Optional[str]] = mapped_column(
        String(50)
    )  # e.g., "Bovenbouw", "Onderbouw"
    sector: Mapped[Optional[str]] = mapped_column(
        String(100)
    )  # e.g., "Vastgoed", "Zorg"
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(String), default=list
    )  # e.g., ["Duurzaamheid", "Innovatie"]

    # Status
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    school: Mapped["School"] = relationship()
    logs: Mapped[list["ClientLog"]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
    project_links: Mapped[list["ClientProjectLink"]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_client_school_active", "school_id", "active"),
        Index("ix_client_organization", "organization"),
    )


class ClientLog(Base):
    """
    Log entries for client interactions and notes
    """

    __tablename__ = "client_logs"

    id: Mapped[int] = id_pk()
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Log content
    log_type: Mapped[str] = mapped_column(
        String(50), default="Notitie"
    )  # e.g., "Notitie", "Mail (template)", "Telefoongesprek"
    text: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationships
    client: Mapped["Client"] = relationship(back_populates="logs")
    author: Mapped["User"] = relationship()

    __table_args__ = (
        Index("ix_client_log_client", "client_id"),
        Index("ix_client_log_created_at", "created_at"),
    )


class ClientProjectLink(Base):
    """
    Links clients to projects with role information
    """

    __tablename__ = "client_project_links"

    id: Mapped[int] = id_pk()
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Role and timeline
    role: Mapped[str] = mapped_column(
        String(50), default="main"
    )  # "main" (hoofdopdrachtgever) or "secondary" (nevenopdrachtgever)
    start_date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)

    # Relationships
    client: Mapped["Client"] = relationship(back_populates="project_links")
    project: Mapped["Project"] = relationship()

    __table_args__ = (
        UniqueConstraint(
            "client_id",
            "project_id",
            name="uq_client_project_once",
        ),
        Index("ix_client_project_client", "client_id"),
        Index("ix_client_project_project", "project_id"),
    )
