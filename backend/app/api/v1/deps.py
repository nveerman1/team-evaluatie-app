from __future__ import annotations
from fastapi import Header, HTTPException, status, Depends
from sqlalchemy.orm import Session
from app.infra.db.session import SessionLocal
from app.infra.db.models import User


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Simpele dev-auth: header X-User-Email
async def get_current_user(
    db: Session = Depends(get_db),
    x_user_email: str | None = Header(default=None, alias="X-User-Email"),
) -> User:
    if not x_user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="X-User-Email required"
        )
    user = db.query(User).filter(User.email == x_user_email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown user"
        )
    return user
