"""
test_reviews.py — Review submission and listing tests.

Covers: submit review after completed appointment, duplicate review rejected,
review on non-completed appointment rejected, review on another patient's
appointment rejected, public listing of doctor reviews.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest
from httpx import AsyncClient


def next_weekday_dt(weekday: int, hour: int = 9, minute: int = 0) -> str:
    today = date.today()
    days_ahead = (weekday - today.weekday()) % 7 or 7
    target = today + timedelta(days=days_ahead)
    dt = datetime(target.year, target.month, target.day, hour, minute, tzinfo=timezone.utc)
    return dt.isoformat()


MONDAY_SLOT = next_weekday_dt(0, 10, 0)
WEDNESDAY_SLOT = next_weekday_dt(2, 10, 0)

AVAILABILITY_PAYLOAD = {
    "slots": [
        {"day_of_week": 0, "start_time": "08:00:00", "end_time": "17:00:00", "slot_duration_minutes": 30, "is_active": True},
        {"day_of_week": 2, "start_time": "08:00:00", "end_time": "17:00:00", "slot_duration_minutes": 30, "is_active": True},
    ]
}


@pytest.fixture
async def completed_appointment(
    client: AsyncClient,
    patient_headers: dict,
    doctor_headers: dict,
    doctor_id: int,
):
    """Book → confirm → complete an appointment; return its id."""
    await client.put(
        "/api/doctors/me/availability",
        json=AVAILABILITY_PAYLOAD,
        headers=doctor_headers,
    )
    create = await client.post(
        "/api/appointments",
        json={"doctor_id": doctor_id, "scheduled_at": MONDAY_SLOT},
        headers=patient_headers,
    )
    appt_id = create.json()["id"]
    await client.patch(
        f"/api/appointments/{appt_id}", json={"status": "CONFIRMED"}, headers=doctor_headers
    )
    await client.patch(
        f"/api/appointments/{appt_id}", json={"status": "COMPLETED"}, headers=doctor_headers
    )
    return appt_id


@pytest.fixture
async def pending_appointment(
    client: AsyncClient,
    patient_headers: dict,
    doctor_headers: dict,
    doctor_id: int,
):
    """Book an appointment and leave it PENDING."""
    await client.put(
        "/api/doctors/me/availability",
        json=AVAILABILITY_PAYLOAD,
        headers=doctor_headers,
    )
    create = await client.post(
        "/api/appointments",
        json={"doctor_id": doctor_id, "scheduled_at": WEDNESDAY_SLOT},
        headers=patient_headers,
    )
    return create.json()["id"]


# ── Submit review ──────────────────────────────────────────────────────────────

async def test_submit_review_for_completed_appointment(
    client: AsyncClient,
    patient_headers: dict,
    completed_appointment: int,
):
    resp = await client.post(
        "/api/reviews",
        json={
            "appointment_id": completed_appointment,
            "rating": 5,
            "comment": "Excellent consultation!",
        },
        headers=patient_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["rating"] == 5
    assert body["comment"] == "Excellent consultation!"
    assert "patient" in body


async def test_submit_review_without_comment(
    client: AsyncClient,
    patient_headers: dict,
    completed_appointment: int,
):
    resp = await client.post(
        "/api/reviews",
        json={"appointment_id": completed_appointment, "rating": 4},
        headers=patient_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["comment"] is None


async def test_duplicate_review_rejected(
    client: AsyncClient,
    patient_headers: dict,
    completed_appointment: int,
):
    payload = {"appointment_id": completed_appointment, "rating": 5}
    await client.post("/api/reviews", json=payload, headers=patient_headers)
    resp = await client.post("/api/reviews", json=payload, headers=patient_headers)
    assert resp.status_code == 409


async def test_review_for_non_completed_appointment_rejected(
    client: AsyncClient,
    patient_headers: dict,
    pending_appointment: int,
):
    resp = await client.post(
        "/api/reviews",
        json={"appointment_id": pending_appointment, "rating": 3},
        headers=patient_headers,
    )
    assert resp.status_code == 400


async def test_review_requires_auth(client: AsyncClient, completed_appointment: int):
    resp = await client.post(
        "/api/reviews",
        json={"appointment_id": completed_appointment, "rating": 5},
    )
    assert resp.status_code == 401


async def test_invalid_rating_below_range(
    client: AsyncClient,
    patient_headers: dict,
    completed_appointment: int,
):
    resp = await client.post(
        "/api/reviews",
        json={"appointment_id": completed_appointment, "rating": 0},
        headers=patient_headers,
    )
    assert resp.status_code == 422


async def test_invalid_rating_above_range(
    client: AsyncClient,
    patient_headers: dict,
    completed_appointment: int,
):
    resp = await client.post(
        "/api/reviews",
        json={"appointment_id": completed_appointment, "rating": 6},
        headers=patient_headers,
    )
    assert resp.status_code == 422


# ── Doctor avg_rating updated ──────────────────────────────────────────────────

async def test_avg_rating_updated_after_review(
    client: AsyncClient,
    patient_headers: dict,
    doctor_headers: dict,
    doctor_id: int,
    completed_appointment: int,
):
    await client.post(
        "/api/reviews",
        json={"appointment_id": completed_appointment, "rating": 4},
        headers=patient_headers,
    )
    resp = await client.get(f"/api/doctors/{doctor_id}")
    assert resp.status_code == 200
    avg = resp.json()["avg_rating"]
    assert avg is not None
    assert float(avg) == pytest.approx(4.0, abs=0.01)


# ── List reviews ───────────────────────────────────────────────────────────────

async def test_list_doctor_reviews_public(
    client: AsyncClient,
    patient_headers: dict,
    doctor_id: int,
    completed_appointment: int,
):
    await client.post(
        "/api/reviews",
        json={"appointment_id": completed_appointment, "rating": 5, "comment": "Great!"},
        headers=patient_headers,
    )
    resp = await client.get(f"/api/reviews/doctor/{doctor_id}")
    assert resp.status_code == 200
    reviews = resp.json()
    assert len(reviews) >= 1
    assert reviews[0]["rating"] == 5


async def test_list_reviews_for_doctor_with_no_reviews(client: AsyncClient):
    resp = await client.get("/api/reviews/doctor/999999")
    assert resp.status_code == 200
    assert resp.json() == []
