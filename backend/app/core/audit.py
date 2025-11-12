"""
Audit logging utilities

Provides helper functions for logging user actions and system events
"""

from __future__ import annotations
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from fastapi import Request

from app.infra.db.models import User, AuditLog


def log_action(
    db: Session,
    user: Optional[User],
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """
    Log an audit event
    
    Args:
        db: Database session
        user: User performing the action (can be None for system actions)
        action: Action name (e.g., "create_evaluation", "update_grade")
        entity_type: Type of entity affected (e.g., "evaluation", "score")
        entity_id: ID of affected entity
        details: Additional context as dictionary
        request: FastAPI request object (for IP and user agent)
    """
    school_id = user.school_id if user else None
    user_id = user.id if user else None
    user_email = user.email if user else None
    
    # Extract IP and user agent from request
    ip_address = None
    user_agent = None
    if request:
        # Get real IP from X-Forwarded-For header if behind proxy
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            ip_address = forwarded_for.split(",")[0].strip()
        else:
            ip_address = request.client.host if request.client else None
        
        user_agent = request.headers.get("User-Agent")
    
    audit_entry = AuditLog(
        school_id=school_id,
        user_id=user_id,
        user_email=user_email,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details or {},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    
    db.add(audit_entry)
    # Note: caller should commit the transaction


def log_create(
    db: Session,
    user: User,
    entity_type: str,
    entity_id: int,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """Log a create action"""
    log_action(
        db=db,
        user=user,
        action=f"create_{entity_type}",
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
        request=request,
    )


def log_update(
    db: Session,
    user: User,
    entity_type: str,
    entity_id: int,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """Log an update action"""
    log_action(
        db=db,
        user=user,
        action=f"update_{entity_type}",
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
        request=request,
    )


def log_delete(
    db: Session,
    user: User,
    entity_type: str,
    entity_id: int,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """Log a delete action"""
    log_action(
        db=db,
        user=user,
        action=f"delete_{entity_type}",
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
        request=request,
    )


def log_publish(
    db: Session,
    user: User,
    entity_type: str,
    entity_id: int,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """Log a publish action"""
    log_action(
        db=db,
        user=user,
        action=f"publish_{entity_type}",
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
        request=request,
    )
