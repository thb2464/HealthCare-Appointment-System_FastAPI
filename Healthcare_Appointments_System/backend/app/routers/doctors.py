"""
Doctors router — public search, profile management, specialties, availability.

Availability logic (formerly AvailabilityService) is co-located here in the monolith.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import CurrentDoctor, CurrentAdmin, CurrentUser, DBSession
from app.models.doctor import Doctor
from app.models.specialty import Specialty
from app.models.availability import Availability
from app.models.appointment import Appointment, AppointmentStatus
from app.models.user import UserRole
from app.schemas.doctor import (
    DoctorResponse,
    DoctorListItem,
    DoctorProfileUpdate,
    SpecialtyCreate,
    SpecialtyUpdate,
    SpecialtyResponse,
    AvailabilityResponse,
    AvailabilityBulkSet,
)
from app.schemas import MessageResponse

router = APIRouter(prefix="/api/doctors", tags=["Doctors"])
specialty_router = APIRouter(prefix="/api/specialties", tags=["Specialties"])


# ══════════════════════════════════════════════════════════════════════════════
# Availability helpers (inlined from AvailabilityService)
# ══════════════════════════════════════════════════════════════════════════════

async def _get_windows(db: AsyncSession, doctor_id: int, weekday: int) -> list[Availability]:
    result = await db.execute(
        select(Availability).where(
            Availability.doctor_id == doctor_id,
            Availability.day_of_week == weekday,
            Availability.is_active == True,  # noqa: E712
        )
    )
    return list(result.scalars().all())


def _expand_windows(windows: list[Availability], target_date: date) -> list[datetime]:
    """Expand availability windows into individual slot datetimes (UTC)."""
    slots: list[datetime] = []
    for w in windows:
        current = datetime.combine(target_date, w.start_time, tzinfo=timezone.utc)
        end = datetime.combine(target_date, w.end_time, tzinfo=timezone.utc)
        delta = timedelta(minutes=w.slot_duration_minutes)
        while current + delta <= end:
            slots.append(current)
            current += delta
    return sorted(set(slots))


async def _get_booked_slots(db: AsyncSession, doctor_id: int, target_date: date) -> set[datetime]:
    day_start = datetime.combine(target_date, time.min, tzinfo=timezone.utc)
    day_end   = datetime.combine(target_date, time.max, tzinfo=timezone.utc)
    result = await db.execute(
        select(Appointment.scheduled_at).where(
            Appointment.doctor_id == doctor_id,
            Appointment.scheduled_at >= day_start,
            Appointment.scheduled_at <= day_end,
            Appointment.status.notin_([AppointmentStatus.CANCELLED, AppointmentStatus.NOSHOW]),
        )
    )
    return {row.replace(second=0, microsecond=0) for row in result.scalars().all()}


async def get_open_slots(
    *, db: AsyncSession, doctor_id: int, target_date: date
) -> list[datetime]:
    windows = await _get_windows(db, doctor_id, target_date.weekday())
    if not windows:
        return []
    all_slots = _expand_windows(windows, target_date)
    booked = await _get_booked_slots(db, doctor_id, target_date)
    return [s for s in all_slots if s not in booked]


async def is_slot_available(
    *, db: AsyncSession, doctor_id: int, scheduled_at: datetime
) -> bool:
    utc_dt = scheduled_at.astimezone(timezone.utc)
    slot_time = utc_dt.time().replace(second=0, microsecond=0)
    windows = await _get_windows(db, doctor_id, utc_dt.weekday())
    if not windows or not any(w.start_time <= slot_time < w.end_time for w in windows):
        return False
    booked = await _get_booked_slots(db, doctor_id, utc_dt.date())
    return utc_dt.replace(second=0, microsecond=0) not in booked


# ══════════════════════════════════════════════════════════════════════════════
# SPECIALTIES
# ══════════════════════════════════════════════════════════════════════════════

@specialty_router.get(
    "",
    response_model=list[SpecialtyResponse],
    summary="List all medical specialties",
)
async def list_specialties(db: DBSession) -> list[Specialty]:
    result = await db.execute(select(Specialty).order_by(Specialty.name))
    return list(result.scalars().all())


@specialty_router.post(
    "",
    response_model=SpecialtyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a specialty (admin only)",
)
async def create_specialty(
    payload: SpecialtyCreate,
    _: CurrentAdmin,
    db: DBSession,
) -> Specialty:
    existing = await db.execute(select(Specialty).where(Specialty.name == payload.name))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Specialty already exists",
        )
    spec = Specialty(**payload.model_dump())
    db.add(spec)
    await db.flush()
    await db.refresh(spec)
    return spec


@specialty_router.patch(
    "/{specialty_id}",
    response_model=SpecialtyResponse,
    summary="Update a specialty (admin only)",
)
async def update_specialty(
    specialty_id: int,
    payload: SpecialtyUpdate,
    _: CurrentAdmin,
    db: DBSession,
) -> Specialty:
    result = await db.execute(select(Specialty).where(Specialty.id == specialty_id))
    spec = result.scalar_one_or_none()
    if not spec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Specialty not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(spec, field, value)
    await db.flush()
    await db.refresh(spec)
    return spec


@specialty_router.delete(
    "/{specialty_id}",
    response_model=MessageResponse,
    summary="Delete a specialty (admin only)",
)
async def delete_specialty(
    specialty_id: int,
    _: CurrentAdmin,
    db: DBSession,
) -> MessageResponse:
    result = await db.execute(select(Specialty).where(Specialty.id == specialty_id))
    spec = result.scalar_one_or_none()
    if not spec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Specialty not found")
    await db.delete(spec)
    return MessageResponse(message="Specialty deleted")


# ══════════════════════════════════════════════════════════════════════════════
# DOCTORS — public search & profile
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "",
    response_model=list[DoctorListItem],
    summary="Search / list doctors (public)",
)
async def list_doctors(
    db: DBSession,
    specialty_id: int | None = Query(default=None),
    name: str | None = Query(default=None, description="Partial name search"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> list[Doctor]:
    from app.models.user import User

    stmt = (
        select(Doctor)
        .join(Doctor.user)
        .options(selectinload(Doctor.user), selectinload(Doctor.specialty))
        .where(User.is_active == True)  # noqa: E712
    )
    if specialty_id:
        stmt = stmt.where(Doctor.specialty_id == specialty_id)
    if name:
        stmt = stmt.where(func.lower(User.full_name).contains(name.lower()))
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get(
    "/me",
    response_model=DoctorResponse,
    summary="Get current doctor's profile",
)
async def get_my_doctor_profile(
    current_user: CurrentDoctor,
    db: DBSession,
) -> Doctor:
    result = await db.execute(
        select(Doctor)
        .options(selectinload(Doctor.user), selectinload(Doctor.specialty))
        .where(Doctor.user_id == current_user.id)
    )
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")
    return doctor


@router.patch(
    "/me",
    response_model=DoctorResponse,
    summary="Update current doctor's profile",
)
async def update_my_doctor_profile(
    payload: DoctorProfileUpdate,
    current_user: CurrentDoctor,
    db: DBSession,
) -> Doctor:
    result = await db.execute(
        select(Doctor)
        .options(selectinload(Doctor.user), selectinload(Doctor.specialty))
        .where(Doctor.user_id == current_user.id)
    )
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(doctor, field, value)
    await db.flush()
    await db.refresh(doctor)
    return doctor


@router.get(
    "/{doctor_id}",
    response_model=DoctorResponse,
    summary="Get a doctor's public profile (public)",
)
async def get_doctor(doctor_id: int, db: DBSession) -> Doctor:
    result = await db.execute(
        select(Doctor)
        .options(selectinload(Doctor.user), selectinload(Doctor.specialty))
        .where(Doctor.id == doctor_id)
    )
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")
    return doctor


# ══════════════════════════════════════════════════════════════════════════════
# AVAILABILITY
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/{doctor_id}/slots",
    response_model=list[str],
    summary="Get open bookable slots for a doctor on a specific date (public)",
)
async def get_open_slots_route(
    doctor_id: int,
    db: DBSession,
    date: date = Query(..., description="Date to query, e.g. 2026-05-01"),
) -> list[str]:
    """Returns a list of available ISO-8601 UTC datetimes the patient can book."""
    slots = await get_open_slots(db=db, doctor_id=doctor_id, target_date=date)
    return [s.isoformat() for s in slots]


@router.get(
    "/{doctor_id}/availability",
    response_model=list[AvailabilityResponse],
    summary="Get a doctor's weekly availability slots (public)",
)
async def get_doctor_availability(doctor_id: int, db: DBSession) -> list[Availability]:
    result = await db.execute(
        select(Availability)
        .where(Availability.doctor_id == doctor_id, Availability.is_active == True)  # noqa: E712
        .order_by(Availability.day_of_week, Availability.start_time)
    )
    return list(result.scalars().all())


@router.put(
    "/me/availability",
    response_model=list[AvailabilityResponse],
    summary="Replace all availability slots (doctor only)",
)
async def set_my_availability(
    payload: AvailabilityBulkSet,
    current_user: CurrentDoctor,
    db: DBSession,
) -> list[Availability]:
    result = await db.execute(
        select(Doctor).where(Doctor.user_id == current_user.id)
    )
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")

    # Delete existing slots
    existing = await db.execute(
        select(Availability).where(Availability.doctor_id == doctor.id)
    )
    for slot in existing.scalars().all():
        await db.delete(slot)
    await db.flush()

    # Insert new slots
    new_slots: list[Availability] = []
    for slot_data in payload.slots:
        slot = Availability(doctor_id=doctor.id, **slot_data.model_dump())
        db.add(slot)
        new_slots.append(slot)
    await db.flush()
    for slot in new_slots:
        await db.refresh(slot)
    return new_slots
