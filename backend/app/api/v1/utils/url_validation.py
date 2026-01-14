"""
URL validation utilities for submission feature and webhook URLs
Validates that URLs are safe SharePoint/OneDrive links and prevents SSRF attacks
"""
import re
import socket
import ipaddress
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


def validate_webhook_url(url: str) -> Tuple[bool, str]:
    """
    Validate webhook URL and prevent SSRF attacks.
    Blocks internal IP ranges and ensures HTTPS is used.
    
    Args:
        url: The webhook URL to validate
        
    Returns:
        Tuple of (is_valid: bool, error_message: str)
    """
    if not url or not url.strip():
        return False, "Webhook URL cannot be empty"
    
    url = url.strip()
    
    # Parse URL
    try:
        parsed = urlparse(url)
    except Exception:
        return False, "Invalid webhook URL format"
    
    # Must use HTTPS (prevent cleartext credential leakage)
    if parsed.scheme != 'https':
        return False, "Webhook URL must use HTTPS"
    
    # Check hostname
    hostname = parsed.hostname
    if not hostname:
        return False, "Invalid webhook URL: no hostname found"
    
    # Resolve hostname to IP address (supports both IPv4 and IPv6)
    try:
        # Use getaddrinfo to support both IPv4 and IPv6
        addr_info = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        if not addr_info:
            return False, "Cannot resolve webhook hostname"
        
        # Check all resolved IPs (a hostname can resolve to multiple IPs)
        for family, _, _, _, sockaddr in addr_info:
            ip_str = sockaddr[0]
            try:
                ip_obj = ipaddress.ip_address(ip_str)
            except ValueError:
                continue  # Skip invalid IPs
            
            # Block loopback addresses first (127.0.0.0/8, ::1)
            if ip_obj.is_loopback:
                return False, "Webhook URL resolves to loopback address (blocked for security)"
            
            # Block private/internal IP ranges (SSRF prevention)
            if ip_obj.is_private:
                return False, "Webhook URL resolves to private IP address (blocked for security)"
            
            # Block link-local addresses (169.254.0.0/16 for IPv4, fe80::/10 for IPv6)
            if ip_obj.is_link_local:
                return False, "Webhook URL resolves to link-local address (blocked for security)"
            
            # Block multicast and reserved addresses
            if ip_obj.is_multicast or ip_obj.is_reserved:
                return False, "Webhook URL resolves to multicast/reserved address (blocked for security)"
        
    except (socket.gaierror, ValueError) as e:
        return False, f"Cannot resolve webhook hostname: {str(e)}"
    
    return True, ""
