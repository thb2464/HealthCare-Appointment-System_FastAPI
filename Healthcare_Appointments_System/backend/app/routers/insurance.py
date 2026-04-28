"""
Insurance router — coverage management and claims processing.
Patients manage their insurance coverage; claims are submitted after visits
and processed by admins.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.dependencies import CurrentAdmin, CurrentPatient, CurrentUser, DBSession
from app.models.appointment import Appointment, AppointmentStatus
from app.models.doctor import Doctor
from app.models.insurance import ClaimStatus, InsuranceClaim, InsuranceCoverage
from app.models.user import UserRole
from app.schemas.insurance import (
    InsuranceClaimCreate,
    InsuranceClaimResponse,
    InsuranceClaimUpdate,
    InsuranceCoverageCreate,
    InsuranceCoverageResponse,
)

router = APIRouter(prefix="/api/insurance", tags=["Insurance"])


# ══════════════════════════════════════════════════════════════════════════════
# Coverage management (patient)
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/coverage",
    response_model=InsuranceCoverageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add insurance coverage (patient only)",
)
async def add_coverage(
    payload: InsuranceCoverageCreate,
    current_user: CurrentPatient,
    db: DBSession,
) -> InsuranceCoverage:
    cov = InsuranceCoverage(patient_id=current_user.id, **payload.model_dump())
    db.add(cov)
    await db.flush()
    await db.refresh(cov)
    return cov


@router.get(
    "/coverage",
    response_model=list[InsuranceCoverageResponse],
    summary="List your insurance coverages (patient only)",
)
async def list_my_coverage(
    current_user: CurrentPatient,
    db: DBSession,
) -> list[InsuranceCoverage]:
    result = await db.execute(
        select(InsuranceCoverage)
        .where(InsuranceCoverage.patient_id == current_user.id)
        .order_by(InsuranceCoverage.coverage_end.desc())
    )
    return list(result.scalars().all())


@router.delete(
    "/coverage/{coverage_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove insurance coverage (patient only)",
)
async def remove_coverage(
    coverage_id: int,
    current_user: CurrentPatient,
    db: DBSession,
) -> None:
    result = await db.execute(
        select(InsuranceCoverage).where(
            InsuranceCoverage.id == coverage_id,
            InsuranceCoverage.patient_id == current_user.id,
        )
    )
    cov = result.scalar_one_or_none()
    if not cov:
        raise HTTPException(status_code=404, detail="Coverage not found")
    await db.delete(cov)
    await db.flush()


# ══════════════════════════════════════════════════════════════════════════════
# Claims (patient submits, admin processes)
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/claims/{appointment_id}",
    response_model=InsuranceClaimResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an insurance claim for a completed appointment",
)
async def submit_claim(
    appointment_id: int,
    payload: InsuranceClaimCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> InsuranceClaim:
    # Fetch appointment
    appt_result = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.doctor))
        .where(Appointment.id == appointment_id)
    )
    appt = appt_result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Access check: patient (own appointment) or admin
    if current_user.role == UserRole.PATIENT and appt.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your appointment")
    elif current_user.role not in (UserRole.PATIENT, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Only patients or admins can submit claims")

    if appt.status != AppointmentStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Claims can only be submitted for COMPLETED appointments")

    # Check coverage exists and belongs to the patient
    cov_result = await db.execute(
        select(InsuranceCoverage).where(
            InsuranceCoverage.id == payload.coverage_id,
            InsuranceCoverage.patient_id == appt.patient_id,
            InsuranceCoverage.is_active == True,  # noqa: E712
        )
    )
    cov = cov_result.scalar_one_or_none()
    if not cov:
        raise HTTPException(status_code=404, detail="Active insurance coverage not found")

    # Check no existing claim
    existing = await db.execute(
        select(InsuranceClaim).where(InsuranceClaim.appointment_id == appointment_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A claim already exists for this appointment")

    # Calculate amounts
    total = float(appt.doctor.consultation_fee or 0)
    copay_pct = float(cov.copay_percentage) / 100
    patient_pays = round(total * copay_pct, 2)
    insurer_covers = round(total - patient_pays, 2)

    claim = InsuranceClaim(
        appointment_id=appointment_id,
        coverage_id=payload.coverage_id,
        total_amount=total,
        covered_amount=insurer_covers,
        patient_responsibility=patient_pays,
        status=ClaimStatus.SUBMITTED,
    )
    db.add(claim)
    await db.flush()
    await db.refresh(claim)
    return claim


@router.get(
    "/claims",
    response_model=list[InsuranceClaimResponse],
    summary="List insurance claims (patient sees own, admin sees all)",
)
async def list_claims(
    current_user: CurrentUser,
    db: DBSession,
    claim_status: ClaimStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> list[InsuranceClaim]:
    stmt = select(InsuranceClaim)

    if current_user.role == UserRole.PATIENT:
        # Only show claims for the patient's appointments
        stmt = stmt.join(Appointment).where(Appointment.patient_id == current_user.id)
    elif current_user.role not in (UserRole.ADMIN, UserRole.RECEPTIONIST):
        raise HTTPException(status_code=403, detail="Not authorised to view claims")

    if claim_status:
        stmt = stmt.where(InsuranceClaim.status == claim_status)

    stmt = (
        stmt.order_by(InsuranceClaim.submitted_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.patch(
    "/claims/{claim_id}",
    response_model=InsuranceClaimResponse,
    summary="Process an insurance claim (admin only — approve/deny)",
)
async def process_claim(
    claim_id: int,
    payload: InsuranceClaimUpdate,
    _: CurrentAdmin,
    db: DBSession,
) -> InsuranceClaim:
    result = await db.execute(
        select(InsuranceClaim).where(InsuranceClaim.id == claim_id)
    )
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if claim.status not in (ClaimStatus.PENDING, ClaimStatus.SUBMITTED):
        raise HTTPException(status_code=400, detail=f"Cannot process a {claim.status.value} claim")

    claim.status = payload.status
    if payload.denial_reason:
        claim.denial_reason = payload.denial_reason
    if payload.status in (ClaimStatus.APPROVED, ClaimStatus.DENIED):
        claim.processed_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(claim)
    return claim
