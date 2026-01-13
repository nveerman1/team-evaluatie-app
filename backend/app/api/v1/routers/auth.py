from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import secrets
import logging
import base64
import json

from app.api.v1.deps import get_current_user, get_db
from app.api.v1.schemas.auth import UserRead
from app.infra.db.models import User, School
from app.core.azure_ad import azure_ad_authenticator
from app.core.security import create_access_token
from app.core.config import settings
from app.core.redirect_validator import normalize_and_validate_return_to, get_role_home_path

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_user)):
    """
    Get the currently authenticated user's information.
    Returns user details including class_name.
    """
    return current_user


@router.get("/azure")
def azure_login(
    school_id: int = Query(..., description="School ID for multi-tenant support"),
    return_to: str | None = Query(None, description="Optional return URL after login"),
):
    """
    Initiate Azure AD OAuth authentication flow.

    Redirects user to Microsoft login page.
    After successful authentication, user will be redirected back to /auth/azure/callback.

    Args:
        school_id: School ID to associate the user with after authentication
        return_to: Optional relative path to redirect to after login (e.g., /teacher/rubrics)
    """
    if not azure_ad_authenticator.enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Azure AD authentication is not configured. Please set AZURE_AD_CLIENT_ID, "
            "AZURE_AD_TENANT_ID, and AZURE_AD_CLIENT_SECRET environment variables.",
        )

    # Validate returnTo if provided
    validated_return_to = normalize_and_validate_return_to(return_to) if return_to else None

    # Generate state for CSRF protection, include school_id and optional returnTo
    # Use base64-encoded JSON to avoid parsing issues with colons in URLs
    state_data = {
        "school_id": school_id,
        "return_to": validated_return_to,
        "token": secrets.token_urlsafe(32)
    }
    state = base64.urlsafe_b64encode(json.dumps(state_data).encode()).decode()

    result = azure_ad_authenticator.get_authorization_url(state=state)

    logger.info(
        f"Initiating Azure AD login for school_id={school_id}, "
        f"returnTo={validated_return_to or 'none'}"
    )

    return RedirectResponse(url=result["auth_url"])


@router.get("/azure/callback")
def azure_callback(
    code: str = Query(..., description="Authorization code from Azure AD"),
    state: str = Query(..., description="State parameter for CSRF protection"),
    db: Session = Depends(get_db),
):
    """
    Handle Azure AD OAuth callback.

    This endpoint:
    1. Validates state parameter and extracts school_id
    2. Verifies school exists in database (server-side validation)
    3. Exchanges authorization code for access token (MSAL validates signature, issuer, audience, tenant)
    4. Retrieves user profile from Microsoft Graph API
    5. Validates user email domain (if configured)
    6. Creates or updates user in database
    7. Sets JWT token as HttpOnly cookie
    8. Redirects to frontend dashboard

    Returns:
        Redirect to frontend dashboard with authentication cookie set
    """
    if not azure_ad_authenticator.enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Azure AD authentication is not configured",
        )

    # Extract school_id and returnTo from state
    # State is base64-encoded JSON for robust parsing
    try:
        state_json = base64.urlsafe_b64decode(state.encode()).decode()
        state_data = json.loads(state_json)
        school_id = int(state_data["school_id"])
        return_to = state_data.get("return_to")
    except (ValueError, KeyError, json.JSONDecodeError, Exception) as e:
        logger.error(f"Invalid state parameter: {state}, error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid state parameter"
        )

    # SERVER-SIDE VALIDATION: Verify school exists and is valid
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        logger.warning(f"Login attempt with invalid school_id={school_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"School with id {school_id} not found",
        )

    logger.info(f"School validation passed: id={school_id}, name={school.name}")

    # Exchange code for token (MSAL validates signature, issuer, audience, tenant)
    token_response = azure_ad_authenticator.acquire_token_by_auth_code(code)
    access_token = token_response.get("access_token")

    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to obtain access token",
        )

    # Get user profile
    profile = azure_ad_authenticator.get_user_profile(access_token)

    # Provision or update user (includes domain validation)
    user = azure_ad_authenticator.provision_or_update_user(db, profile, school_id)

    # Create JWT token with role claim
    jwt_token = create_access_token(
        sub=user.email, role=user.role, school_id=user.school_id
    )

    logger.info(
        f"Azure AD authentication successful for user {user.email}, "
        f"school_id={school_id}, role={user.role}"
    )

    # Determine redirect path
    frontend_url = settings.FRONTEND_URL
    
    # Validate returnTo if present
    validated_return_to = validate_return_to(return_to) if return_to else None
    
    if validated_return_to:
        # User had a specific destination in mind
        redirect_path = validated_return_to
        logger.info(f"Redirecting to returnTo: {redirect_path}")
    else:
        # Redirect to role-specific home
        redirect_path = get_role_home_path(user.role)
        logger.info(f"Redirecting to role home: {redirect_path} (role={user.role})")
    
    redirect_url = f"{frontend_url}{redirect_path}"

    # Create response with redirect
    response = RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
    
    # Set HttpOnly cookie with JWT token
    response.set_cookie(
        key="access_token",
        value=jwt_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,  # True in production
        samesite=settings.COOKIE_SAMESITE,  # "Lax" allows OAuth redirects
        max_age=settings.COOKIE_MAX_AGE,  # 7 days
        path="/",
        domain=settings.COOKIE_DOMAIN if settings.COOKIE_DOMAIN else None,
    )
    
    logger.info(f"Authentication cookie set for user {user.email}, redirecting to {redirect_url}")
    
    return response


@router.post("/logout")
def logout(response: Response):
    """
    Logout the current user by clearing the authentication cookie.
    
    This endpoint:
    1. Clears the access_token cookie by setting it to expire
    2. Returns a success message
    
    Returns:
        Success message confirming logout
    """
    # Clear the cookie by setting it to expire in the past
    response.set_cookie(
        key="access_token",
        value="",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=0,  # Expire immediately
        expires=0,  # Also set expires to epoch
        path="/",
        domain=settings.COOKIE_DOMAIN if settings.COOKIE_DOMAIN else None,
    )
    
    logger.info("User logged out, cookie cleared")
    
    return {"message": "Successfully logged out"}


@router.post("/dev-login")
def dev_login(
    email: str = Query(..., description="User email for dev-login"),
    return_to: str | None = Query(None, description="Optional return URL after login"),
    db: Session = Depends(get_db),
):
    """
    Development-only login endpoint for easy testing.
    
    This endpoint is ONLY available when ENABLE_DEV_LOGIN=true.
    In production (ENABLE_DEV_LOGIN=false), this returns 404.
    
    Args:
        email: User email to login as
        return_to: Optional relative path to redirect to after login
        
    Returns:
        Redirect to role-specific home or returnTo with cookie set
    """
    # SECURITY: Return 404 (not 403) to not leak endpoint existence
    if not settings.ENABLE_DEV_LOGIN:
        logger.warning(
            f"Dev-login attempt blocked - ENABLE_DEV_LOGIN=false. "
            f"Attempted email: {email}"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found"
        )
    
    logger.warning(
        f"Dev-login used for email: {email}. "
        "This endpoint should ONLY be used in local development!"
    )
    
    # Find user
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    # Check if user is archived
    if user.archived:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is archived"
        )
    
    # Create JWT token
    jwt_token = create_access_token(
        sub=user.email, role=user.role, school_id=user.school_id
    )
    
    # Determine redirect path
    frontend_url = settings.FRONTEND_URL
    validated_return_to = normalize_and_validate_return_to(return_to) if return_to else None
    
    if validated_return_to:
        redirect_path = validated_return_to
    else:
        redirect_path = get_role_home_path(user.role)
    
    redirect_url = f"{frontend_url}{redirect_path}"
    
    # Create response with redirect
    response = RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
    
    # Set HttpOnly cookie
    response.set_cookie(
        key="access_token",
        value=jwt_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.COOKIE_MAX_AGE,
        path="/",
        domain=settings.COOKIE_DOMAIN if settings.COOKIE_DOMAIN else None,
    )
    
    logger.info(
        f"Dev-login successful for {user.email} (role={user.role}), "
        f"redirecting to {redirect_path}"
    )
    
    return response
