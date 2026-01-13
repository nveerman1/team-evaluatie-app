"""
Redirect URL validation to prevent open redirect vulnerabilities.
"""
import logging
from typing import Optional
from urllib.parse import unquote

logger = logging.getLogger(__name__)


def normalize_and_validate_return_to(raw: Optional[str]) -> Optional[str]:
    """
    Normalize and validate a returnTo parameter to prevent open redirect attacks.
    
    This function:
    1. URL-decodes the input (handling single or double encoding)
    2. Validates the result is a safe relative path
    
    A safe returnTo must be:
    1. A relative path starting with "/"
    2. Not containing "://" (absolute URLs)
    3. Not starting with "//" (protocol-relative URLs)
    
    Args:
        raw: The raw returnTo parameter (possibly URL-encoded)
        
    Returns:
        The normalized and validated returnTo path if safe, None otherwise
        
    Examples:
        >>> normalize_and_validate_return_to("/teacher")
        "/teacher"
        >>> normalize_and_validate_return_to("%2Fteacher")
        "/teacher"
        >>> normalize_and_validate_return_to("%252Fteacher")
        "/teacher"
        >>> normalize_and_validate_return_to("/teacher/rubrics?id=123")
        "/teacher/rubrics?id=123"
        >>> normalize_and_validate_return_to("https://evil.com")
        None
        >>> normalize_and_validate_return_to("//evil.com")
        None
        >>> normalize_and_validate_return_to("javascript:alert(1)")
        None
    """
    if not raw:
        return None
    
    # Must be a string
    if not isinstance(raw, str):
        logger.warning(f"Invalid returnTo type: {type(raw)}")
        return None
    
    # Strip whitespace
    normalized = raw.strip()
    
    # URL-decode up to 2 times to handle single or double encoding
    # Example: "%252Fteacher" -> "%2Fteacher" -> "/teacher"
    for i in range(2):
        decoded = unquote(normalized)
        if decoded == normalized:
            # No more decoding needed
            break
        normalized = decoded
    
    # After normalization, validate the result
    
    # Must start with / but not //
    if not normalized.startswith("/"):
        logger.warning(f"returnTo does not start with / after normalization: {normalized} (original: {raw})")
        return None
    
    if normalized.startswith("//"):
        logger.warning(f"returnTo starts with // after normalization: {normalized} (original: {raw})")
        return None
    
    # Must not contain :// (no absolute URLs)
    if "://" in normalized:
        logger.warning(f"returnTo contains :// after normalization: {normalized} (original: {raw})")
        return None
    
    # Additional check for javascript: and other dangerous protocols
    # Check if any protocol-like pattern exists at the start
    if ":" in normalized[:20]:  # Check first 20 chars for protocols
        # Split on first colon to check for dangerous protocols
        protocol_part = normalized.split(":", 1)[0].lower()
        dangerous_protocols = ["javascript", "data", "vbscript", "file"]
        if protocol_part in dangerous_protocols:
            logger.warning(f"returnTo contains dangerous protocol after normalization: {normalized} (original: {raw})")
            return None
    
    logger.info(f"Validated returnTo: {normalized} (original: {raw})")
    return normalized


def validate_return_to(return_to: Optional[str]) -> Optional[str]:
    """
    Validate a returnTo parameter to prevent open redirect attacks.
    
    DEPRECATED: Use normalize_and_validate_return_to instead.
    This function is kept for backward compatibility but now delegates to the new function.
    
    Args:
        return_to: The returnTo parameter to validate
        
    Returns:
        The validated returnTo path if safe, None otherwise
    """
    return normalize_and_validate_return_to(return_to)


def get_role_home_path(role: str) -> str:
    """
    Get the home path for a given user role.
    
    NOTE: This logic is duplicated in frontend/src/lib/role-utils.ts.
    Both implementations must stay synchronized.
    
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
