from __future__ import annotations
from fastapi import Header, HTTPException, status, Depends, Cookie, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.infra.db.session import SessionLocal
from app.infra.db.models import User
from app.core.config import settings
from app.core.security import decode_access_token
import logging

logger = logging.getLogger(__name__)

# Optional bearer token scheme (for backwards compatibility)
bearer_scheme = HTTPBearer(auto_error=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_current_user_dev(
    request: Request,
    db: Session = Depends(get_db),
    x_user_email: str | None = Header(default=None, alias="X-User-Email"),
    access_token_cookie: str | None = Cookie(default=None, alias="access_token"),
    bearer_token: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> User:
    """
    Authentication dependency supporting multiple methods:

    1. Development mode (NODE_ENV=development):
       - X-User-Email header for quick testing

    2. Production mode:
       - HttpOnly cookie (access_token) - preferred method
       - Bearer token in Authorization header - fallback for API clients

    Security:
    - Dev-login is blocked in production
    - JWT tokens are validated and decoded
    - User must not be archived (archived=False)
    - School ID must match the token claim
    """

    # DEVELOPMENT: Allow X-User-Email header ONLY when explicitly enabled
    if settings.ENABLE_DEV_LOGIN and x_user_email:
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

    # PRODUCTION: Use cookie or bearer token
    token = None

    # Priority 1: Cookie-based authentication (preferred)
    if access_token_cookie:
        token = access_token_cookie
        logger.debug("Authentication via HttpOnly cookie")

    # Priority 2: Bearer token (fallback for API clients)
    elif bearer_token:
        token = bearer_token.credentials
        logger.debug("Authentication via Bearer token")

    # No valid authentication method found
    if not token:
        # SECURITY: Block and alert on dev-login attempts when disabled
        if not settings.ENABLE_DEV_LOGIN and x_user_email:
            logger.error(
                f"SECURITY ALERT: X-User-Email header detected but ENABLE_DEV_LOGIN=False! "
                f"Attempted email: {x_user_email}, "
                f"IP: {request.client.host if request.client else 'unknown'}, "
                f"User-Agent: {request.headers.get('user-agent', 'unknown')}, "
                f"ENABLE_DEV_LOGIN={settings.ENABLE_DEV_LOGIN}. "
                f"This may indicate an authentication bypass attempt. "
                f"Use Azure AD authentication instead."
            )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Decode and validate JWT
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract user email from token
    email = payload.get("sub")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    # Get user from database
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Validate user is not archived
    if user.archived:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is archived",
        )

    # Validate school_id matches token claim (if present in token)
    token_school_id = payload.get("school_id")
    if token_school_id is not None and user.school_id != token_school_id:
        logger.warning(
            f"School ID mismatch for user {user.email}: "
            f"token={token_school_id}, user={user.school_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="School ID mismatch",
        )

    return user


async def get_current_user_prod(
    request: Request,
    db: Session = Depends(get_db),
    access_token_cookie: str | None = Cookie(default=None, alias="access_token"),
    bearer_token: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> User:
    """
    Production authentication dependency - NO X-User-Email header support.

    Supports:
    - HttpOnly cookie (access_token) - preferred method
    - Bearer token in Authorization header - fallback for API clients

    Security:
    - X-User-Email header is completely removed from signature
    - JWT tokens are validated and decoded
    - User must not be archived (archived=False)
    - School ID must match the token claim
    """

    # PRODUCTION: Use cookie or bearer token ONLY
    token = None

    # Priority 1: Cookie-based authentication (preferred)
    if access_token_cookie:
        token = access_token_cookie
        logger.debug("Authentication via HttpOnly cookie")

    # Priority 2: Bearer token (fallback for API clients)
    elif bearer_token:
        token = bearer_token.credentials
        logger.debug("Authentication via Bearer token")

    # No valid authentication method found
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Decode and validate JWT
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract user email from token
    email = payload.get("sub")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    # Get user from database
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Validate user is not archived
    if user.archived:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is archived",
        )

    # Validate school_id matches token claim (if present in token)
    token_school_id = payload.get("school_id")
    if token_school_id is not None and user.school_id != token_school_id:
        logger.warning(
            f"School ID mismatch for user {user.email}: "
            f"token={token_school_id}, user={user.school_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="School ID mismatch",
        )

    return user


async def verify_rfid_api_key(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> None:
    """
    Verify RFID API key for Raspberry Pi scanner authentication.
    
    The API key is sent in the X-API-Key header.
    Valid keys are configured via the RFID_API_KEYS environment variable.
    
    Security:
    - Keys must be strong random values (min 32 characters recommended)
    - Use secrets.token_urlsafe(32) to generate keys
    - Keys are stored as comma-separated list in environment variable
    - In production, use IP whitelisting in addition to API keys (nginx/firewall)
    
    Raises:
        HTTPException 401: If API key is missing or invalid
    """
    if not x_api_key:
        logger.warning("RFID scan attempt without API key")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required. Include X-API-Key header.",
        )
    
    # Get valid API keys from configuration
    valid_keys = settings.RFID_API_KEYS
    
    if not valid_keys:
        logger.error(
            "SECURITY ERROR: RFID_API_KEYS not configured but /scan endpoint was called. "
            "Configure RFID_API_KEYS environment variable."
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="RFID service not configured",
        )
    
    # Validate API key
    if x_api_key not in valid_keys:
        # Safely truncate key for logging (handle short keys)
        key_preview = x_api_key[:min(8, len(x_api_key))] if x_api_key else ""
        logger.warning(
            f"RFID scan attempt with invalid API key. "
            f"Key prefix: {key_preview}..."
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    
    logger.debug("RFID API key validated successfully")


# Export the correct dependency based on ENABLE_DEV_LOGIN
# Production is the explicit default for security
# Only use dev mode when explicitly enabled
if settings.ENABLE_DEV_LOGIN:
    get_current_user = get_current_user_dev
    logger.info("Using development authentication (X-User-Email header enabled)")
else:
    get_current_user = get_current_user_prod
    logger.info("Using production authentication (dev-login disabled)")
