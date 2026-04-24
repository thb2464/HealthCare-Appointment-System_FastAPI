"""
test_admin.py — Admin endpoint tests.

Covers: list all users, filter by role, filter by active status,
activate/deactivate user, platform stats, access-control enforcement.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import create_user_and_token


# ── Access control ─────────────────────────────────────────────────────────────

async def test_list_users_requires_admin(client: AsyncClient, patient_headers: dict):
    resp = await client.get("/api/admin/users", headers=patient_headers)
    assert resp.status_code == 403


async def test_list_users_requires_auth(client: AsyncClient):
    resp = await client.get("/api/admin/users")
    assert resp.status_code == 401


async def test_stats_requires_admin(client: AsyncClient, patient_headers: dict):
    resp = await client.get("/api/admin/stats", headers=patient_headers)
    assert resp.status_code == 403


# ── List users ─────────────────────────────────────────────────────────────────

async def test_admin_can_list_all_users(client: AsyncClient, admin_headers: dict, patient_headers: dict):
    # Ensure at least the patient fixture user exists
    resp = await client.get("/api/admin/users", headers=admin_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1


async def test_admin_filter_users_by_role(
    client: AsyncClient, admin_headers: dict, doctor_headers: dict
):
    resp = await client.get(
        "/api/admin/users", params={"role": "DOCTOR"}, headers=admin_headers
    )
    assert resp.status_code == 200
    for user in resp.json():
        assert user["role"] == "DOCTOR"


async def test_admin_filter_active_users(client: AsyncClient, admin_headers: dict):
    resp = await client.get(
        "/api/admin/users", params={"is_active": True}, headers=admin_headers
    )
    assert resp.status_code == 200
    for user in resp.json():
        assert user["is_active"] is True


# ── Toggle active ──────────────────────────────────────────────────────────────

async def test_admin_deactivate_user(client: AsyncClient, admin_headers: dict):
    # Create a user to deactivate
    headers = await create_user_and_token(
        client, "todeactivate@test.com", "Deact@123", "To Deactivate"
    )
    me = await client.get("/api/auth/me", headers=headers)
    user_id = me.json()["id"]

    resp = await client.patch(
        f"/api/admin/users/{user_id}",
        params={"is_active": False},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


async def test_admin_reactivate_user(client: AsyncClient, admin_headers: dict):
    headers = await create_user_and_token(
        client, "toreactivate@test.com", "React@123", "To Reactivate"
    )
    me = await client.get("/api/auth/me", headers=headers)
    user_id = me.json()["id"]

    await client.patch(
        f"/api/admin/users/{user_id}",
        params={"is_active": False},
        headers=admin_headers,
    )
    resp = await client.patch(
        f"/api/admin/users/{user_id}",
        params={"is_active": True},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is True


async def test_toggle_nonexistent_user_returns_404(client: AsyncClient, admin_headers: dict):
    resp = await client.patch(
        "/api/admin/users/999999",
        params={"is_active": False},
        headers=admin_headers,
    )
    assert resp.status_code == 404


# ── Stats ──────────────────────────────────────────────────────────────────────

async def test_admin_stats_structure(
    client: AsyncClient, admin_headers: dict, patient_headers: dict, doctor_headers: dict
):
    resp = await client.get("/api/admin/stats", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()

    assert "users" in body
    assert "appointments" in body

    users = body["users"]
    assert "total" in users
    assert "patients" in users
    assert "doctors" in users
    assert users["total"] >= 0

    appointments = body["appointments"]
    assert "total" in appointments
    for status in ("PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "RESCHEDULED"):
        assert status in appointments


async def test_stats_reflect_registered_users(
    client: AsyncClient, admin_headers: dict, patient_headers: dict
):
    resp = await client.get("/api/admin/stats", headers=admin_headers)
    body = resp.json()
    assert body["users"]["patients"] >= 1
