from __future__ import annotations
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.infra.db.models import Notification, User
from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: int
    school_id: int
    recipient_user_id: int
    type: str
    title: str
    body: Optional[str] = None
    link: Optional[str] = None
    read_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationsResponse(BaseModel):
    items: List[NotificationOut]
    total: int
    unread_count: int


router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationsResponse)
def get_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get notifications for the current user.
    Returns unread notifications first, then read notifications.
    """
    query = db.query(Notification).filter(
        Notification.recipient_user_id == current_user.id,
        Notification.school_id == current_user.school_id,
    )
    
    if unread_only:
        query = query.filter(Notification.read_at.is_(None))
    
    # Order by: unread first, then by created_at descending
    query = query.order_by(
        Notification.read_at.is_(None).desc(),
        Notification.created_at.desc()
    )
    
    notifications = query.limit(limit).all()
    
    # Get unread count
    unread_count = db.query(Notification).filter(
        Notification.recipient_user_id == current_user.id,
        Notification.school_id == current_user.school_id,
        Notification.read_at.is_(None),
    ).count()
    
    return NotificationsResponse(
        items=[NotificationOut.model_validate(n) for n in notifications],
        total=len(notifications),
        unread_count=unread_count,
    )


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a notification as read"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.recipient_user_id == current_user.id,
        Notification.school_id == current_user.school_id,
    ).first()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notificatie niet gevonden"
        )
    
    if notification.read_at is None:
        notification.read_at = datetime.utcnow()
        db.commit()
        db.refresh(notification)
    
    return notification


@router.post("/mark-all-read")
def mark_all_notifications_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all notifications as read for the current user"""
    db.query(Notification).filter(
        Notification.recipient_user_id == current_user.id,
        Notification.school_id == current_user.school_id,
        Notification.read_at.is_(None),
    ).update({"read_at": datetime.utcnow()})
    
    db.commit()
    
    return {"message": "Alle notificaties gemarkeerd als gelezen"}
