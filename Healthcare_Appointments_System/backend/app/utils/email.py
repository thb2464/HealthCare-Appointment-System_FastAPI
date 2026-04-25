"""
Email notification helpers.
Sends via fastapi-mail when MAIL_FROM is configured; falls back to log-only
so the app runs without SMTP credentials during development.
"""
import logging
from typing import Any

logger = logging.getLogger(__name__)


def _mail_configured() -> bool:
    from app.config import settings
    return bool(settings.MAIL_FROM and settings.MAIL_USERNAME)


def _build_conf():
    from fastapi_mail import ConnectionConfig
    from app.config import settings
    return ConnectionConfig(
        MAIL_USERNAME=settings.MAIL_USERNAME,
        MAIL_PASSWORD=settings.MAIL_PASSWORD,
        MAIL_FROM=settings.MAIL_FROM,
        MAIL_PORT=settings.MAIL_PORT,
        MAIL_SERVER=settings.MAIL_SERVER,
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True,
    )


async def _send(subject: str, recipients: list[str], body: str) -> None:
    if not _mail_configured():
        logger.info("EMAIL (no-send) subject=%r to=%s", subject, recipients)
        return
    try:
        from fastapi_mail import FastMail, MessageSchema, MessageType
        msg = MessageSchema(
            subject=subject,
            recipients=recipients,
            body=body,
            subtype=MessageType.plain,
        )
        await FastMail(_build_conf()).send_message(msg)
        logger.info("EMAIL sent subject=%r to=%s", subject, recipients)
    except Exception:
        logger.exception("EMAIL failed subject=%r to=%s", subject, recipients)


# ── Public notification functions ──────────────────────────────────────────────

async def send_appointment_confirmation(
    to_email: str, patient_name: str, scheduled_at: str, doctor_name: str
) -> None:
    await _send(
        subject="Appointment Confirmed",
        recipients=[to_email],
        body=(
            f"Dear {patient_name},\n\n"
            f"Your appointment with Dr. {doctor_name} has been booked for {scheduled_at} (UTC).\n\n"
            "Please arrive on time. You can reschedule or cancel via your patient dashboard.\n\n"
            "— MediCare Team"
        ),
    )


async def send_appointment_confirmed_by_doctor(
    to_email: str, patient_name: str, scheduled_at: str, doctor_name: str
) -> None:
    await _send(
        subject="Appointment Confirmed by Doctor",
        recipients=[to_email],
        body=(
            f"Dear {patient_name},\n\n"
            f"Dr. {doctor_name} has confirmed your appointment on {scheduled_at} (UTC).\n\n"
            "We look forward to seeing you!\n\n"
            "— MediCare Team"
        ),
    )


async def send_appointment_reminder(
    to_email: str, patient_name: str, scheduled_at: str, doctor_name: str
) -> None:
    await _send(
        subject="Appointment Reminder",
        recipients=[to_email],
        body=(
            f"Dear {patient_name},\n\n"
            f"This is a reminder that your appointment with Dr. {doctor_name} "
            f"is scheduled for {scheduled_at} (UTC).\n\n"
            "— MediCare Team"
        ),
    )


async def send_appointment_cancelled(
    to_email: str, patient_name: str, scheduled_at: str, doctor_name: str
) -> None:
    await _send(
        subject="Appointment Cancelled",
        recipients=[to_email],
        body=(
            f"Dear {patient_name},\n\n"
            f"Your appointment with Dr. {doctor_name} on {scheduled_at} (UTC) has been cancelled.\n\n"
            "You can book a new appointment at any time via the MediCare platform.\n\n"
            "— MediCare Team"
        ),
    )


async def send_appointment_completed(
    to_email: str, patient_name: str, doctor_name: str
) -> None:
    await _send(
        subject="Visit Complete — Please Leave a Review",
        recipients=[to_email],
        body=(
            f"Dear {patient_name},\n\n"
            f"Your visit with Dr. {doctor_name} is now marked as complete.\n\n"
            "We'd love to hear your feedback — log in to your dashboard to leave a review.\n\n"
            "— MediCare Team"
        ),
    )


async def send_waitlist_slot_available(
    to_email: str, patient_name: str, doctor_name: str
) -> None:
    await _send(
        subject="A Slot Is Now Available",
        recipients=[to_email],
        body=(
            f"Dear {patient_name},\n\n"
            f"Good news! A slot with Dr. {doctor_name} has just become available "
            "due to a cancellation.\n\n"
            "Log in to MediCare now to book before it fills up.\n\n"
            "— MediCare Team"
        ),
    )
