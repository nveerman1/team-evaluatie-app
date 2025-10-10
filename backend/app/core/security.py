# app/core/security.py
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict

import jwt  # PyJWT
from jwt import InvalidTokenError  # centrale PyJWT-exceptie (dekt Decode/Expired etc.)
from passlib.context import CryptContext

from app.core.config import settings

# Let op: voor Argon2 heb je 'argon2-cffi' nodig (zie install-notes hieronder)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(sub: str) -> str:
    """
    Maak een access token met timezone-aware exp.
    """
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload: Dict[str, object] = {"sub": sub, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, object]]:
    """
    Decodeer en valideer het JWT. Geeft payload terug of None bij ongeldige/expired token.
    Wil je strakker zijn? Vang InvalidTokenError op in je dependency en raise HTTPException(401).
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except InvalidTokenError:
        return None
