# app/core/security.py
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict
import secrets
import hashlib

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


def create_access_token(sub: str, role: Optional[str] = None, school_id: Optional[int] = None) -> str:
    """
    Maak een access token met timezone-aware exp en optionele claims.
    
    Args:
        sub: Subject (usually user email or user_id)
        role: User role (student, teacher, admin)
        school_id: School ID for multi-tenant support
    
    Returns:
        Encoded JWT token
    """
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload: Dict[str, object] = {
        "sub": sub,
        "exp": expire,
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
