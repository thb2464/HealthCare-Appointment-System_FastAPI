"""
test_appointments.py — Appointment lifecycle tests.

Covers: booking, past-time rejection, slot-unavailable rejection, double-book
conflict, listing, status transitions, reschedule, cancel, access control.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest
from httpx import AsyncClient


# ── Helpers ────────────────────────────────────────────────────────────────────

def next_weekday_dt(weekday: int, hour: int = 9, minute: int = 0) -> str:
    """Return ISO-8601 UTC string for the next occurrence of *weekday* (0=Mon)."""
    today = date.today()
    days_ahead = (weekday - today.weekday()) % 7 or 7
    target = today + timedelta(days=days_ahead)
    dt = datetime(target.year, target.month, target.day, hour, minute, tzinfo=timezone.utc)
    return dt.isoformat()


MONDAY_SLOT = next_weekday_dt(0, 9, 0)
MONDAY_SLOT_2 = next_weekday_dt(0, 9, 30)
WEDNESDAY_SLOT = next_weekday_dt(2, 13, 0)

AVAILABILITY_PAYLOAD = {
    "slots": [
        {
            "day_of_week": 0,
            "start_time": "08:00:00",
            "end_time": "17:00:00",
            "slot_duration_minutes": 30,
            "is_active": True,
        },
        {
            "day_of_week": 2,
            "start_time": "08:00:00",
            "end_time": "17:00:00",
            "slot_duration_minutes": 30,
            "is_active": True,
        },
    ]
}


@pytest.fixture
async def doctor_with_availability(
    client: AsyncClient, doctor_headers: dict, doctor_id: int
):
    """Set up Monday + Wednesday availability for the fixture doctor."""
    await client.put(
        "/api/doctors/me/availability",
        json=AVAILABILITY_PAYLOAD,
        headers=doctor_headers,
    )
    return doctor_id


# ── Book appointment ───────────────────────────────────────────────────────────

async def test_book_appointment_success(
    client: AsyncClient,
    patient_headers: dict,
    doctor_with_availability: int,
):
    resp = await client.post(
        "/api/appointments",
        json={
            "doctor_id": doctor_with_availability,
            "scheduled_at": MONDAY_SLOT,
            "reason": "Routine check",
        },
        headers=patient_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "PENDING"
    assert body["doctor"]["id"] == doctor_with_availability


async def test_book_appointment_in_past_rejected(
    client: AsyncClient,
    patient_headers: dict,
    doctor_with_availability: int,
):
    past_dt = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    resp = await client.post(
        "/api/appointments",
        json={"doctor_id": doctor_with_availability, "scheduled_at": past_dt},
        headers=patient_headers,
    )
    assert resp.status_code == 400


async def test_book_slot_outside_availability_rejected(
    client: AsyncClient,
    patient_headers: dict,
    doctor_with_availability: int,
):
    # Sunday — no availability set
    sunday_slot = next_weekday_dt(6, 10, 0)
    resp = await client.post(
        "/api/appointments",
        json={"doctor_id": doctor_with_availability, "scheduled_at": sunday_slot},
        headers=patient_headers,
    )
    assert resp.status_code == 409


async def test_double_book_same_slot_returns_409(
    client: AsyncClient,
    patient_headers: dict,
    doctor_with_availability: int,
):
    payload = {"doctor_id": doctor_with_availability, "scheduled_at": MONDAY_SLOT_2}
    resp1 = await client.post("/api/appointments", json=payload, headers=patient_headers)
    assert resp1.status_code == 201

    resp2 = await client.post("/api/appointments", json=payload, headers=patient_headers)
    assert resp2.status_code == 409


async def test_doctor_cannot_book_appointment(
    client: AsyncClient,
    doctor_headers: dict,
    doctor_with_availability: int,
):
    resp = await client.post(
        "/api/appointments",
        json={"doctor_id": doctor_with_availability, "scheduled_at": WEDNESDAY_SLOT},
        headers=doctor_headers,
    )
    assert resp.status_code == 403


# ── List appointments ──────────────────────────────────────────────────────────

async def test_list_appointments_for_patient(
    client: AsyncClient,
    patient_headers: dict,
    doctor_with_availability: int,
):
    await client.post(
        "/api/appointments",
        json={"doctor_id": doctor_with_availability, "scheduled_at": MONDAY_SLOT},
        headers=patient_headers,
    )
    resp = await client.get("/api/appointments", headers=patient_headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


async def test_list_appointments_for_doctor(
    client: AsyncClient,
    patient_headers: dict,
    doctor_headers: dict,
    doctor_with_availability: int,
):
    await client.post(
        "/api/appointments",
        json={"doctor_id": doctor_with_availability, "scheduled_at": MONDAY_SLOT},
        headers=patient_headers,
    )
    resp = await client.get("/api/appointments", headers=doctor_headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


async def test_list_appointments_requires_auth(client: AsyncClient):
    resp = await client.get("/api/appointments")
    assert resp.status_code == 401


# ── Get appointment detail ─────────────────────────────────────────────────────

async def test_get_appointment_detail(
    client: AsyncClient,
    patient_headers: dict,
    doctor_with_availability: int,
):
    create = await client.post(
        "/api/appointments",
        json={"doctor_id": doctor_with_availability, "scheduled_at": MONDAY_SLOT},
        headers=patient_headers,
    )
    appt_id = create.json()["id"]

    resp = await client.get(f"/api/appointments/{appt_id}", headers=patient_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == appt_id


async def test_get_appointment_forbidden_for_other_patient(
    client: AsyncClient,
    patient_headers: dict,
    doctor_with_availability: int,
):
    create = await client.post(
        "/api/appointments",
        json={"doctor_id": doctor_with_availability, "scheduled_at": MONDAY_SLOT},
        headers=patient_headers,
    )
    appt_id = create.json()["id"]

    # Register a second patient
    from tests.conftest import create_user_and_token
    other_headers = await create_user_and_token(
        client, "other@test.com", "Other@123", "Other Patient"
    )
    resp = await client.get(f"/api/appointments/{appt_id}", headers=other_headers)
    assert resp.status_code == 403


# ── Status transitions ─────────────────────────────────────────────────────────

async def test_doctor_confirms_appointment(
    client: AsyncClient,
    patient_headers: dict,
    doctor_headers: dict,
    doctor_with_availability: int,
):
    create = await client.post(
        "/api/appointments",
        json={"doctor_id": doctor_with_availability, "scheduled_at": MONDAY_SLOT},
        headers=patient_headers,
    )
    appt_id = create.json()["id"]

    resp = await client.patch(
        f"/api/appointments/{appt_id}",
        json={"status": "CONFIRMED"},
        headers=doctor_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "CONFIRMED"


async def test_patient_cannot_confirm_appointment(
    client: AsyncClient,
    patient_headers: dict,
    doctor_with_availability: int,
):
    create = await client.post(
        "/api/appointments",
        json={"doctor_id": doctor_with_availability, "scheduled_at": MONDAY_SLOT},
        headers=patient_headers,
    )
    appt_id = create.json()["id"]

    resp = await client.patch(
        f"/api/appointments/{appt_id}",
        json={"status": "CONFIRMED"},
        headers=patient_headers,
    )
    assert resp.status_code == 403


async def test_invalid_status_transition_rejected(
    client: AsyncClient,
    patient_headers: dict,
    doctor_with_availability: int,
):
    create = await client.post(
        "/api/appointments",
        json={"doctor_id": doctor_with_availability, "scheduled_at": MONDAY_SLOT},
        headers=patient_headers,
    )
    appt_id = create.json()["id"]

    # PENDING → COMPLETED is not an allowed transition
    resp = await client.patch(
        f"/api/appointments/{appt_id}",
        json={"status": "COMPLETED"},
        headers=patient_headers,
    )
    assert resp.status_code in (400, 403)


async def test_doctor_marks_appointment_completed(
    client: AsyncClient,
    patient_headers: dict,
    doctor_headers: dict,
    doctor_with_availability: int,
):
    create = await client.post(
        "/api/appointments",
        json={"doctor_id": doctor_with_availability, "scheduled_at": MONDAY_SLOT},
        headers=patient_headers,
    )
    appt_id = create.json()["id"]

    await client.patch(
        f"/api/appointments/{appt_id}",
        json={"status": "CONFIRMED"},
        headers=doctor_headers,
    )
    resp = await client.patch(
        f"/api/appointments/{appt_id}",
        json={"status": "COMPLETED", "notes": "Healthy"},
        headers=doctor_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "COMPLETED"
    assert resp.json()["notes"] == "Healthy"


# ── Reschedule ─────────────────────────────────────────────────────────────────

async def test_reschedule_appointment(
    client: AsyncClient,
    patient_headers: dict,
    doctor_with_availability: int,
):
    create = await client.post(
        "/api/appointments",
        json={"doctor_id": doctor_with_availability, "scheduled_at": MONDAY_SLOT},
        headers=patient_headers,
    )
    appt_id = create.json()["id"]

    resp = await client.patch(
        f"/api/appointments/{appt_id}/reschedule",
        json={"scheduled_at": WEDNESDAY_SLOT},
        headers=patient_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "RESCHEDULED"


async def test_cannot_reschedule_completed_appointment(
    client: AsyncClient,
    patient_headers: dict,
    doctor_headers: dict,
    doctor_with_availability: int,
):
    create = await client.post(
        "/api/appointments",
        json={"doctor_id": doctor_with_availability, "scheduled_at": MONDAY_SLOT},
        headers=patient_headers,
    )
    appt_id = create.json()["id"]

    await client.patch(
        f"/api/appointments/{appt_id}", json={"status": "CONFIRMED"}, headers=doctor_headers
    )
    await client.patch(
        f"/api/appointments/{appt_id}", json={"status": "COMPLETED"}, headers=doctor_headers
    )
    resp = await client.patch(
        f"/api/appointments/{appt_id}/reschedule",
        json={"scheduled_at": WEDNESDAY_SLOT},
        headers=patient_headers,
    )
    assert resp.status_code == 400


# ── Cancel ─────────────────────────────────────────────────────────────────────

async def test_patient_can_cancel_pending_appointment(
    client: AsyncClient,
    patient_headers: dict,
    doctor_with_availability: int,
):
    create = await client.post(
        "/api/appointments",
        json={"doctor_id": doctor_with_availability, "scheduled_at": MONDAY_SLOT},
        headers=patient_headers,
    )
    appt_id = create.json()["id"]

    resp = await client.delete(f"/api/appointments/{appt_id}", headers=patient_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "CANCELLED"


async def test_cannot_cancel_already_cancelled(
    client: AsyncClient,
    patient_headers: dict,
    doctor_with_availability: int,
):
    create = await client.post(
        "/api/appointments",
        json={"doctor_id": doctor_with_availability, "scheduled_at": MONDAY_SLOT},
        headers=patient_headers,
    )
    appt_id = create.json()["id"]

    await client.delete(f"/api/appointments/{appt_id}", headers=patient_headers)
    resp = await client.delete(f"/api/appointments/{appt_id}", headers=patient_headers)
    assert resp.status_code == 400
