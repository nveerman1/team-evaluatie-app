"""
RFID Card Management API endpoints
"""

from __future__ import annotations
from typing import List
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import User, RFIDCard
from app.api.v1.schemas.attendance import (
    RFIDCardOut,
    RFIDCardCreate,
    RFIDCardUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/rfid", tags=["rfid"])


@router.get("/{user_id}", response_model=List[RFIDCardOut])
def list_user_rfid_cards(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all RFID cards for a user (teacher/admin only)
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can view RFID cards"
        )
    
    # Verify user belongs to same school
    user = db.query(User).filter(
        User.id == user_id,
        User.school_id == current_user.school_id
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    cards = db.query(RFIDCard).filter(RFIDCard.user_id == user_id).all()
    return [RFIDCardOut.model_validate(card) for card in cards]


@router.post("/{user_id}", response_model=RFIDCardOut, status_code=status.HTTP_201_CREATED)
def create_rfid_card(
    user_id: int,
    card_create: RFIDCardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Assign a new RFID card to a user (teacher/admin only)
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can create RFID cards"
        )
    
    # Verify user belongs to same school
    user = db.query(User).filter(
        User.id == user_id,
        User.school_id == current_user.school_id
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if UID already exists
    existing_card = db.query(RFIDCard).filter(RFIDCard.uid == card_create.uid).first()
    if existing_card:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"RFID card with UID {card_create.uid} already exists"
        )
    
    # Create new card
    new_card = RFIDCard(
        user_id=user_id,
        uid=card_create.uid,
        label=card_create.label,
        is_active=card_create.is_active,
        created_by=current_user.id
    )
    
    db.add(new_card)
    db.commit()
    db.refresh(new_card)
    
    return RFIDCardOut.model_validate(new_card)


@router.patch("/{card_id}", response_model=RFIDCardOut)
def update_rfid_card(
    card_id: int,
    card_update: RFIDCardUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update an RFID card (e.g., deactivate) (teacher/admin only)
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can update RFID cards"
        )
    
    # Find card and verify user belongs to same school
    card = db.query(RFIDCard).join(User).filter(
        RFIDCard.id == card_id,
        User.school_id == current_user.school_id
    ).first()
    
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="RFID card not found"
        )
    
    # Apply updates
    update_data = card_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(card, field, value)
    
    db.commit()
    db.refresh(card)
    
    return RFIDCardOut.model_validate(card)


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rfid_card(
    card_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete an RFID card (teacher/admin only)
    """
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can delete RFID cards"
        )
    
    # Find card and verify user belongs to same school
    card = db.query(RFIDCard).join(User).filter(
        RFIDCard.id == card_id,
        User.school_id == current_user.school_id
    ).first()
    
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="RFID card not found"
        )
    
    db.delete(card)
    db.commit()
