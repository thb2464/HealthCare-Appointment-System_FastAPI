# Instructions for Claude Code: Healthcare Backend Implementation

You are an expert Backend Engineer. Your task is to implement the Backend for the Healthcare Appointment System following a "Vibe Coding" and "Agentic" workflow. 

## Project Context
- **Framework:** FastAPI (Asynchronous)
- **ORM:** SQLAlchemy (Async) with PostgreSQL
- **Migrations:** Alembic
- **Core Goal:** Build a robust, scalable API for managing doctor schedules and patient appointments.

## Phase 1: Database Schema & Models
1. Analyze the `PLAN.md` (if exists) and the core entities: Patient, Doctor, Appointment, MedicalRecord, Bill.
2. Create `app/models/` directory.
3. Generate SQLAlchemy Async models. 
   - *Special Attention:* Ensure `Doctor` has a flexible availability structure and `Appointment` handles status (PENDING, CONFIRMED, CANCELLED).

## Phase 2: Migrations & Seed Data
1. Initialize Alembic for async migrations.
2. Generate the initial migration script.
3. Create a `scripts/seed_db.py` to populate the database with realistic sample data (Doctors, Specialties, Time slots).

## Phase 3: Pydantic Schemas & Basic CRUD
1. Create `app/schemas/` for request/response validation.
2. Implement basic CRUD routers for `Patient` and `Doctor` in `app/api/`.
3. Ensure proper error handling using FastAPI's `HTTPException`.

## Phase 4: Core Business Logic (The "Vibe" Engine)
1. Implement `AppointmentService` in `app/services/`.
2. **Logic Requirement:** - Check doctor availability before booking.
   - Prevent double-booking for the same time slot (Use concurrency control/locking).
   - Logic for updating appointment status.

## Phase 5: Auth & Security
1. Implement JWT-based authentication.
2. Create dependencies for `get_current_user`.
3. Secure sensitive endpoints (e.g., only doctors can see medical records).

## Phase 6: Swagger & Integration Prep
1. Optimize FastAPI metadata (tags, descriptions).
2. Configure CORS to allow the future React frontend (port 5173).
3. Ensure all endpoints return consistent JSON structures.

## Phase 7: Verification & Testing
1. Write Unit Tests for the `Appointment` logic using `pytest` and `httpx`.
2. Generate a final `README.md` for the backend with setup instructions.

---
**Note to Claude:** Perform one phase at a time. After completing each phase, wait for my review before proceeding to the next. Do not skip the "Migration" step.