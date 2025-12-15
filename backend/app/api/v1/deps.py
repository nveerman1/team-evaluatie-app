from __future__ import annotations
from fastapi import Header, HTTPException, status, Depends
from sqlalchemy.orm import Session
from app.infra.db.session import SessionLocal
from app.infra.db.models import User
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Simpele dev-auth: header X-User-Email (ONLY in development mode)
async def get_current_user(
    db: Session = Depends(get_db),
    x_user_email: str | None = Header(default=None, alias="X-User-Email"),
) -> User:
    """
    Dev-login authentication dependency.

    This method uses X-User-Email header for authentication and is ONLY
    allowed in development mode (NODE_ENV=development).

    In production, this will raise an error and Azure AD authentication
    should be used instead via /auth/azure endpoints.
    """
    # Check if dev-login is allowed
    if settings.NODE_ENV != "development":
        logger.warning(
            "Dev-login attempted in non-development environment. "
            f"NODE_ENV={settings.NODE_ENV}. Use Azure AD authentication instead."
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Dev-login is only available in development mode. Please use Azure AD authentication.",
        )

    if not x_user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="X-User-Email required"
        )

    # Log dev-login usage for monitoring
    logger.warning(
        f"Dev-login used for user: {x_user_email}. "
        "This authentication method should only be used in local development."
    )

    user = db.query(User).filter(User.email == x_user_email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown user"
        )
    return user
