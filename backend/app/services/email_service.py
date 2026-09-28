"""SMTP email sending. Uses the stdlib smtplib rather than a new dependency —
this app sends low volumes of transactional mail, nothing that needs a queue
or a templating engine.

Every send failure is swallowed here (logged, never raised) — email is a
side effect of a create/decision request, and must never turn an otherwise
successful API call into a 500.
"""

import logging
import smtplib
from email.message import EmailMessage
from pathlib import Path

from app.core.config import settings
from app.services.email_templates import LOGO_CID

logger = logging.getLogger(__name__)

_LOGO_PATH = Path(__file__).resolve().parent.parent / "assets" / "email-logo.png"


def send_email(to: list[str], subject: str, html_body: str) -> None:
    recipients = [addr for addr in to if addr]
    if not recipients:
        return

    if not settings.email_enabled:
        logger.info("Email disabled (EMAIL_ENABLED=false) — skipped %r to %s", subject, recipients)
        return

    if not settings.smtp_host or not settings.smtp_user or not settings.smtp_password:
        logger.warning("SMTP not configured — skipped email %r to %s", subject, recipients)
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from_email or settings.smtp_user
    message["To"] = ", ".join(recipients)
    message.set_content("This email requires an HTML-capable client to view.")
    message.add_alternative(html_body, subtype="html")

    # The logo is a CID-embedded inline image, not a hosted URL or data URI —
    # see the note on email_templates.LOGO_CID for why. Attach it as a part
    # related to the HTML alternative only when the template actually
    # references it.
    if f"cid:{LOGO_CID}" in html_body and _LOGO_PATH.exists():
        html_part = message.get_payload()[-1]
        html_part.add_related(_LOGO_PATH.read_bytes(), maintype="image", subtype="png", cid=f"<{LOGO_CID}>")

    try:
        if settings.smtp_use_ssl:
            # Implicit TLS (port 465) — the connection is encrypted from the
            # first byte, so there is no plaintext handshake to upgrade.
            client_cls = smtplib.SMTP_SSL
        else:
            client_cls = smtplib.SMTP
        with client_cls(settings.smtp_host, settings.smtp_port, timeout=10) as client:
            if settings.smtp_use_tls and not settings.smtp_use_ssl:
                client.starttls()
            client.login(settings.smtp_user, settings.smtp_password)
            client.send_message(message)
    except Exception:
        logger.exception("Failed to send email %r to %s", subject, recipients)
