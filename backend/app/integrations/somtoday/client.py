"""
Somtoday OAuth2 client

Handles authentication and API requests to Somtoday
"""

from __future__ import annotations
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import httpx
from pydantic import BaseModel


class SomtodayConfig(BaseModel):
    """Configuration for Somtoday API"""

    client_id: str
    client_secret: str
    redirect_uri: str
    authorization_url: str = "https://somtoday.nl/oauth2/authorize"
    token_url: str = "https://somtoday.nl/oauth2/token"
    api_base_url: str = "https://api.somtoday.nl"
    scopes: List[str] = [
        "openid",
        "profile",
        "email",
        "somtoday.read.classes",
        "somtoday.read.students",
    ]


class SomtodayToken(BaseModel):
    """OAuth2 token response"""

    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "Bearer"
    expires_in: int
    expires_at: Optional[datetime] = None
    scope: Optional[str] = None


class SomtodayClient:
    """
    OAuth2 client for Somtoday API
    
    Usage:
        config = SomtodayConfig(
            client_id="your_client_id",
            client_secret="your_client_secret",
            redirect_uri="http://localhost:8000/api/v1/integrations/somtoday/callback"
        )
        client = SomtodayClient(config)
        
        # Get authorization URL
        auth_url = client.get_authorization_url(state="random_state")
        
        # Exchange code for token
        token = await client.exchange_code_for_token(code="auth_code")
        
        # Make API requests
        classes = await client.get_classes(token.access_token)
    """

    def __init__(self, config: SomtodayConfig):
        self.config = config
        self.http_client = httpx.AsyncClient(timeout=30.0)

    def get_authorization_url(self, state: str) -> str:
        """
        Generate OAuth2 authorization URL
        
        Args:
            state: Random state for CSRF protection
            
        Returns:
            Authorization URL to redirect user to
        """
        params = {
            "client_id": self.config.client_id,
            "redirect_uri": self.config.redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.config.scopes),
            "state": state,
        }
        
        query_string = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{self.config.authorization_url}?{query_string}"

    async def exchange_code_for_token(self, code: str) -> SomtodayToken:
        """
        Exchange authorization code for access token
        
        Args:
            code: Authorization code from callback
            
        Returns:
            SomtodayToken with access token and refresh token
        """
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self.config.redirect_uri,
            "client_id": self.config.client_id,
            "client_secret": self.config.client_secret,
        }
        
        response = await self.http_client.post(self.config.token_url, data=data)
        response.raise_for_status()
        
        token_data = response.json()
        token_data["expires_at"] = datetime.utcnow() + timedelta(
            seconds=token_data["expires_in"]
        )
        
        return SomtodayToken(**token_data)

    async def refresh_token(self, refresh_token: str) -> SomtodayToken:
        """
        Refresh an expired access token
        
        Args:
            refresh_token: Refresh token from previous authentication
            
        Returns:
            New SomtodayToken with updated access token
        """
        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": self.config.client_id,
            "client_secret": self.config.client_secret,
        }
        
        response = await self.http_client.post(self.config.token_url, data=data)
        response.raise_for_status()
        
        token_data = response.json()
        token_data["expires_at"] = datetime.utcnow() + timedelta(
            seconds=token_data["expires_in"]
        )
        
        return SomtodayToken(**token_data)

    async def get_classes(self, access_token: str) -> List[Dict[str, Any]]:
        """
        Get list of classes from Somtoday
        
        Args:
            access_token: Valid access token
            
        Returns:
            List of class objects
        """
        headers = {"Authorization": f"Bearer {access_token}"}
        
        response = await self.http_client.get(
            f"{self.config.api_base_url}/v1/classes", headers=headers
        )
        response.raise_for_status()
        
        return response.json().get("data", [])

    async def get_students(
        self, access_token: str, class_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get list of students from Somtoday
        
        Args:
            access_token: Valid access token
            class_id: Optional filter by class ID
            
        Returns:
            List of student objects
        """
        headers = {"Authorization": f"Bearer {access_token}"}
        
        url = f"{self.config.api_base_url}/v1/students"
        if class_id:
            url += f"?class_id={class_id}"
        
        response = await self.http_client.get(url, headers=headers)
        response.raise_for_status()
        
        return response.json().get("data", [])

    async def export_grades(
        self, access_token: str, grades: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Export grades to Somtoday
        
        Note: Requires write permissions (somtoday.write.grades scope)
        
        Args:
            access_token: Valid access token with write permissions
            grades: List of grade objects to export
            
        Returns:
            Export response
        """
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        
        response = await self.http_client.post(
            f"{self.config.api_base_url}/v1/grades",
            headers=headers,
            json={"grades": grades},
        )
        response.raise_for_status()
        
        return response.json()

    async def close(self):
        """Close the HTTP client"""
        await self.http_client.aclose()
