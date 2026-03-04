"""
SMTP email sender service.

Sends plain-text (with optional HTML alternative) emails via any STARTTLS-capable
SMTP server.  Configured entirely through environment variables — no credentials are
ever hard-coded here.

Typical usage::

    from app.infra.services.email_service import email_service

    if email_service.is_configured():
        sent = email_service.send_email(
            to=["recipient@example.com"],
            subject="Hello",
            body="Plain-text body",
            html_body="<p>HTML body</p>",
        )
"""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from typing import List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Thin wrapper around :mod:`smtplib` for sending outbound email."""

    # ------------------------------------------------------------------ helpers

    def is_configured(self) -> bool:
        """Return ``True`` when all mandatory SMTP settings are present."""
        return bool(
            settings.SMTP_HOST and settings.SMTP_USERNAME and settings.SMTP_PASSWORD
        )

    # ------------------------------------------------------------------ core

    def send_email(
        self,
        to: List[str],
        subject: str,
        body: str,
        html_body: Optional[str] = None,
        bcc: Optional[List[str]] = None,
        reply_to: Optional[str] = None,
    ) -> bool:
        """
        Send an email.

        Parameters
        ----------
        to:
            List of recipient addresses for the *To* header.
        subject:
            Email subject line.
        body:
            Plain-text body (required).
        html_body:
            Optional HTML body.  When provided, the message becomes
            ``multipart/alternative`` with both plain-text and HTML parts.
        bcc:
            Optional list of BCC recipients.
        reply_to:
            Reply-To address.  Falls back to ``settings.SMTP_REPLY_TO`` when
            not provided explicitly.

        Returns
        -------
        bool
            ``True`` on success, ``False`` on any error.
        """
        if not self.is_configured():
            logger.warning(
                "SMTP is not configured — email not sent "
                "(set SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD)"
            )
            return False

        try:
            msg = self._build_message(to, subject, body, html_body, bcc, reply_to)
            self._deliver(msg)
            logger.info(
                "Email sent: subject=%r to=%r bcc=%r",
                subject,
                to,
                bcc or [],
            )
            return True
        except Exception:
            logger.exception(
                "Failed to send email: subject=%r to=%r",
                subject,
                to,
            )
            return False

    # ------------------------------------------------------------------ private

    def _build_message(
        self,
        to: List[str],
        subject: str,
        body: str,
        html_body: Optional[str],
        bcc: Optional[List[str]],
        reply_to: Optional[str],
    ) -> EmailMessage:
        msg = EmailMessage()
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = ", ".join(to)
        msg["Subject"] = subject

        effective_reply_to = reply_to or settings.SMTP_REPLY_TO
        if effective_reply_to:
            msg["Reply-To"] = effective_reply_to

        if bcc:
            msg["Bcc"] = ", ".join(bcc)

        if html_body:
            msg.set_content(body)
            msg.add_alternative(html_body, subtype="html")
        else:
            msg.set_content(body)

        return msg

    def _deliver(self, msg: EmailMessage) -> None:
        """Open an SMTP connection, optionally upgrade with STARTTLS, and send."""
        with smtplib.SMTP(
            host=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            timeout=settings.SMTP_TIMEOUT,
        ) as smtp:
            smtp.ehlo()
            if settings.SMTP_USE_STARTTLS:
                smtp.starttls()
                smtp.ehlo()
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(msg)


# Module-level singleton used throughout the application.
email_service = EmailService()
