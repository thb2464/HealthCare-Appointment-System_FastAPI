"""
Background reminder task — sends appointment reminders 24h and 2h before scheduled time.
Runs every 5 minutes inside the FastAPI lifespan via asyncio.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)

# How often to poll (seconds)
_POLL_INTERVAL = 300  # 5 minutes

# Tolerance window around each reminder trigger (seconds)
_WINDOW = 300  # ±5 minutes


async def send_due_reminders() -> None:
    """Query for appointments due for a 24h or 2h reminder and dispatch emails."""
    from app.database import AsyncSessionLocal
    from app.models.appointment import Appointment, AppointmentStatus
    from app.models.doctor import Doctor
    from app.utils.email import send_appointment_reminder

    now = datetime.now(timezone.utc)

    # Windows: [target_time - window, target_time + window]
    reminder_targets = [
        (24, now + timedelta(hours=24) - timedelta(seconds=_WINDOW), now + timedelta(hours=24) + timedelta(seconds=_WINDOW)),
        (2,  now + timedelta(hours=2)  - timedelta(seconds=_WINDOW), now + timedelta(hours=2)  + timedelta(seconds=_WINDOW)),
    ]

    async with AsyncSessionLocal() as db:
        # reminders are read-only — no commit needed
        for hours_before, window_start, window_end in reminder_targets:
            result = await db.execute(
                select(Appointment)
                .options(
                    selectinload(Appointment.patient),
                    selectinload(Appointment.doctor).selectinload(Doctor.user),
                )
                .where(
                    Appointment.status == AppointmentStatus.CONFIRMED,
                    Appointment.scheduled_at >= window_start,
                    Appointment.scheduled_at <= window_end,
                )
            )
            appointments = result.scalars().all()
            for appt in appointments:
                try:
                    patient = appt.patient
                    doctor_name = (
                        appt.doctor.user.full_name
                        if appt.doctor and appt.doctor.user
                        else "your doctor"
                    )
                    asyncio.create_task(
                        send_appointment_reminder(
                            to_email=patient.email,
                            patient_name=patient.full_name,
                            scheduled_at=appt.scheduled_at.isoformat(),
                            doctor_name=doctor_name,
                            hours_before=hours_before,
                        )
                    )
                    logger.info(
                        "Reminder queued: appt_id=%d patient=%s %dh before",
                        appt.id, patient.email, hours_before,
                    )
                except Exception:
                    logger.exception("Failed to queue reminder for appt_id=%d", appt.id)


async def reminder_loop() -> None:
    """Infinite loop: runs send_due_reminders every _POLL_INTERVAL seconds."""
    logger.info("Appointment reminder loop started (poll every %ds)", _POLL_INTERVAL)
    while True:
        try:
            await send_due_reminders()
        except Exception:
            logger.exception("Error in reminder loop")
        await asyncio.sleep(_POLL_INTERVAL)
