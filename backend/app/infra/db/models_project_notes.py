"""
DATABASE MODELS FOR PROJECT NOTES
=================================

This file contains the SQLAlchemy models for the Projectaantekeningen feature.

TODO: Uncomment and add these models to the main models.py file once ready to implement.
      Also create Alembic migrations to add these tables to the database.

MIGRATION STEPS:
1. Add these model classes to app/infra/db/models.py
2. Run: alembic revision --autogenerate -m "Add project notes tables"
3. Review the generated migration file
4. Run: alembic upgrade head
"""

# from __future__ import annotations
# from datetime import datetime
# from typing import Optional, List
# from sqlalchemy import (
#     String,
#     Integer,
#     ForeignKey,
#     Boolean,
#     Text,
#     Index,
# )
# from sqlalchemy.orm import Mapped, mapped_column, relationship
# from sqlalchemy.dialects.postgresql import JSONB, ARRAY
# from app.infra.db.base import Base
# 
# 
# class ProjectNotesContext(Base):
#     """
#     A container for all notes related to a specific project.
#     Links to a course, class, and optionally an evaluation.
#     """
#     __tablename__ = "project_notes_contexts"
#     
#     id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
#     school_id: Mapped[int] = mapped_column(Integer, index=True)
#     
#     # Basic info
#     title: Mapped[str] = mapped_column(String(200), nullable=False)
#     description: Mapped[Optional[str]] = mapped_column(Text)
#     
#     # Links
#     course_id: Mapped[Optional[int]] = mapped_column(
#         ForeignKey("courses.id", ondelete="SET NULL"),
#         index=True,
#     )
#     class_name: Mapped[Optional[str]] = mapped_column(String(50), index=True)
#     evaluation_id: Mapped[Optional[int]] = mapped_column(
#         ForeignKey("evaluations.id", ondelete="SET NULL"),
#         index=True,
#     )
#     
#     # Metadata
#     created_by: Mapped[int] = mapped_column(
#         ForeignKey("users.id", ondelete="CASCADE"),
#         index=True,
#     )
#     created_at: Mapped[datetime] = mapped_column(
#         default=datetime.utcnow,
#         nullable=False,
#     )
#     updated_at: Mapped[datetime] = mapped_column(
#         default=datetime.utcnow,
#         onupdate=datetime.utcnow,
#         nullable=False,
#     )
#     settings: Mapped[dict] = mapped_column(JSONB, default=dict)
#     
#     # Relationships
#     notes: Mapped[List["ProjectNote"]] = relationship(
#         back_populates="context",
#         cascade="all, delete-orphan",
#     )
#     course: Mapped["Course"] = relationship()
#     evaluation: Mapped["Evaluation"] = relationship()
#     creator: Mapped["User"] = relationship()
#     
#     __table_args__ = (
#         Index("ix_project_notes_context_school_course", "school_id", "course_id"),
#         Index("ix_project_notes_context_created_by", "created_by"),
#     )
# 
# 
# class ProjectNote(Base):
#     """
#     An individual note/observation within a project context.
#     Can be project-wide, team-specific, or student-specific.
#     """
#     __tablename__ = "project_notes"
#     
#     id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
#     context_id: Mapped[int] = mapped_column(
#         ForeignKey("project_notes_contexts.id", ondelete="CASCADE"),
#         index=True,
#         nullable=False,
#     )
#     
#     # Note type and target
#     note_type: Mapped[str] = mapped_column(
#         String(20),
#         nullable=False,
#     )  # "project" | "team" | "student"
#     
#     team_id: Mapped[Optional[int]] = mapped_column(
#         ForeignKey("groups.id", ondelete="CASCADE"),
#         index=True,
#     )
#     student_id: Mapped[Optional[int]] = mapped_column(
#         ForeignKey("users.id", ondelete="CASCADE"),
#         index=True,
#     )
#     
#     # Content
#     text: Mapped[str] = mapped_column(Text, nullable=False)
#     tags: Mapped[List[str]] = mapped_column(ARRAY(String), default=list)
#     
#     # Links to competencies and learning objectives
#     omza_category: Mapped[Optional[str]] = mapped_column(String(100))
#     learning_objective_id: Mapped[Optional[int]] = mapped_column(
#         ForeignKey("learning_objectives.id", ondelete="SET NULL"),
#         index=True,
#     )
#     
#     # Flags
#     is_competency_evidence: Mapped[bool] = mapped_column(Boolean, default=False)
#     is_portfolio_evidence: Mapped[bool] = mapped_column(Boolean, default=False)
#     
#     # Additional metadata (flexible JSON field for future extensions)
#     metadata: Mapped[dict] = mapped_column(JSONB, default=dict)
#     
#     # Audit fields
#     created_by: Mapped[int] = mapped_column(
#         ForeignKey("users.id", ondelete="CASCADE"),
#         index=True,
#     )
#     created_at: Mapped[datetime] = mapped_column(
#         default=datetime.utcnow,
#         nullable=False,
#     )
#     updated_at: Mapped[datetime] = mapped_column(
#         default=datetime.utcnow,
#         onupdate=datetime.utcnow,
#         nullable=False,
#     )
#     
#     # Relationships
#     context: Mapped["ProjectNotesContext"] = relationship(back_populates="notes")
#     team: Mapped["Group"] = relationship()
#     student: Mapped["User"] = relationship()
#     learning_objective: Mapped["LearningObjective"] = relationship()
#     creator: Mapped["User"] = relationship()
#     
#     __table_args__ = (
#         Index("ix_project_note_context_type", "context_id", "note_type"),
#         Index("ix_project_note_team", "team_id"),
#         Index("ix_project_note_student", "student_id"),
#         Index("ix_project_note_created_at", "created_at"),
#         Index("ix_project_note_omza", "omza_category"),
#     )
