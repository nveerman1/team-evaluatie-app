import jwt  # PyJWT
from jwt import InvalidTokenError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.auth_utils import normalize_email
from app.infra.db.session import SessionLocal
from app.infra.db.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        sub = payload.get("sub")
        if sub is None:
            raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception

    # Normalize email for case-insensitive lookup
    normalized_email = normalize_email(sub)
    user = db.query(User).filter(User.email == normalized_email).first()
    if not user:
        raise credentials_exception
    return user
