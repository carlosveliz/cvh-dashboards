import smtplib
from email.message import EmailMessage

from ..config import settings


def send_invitation_email(to_email: str, invite_url: str) -> bool:
    """Send an invitation email. Returns True if sent, False if SMTP not configured."""
    if not settings.smtp_enabled:
        return False

    msg = EmailMessage()
    msg["Subject"] = "Invitación a CVH Dashboards"
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    msg.set_content(
        "Has sido invitado a CVH Dashboards.\n\n"
        f"Activa tu cuenta en el siguiente enlace:\n{invite_url}\n\n"
        "Si no esperabas esta invitación, ignora este correo."
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        if settings.smtp_tls:
            server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)
    return True
