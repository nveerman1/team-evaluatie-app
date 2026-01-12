"""
Redirect URL validation to prevent open redirect vulnerabilities.
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def validate_return_to(return_to: Optional[str]) -> Optional[str]:
    """
    Validate a returnTo parameter to prevent open redirect attacks.
    
    A safe returnTo must be:
    1. A relative path starting with "/"
    2. Not containing "://" (absolute URLs)
    3. Not starting with "//" (protocol-relative URLs)
    
    Args:
        return_to: The returnTo parameter to validate
        
    Returns:
        The validated returnTo path if safe, None otherwise
        
    Examples:
        >>> validate_return_to("/teacher/rubrics")
        "/teacher/rubrics"
        >>> validate_return_to("https://evil.com")
        None
        >>> validate_return_to("//evil.com")
        None
    """
    if not return_to:
        return None
    
    # Must be a string
    if not isinstance(return_to, str):
        logger.warning(f"Invalid returnTo type: {type(return_to)}")
        return None
    
    # Strip whitespace
    return_to = return_to.strip()
    
    # Must start with / but not //
    if not return_to.startswith("/"):
        logger.warning(f"returnTo does not start with /: {return_to}")
        return None
    
    if return_to.startswith("//"):
        logger.warning(f"returnTo starts with //: {return_to}")
        return None
    
    # Must not contain :// (no absolute URLs)
    if "://" in return_to:
        logger.warning(f"returnTo contains ://: {return_to}")
        return None
    
    logger.info(f"Validated returnTo: {return_to}")
    return return_to


def get_role_home_path(role: str) -> str:
    """
    Get the home path for a given user role.
    
    Args:
        role: User role (admin, teacher, student)
        
    Returns:
        The home path for the role
    """
    if role == "admin":
        return "/teacher"
    elif role == "teacher":
        return "/teacher"
    elif role == "student":
        return "/student"
    else:
        # Default fallback
        return "/"
