"""
Background tasks:
  1. Appointment reminders — sends 24h and 2h before scheduled time, with deduplication.
  2. Payment expiry — cancels PENDING appointments whose payment hold has expired.
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
    """Query for appointments due for a 24h or 2h reminder and dispatch emails (with dedup)."""
    from app.database import AsyncSessionLocal
    from app.models.appointment import Appointment, AppointmentStatus
    from app.models.doctor import Doctor
    from app.utils.email import send_appointment_reminder

    now = datetime.now(timezone.utc)

    reminder_targets = [
        (24, "reminder_24h_sent", now + timedelta(hours=24) - timedelta(seconds=_WINDOW), now + timedelta(hours=24) + timedelta(seconds=_WINDOW)),
        (2, "reminder_2h_sent", now + timedelta(hours=2) - timedelta(seconds=_WINDOW), now + timedelta(hours=2) + timedelta(seconds=_WINDOW)),
    ]

    async with AsyncSessionLocal() as db:
        for hours_before, flag_name, window_start, window_end in reminder_targets:
            # Filter: CONFIRMED + not yet sent for this window
            stmt = (
                select(Appointment)
                .options(
                    selectinload(Appointment.patient),
                    selectinload(Appointment.doctor).selectinload(Doctor.user),
                )
                .where(
                    Appointment.status == AppointmentStatus.CONFIRMED,
                    Appointment.scheduled_at >= window_start,
                    Appointment.scheduled_at <= window_end,
                    getattr(Appointment, flag_name) == False,  # noqa: E712
                )
            )
            result = await db.execute(stmt)
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
                    # Mark as sent (dedup)
                    setattr(appt, flag_name, True)
                    logger.info(
                        "Reminder queued: appt_id=%d patient=%s %dh before",
                        appt.id, patient.email, hours_before,
                    )
                except Exception:
                    logger.exception("Failed to queue reminder for appt_id=%d", appt.id)

        await db.commit()


async def expire_stale_payments() -> None:
    """Cancel PENDING appointments whose payment hold has expired."""
    from app.database import AsyncSessionLocal
    from app.models.appointment import Appointment, AppointmentStatus

    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Appointment).where(
                Appointment.status == AppointmentStatus.PENDING,
                Appointment.payment_expires_at != None,  # noqa: E711
                Appointment.payment_expires_at < now,
                Appointment.deposit_paid == False,  # noqa: E712
            )
        )
        expired = result.scalars().all()
        for appt in expired:
            appt.status = AppointmentStatus.CANCELLED
            appt.cancellation_reason = "Payment timeout — slot hold expired"
            logger.info("Auto-cancelled expired payment hold: appt_id=%d", appt.id)
        if expired:
            await db.commit()


async def reminder_loop() -> None:
    """Infinite loop: runs send_due_reminders + expire_stale_payments every _POLL_INTERVAL seconds."""
    logger.info("Background task loop started (poll every %ds)", _POLL_INTERVAL)
    while True:
        try:
            await send_due_reminders()
        except Exception:
            logger.exception("Error in reminder loop")
        try:
            await expire_stale_payments()
        except Exception:
            logger.exception("Error in payment expiry loop")
        await asyncio.sleep(_POLL_INTERVAL)
