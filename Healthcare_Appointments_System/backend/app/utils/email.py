"""
Email notification helpers.
Full implementation (fastapi-mail) will be wired in Phase 6.
"""
import logging

logger = logging.getLogger(__name__)


async def send_appointment_confirmation(to_email: str, patient_name: str, scheduled_at: str) -> None:
    logger.info("EMAIL [confirmation] to=%s patient=%s at=%s", to_email, patient_name, scheduled_at)


async def send_appointment_reminder(to_email: str, patient_name: str, scheduled_at: str) -> None:
    logger.info("EMAIL [reminder] to=%s patient=%s at=%s", to_email, patient_name, scheduled_at)


async def send_appointment_cancelled(to_email: str, patient_name: str) -> None:
    logger.info("EMAIL [cancelled] to=%s patient=%s", to_email, patient_name)
