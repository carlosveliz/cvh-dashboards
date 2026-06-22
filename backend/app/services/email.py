import smtplib
from email.message import EmailMessage

from ..config import settings


def _send(to_email: str, subject: str, body: str) -> bool:
    """Send an email. Returns True if sent, False if SMTP is not configured."""
    if not settings.smtp_enabled:
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    msg.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        if settings.smtp_tls:
            server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)
    return True


def send_invitation_email(to_email: str, invite_url: str) -> bool:
    return _send(
        to_email,
        "Invitación a CVH Dashboards",
        "Has sido invitado a CVH Dashboards.\n\n"
        f"Activa tu cuenta en el siguiente enlace:\n{invite_url}\n\n"
        "Si no esperabas esta invitación, ignora este correo.",
    )


def send_password_reset_email(to_email: str, reset_url: str) -> bool:
    return _send(
        to_email,
        "Restablecer contraseña — CVH Dashboards",
        "Solicitaste restablecer tu contraseña.\n\n"
        f"Crea una nueva contraseña en el siguiente enlace (expira en 1 hora):\n{reset_url}\n\n"
        "Si no fuiste tú, ignora este correo.",
    )
