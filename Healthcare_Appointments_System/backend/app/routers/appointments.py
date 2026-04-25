"""
Appointments router — booking, listing, status updates, rescheduling, cancellation, check-in.
Booking logic is co-located here in the monolith.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import CurrentUser, CurrentPatient, DBSession
from app.models.appointment import Appointment, AppointmentStatus
from app.models.availability import Availability
from app.models.doctor import Doctor
from app.models.user import UserRole
from app.models.waitlist import WaitlistEntry
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentStatusUpdate,
    AppointmentReschedule,
    AppointmentResponse,
    AppointmentListResponse,
)
from app.utils.email import (
    send_appointment_confirmation,
    send_appointment_confirmed_by_doctor,
    send_appointment_cancelled,
    send_appointment_completed,
    send_waitlist_slot_available,
)

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])

_LOAD = [
    selectinload(Appointment.patient),
    selectinload(Appointment.doctor).selectinload(Doctor.user),
    selectinload(Appointment.doctor).selectinload(Doctor.specialty),
]


# ══════════════════════════════════════════════════════════════════════════════
# Booking helpers
# ══════════════════════════════════════════════════════════════════════════════

def _slot_lock_key(doctor_id: int, scheduled_at: datetime) -> int:
    """Stable 64-bit integer for pg_try_advisory_xact_lock."""
    epoch_minutes = int(scheduled_at.timestamp()) // 60
    return ((doctor_id & 0xFFFFFFFF) << 32) | (epoch_minutes & 0xFFFFFFFF)


async def _acquire_advisory_lock(db: AsyncSession, lock_key: int) -> None:
    try:
        result = await db.execute(
            text("SELECT pg_try_advisory_xact_lock(:key)"),
            {"key": lock_key},
        )
        if not result.scalar_one():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This slot is currently being booked. Please try again.",
            )
    except OperationalError:
        pass


async def _get_active_doctor(db: AsyncSession, doctor_id: int) -> Doctor:
    from app.models.user import User

    result = await db.execute(
        select(Doctor)
        .join(Doctor.user)
        .where(Doctor.id == doctor_id, User.is_active == True)  # noqa: E712
    )
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found or account is inactive",
        )
    return doctor


async def _get_slot_duration(db: AsyncSession, doctor_id: int, scheduled_at: datetime) -> int:
    slot_time = scheduled_at.astimezone(timezone.utc).time().replace(second=0, microsecond=0)
    weekday = scheduled_at.astimezone(timezone.utc).weekday()
    result = await db.execute(
        select(Availability).where(
            Availability.doctor_id == doctor_id,
            Availability.day_of_week == weekday,
            Availability.start_time <= slot_time,
            Availability.end_time > slot_time,
            Availability.is_active == True,  # noqa: E712
        )
    )
    window = result.scalar_one_or_none()
    return window.slot_duration_minutes if window else 30


async def _is_slot_available(db: AsyncSession, doctor_id: int, scheduled_at: datetime) -> bool:
    utc_dt = scheduled_at.astimezone(timezone.utc)
    slot_time = utc_dt.time().replace(second=0, microsecond=0)
    weekday = utc_dt.weekday()

    result = await db.execute(
        select(Availability).where(
            Availability.doctor_id == doctor_id,
            Availability.day_of_week == weekday,
            Availability.is_active == True,  # noqa: E712
        )
    )
    windows = list(result.scalars().all())
    if not windows or not any(w.start_time <= slot_time < w.end_time for w in windows):
        return False

    conflict = await db.execute(
        select(Appointment.scheduled_at).where(
            Appointment.doctor_id == doctor_id,
            Appointment.scheduled_at == utc_dt.replace(second=0, microsecond=0),
            Appointment.status.notin_([AppointmentStatus.CANCELLED]),
        )
    )
    return conflict.scalar_one_or_none() is None


def _validate_status_transition(
    current: AppointmentStatus,
    new: AppointmentStatus,
    role: UserRole,
) -> None:
    allowed: dict[AppointmentStatus, set[AppointmentStatus]] = {
        AppointmentStatus.PENDING: {AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED},
        AppointmentStatus.CONFIRMED: {
            AppointmentStatus.ARRIVED,
            AppointmentStatus.COMPLETED,
            AppointmentStatus.CANCELLED,
            AppointmentStatus.RESCHEDULED,
        },
        AppointmentStatus.ARRIVED: {AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED},
        AppointmentStatus.RESCHEDULED: {AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED},
        AppointmentStatus.COMPLETED: set(),
        AppointmentStatus.CANCELLED: set(),
    }
    if new not in allowed.get(current, set()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Transition {current.value} → {new.value} is not allowed. "
                f"Valid transitions: {[s.value for s in allowed.get(current, set())]}"
            ),
        )
    if new == AppointmentStatus.COMPLETED and role not in (UserRole.DOCTOR, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors can mark appointments as COMPLETED",
        )
    if new == AppointmentStatus.CONFIRMED and role == UserRole.PATIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors or admins can confirm appointments",
        )
    if new == AppointmentStatus.ARRIVED and role not in (
        UserRole.RECEPTIONIST, UserRole.ADMIN, UserRole.DOCTOR
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only receptionists, doctors, or admins can mark a patient as arrived",
        )


async def _book(
    *,
    db: AsyncSession,
    patient_id: int,
    doctor_id: int,
    scheduled_at: datetime,
    reason: str | None,
) -> Appointment:
    await _get_active_doctor(db, doctor_id)

    if scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
    else:
        scheduled_at = scheduled_at.astimezone(timezone.utc)

    if scheduled_at <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot book an appointment in the past",
        )

    if not await _is_slot_available(db, doctor_id, scheduled_at):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The requested time slot is not available for this doctor",
        )

    lock_key = _slot_lock_key(doctor_id, scheduled_at)
    await _acquire_advisory_lock(db, lock_key)

    conflict = await db.execute(
        select(Appointment).where(
            Appointment.doctor_id == doctor_id,
            Appointment.scheduled_at == scheduled_at,
            Appointment.status.notin_([AppointmentStatus.CANCELLED]),
        )
    )
    if conflict.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This slot was just booked by someone else. Please choose another time.",
        )

    slot_minutes = await _get_slot_duration(db, doctor_id, scheduled_at)
    appt = Appointment(
        patient_id=patient_id,
        doctor_id=doctor_id,
        scheduled_at=scheduled_at,
        end_at=scheduled_at + timedelta(minutes=slot_minutes),
        status=AppointmentStatus.PENDING,
        reason=reason,
    )
    db.add(appt)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This slot is already booked (concurrent request). Please choose another time.",
        )
    return appt


async def _reschedule(
    *,
    db: AsyncSession,
    appointment: Appointment,
    new_time: datetime,
) -> None:
    if new_time.tzinfo is None:
        new_time = new_time.replace(tzinfo=timezone.utc)
    else:
        new_time = new_time.astimezone(timezone.utc)

    if new_time <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reschedule to a time in the past",
        )

    available = await _is_slot_available(db, appointment.doctor_id, new_time)
    if not available and new_time != appointment.scheduled_at:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The requested time slot is not available for this doctor",
        )

    lock_key = _slot_lock_key(appointment.doctor_id, new_time)
    await _acquire_advisory_lock(db, lock_key)

    conflict = await db.execute(
        select(Appointment).where(
            Appointment.doctor_id == appointment.doctor_id,
            Appointment.scheduled_at == new_time,
            Appointment.status.notin_([AppointmentStatus.CANCELLED]),
            Appointment.id != appointment.id,
        )
    )
    if conflict.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This slot was just booked by someone else. Please choose another time.",
        )

    slot_minutes = await _get_slot_duration(db, appointment.doctor_id, new_time)
    appointment.scheduled_at = new_time
    appointment.end_at = new_time + timedelta(minutes=slot_minutes)
    appointment.status = AppointmentStatus.RESCHEDULED
    await db.flush()


async def _notify_waitlist(db: AsyncSession, doctor_id: int) -> None:
    """Notify the oldest waitlist patient for a doctor when a slot is freed."""
    result = await db.execute(
        select(WaitlistEntry)
        .options(
            selectinload(WaitlistEntry.patient),
            selectinload(WaitlistEntry.doctor).selectinload(Doctor.user),
        )
        .where(WaitlistEntry.doctor_id == doctor_id)
        .order_by(WaitlistEntry.created_at)
        .limit(1)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        return
    doctor_name = entry.doctor.user.full_name if entry.doctor and entry.doctor.user else "your doctor"
    asyncio.create_task(
        send_waitlist_slot_available(
            to_email=entry.patient.email,
            patient_name=entry.patient.full_name,
            doctor_name=doctor_name,
        )
    )
    await db.delete(entry)
    await db.flush()


# ══════════════════════════════════════════════════════════════════════════════
# Route handlers
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Book an appointment (patient only)",
)
async def book_appointment(
    payload: AppointmentCreate,
    current_user: CurrentPatient,
    db: DBSession,
) -> Appointment:
    appt = await _book(
        db=db,
        patient_id=current_user.id,
        doctor_id=payload.doctor_id,
        scheduled_at=payload.scheduled_at,
        reason=payload.reason,
    )
    result = await db.execute(
        select(Appointment).options(*_LOAD).where(Appointment.id == appt.id)
    )
    appt = result.scalar_one()
    doctor_name = appt.doctor.user.full_name if appt.doctor and appt.doctor.user else "your doctor"
    asyncio.create_task(
        send_appointment_confirmation(
            to_email=current_user.email,
            patient_name=current_user.full_name,
            scheduled_at=appt.scheduled_at.isoformat(),
            doctor_name=doctor_name,
        )
    )
    return appt


@router.get(
    "",
    response_model=list[AppointmentListResponse],
    summary="List appointments for current user",
)
async def list_appointments(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: AppointmentStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> list[Appointment]:
    stmt = select(Appointment).options(*_LOAD)

    if current_user.role == UserRole.PATIENT:
        stmt = stmt.where(Appointment.patient_id == current_user.id)
    elif current_user.role == UserRole.DOCTOR:
        doctor_result = await db.execute(
            select(Doctor).where(Doctor.user_id == current_user.id)
        )
        doctor = doctor_result.scalar_one_or_none()
        if not doctor:
            return []
        stmt = stmt.where(Appointment.doctor_id == doctor.id)
    # Admin and Receptionist see all

    if status_filter:
        stmt = stmt.where(Appointment.status == status_filter)

    stmt = (
        stmt.order_by(Appointment.scheduled_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get(
    "/{appointment_id}",
    response_model=AppointmentResponse,
    summary="Get appointment detail",
)
async def get_appointment(
    appointment_id: int,
    current_user: CurrentUser,
    db: DBSession,
) -> Appointment:
    result = await db.execute(
        select(Appointment).options(*_LOAD).where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    _assert_access(current_user, appt)
    return appt


@router.patch(
    "/{appointment_id}",
    response_model=AppointmentResponse,
    summary="Update appointment status / notes",
)
async def update_appointment(
    appointment_id: int,
    payload: AppointmentStatusUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> Appointment:
    result = await db.execute(
        select(Appointment).options(*_LOAD).where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    _assert_access(current_user, appt)
    _validate_status_transition(appt.status, payload.status, current_user.role)

    prev_status = appt.status
    appt.status = payload.status
    if payload.notes is not None:
        appt.notes = payload.notes
    await db.flush()
    await db.refresh(appt)

    doctor_name = appt.doctor.user.full_name if appt.doctor and appt.doctor.user else "your doctor"
    patient_email = appt.patient.email
    patient_name = appt.patient.full_name
    scheduled_str = appt.scheduled_at.isoformat()

    if payload.status == AppointmentStatus.CONFIRMED:
        asyncio.create_task(
            send_appointment_confirmed_by_doctor(
                to_email=patient_email,
                patient_name=patient_name,
                scheduled_at=scheduled_str,
                doctor_name=doctor_name,
            )
        )
    elif payload.status == AppointmentStatus.CANCELLED:
        asyncio.create_task(
            send_appointment_cancelled(
                to_email=patient_email,
                patient_name=patient_name,
                scheduled_at=scheduled_str,
                doctor_name=doctor_name,
            )
        )
        if prev_status == AppointmentStatus.CONFIRMED:
            await _notify_waitlist(db, appt.doctor_id)
    elif payload.status == AppointmentStatus.COMPLETED:
        asyncio.create_task(
            send_appointment_completed(
                to_email=patient_email,
                patient_name=patient_name,
                doctor_name=doctor_name,
            )
        )

    return appt


@router.patch(
    "/{appointment_id}/reschedule",
    response_model=AppointmentResponse,
    summary="Reschedule an appointment",
)
async def reschedule_appointment(
    appointment_id: int,
    payload: AppointmentReschedule,
    current_user: CurrentUser,
    db: DBSession,
) -> Appointment:
    result = await db.execute(
        select(Appointment).options(*_LOAD).where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    _assert_access(current_user, appt)

    if appt.status not in (AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PENDING or CONFIRMED appointments can be rescheduled",
        )

    if current_user.role == UserRole.PATIENT:
        if appt.status != AppointmentStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Patients can only reschedule PENDING appointments (before doctor confirmation)",
            )
    elif current_user.role == UserRole.DOCTOR:
        if appt.status != AppointmentStatus.CONFIRMED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Doctors can only reschedule CONFIRMED appointments",
            )

    await _reschedule(db=db, appointment=appt, new_time=payload.scheduled_at)
    await db.refresh(appt)
    return appt


@router.patch(
    "/{appointment_id}/arrive",
    response_model=AppointmentResponse,
    summary="Mark patient as arrived (receptionist / doctor / admin only)",
)
async def mark_arrived(
    appointment_id: int,
    current_user: CurrentUser,
    db: DBSession,
) -> Appointment:
    if current_user.role not in (UserRole.RECEPTIONIST, UserRole.ADMIN, UserRole.DOCTOR):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only receptionists, doctors, or admins can mark a patient as arrived",
        )

    result = await db.execute(
        select(Appointment).options(*_LOAD).where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    if appt.status != AppointmentStatus.CONFIRMED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only CONFIRMED appointments can be marked as arrived (current: {appt.status.value})",
        )

    appt.status = AppointmentStatus.ARRIVED
    await db.flush()
    await db.refresh(appt)
    return appt


@router.delete(
    "/{appointment_id}",
    response_model=AppointmentResponse,
    summary="Cancel an appointment",
)
async def cancel_appointment(
    appointment_id: int,
    current_user: CurrentUser,
    db: DBSession,
) -> Appointment:
    result = await db.execute(
        select(Appointment).options(*_LOAD).where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    _assert_access(current_user, appt)

    if current_user.role == UserRole.PATIENT and appt.status == AppointmentStatus.CONFIRMED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Patients cannot cancel a confirmed appointment. Please contact the clinic.",
        )

    if appt.status in (AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel a {appt.status.value} appointment",
        )

    was_confirmed = appt.status == AppointmentStatus.CONFIRMED
    appt.status = AppointmentStatus.CANCELLED
    await db.flush()
    await db.refresh(appt)

    doctor_name = appt.doctor.user.full_name if appt.doctor and appt.doctor.user else "your doctor"
    asyncio.create_task(
        send_appointment_cancelled(
            to_email=appt.patient.email,
            patient_name=appt.patient.full_name,
            scheduled_at=appt.scheduled_at.isoformat(),
            doctor_name=doctor_name,
        )
    )
    if was_confirmed:
        await _notify_waitlist(db, appt.doctor_id)

    return appt


# ── Access guard ───────────────────────────────────────────────────────────────
def _assert_access(user, appt: Appointment) -> None:
    if user.role in (UserRole.ADMIN, UserRole.RECEPTIONIST):
        return
    if user.role == UserRole.PATIENT and appt.patient_id == user.id:
        return
    if user.role == UserRole.DOCTOR and appt.doctor.user_id == user.id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not authorised to access this appointment",
    )
