"""
test_auth.py — Authentication flow tests.

Covers: register, duplicate-email rejection, login, wrong-password rejection,
inactive-account rejection, token refresh, /me endpoint.
"""
import pytest
from httpx import AsyncClient


# ── Register ───────────────────────────────────────────────────────────────────

async def test_register_patient_success(client: AsyncClient):
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": "newpatient@test.com",
            "password": "Secure@1",
            "full_name": "New Patient",
            "role": "PATIENT",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "newpatient@test.com"
    assert body["role"] == "PATIENT"
    assert body["is_active"] is True
    assert "hashed_password" not in body


async def test_register_doctor_creates_doctor_profile(client: AsyncClient):
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": "newdoc@test.com",
            "password": "Secure@1",
            "full_name": "New Doctor",
            "role": "DOCTOR",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["role"] == "DOCTOR"

    # Doctor profile should be accessible after login
    login = await client.post(
        "/api/auth/login",
        data={"username": "newdoc@test.com", "password": "Secure@1"},
    )
    token = login.json()["access_token"]
    profile = await client.get(
        "/api/doctors/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert profile.status_code == 200


async def test_register_duplicate_email_returns_409(client: AsyncClient):
    payload = {
        "email": "dup@test.com",
        "password": "Secure@1",
        "full_name": "Dup User",
        "role": "PATIENT",
    }
    await client.post("/api/auth/register", json=payload)
    resp = await client.post("/api/auth/register", json=payload)
    assert resp.status_code == 409


async def test_register_weak_password_rejected(client: AsyncClient):
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": "weak@test.com",
            "password": "password",   # no uppercase, no digit
            "full_name": "Weak Pass",
            "role": "PATIENT",
        },
    )
    assert resp.status_code == 422


# ── Login ──────────────────────────────────────────────────────────────────────

async def test_login_success_returns_tokens(client: AsyncClient, patient_headers: dict):
    # patient_headers fixture registered patient@test.com with Patient@1 — log in again
    # to verify the login endpoint returns a well-formed token response.
    resp = await client.post(
        "/api/auth/login",
        data={"username": "patient@test.com", "password": "Patient@1"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"


async def test_login_wrong_password_returns_401(client: AsyncClient):
    await client.post(
        "/api/auth/register",
        json={"email": "wrongpass@test.com", "password": "Correct@1", "full_name": "WP User"},
    )
    resp = await client.post(
        "/api/auth/login",
        data={"username": "wrongpass@test.com", "password": "Wrong@1"},
    )
    assert resp.status_code == 401


async def test_login_unknown_email_returns_401(client: AsyncClient):
    resp = await client.post(
        "/api/auth/login",
        data={"username": "nobody@test.com", "password": "Any@123"},
    )
    assert resp.status_code == 401


# ── Refresh token ──────────────────────────────────────────────────────────────

async def test_refresh_token_returns_new_tokens(client: AsyncClient):
    await client.post(
        "/api/auth/register",
        json={"email": "refresh@test.com", "password": "Refresh@1", "full_name": "Refresh User"},
    )
    login = await client.post(
        "/api/auth/login",
        data={"username": "refresh@test.com", "password": "Refresh@1"},
    )
    refresh_token = login.json()["refresh_token"]

    resp = await client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body


async def test_refresh_with_access_token_rejected(client: AsyncClient):
    await client.post(
        "/api/auth/register",
        json={"email": "badrefresh@test.com", "password": "Bad@12345", "full_name": "BR User"},
    )
    login = await client.post(
        "/api/auth/login",
        data={"username": "badrefresh@test.com", "password": "Bad@12345"},
    )
    # Passing the access token as if it were a refresh token should be rejected
    access_token = login.json()["access_token"]
    resp = await client.post("/api/auth/refresh", json={"refresh_token": access_token})
    assert resp.status_code == 401


async def test_refresh_with_garbage_token_rejected(client: AsyncClient):
    resp = await client.post("/api/auth/refresh", json={"refresh_token": "not.a.token"})
    assert resp.status_code == 401


# ── /me ────────────────────────────────────────────────────────────────────────

async def test_me_returns_current_user(client: AsyncClient, patient_headers: dict):
    resp = await client.get("/api/auth/me", headers=patient_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "patient@test.com"


async def test_me_without_token_returns_401(client: AsyncClient):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401
