"""
Tests for webhook security - SSRF protection
"""

import socket
import pytest
from unittest.mock import patch, Mock
from app.api.v1.utils.url_validation import validate_webhook_url
from app.infra.services.webhook_service import WebhookService


class TestWebhookURLValidation:
    """Tests for webhook URL validation to prevent SSRF attacks"""

    def test_valid_https_public_url(self):
        """Test that valid HTTPS public URLs are accepted"""
        with patch('app.api.v1.utils.url_validation.socket.getaddrinfo', return_value=[
            (socket.AF_INET, socket.SOCK_STREAM, 6, '', ('8.8.8.8', 443))
        ]):
            is_valid, error = validate_webhook_url("https://example.com/webhook")
            assert is_valid is True
            assert error == ""

    def test_http_url_rejected(self):
        """Test that HTTP URLs are rejected (HTTPS required)"""
        is_valid, error = validate_webhook_url("http://example.com/webhook")
        assert is_valid is False
        assert "HTTPS" in error

    def test_empty_url_rejected(self):
        """Test that empty URLs are rejected"""
        is_valid, error = validate_webhook_url("")
        assert is_valid is False
        assert "empty" in error.lower()

    def test_localhost_blocked(self):
        """Test that localhost/127.0.0.1 is blocked"""
        with patch('app.api.v1.utils.url_validation.socket.getaddrinfo', return_value=[
            (socket.AF_INET, socket.SOCK_STREAM, 6, '', ('127.0.0.1', 443))
        ]):
            is_valid, error = validate_webhook_url("https://localhost/webhook")
            assert is_valid is False
            # 127.0.0.1 is both loopback and private, so either message is acceptable
            assert "loopback" in error.lower() or "private" in error.lower()

    def test_private_ip_10_blocked(self):
        """Test that private IP 10.0.0.0/8 is blocked"""
        with patch('app.api.v1.utils.url_validation.socket.getaddrinfo', return_value=[
            (socket.AF_INET, socket.SOCK_STREAM, 6, '', ('10.0.0.1', 443))
        ]):
            is_valid, error = validate_webhook_url("https://internal.company.com/webhook")
            assert is_valid is False
            assert "private" in error.lower()

    def test_private_ip_172_blocked(self):
        """Test that private IP 172.16.0.0/12 is blocked"""
        with patch('app.api.v1.utils.url_validation.socket.getaddrinfo', return_value=[
            (socket.AF_INET, socket.SOCK_STREAM, 6, '', ('172.16.0.1', 443))
        ]):
            is_valid, error = validate_webhook_url("https://internal.company.com/webhook")
            assert is_valid is False
            assert "private" in error.lower()

    def test_private_ip_192_blocked(self):
        """Test that private IP 192.168.0.0/16 is blocked"""
        with patch('app.api.v1.utils.url_validation.socket.getaddrinfo', return_value=[
            (socket.AF_INET, socket.SOCK_STREAM, 6, '', ('192.168.1.1', 443))
        ]):
            is_valid, error = validate_webhook_url("https://router.local/webhook")
            assert is_valid is False
            assert "private" in error.lower()

    def test_link_local_blocked(self):
        """Test that link-local IP 169.254.0.0/16 (AWS/Azure metadata) is blocked"""
        with patch('app.api.v1.utils.url_validation.socket.getaddrinfo', return_value=[
            (socket.AF_INET, socket.SOCK_STREAM, 6, '', ('169.254.169.254', 443))
        ]):
            is_valid, error = validate_webhook_url("https://metadata.service/webhook")
            assert is_valid is False
            # 169.254.x.x is both link-local and private, so either message is acceptable
            assert "link-local" in error.lower() or "private" in error.lower()

    def test_ipv6_localhost_blocked(self):
        """Test that IPv6 localhost ::1 is blocked"""
        with patch('app.api.v1.utils.url_validation.socket.getaddrinfo', return_value=[
            (socket.AF_INET6, socket.SOCK_STREAM, 6, '', ('::1', 443, 0, 0))
        ]):
            is_valid, error = validate_webhook_url("https://localhost6/webhook")
            assert is_valid is False
            # IPv6 ::1 is loopback
            assert "loopback" in error.lower()

    def test_dns_resolution_failure(self):
        """Test that DNS resolution failures are handled"""
        with patch('app.api.v1.utils.url_validation.socket.gethostbyname', side_effect=socket.gaierror("DNS error")):
            is_valid, error = validate_webhook_url("https://nonexistent.invalid/webhook")
            assert is_valid is False
            assert "resolve" in error.lower()

    def test_invalid_url_format(self):
        """Test that malformed URLs are rejected"""
        is_valid, error = validate_webhook_url("not a url")
        assert is_valid is False
        # Could be format error or scheme error
        assert "HTTPS" in error or "format" in error.lower()


class TestWebhookServiceSSRFProtection:
    """Tests for WebhookService SSRF protection"""

    def test_webhook_service_validates_url(self):
        """Test that WebhookService validates URLs before sending"""
        # Try to send webhook to localhost - should be blocked
        with patch('app.api.v1.utils.url_validation.socket.getaddrinfo', return_value=[
            (socket.AF_INET, socket.SOCK_STREAM, 6, '', ('127.0.0.1', 443))
        ]):
            success, error = WebhookService.send_webhook(
                url="https://localhost/webhook",
                payload={"test": "data"}
            )
            assert success is False
            assert error is not None
            assert "Invalid webhook URL" in error

    def test_webhook_service_allows_valid_url(self):
        """Test that WebhookService allows valid public URLs"""
        mock_response = Mock()
        mock_response.status_code = 200
        
        with patch('app.api.v1.utils.url_validation.socket.getaddrinfo', return_value=[
            (socket.AF_INET, socket.SOCK_STREAM, 6, '', ('8.8.8.8', 443))
        ]):
            with patch('app.infra.services.webhook_service.requests.post', return_value=mock_response):
                success, error = WebhookService.send_webhook(
                    url="https://example.com/webhook",
                    payload={"test": "data"}
                )
                assert success is True
                assert error is None

    def test_webhook_service_blocks_private_network(self):
        """Test that WebhookService blocks private network IPs"""
        # Try various private IP ranges
        private_ips = [
            ('10.0.0.1', 443),
            ('172.16.0.1', 443),
            ('192.168.1.1', 443),
            ('169.254.169.254', 443)
        ]
        
        for ip_addr, port in private_ips:
            with patch('app.api.v1.utils.url_validation.socket.getaddrinfo', return_value=[
                (socket.AF_INET, socket.SOCK_STREAM, 6, '', (ip_addr, port))
            ]):
                success, error = WebhookService.send_webhook(
                    url=f"https://internal-{ip_addr.replace('.', '-')}.com/webhook",
                    payload={"test": "data"}
                )
                assert success is False, f"Should block IP {ip_addr}"
                assert error is not None
                assert "Invalid webhook URL" in error
