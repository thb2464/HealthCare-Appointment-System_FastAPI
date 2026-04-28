"""
Encounters router — EHR: clinical encounters, prescriptions, lab results.
An Encounter is auto-created when a patient arrives (ARRIVED status).
Doctors can update the encounter with diagnosis, vitals, prescriptions, and lab orders.
Patients can read their own encounter records (EHR access).
"""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.dependencies import CurrentUser, DBSession
from app.models.appointment import Appointment, AppointmentStatus
from app.models.doctor import Doctor
from app.models.encounter import Encounter, LabResult, LabResultStatus, Prescription
from app.models.user import UserRole
from app.schemas.encounter import (
    EncounterResponse,
    EncounterUpdate,
    LabResultCreate,
    LabResultResponse,
    LabResultUpdate,
    PrescriptionCreate,
    PrescriptionResponse,
)

router = APIRouter(prefix="/api/encounters", tags=["Encounters / EHR"])

_ENC_LOAD = [
    selectinload(Encounter.prescriptions),
    selectinload(Encounter.lab_results),
]


async def _get_encounter_or_404(db, appointment_id: int) -> Encounter:
    result = await db.execute(
        select(Encounter)
        .options(*_ENC_LOAD)
        .where(Encounter.appointment_id == appointment_id)
    )
    enc = result.scalar_one_or_none()
    if not enc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Encounter not found for this appointment")
    return enc


def _assert_encounter_access(user, encounter: Encounter) -> None:
    if user.role in (UserRole.ADMIN, UserRole.RECEPTIONIST):
        return
    if user.role == UserRole.PATIENT and encounter.patient_id == user.id:
        return
    if user.role == UserRole.DOCTOR and encounter.doctor_id == _get_doctor_id_sync(user):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorised")


def _get_doctor_id_sync(user) -> int | None:
    """Get doctor profile id from user (relationship should be loaded)."""
    if hasattr(user, "doctor_profile") and user.doctor_profile:
        return user.doctor_profile.id
    return None


async def _get_doctor_id(db, user) -> int | None:
    result = await db.execute(select(Doctor.id).where(Doctor.user_id == user.id))
    return result.scalar_one_or_none()


async def create_encounter_for_appointment(db, appointment: Appointment) -> Encounter:
    """Create an Encounter when a patient arrives. Called from appointments router."""
    existing = await db.execute(
        select(Encounter).where(Encounter.appointment_id == appointment.id)
    )
    if existing.scalar_one_or_none():
        return existing.scalar_one_or_none()

    enc = Encounter(
        appointment_id=appointment.id,
        doctor_id=appointment.doctor_id,
        patient_id=appointment.patient_id,
    )
    db.add(enc)
    await db.flush()
    return enc


# ── Encounter CRUD ────────────────────────────────────────────────────────────

@router.get(
    "/{appointment_id}",
    response_model=EncounterResponse,
    summary="Get encounter record for an appointment (doctor/patient/admin)",
)
async def get_encounter(
    appointment_id: int,
    current_user: CurrentUser,
    db: DBSession,
) -> Encounter:
    enc = await _get_encounter_or_404(db, appointment_id)
    doctor_id = await _get_doctor_id(db, current_user)
    if current_user.role in (UserRole.ADMIN, UserRole.RECEPTIONIST):
        pass
    elif current_user.role == UserRole.PATIENT and enc.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorised")
    elif current_user.role == UserRole.DOCTOR and enc.doctor_id != doctor_id:
        raise HTTPException(status_code=403, detail="Not authorised")
    return enc


@router.patch(
    "/{appointment_id}",
    response_model=EncounterResponse,
    summary="Update encounter (doctor/admin only — diagnosis, vitals, notes)",
)
async def update_encounter(
    appointment_id: int,
    payload: EncounterUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> Encounter:
    if current_user.role not in (UserRole.DOCTOR, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Only doctors or admins can update encounters")

    enc = await _get_encounter_or_404(db, appointment_id)

    if current_user.role == UserRole.DOCTOR:
        doctor_id = await _get_doctor_id(db, current_user)
        if enc.doctor_id != doctor_id:
            raise HTTPException(status_code=403, detail="Not your encounter")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(enc, field, value)
    await db.flush()
    await db.refresh(enc)
    # Re-load with relationships
    return await _get_encounter_or_404(db, appointment_id)


# ── Prescriptions ─────────────────────────────────────────────────────────────

@router.post(
    "/{appointment_id}/prescriptions",
    response_model=PrescriptionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a prescription to an encounter (doctor/admin only)",
)
async def add_prescription(
    appointment_id: int,
    payload: PrescriptionCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> Prescription:
    if current_user.role not in (UserRole.DOCTOR, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Only doctors can add prescriptions")

    enc = await _get_encounter_or_404(db, appointment_id)
    if current_user.role == UserRole.DOCTOR:
        doctor_id = await _get_doctor_id(db, current_user)
        if enc.doctor_id != doctor_id:
            raise HTTPException(status_code=403, detail="Not your encounter")

    rx = Prescription(encounter_id=enc.id, **payload.model_dump())
    db.add(rx)
    await db.flush()
    await db.refresh(rx)
    return rx


@router.get(
    "/{appointment_id}/prescriptions",
    response_model=list[PrescriptionResponse],
    summary="List prescriptions for an encounter",
)
async def list_prescriptions(
    appointment_id: int,
    current_user: CurrentUser,
    db: DBSession,
) -> list[Prescription]:
    enc = await _get_encounter_or_404(db, appointment_id)
    doctor_id = await _get_doctor_id(db, current_user)
    if current_user.role == UserRole.PATIENT and enc.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorised")
    if current_user.role == UserRole.DOCTOR and enc.doctor_id != doctor_id:
        raise HTTPException(status_code=403, detail="Not authorised")
    return enc.prescriptions


# ── Lab Results ───────────────────────────────────────────────────────────────

@router.post(
    "/{appointment_id}/lab-results",
    response_model=LabResultResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Order a lab test (doctor/admin only)",
)
async def order_lab_test(
    appointment_id: int,
    payload: LabResultCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> LabResult:
    if current_user.role not in (UserRole.DOCTOR, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Only doctors can order lab tests")

    enc = await _get_encounter_or_404(db, appointment_id)
    if current_user.role == UserRole.DOCTOR:
        doctor_id = await _get_doctor_id(db, current_user)
        if enc.doctor_id != doctor_id:
            raise HTTPException(status_code=403, detail="Not your encounter")

    lab = LabResult(encounter_id=enc.id, **payload.model_dump())
    db.add(lab)
    await db.flush()
    await db.refresh(lab)
    return lab


@router.patch(
    "/{appointment_id}/lab-results/{lab_result_id}",
    response_model=LabResultResponse,
    summary="Update a lab result (doctor/admin only)",
)
async def update_lab_result(
    appointment_id: int,
    lab_result_id: int,
    payload: LabResultUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> LabResult:
    if current_user.role not in (UserRole.DOCTOR, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Only doctors can update lab results")

    enc = await _get_encounter_or_404(db, appointment_id)
    if current_user.role == UserRole.DOCTOR:
        doctor_id = await _get_doctor_id(db, current_user)
        if enc.doctor_id != doctor_id:
            raise HTTPException(status_code=403, detail="Not your encounter")

    result = await db.execute(
        select(LabResult).where(LabResult.id == lab_result_id, LabResult.encounter_id == enc.id)
    )
    lab = result.scalar_one_or_none()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab result not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(lab, field, value)
    if payload.status == LabResultStatus.COMPLETED and not lab.completed_at:
        lab.completed_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(lab)
    return lab


@router.get(
    "/{appointment_id}/lab-results",
    response_model=list[LabResultResponse],
    summary="List lab results for an encounter",
)
async def list_lab_results(
    appointment_id: int,
    current_user: CurrentUser,
    db: DBSession,
) -> list[LabResult]:
    enc = await _get_encounter_or_404(db, appointment_id)
    doctor_id = await _get_doctor_id(db, current_user)
    if current_user.role == UserRole.PATIENT and enc.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorised")
    if current_user.role == UserRole.DOCTOR and enc.doctor_id != doctor_id:
        raise HTTPException(status_code=403, detail="Not authorised")
    return enc.lab_results
