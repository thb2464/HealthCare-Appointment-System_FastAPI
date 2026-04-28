"""
VNPay payment router.

Flow:
  1. POST /api/payment/vnpay/create
       - Validates the patient & appointment slot
       - Books the appointment (status=PENDING)
       - Returns a VNPay redirect URL
  2. GET  /api/payment/vnpay/return
       - VNPay redirects the browser here after payment
       - Verifies HMAC-SHA512 signature
       - On success: deposit_paid=True, status=CONFIRMED
       - Redirects browser to /dashboard
"""
from __future__ import annotations

import hashlib
import hmac
import urllib.parse
from datetime import datetime, timezone

import logging

from fastapi import APIRouter, HTTPException, Request, status  # noqa: F401
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import settings

logger = logging.getLogger(__name__)
from app.dependencies import CurrentPatient, DBSession
from app.models.appointment import Appointment, AppointmentStatus
from app.models.doctor import Doctor
from app.routers.appointments import _book, _LOAD, _auto_noshow_conflicts
from app.utils.email import send_appointment_confirmed_by_doctor
import asyncio

router = APIRouter(prefix="/api/payment", tags=["Payment"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class VNPayCreateRequest(BaseModel):
    doctor_id: int
    scheduled_at: datetime
    reason: str | None = None


class VNPayCreateResponse(BaseModel):
    payment_url: str
    appointment_id: int


# ── VNPay helpers ──────────────────────────────────────────────────────────────

def _vnpay_sign(params: dict[str, str], secret: str) -> str:
    """
    Build HMAC-SHA512 over the sorted, urllib.parse.quote_plus-encoded query string.
    VNPay signs the encoded form, e.g. vnp_OrderInfo=Dat+lich+kham...
    """
    sorted_params = sorted(params.items())
    query_string = "&".join(
        f"{k}={urllib.parse.quote_plus(v)}" for k, v in sorted_params
    )
    return hmac.new(
        secret.encode("utf-8"),
        query_string.encode("utf-8"),
        hashlib.sha512,
    ).hexdigest()


def _build_vnpay_url(
    amount_vnd: int,
    appointment_id: int,
    order_desc: str,
    client_ip: str,
) -> str:
    """Construct the VNPay payment redirect URL."""
    from datetime import timedelta, timezone as _tz
    vn_tz = _tz(timedelta(hours=7))
    now = datetime.now(vn_tz)
    create_date = now.strftime("%Y%m%d%H%M%S")
    expire_date = (now + timedelta(minutes=15)).strftime("%Y%m%d%H%M%S")

    params: dict[str, str] = {
        "vnp_Version": "2.1.0",
        "vnp_Command": "pay",
        "vnp_TmnCode": settings.VNPAY_TMN_CODE,
        "vnp_Amount": str(amount_vnd * 100),   # VNPay requires amount × 100
        "vnp_CurrCode": "VND",
        "vnp_TxnRef": str(appointment_id),
        "vnp_OrderInfo": order_desc,
        "vnp_OrderType": "other",
        "vnp_Locale": "vn",
        "vnp_ReturnUrl": settings.VNPAY_RETURN_URL,
        "vnp_IpAddr": client_ip,
        "vnp_CreateDate": create_date,
        "vnp_ExpireDate": expire_date,
    }

    signature = _vnpay_sign(params, settings.VNPAY_HASH_SECRET)

    # Build the final URL using the same quote_plus encoding used during signing,
    # then append the secure hash (which must NOT be included in the signed string).
    sorted_params = sorted(params.items())
    query = "&".join(
        f"{k}={urllib.parse.quote_plus(v)}" for k, v in sorted_params
    )
    query += f"&vnp_SecureHash={signature}"
    return f"{settings.VNPAY_URL}?{query}"


def _verify_vnpay_return(params: dict[str, str]) -> bool:
    """
    Verify the HMAC-SHA512 signature on the return URL params.

    FastAPI's request.query_params gives us already-decoded values (e.g. spaces,
    not plus signs). _vnpay_sign re-encodes them with quote_plus before hashing,
    which matches how VNPay built the signature on their side.
    """
    received_sig = params.pop("vnp_SecureHash", None)
    params.pop("vnp_SecureHashType", None)
    if not received_sig:
        return False
    expected_sig = _vnpay_sign(params, settings.VNPAY_HASH_SECRET)
    logger.info("VNPay sig check — received: %s, expected: %s", received_sig.lower(), expected_sig.lower())
    return hmac.compare_digest(received_sig.lower(), expected_sig.lower())


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post(
    "/vnpay/create",
    response_model=VNPayCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create VNPay payment URL and book appointment (patient only)",
)
async def create_vnpay_payment(
    payload: VNPayCreateRequest,
    current_user: CurrentPatient,
    db: DBSession,
) -> VNPayCreateResponse:
    if not settings.VNPAY_TMN_CODE or not settings.VNPAY_HASH_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment gateway is not configured. Contact support.",
        )

    # Book the appointment (status=PENDING); raises HTTP 4xx on any violation
    appt = await _book(
        db=db,
        patient_id=current_user.id,
        doctor_id=payload.doctor_id,
        scheduled_at=payload.scheduled_at,
        reason=payload.reason,
    )

    # Reload with relationships to read the fee
    result = await db.execute(
        select(Appointment).options(*_LOAD).where(Appointment.id == appt.id)
    )
    appt = result.scalar_one()
    await db.commit()

    fee_vnd = int(appt.doctor.consultation_fee or 0)
    if fee_vnd <= 0:
        fee_vnd = 50_000  # fallback: 50 000 VND deposit

    doctor_name = appt.doctor.user.full_name if appt.doctor and appt.doctor.user else "Doctor"
    order_desc = f"Dat lich kham BS {doctor_name} - Appt#{appt.id}"

    payment_url = _build_vnpay_url(
        amount_vnd=fee_vnd,
        appointment_id=appt.id,
        order_desc=order_desc,
        client_ip="127.0.0.1",     # VNPay sandbox accepts any IP
    )

    return VNPayCreateResponse(payment_url=payment_url, appointment_id=appt.id)


@router.post(
    "/vnpay/retry/{appointment_id}",
    response_model=VNPayCreateResponse,
    summary="Generate a new VNPay URL for an existing unpaid PENDING appointment",
)
async def retry_vnpay_payment(
    appointment_id: int,
    current_user: CurrentPatient,
    db: DBSession,
) -> VNPayCreateResponse:
    if not settings.VNPAY_TMN_CODE or not settings.VNPAY_HASH_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment gateway is not configured. Contact support.",
        )

    result = await db.execute(
        select(Appointment).options(*_LOAD).where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()

    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appt.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your appointment")
    if appt.status != AppointmentStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only PENDING appointments can be paid")
    if appt.deposit_paid:
        raise HTTPException(status_code=400, detail="Appointment is already paid")

    fee_vnd = int(appt.doctor.consultation_fee or 0)
    if fee_vnd <= 0:
        fee_vnd = 50_000

    doctor_name = appt.doctor.user.full_name if appt.doctor and appt.doctor.user else "Doctor"
    order_desc = f"Dat lich kham BS {doctor_name} - Appt#{appt.id}"

    payment_url = _build_vnpay_url(
        amount_vnd=fee_vnd,
        appointment_id=appt.id,
        order_desc=order_desc,
        client_ip="127.0.0.1",
    )

    return VNPayCreateResponse(payment_url=payment_url, appointment_id=appt.id)


@router.get(
    "/vnpay/return",
    summary="VNPay return URL — verify payment and confirm appointment",
    include_in_schema=False,  # internal redirect target, not a public API contract
)
async def vnpay_return(
    request: Request,
    db: DBSession,
) -> RedirectResponse:
    """
    VNPay redirects here after the user completes (or cancels) payment.
    We verify the HMAC, then:
      - 00 (success)  → deposit_paid=True, status=CONFIRMED → redirect /dashboard?payment=success
      - anything else → redirect /dashboard?payment=failed
    """

    frontend_base = settings.VNPAY_RETURN_URL.rsplit("/api/", 1)[0]
    success_url = f"{frontend_base}/dashboard?payment=success"
    failed_url = f"{frontend_base}/dashboard?payment=failed"

    # Collect all query params as a plain dict for HMAC verification
    raw_params: dict[str, str] = dict(request.query_params)
    logger.info("VNPay return params: %s", raw_params)

    vnp_response_code = raw_params.get("vnp_ResponseCode", "")
    vnp_txn_status = raw_params.get("vnp_TransactionStatus", "")
    vnp_txn_ref = raw_params.get("vnp_TxnRef", "")
    vnp_bank_tran_no = raw_params.get("vnp_BankTranNo", "")

    # ── Parse appointment id ────────────────────────────────────────────────
    try:
        appointment_id = int(vnp_txn_ref)
    except (ValueError, TypeError):
        return RedirectResponse(url=failed_url, status_code=302)

    # ── Fetch appointment ───────────────────────────────────────────────────
    result = await db.execute(
        select(Appointment).options(*_LOAD).where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        return RedirectResponse(url=failed_url, status_code=302)

    # ── Verify HMAC signature (skip if secret not configured) ──────────────
    if settings.VNPAY_HASH_SECRET:
        params_copy = dict(raw_params)
        if not _verify_vnpay_return(params_copy):
            return RedirectResponse(url=failed_url, status_code=302)

    # ── Check payment result ────────────────────────────────────────────────
    payment_success = (
        vnp_response_code == "00" and vnp_txn_status == "00"
    )

    if not payment_success:
        return RedirectResponse(url=failed_url, status_code=302)

    # ── Confirm appointment ─────────────────────────────────────────────────
    if appt.status == AppointmentStatus.PENDING:
        appt.deposit_paid = True
        appt.vnpay_txn_ref = vnp_bank_tran_no or vnp_txn_ref
        appt.status = AppointmentStatus.CONFIRMED
        await _auto_noshow_conflicts(db, appt.doctor_id, appt.scheduled_at, appt.id)
        await db.flush()
        await db.commit()

        doctor_name = appt.doctor.user.full_name if appt.doctor and appt.doctor.user else "your doctor"
        asyncio.create_task(
            send_appointment_confirmed_by_doctor(
                to_email=appt.patient.email,
                patient_name=appt.patient.full_name,
                scheduled_at=appt.scheduled_at.isoformat(),
                doctor_name=doctor_name,
            )
        )

    return RedirectResponse(url=success_url, status_code=302)
