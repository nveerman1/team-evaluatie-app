"""
Unit tests for EmailService.

Tests verify SMTP interactions using unittest.mock — no real network connections
are made.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch
import smtplib

import pytest

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_settings(**overrides):
    """Return a SimpleNamespace that looks like app.core.config.settings."""
    from types import SimpleNamespace

    defaults = dict(
        SMTP_HOST="smtp.transip.email",
        SMTP_PORT=587,
        SMTP_USERNAME="noreply@technasiummbh.nl",
        SMTP_PASSWORD="secret",
        SMTP_USE_STARTTLS=True,
        SMTP_FROM_NAME="Technasium MBH App",
        SMTP_FROM_EMAIL="noreply@technasiummbh.nl",
        SMTP_REPLY_TO="support@technasiummbh.nl",
        SMTP_TIMEOUT=10,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestEmailServiceIsConfigured:
    """Tests for EmailService.is_configured()."""

    def test_configured_when_all_required_fields_set(self):
        from app.infra.services.email_service import EmailService

        svc = EmailService()
        with patch("app.infra.services.email_service.settings", _make_settings()):
            assert svc.is_configured() is True

    def test_not_configured_when_host_missing(self):
        from app.infra.services.email_service import EmailService

        svc = EmailService()
        with patch(
            "app.infra.services.email_service.settings",
            _make_settings(SMTP_HOST=""),
        ):
            assert svc.is_configured() is False

    def test_not_configured_when_username_missing(self):
        from app.infra.services.email_service import EmailService

        svc = EmailService()
        with patch(
            "app.infra.services.email_service.settings",
            _make_settings(SMTP_USERNAME=""),
        ):
            assert svc.is_configured() is False

    def test_not_configured_when_password_missing(self):
        from app.infra.services.email_service import EmailService

        svc = EmailService()
        with patch(
            "app.infra.services.email_service.settings",
            _make_settings(SMTP_PASSWORD=""),
        ):
            assert svc.is_configured() is False


@pytest.mark.unit
class TestEmailServiceSendEmail:
    """Tests for EmailService.send_email() — smtplib is fully mocked."""

    def _send(self, mock_smtp_cls, **settings_overrides):
        """Helper: call send_email with mocked SMTP and return (result, smtp_instance)."""
        from app.infra.services.email_service import EmailService

        smtp_instance = MagicMock()
        mock_smtp_cls.return_value.__enter__.return_value = smtp_instance

        svc = EmailService()
        fake_settings = _make_settings(**settings_overrides)

        with patch("app.infra.services.email_service.settings", fake_settings):
            result = svc.send_email(
                to=["student@school.nl"],
                subject="Test subject",
                body="Plain text body",
            )

        return result, smtp_instance

    @patch("smtplib.SMTP")
    def test_returns_true_on_success(self, mock_smtp_cls):
        result, _ = self._send(mock_smtp_cls)
        assert result is True

    @patch("smtplib.SMTP")
    def test_starttls_called_when_enabled(self, mock_smtp_cls):
        _, smtp_instance = self._send(mock_smtp_cls, SMTP_USE_STARTTLS=True)
        smtp_instance.starttls.assert_called_once()

    @patch("smtplib.SMTP")
    def test_starttls_not_called_when_disabled(self, mock_smtp_cls):
        _, smtp_instance = self._send(mock_smtp_cls, SMTP_USE_STARTTLS=False)
        smtp_instance.starttls.assert_not_called()

    @patch("smtplib.SMTP")
    def test_login_called_with_credentials(self, mock_smtp_cls):
        fake_settings = _make_settings()
        _, smtp_instance = self._send(mock_smtp_cls)
        smtp_instance.login.assert_called_once_with(
            fake_settings.SMTP_USERNAME, fake_settings.SMTP_PASSWORD
        )

    @patch("smtplib.SMTP")
    def test_send_message_called(self, mock_smtp_cls):
        _, smtp_instance = self._send(mock_smtp_cls)
        smtp_instance.send_message.assert_called_once()

    @patch("smtplib.SMTP")
    def test_returns_false_when_not_configured(self, mock_smtp_cls):
        from app.infra.services.email_service import EmailService

        svc = EmailService()
        with patch(
            "app.infra.services.email_service.settings",
            _make_settings(SMTP_HOST=""),
        ):
            result = svc.send_email(
                to=["student@school.nl"],
                subject="Test",
                body="Body",
            )
        assert result is False
        mock_smtp_cls.assert_not_called()

    @patch("smtplib.SMTP")
    def test_returns_false_on_smtp_exception(self, mock_smtp_cls):
        from app.infra.services.email_service import EmailService

        smtp_instance = MagicMock()
        mock_smtp_cls.return_value.__enter__.return_value = smtp_instance
        smtp_instance.send_message.side_effect = smtplib.SMTPException(
            "Connection refused"
        )

        svc = EmailService()
        with patch("app.infra.services.email_service.settings", _make_settings()):
            result = svc.send_email(
                to=["student@school.nl"],
                subject="Test",
                body="Body",
            )
        assert result is False

    @patch("smtplib.SMTP")
    def test_html_alternative_included_when_provided(self, mock_smtp_cls):
        from app.infra.services.email_service import EmailService

        smtp_instance = MagicMock()
        mock_smtp_cls.return_value.__enter__.return_value = smtp_instance

        svc = EmailService()
        with patch("app.infra.services.email_service.settings", _make_settings()):
            result = svc.send_email(
                to=["student@school.nl"],
                subject="Test",
                body="Plain body",
                html_body="<p>HTML body</p>",
            )

        assert result is True
        # The message passed to send_message should be multipart/alternative
        msg_arg = smtp_instance.send_message.call_args[0][0]
        assert msg_arg.get_content_type() == "multipart/alternative"

    @patch("smtplib.SMTP")
    def test_bcc_header_set_when_provided(self, mock_smtp_cls):
        from app.infra.services.email_service import EmailService

        smtp_instance = MagicMock()
        mock_smtp_cls.return_value.__enter__.return_value = smtp_instance

        svc = EmailService()
        with patch("app.infra.services.email_service.settings", _make_settings()):
            svc.send_email(
                to=["student@school.nl"],
                subject="Test",
                body="Body",
                bcc=["bcc@school.nl"],
            )

        msg_arg = smtp_instance.send_message.call_args[0][0]
        assert "bcc@school.nl" in msg_arg["Bcc"]

    @patch("smtplib.SMTP")
    def test_reply_to_set_from_settings_when_not_provided(self, mock_smtp_cls):
        from app.infra.services.email_service import EmailService

        smtp_instance = MagicMock()
        mock_smtp_cls.return_value.__enter__.return_value = smtp_instance

        svc = EmailService()
        fake_settings = _make_settings(SMTP_REPLY_TO="support@technasiummbh.nl")
        with patch("app.infra.services.email_service.settings", fake_settings):
            svc.send_email(to=["s@school.nl"], subject="T", body="B")

        msg_arg = smtp_instance.send_message.call_args[0][0]
        assert msg_arg["Reply-To"] == "support@technasiummbh.nl"

    @patch("smtplib.SMTP")
    def test_reply_to_overridable_per_send(self, mock_smtp_cls):
        from app.infra.services.email_service import EmailService

        smtp_instance = MagicMock()
        mock_smtp_cls.return_value.__enter__.return_value = smtp_instance

        svc = EmailService()
        with patch("app.infra.services.email_service.settings", _make_settings()):
            svc.send_email(
                to=["s@school.nl"],
                subject="T",
                body="B",
                reply_to="custom@school.nl",
            )

        msg_arg = smtp_instance.send_message.call_args[0][0]
        assert msg_arg["Reply-To"] == "custom@school.nl"
