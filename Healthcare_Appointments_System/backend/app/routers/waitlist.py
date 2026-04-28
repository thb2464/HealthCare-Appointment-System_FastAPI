"""
Waitlist router — patients can join/leave a waitlist for a doctor.
When a confirmed appointment is cancelled or no-showed, the oldest waitlist
entry for that doctor is automatically notified (see appointments router).
"""
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.dependencies import CurrentPatient, DBSession
from app.models.doctor import Doctor
from app.models.waitlist import WaitlistEntry
from app.routers.appointments import _get_active_doctor
from app.schemas.waitlist import WaitlistCreate, WaitlistResponse

router = APIRouter(prefix="/api/waitlist", tags=["Waitlist"])

_LOAD = [
    selectinload(WaitlistEntry.doctor).selectinload(Doctor.user),
    selectinload(WaitlistEntry.doctor).selectinload(Doctor.specialty),
]


@router.post(
    "",
    response_model=WaitlistResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Join the waitlist for a doctor (patient only)",
)
async def join_waitlist(
    payload: WaitlistCreate,
    current_user: CurrentPatient,
    db: DBSession,
) -> WaitlistEntry:
    await _get_active_doctor(db, payload.doctor_id)

    entry = WaitlistEntry(patient_id=current_user.id, doctor_id=payload.doctor_id)
    db.add(entry)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already on the waitlist for this doctor",
        )

    result = await db.execute(
        select(WaitlistEntry).options(*_LOAD).where(WaitlistEntry.id == entry.id)
    )
    return result.scalar_one()


@router.get(
    "",
    response_model=list[WaitlistResponse],
    summary="List your waitlist entries (patient only)",
)
async def list_my_waitlist(
    current_user: CurrentPatient,
    db: DBSession,
) -> list[WaitlistEntry]:
    result = await db.execute(
        select(WaitlistEntry)
        .options(*_LOAD)
        .where(WaitlistEntry.patient_id == current_user.id)
        .order_by(WaitlistEntry.created_at.desc())
    )
    return list(result.scalars().all())


@router.delete(
    "/{doctor_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Leave the waitlist for a doctor (patient only)",
)
async def leave_waitlist(
    doctor_id: int,
    current_user: CurrentPatient,
    db: DBSession,
) -> None:
    result = await db.execute(
        select(WaitlistEntry).where(
            WaitlistEntry.patient_id == current_user.id,
            WaitlistEntry.doctor_id == doctor_id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not on the waitlist for this doctor",
        )
    await db.delete(entry)
    await db.flush()
