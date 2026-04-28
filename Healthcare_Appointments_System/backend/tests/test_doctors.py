"""
test_doctors.py — Doctors, specialties, and availability tests.

Covers: specialty CRUD (admin-gated), doctor listing/search, doctor profile
update, availability bulk-set, open-slots query.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient


# ══════════════════════════════════════════════════════════════════════════════
# SPECIALTIES
# ══════════════════════════════════════════════════════════════════════════════

async def test_list_specialties_empty(client: AsyncClient):
    resp = await client.get("/api/specialties")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_create_specialty_as_admin(client: AsyncClient, admin_headers: dict):
    resp = await client.post(
        "/api/specialties",
        json={"name": "Cardiology", "description": "Heart care", "icon": "heart"},
        headers=admin_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Cardiology"
    assert body["id"] is not None


async def test_create_specialty_non_admin_forbidden(client: AsyncClient, patient_headers: dict):
    resp = await client.post(
        "/api/specialties",
        json={"name": "Forbidden"},
        headers=patient_headers,
    )
    assert resp.status_code == 403


async def test_create_duplicate_specialty_returns_409(client: AsyncClient, admin_headers: dict):
    payload = {"name": "Neurology"}
    await client.post("/api/specialties", json=payload, headers=admin_headers)
    resp = await client.post("/api/specialties", json=payload, headers=admin_headers)
    assert resp.status_code == 409


async def test_update_specialty(client: AsyncClient, admin_headers: dict):
    create = await client.post(
        "/api/specialties",
        json={"name": "OldName"},
        headers=admin_headers,
    )
    spec_id = create.json()["id"]

    resp = await client.patch(
        f"/api/specialties/{spec_id}",
        json={"name": "NewName", "description": "Updated"},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "NewName"


async def test_delete_specialty(client: AsyncClient, admin_headers: dict):
    create = await client.post(
        "/api/specialties",
        json={"name": "ToDelete"},
        headers=admin_headers,
    )
    spec_id = create.json()["id"]

    resp = await client.delete(f"/api/specialties/{spec_id}", headers=admin_headers)
    assert resp.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
# DOCTOR LISTING & PROFILE
# ══════════════════════════════════════════════════════════════════════════════

async def test_list_doctors_returns_empty_by_default(client: AsyncClient):
    resp = await client.get("/api/doctors")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_doctor_profile_accessible_after_register(
    client: AsyncClient, doctor_headers: dict
):
    resp = await client.get("/api/doctors/me", headers=doctor_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "id" in body
    assert "user" in body


async def test_get_doctor_by_id_public(client: AsyncClient, doctor_headers: dict, doctor_id: int):
    resp = await client.get(f"/api/doctors/{doctor_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == doctor_id


async def test_get_nonexistent_doctor_returns_404(client: AsyncClient):
    resp = await client.get("/api/doctors/999999")
    assert resp.status_code == 404


async def test_update_doctor_profile(client: AsyncClient, doctor_headers: dict):
    resp = await client.patch(
        "/api/doctors/me",
        json={
            "bio": "Experienced cardiologist.",
            "years_experience": 10,
            "consultation_fee": "6250000",
        },
        headers=doctor_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["bio"] == "Experienced cardiologist."
    assert body["years_experience"] == 10


async def test_patient_cannot_update_doctor_profile(
    client: AsyncClient, patient_headers: dict
):
    resp = await client.patch(
        "/api/doctors/me",
        json={"bio": "Should fail"},
        headers=patient_headers,
    )
    assert resp.status_code == 403


async def test_list_doctors_appears_after_register(
    client: AsyncClient, doctor_headers: dict
):
    resp = await client.get("/api/doctors")
    assert resp.status_code == 200
    # At least the fixture doctor should appear
    assert len(resp.json()) >= 1


# ══════════════════════════════════════════════════════════════════════════════
# AVAILABILITY
# ══════════════════════════════════════════════════════════════════════════════

AVAILABILITY_PAYLOAD = {
    "slots": [
        {
            "day_of_week": 0,   # Monday
            "start_time": "08:00:00",
            "end_time": "12:00:00",
            "slot_duration_minutes": 30,
            "is_active": True,
        },
        {
            "day_of_week": 2,   # Wednesday
            "start_time": "13:00:00",
            "end_time": "17:00:00",
            "slot_duration_minutes": 30,
            "is_active": True,
        },
    ]
}


async def test_set_availability_as_doctor(client: AsyncClient, doctor_headers: dict):
    resp = await client.put(
        "/api/doctors/me/availability",
        json=AVAILABILITY_PAYLOAD,
        headers=doctor_headers,
    )
    assert resp.status_code == 200
    slots = resp.json()
    assert len(slots) == 2
    assert slots[0]["day_of_week"] == 0


async def test_set_availability_replaces_existing(client: AsyncClient, doctor_headers: dict):
    await client.put(
        "/api/doctors/me/availability",
        json=AVAILABILITY_PAYLOAD,
        headers=doctor_headers,
    )
    # Now replace with a single slot
    resp = await client.put(
        "/api/doctors/me/availability",
        json={"slots": [{"day_of_week": 4, "start_time": "09:00:00", "end_time": "11:00:00", "slot_duration_minutes": 30, "is_active": True}]},
        headers=doctor_headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["day_of_week"] == 4


async def test_patient_cannot_set_availability(client: AsyncClient, patient_headers: dict):
    resp = await client.put(
        "/api/doctors/me/availability",
        json=AVAILABILITY_PAYLOAD,
        headers=patient_headers,
    )
    assert resp.status_code == 403


async def test_get_doctor_availability_public(
    client: AsyncClient, doctor_headers: dict, doctor_id: int
):
    await client.put(
        "/api/doctors/me/availability",
        json=AVAILABILITY_PAYLOAD,
        headers=doctor_headers,
    )
    resp = await client.get(f"/api/doctors/{doctor_id}/availability")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


async def test_get_open_slots_for_monday(
    client: AsyncClient, doctor_headers: dict, doctor_id: int
):
    await client.put(
        "/api/doctors/me/availability",
        json=AVAILABILITY_PAYLOAD,
        headers=doctor_headers,
    )
    # Find next Monday
    from datetime import date, timedelta
    today = date.today()
    days_ahead = (0 - today.weekday()) % 7 or 7
    next_monday = today + timedelta(days=days_ahead)

    resp = await client.get(
        f"/api/doctors/{doctor_id}/slots",
        params={"date": next_monday.isoformat()},
    )
    assert resp.status_code == 200
    slots = resp.json()
    # Monday 08:00–12:00 with 30-min slots = 8 slots
    assert len(slots) == 8


async def test_get_open_slots_for_day_with_no_availability(
    client: AsyncClient, doctor_headers: dict, doctor_id: int
):
    await client.put(
        "/api/doctors/me/availability",
        json=AVAILABILITY_PAYLOAD,
        headers=doctor_headers,
    )
    # Find next Sunday (day_of_week=6, not in availability)
    from datetime import date, timedelta
    today = date.today()
    days_ahead = (6 - today.weekday()) % 7 or 7
    next_sunday = today + timedelta(days=days_ahead)

    resp = await client.get(
        f"/api/doctors/{doctor_id}/slots",
        params={"date": next_sunday.isoformat()},
    )
    assert resp.status_code == 200
    assert resp.json() == []
