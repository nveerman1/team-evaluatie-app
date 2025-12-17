from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import secrets
import logging

from app.api.v1.deps import get_current_user, get_db
from app.api.v1.schemas.auth import UserRead, AzureAuthResponse
from app.infra.db.models import User, School
from app.core.azure_ad import azure_ad_authenticator
from app.core.security import create_access_token

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
):
    """
    Initiate Azure AD OAuth authentication flow.

    Redirects user to Microsoft login page.
    After successful authentication, user will be redirected back to /auth/azure/callback.

    Args:
        school_id: School ID to associate the user with after authentication
    """
    if not azure_ad_authenticator.enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Azure AD authentication is not configured. Please set AZURE_AD_CLIENT_ID, "
            "AZURE_AD_TENANT_ID, and AZURE_AD_CLIENT_SECRET environment variables.",
        )

    # Generate state for CSRF protection, include school_id
    state = f"{school_id}:{secrets.token_urlsafe(32)}"

    result = azure_ad_authenticator.get_authorization_url(state=state)

    logger.info(f"Initiating Azure AD login for school_id={school_id}")

    return RedirectResponse(url=result["auth_url"])


@router.get("/azure/callback", response_model=AzureAuthResponse)
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
    7. Issues JWT token for application authentication

    Returns:
        JWT access token and user information
    """
    if not azure_ad_authenticator.enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Azure AD authentication is not configured",
        )

    # Extract school_id from state
    try:
        school_id_str, _ = state.split(":", 1)
        school_id = int(school_id_str)
    except (ValueError, AttributeError):
        logger.error(f"Invalid state parameter: {state}")
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

    return {
        "access_token": jwt_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "school_id": user.school_id,
            "class_name": user.class_name,
        },
    }
