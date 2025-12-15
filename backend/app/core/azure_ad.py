# app/core/azure_ad.py
"""
Azure AD OAuth authentication integration.

This module provides Azure AD authentication using MSAL (Microsoft Authentication Library).
It handles the OAuth flow, token validation, and user provisioning.
"""

from __future__ import annotations
from typing import Optional, Dict, Any
import logging

import msal
import requests
from fastapi import HTTPException, status

from app.core.config import settings
from app.infra.db.models import User
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class AzureADAuthenticator:
    """
    Azure AD OAuth authentication handler.

    Handles:
    - OAuth authorization URL generation
    - Token exchange from authorization code
    - Token validation
    - User profile retrieval from Microsoft Graph API
    - User provisioning/updating in local database
    """

    def __init__(self):
        """Initialize Azure AD authenticator with MSAL client."""
        if not settings.AZURE_AD_CLIENT_ID or not settings.AZURE_AD_TENANT_ID:
            logger.warning(
                "Azure AD is not configured. Set AZURE_AD_CLIENT_ID and "
                "AZURE_AD_TENANT_ID to enable Azure AD authentication."
            )
            self.enabled = False
            self.msal_app = None
        else:
            self.enabled = True
            authority = (
                settings.AZURE_AD_AUTHORITY
                or f"https://login.microsoftonline.com/{settings.AZURE_AD_TENANT_ID}"
            )

            self.msal_app = msal.ConfidentialClientApplication(
                settings.AZURE_AD_CLIENT_ID,
                authority=authority,
                client_credential=settings.AZURE_AD_CLIENT_SECRET,
            )

    def get_authorization_url(self, state: Optional[str] = None) -> Dict[str, str]:
        """
        Generate Azure AD authorization URL for OAuth flow.

        Args:
            state: Optional state parameter for CSRF protection

        Returns:
            Dict with 'auth_url' and 'state' keys

        Raises:
            HTTPException: If Azure AD is not configured
        """
        if not self.enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Azure AD authentication is not configured",
            )

        auth_url = self.msal_app.get_authorization_request_url(
            scopes=settings.AZURE_AD_SCOPES,
            state=state,
            redirect_uri=settings.AZURE_AD_REDIRECT_URI,
        )

        return {
            "auth_url": auth_url,
            "state": state or "",
        }

    def acquire_token_by_auth_code(self, code: str) -> Dict[str, Any]:
        """
        Exchange authorization code for access token.

        Args:
            code: Authorization code from OAuth callback

        Returns:
            Token response containing access_token, id_token, etc.

        Raises:
            HTTPException: If token exchange fails
        """
        if not self.enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Azure AD authentication is not configured",
            )

        try:
            result = self.msal_app.acquire_token_by_authorization_code(
                code,
                scopes=settings.AZURE_AD_SCOPES,
                redirect_uri=settings.AZURE_AD_REDIRECT_URI,
            )

            if "error" in result:
                logger.error(f"Azure AD token error: {result.get('error_description')}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Authentication failed: {result.get('error_description', 'Unknown error')}",
                )

            return result

        except Exception as e:
            logger.error(f"Error acquiring token: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Failed to authenticate with Azure AD",
            )

    def get_user_profile(self, access_token: str) -> Dict[str, Any]:
        """
        Retrieve user profile from Microsoft Graph API.

        Args:
            access_token: Valid access token

        Returns:
            User profile data containing email, name, etc.

        Raises:
            HTTPException: If profile retrieval fails
        """
        try:
            graph_endpoint = "https://graph.microsoft.com/v1.0/me"
            headers = {"Authorization": f"Bearer {access_token}"}

            response = requests.get(graph_endpoint, headers=headers, timeout=10)
            response.raise_for_status()

            return response.json()

        except requests.RequestException as e:
            logger.error(f"Error fetching user profile: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Failed to retrieve user profile",
            )

    def validate_domain(self, email: str) -> bool:
        """
        Validate that user email is from an allowed domain.

        Args:
            email: User email address

        Returns:
            True if domain is allowed or no domain restrictions configured
        """
        if not settings.AZURE_AD_ALLOWED_DOMAINS:
            # No domain restrictions
            return True

        # Extract domain from email - handle malformed emails
        if "@" not in email:
            logger.warning(f"Invalid email format (no @): {email}")
            return False

        parts = email.split("@")
        if len(parts) != 2 or not parts[0] or not parts[1]:
            logger.warning(f"Invalid email format: {email}")
            return False

        domain = parts[1].lower()
        is_allowed = domain in [d.lower() for d in settings.AZURE_AD_ALLOWED_DOMAINS]

        if not is_allowed:
            logger.warning(
                f"User {email} attempted login but domain {domain} is not in allowed list: "
                f"{settings.AZURE_AD_ALLOWED_DOMAINS}"
            )

        return is_allowed

    def provision_or_update_user(
        self, db: Session, profile: Dict[str, Any], school_id: int
    ) -> User:
        """
        Create or update user from Azure AD profile.

        Args:
            db: Database session
            profile: User profile from Microsoft Graph API
            school_id: School ID to associate user with

        Returns:
            User object

        Raises:
            HTTPException: If user provisioning fails
        """
        email = profile.get("mail") or profile.get("userPrincipalName", "")
        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No email found in Azure AD profile",
            )

        # Validate domain
        if not self.validate_domain(email):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Email domain not allowed. Allowed domains: {settings.AZURE_AD_ALLOWED_DOMAINS}",
            )

        # Get or create user
        user = (
            db.query(User)
            .filter(User.email == email, User.school_id == school_id)
            .first()
        )

        name = profile.get("displayName") or email.split("@")[0]

        if user:
            # Update existing user
            user.name = name
            user.auth_provider = "azure_ad"
            logger.info(f"Updated existing user {email} from Azure AD")
        else:
            # Create new user with default role 'student'
            # Admin should update role via admin panel if needed
            user = User(
                school_id=school_id,
                email=email,
                name=name,
                role="student",  # Default role - can be changed by admin
                auth_provider="azure_ad",
                archived=False,
            )
            db.add(user)
            logger.info(f"Created new user {email} from Azure AD with role 'student'")

        db.commit()
        db.refresh(user)

        return user


# Global authenticator instance
azure_ad_authenticator = AzureADAuthenticator()
