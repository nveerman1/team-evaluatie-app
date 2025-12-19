"""
URL validation utilities for submission feature
Validates that URLs are safe SharePoint/OneDrive links
"""
import re
from urllib.parse import urlparse
from typing import Tuple


ALLOWED_HOSTS = [
    "sharepoint.com",
    "1drv.ms",  # OneDrive short URLs
]

# Specific Microsoft Office 365 domains
ALLOWED_OFFICE_DOMAINS = [
    "officeapps.live.com",  # Office web apps
    "view.officeapps.live.com",  # Office document viewer
]


def validate_sharepoint_url(url: str) -> Tuple[bool, str]:
    """
    Validate that URL is a SharePoint/OneDrive link.
    Blocks XSS and other malicious inputs.
    
    Args:
        url: The URL to validate
        
    Returns:
        Tuple of (is_valid: bool, error_message: str)
    """
    if not url or not url.strip():
        return False, "URL cannot be empty"
    
    url = url.strip()
    
    # Block javascript:, data:, and vbscript: URLs (XSS prevention)
    if re.match(r'^(javascript|data|vbscript):', url, re.IGNORECASE):
        return False, "Invalid URL scheme detected"
    
    # Must be HTTPS
    if not url.startswith('https://'):
        return False, "Only HTTPS URLs are allowed"
    
    # Parse URL
    try:
        parsed = urlparse(url)
    except Exception:
        return False, "Invalid URL format"
    
    # Check hostname
    hostname = parsed.hostname
    if not hostname:
        return False, "Invalid URL: no hostname found"
    
    # Must end with allowed host
    hostname_lower = hostname.lower()
    
    # Check against general allowed hosts
    for allowed in ALLOWED_HOSTS:
        if hostname_lower.endswith(allowed):
            return True, ""
    
    # Check against specific Office domains
    for allowed in ALLOWED_OFFICE_DOMAINS:
        if hostname_lower == allowed:
            return True, ""
    
    return False, f"Only SharePoint/OneDrive URLs are allowed (e.g., *.sharepoint.com, 1drv.ms)"
