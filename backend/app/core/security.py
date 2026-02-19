# app/core/security.py
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Tuple
import secrets
import hashlib

import jwt  # PyJWT
from jwt import InvalidTokenError, ExpiredSignatureError  # centrale PyJWT-excepties
from passlib.context import CryptContext

from app.core.config import settings

# Let op: voor Argon2 heb je 'argon2-cffi' nodig (zie install-notes hieronder)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(
    sub: str,
    role: Optional[str] = None,
    school_id: Optional[int] = None,
    session_start: Optional[datetime] = None,
) -> str:
    """
    Maak een access token met timezone-aware exp en optionele claims.

    Args:
        sub: Subject (usually user email or user_id)
        role: User role (student, teacher, admin)
        school_id: School ID for multi-tenant support
        session_start: Original session start time (copied on renewal to
            preserve the absolute max-session-age). If None, uses now.

    Returns:
        Encoded JWT token
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    # ss = session start (Unix timestamp). Used to enforce SESSION_MAX_HOURS.
    ss = (session_start or now).timestamp()
    payload: Dict[str, object] = {
        "sub": sub,
        "exp": expire,
        "ss": ss,
    }

    # Add optional claims
    if role:
        payload["role"] = role
    if school_id:
        payload["school_id"] = school_id

    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, object]]:
    """
    Decodeer en valideer het JWT. Geeft payload terug of None bij ongeldige/expired token.
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


def decode_access_token_and_check_expiry(token: str) -> Tuple[Optional[Dict[str, object]], bool]:
    """
    Decode the JWT and indicate whether it failed due to expiry.

    Returns:
        (payload, is_expired)
        - payload is the decoded claims dict, or None if the token is invalid/expired.
        - is_expired is True when the token was syntactically valid but has expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload, False
    except ExpiredSignatureError:
        return None, True
    except InvalidTokenError:
        return None, False


def generate_external_token() -> str:
    """
    Generate a secure random token for external invites (32 bytes = 64 hex chars)
    """
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """
    Hash a token using SHA-256 for secure storage
    Returns hex digest (64 chars)
    """
    return hashlib.sha256(token.encode()).hexdigest()
