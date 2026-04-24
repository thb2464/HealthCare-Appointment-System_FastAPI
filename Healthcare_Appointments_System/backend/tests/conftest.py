"""
conftest.py — shared fixtures for the Healthcare Appointments test suite.

Uses an in-memory SQLite database (via aiosqlite) so tests never need a real
Postgres instance.  Each test gets a fresh set of tables via function-scoped
fixtures, ensuring full isolation.
"""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.models import (  # noqa: F401 — registers all mappers
    User, UserRole,
    Doctor,
    Specialty,
    Availability,
    Appointment, AppointmentStatus,
    Review,
)
from app.utils.security import hash_password

# ── In-memory SQLite engine (per test session) ─────────────────────────────────
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


# ── Create / drop schema once per test session ─────────────────────────────────
@pytest.fixture(scope="session", autouse=True)
async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


# ── Per-test DB session with rollback ─────────────────────────────────────────
@pytest.fixture
async def db_session():
    async with TestingSessionLocal() as session:
        yield session
        await session.rollback()


# ── Override get_db to use test session ───────────────────────────────────────
@pytest.fixture
async def client(db_session: AsyncSession):
    async def _override_get_db():
        try:
            yield db_session
            await db_session.flush()  # make writes visible within the test's single connection
        except Exception:
            await db_session.rollback()
            raise

    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


# ── Reusable helper: register + login, return auth headers ────────────────────
async def create_user_and_token(
    client: AsyncClient,
    email: str,
    password: str,
    full_name: str,
    role: str = "PATIENT",
) -> dict[str, str]:
    await client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "full_name": full_name, "role": role},
    )
    resp = await client.post(
        "/api/auth/login",
        data={"username": email, "password": password},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ── Pre-built fixtures ─────────────────────────────────────────────────────────

@pytest.fixture
async def patient_headers(client: AsyncClient) -> dict[str, str]:
    return await create_user_and_token(
        client,
        email="patient@test.com",
        password="Patient@1",
        full_name="Test Patient",
        role="PATIENT",
    )


@pytest.fixture
async def doctor_headers(client: AsyncClient) -> dict[str, str]:
    return await create_user_and_token(
        client,
        email="doctor@test.com",
        password="Doctor@1",
        full_name="Test Doctor",
        role="DOCTOR",
    )


@pytest.fixture
async def admin_headers(client: AsyncClient, db_session: AsyncSession) -> dict[str, str]:
    """Admin users can't self-register via /register — create directly in DB."""
    admin = User(
        email="admin@test.com",
        hashed_password=hash_password("Admin@123"),
        full_name="Test Admin",
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(admin)
    await db_session.flush()

    resp = await client.post(
        "/api/auth/login",
        data={"username": "admin@test.com", "password": "Admin@123"},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def doctor_id(client: AsyncClient, doctor_headers: dict, db_session: AsyncSession) -> int:
    """Return the Doctor.id for the pre-built doctor fixture."""
    resp = await client.get("/api/doctors/me", headers=doctor_headers)
    return resp.json()["id"]
