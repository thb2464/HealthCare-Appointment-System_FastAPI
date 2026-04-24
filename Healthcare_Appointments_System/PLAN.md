# Healthcare Appointment Web Application — Implementation Plan

## Business Concept

A web-based platform that connects **patients** with **healthcare providers** (doctors, specialists, clinics). The system streamlines the appointment lifecycle — from discovery and booking through reminders and follow-ups — reducing no-shows, eliminating phone-tag, and giving both parties a single source of truth for scheduling.

**Core value propositions:**
- Patients can self-serve: search, book, reschedule, and cancel without calling a clinic.
- Providers manage availability in one place and get an up-to-date daily schedule.
- Admins oversee the platform, manage users, and resolve disputes.

---

## User Roles

| Role | Description |
|---|---|
| **Patient** | Books, reschedules, and cancels appointments; views history |
| **Doctor / Provider** | Manages availability, views daily schedule, updates appointment status |
| **Admin** | Manages all users, providers, specialties, and platform settings |

---

## User Stories

### Patient
1. As a patient, I can register and log in securely.
2. As a patient, I can search for doctors by specialty, location, or name.
3. As a patient, I can view a doctor's profile (bio, specialty, available slots).
4. As a patient, I can book an available appointment slot.
5. As a patient, I can view all my upcoming and past appointments.
6. As a patient, I can reschedule or cancel an upcoming appointment.
7. As a patient, I can receive confirmation and reminder notifications (email / in-app).
8. As a patient, I can leave a rating/review after a completed appointment.

### Doctor / Provider
1. As a doctor, I can register, log in, and complete my provider profile.
2. As a doctor, I can set my working hours and recurring availability.
3. As a doctor, I can view my daily/weekly appointment schedule.
4. As a doctor, I can accept, reschedule, or cancel a patient appointment.
5. As a doctor, I can mark an appointment as completed and add notes.
6. As a doctor, I can view patient appointment history for context.

### Admin
1. As an admin, I can manage (CRUD) all users and providers.
2. As an admin, I can manage medical specialties and clinic/location data.
3. As an admin, I can view platform-wide appointment statistics and reports.
4. As an admin, I can deactivate or suspend any account.

---

## Core Workflow

```
Patient registers / logs in
        │
        ▼
Search doctors (specialty / name / location)
        │
        ▼
View doctor profile & available slots
        │
        ▼
Select slot → Confirm booking
        │
        ▼
System creates Appointment (status: PENDING)
        │
   ┌────┴────┐
   │         │
Doctor    Patient
confirms  can cancel / reschedule
   │
   ▼
Status → CONFIRMED
   │
   ▼
Appointment date arrives
   │
   ▼
Doctor marks COMPLETED + adds notes
   │
   ▼
Patient can leave review
```

**Appointment Status Flow:**

```
PENDING → CONFIRMED → COMPLETED
PENDING / CONFIRMED → CANCELLED
CONFIRMED → RESCHEDULED → CONFIRMED
```

---

## System Architecture

### High-Level Overview (Monolith)

```
┌─────────────────────────────────────────────────────────┐
│                      Client (Browser)                    │
│              React 18 + Tailwind CSS (SPA)               │
│  Pages: Auth · Search · Doctor Profile · Dashboards     │
│         Booking · Availability Settings · Admin Panel   │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP (same origin in production)
                     │ JWT in Authorization header
┌────────────────────▼────────────────────────────────────┐
│            FastAPI Monolith  (single process)            │
│  /api/*  → Routers: auth · users · doctors ·            │
│             appointments · reviews · admin              │
│  /assets → StaticFiles  (compiled React JS/CSS)         │
│  /*      → SPA fallback  (index.html)                   │
│  Middleware: CORS (dev only) · JWT auth                  │
└────────────────────┬────────────────────────────────────┘
                     │ SQLAlchemy 2 ORM (async)
┌────────────────────▼────────────────────────────────────┐
│                  PostgreSQL 15 Database                  │
│  Tables: users · doctors · specialties · availabilities │
│          appointments · reviews                         │
└─────────────────────────────────────────────────────────┘
```

**Monolith design decisions:**
- No separate `services/` layer — booking logic lives in `routers/appointments.py`, availability logic in `routers/doctors.py`.
- React SPA is compiled (`npm run build`) into `backend/app/static/` and served by FastAPI's `StaticFiles` mount + SPA fallback route.
- Single Docker container (multi-stage build: Node → Python) replaces the previous separate `frontend` and `backend` containers.

---

## Backend Architecture — FastAPI

### Project Structure

```
backend/
├── app/
│   ├── main.py                  # App factory, CORS, router registration
│   ├── config.py                # Settings (env vars via pydantic-settings)
│   ├── database.py              # Async SQLAlchemy engine & session factory
│   ├── dependencies.py          # get_db, get_current_user, role guards
│   ├── models/                  # SQLAlchemy ORM models
│   │   ├── user.py
│   │   ├── doctor.py
│   │   ├── specialty.py
│   │   ├── availability.py
│   │   ├── appointment.py
│   │   └── review.py
│   ├── schemas/                 # Pydantic request/response schemas
│   │   ├── user.py
│   │   ├── doctor.py
│   │   ├── appointment.py
│   │   └── review.py
│   ├── routers/                 # Route handlers + inlined business logic
│   │   ├── auth.py              # Auth logic inline
│   │   ├── users.py
│   │   ├── doctors.py           # Availability helpers inlined (get_open_slots, is_slot_available, …)
│   │   ├── appointments.py      # Booking helpers inlined (_book, _reschedule, _validate_status_transition, …)
│   │   ├── reviews.py
│   │   └── admin.py
│   └── utils/                   # No services/ layer — business logic lives in routers
│       ├── security.py          # JWT encode/decode, bcrypt hashing
│       └── email.py             # Email notification helpers
├── alembic/                     # DB migrations
├── tests/
└── requirements.txt             # at project root
```

### Key API Endpoints

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Patient or doctor registration |
| POST | `/api/auth/login` | Public | Login → JWT access + refresh tokens |
| POST | `/api/auth/refresh` | Public | Refresh access token |
| GET | `/api/doctors` | Public | Search/list doctors (filter by specialty, name) |
| GET | `/api/doctors/{id}` | Public | Doctor profile + available slots |
| GET | `/api/doctors/{id}/availability` | Public | Available time slots for booking |
| PUT | `/api/doctors/me/availability` | Doctor | Set weekly availability |
| POST | `/api/appointments` | Patient | Book an appointment |
| GET | `/api/appointments` | Auth | List current user's appointments |
| GET | `/api/appointments/{id}` | Auth | Appointment detail |
| PATCH | `/api/appointments/{id}` | Auth | Update status / reschedule |
| DELETE | `/api/appointments/{id}` | Auth | Cancel appointment |
| POST | `/api/reviews` | Patient | Submit review after completed appointment |
| GET | `/api/admin/users` | Admin | List all users |
| PATCH | `/api/admin/users/{id}` | Admin | Activate / deactivate user |
| GET | `/api/admin/stats` | Admin | Platform-wide statistics |

---

## Database Schema

### Key Tables

```
users
  id, email, hashed_password, full_name, role (PATIENT/DOCTOR/ADMIN),
  phone, avatar_url, is_active, created_at, updated_at

doctors  (one-to-one with users)
  id, user_id (FK→users), specialty_id (FK→specialties), bio,
  license_number, years_experience, clinic_address,
  consultation_fee, avg_rating

specialties
  id, name, description, icon

availabilities
  id, doctor_id (FK→doctors), day_of_week (0–6),
  start_time, end_time, slot_duration_minutes, is_active

appointments
  id, patient_id (FK→users), doctor_id (FK→doctors),
  scheduled_at (timestamptz), end_at (timestamptz),
  status (PENDING/CONFIRMED/COMPLETED/CANCELLED/RESCHEDULED),
  reason, notes, created_at, updated_at

reviews
  id, appointment_id (FK→appointments, UNIQUE),
  patient_id (FK→users), doctor_id (FK→doctors),
  rating (1–5), comment, created_at
```

---

## Frontend Architecture — React + Tailwind CSS

### Project Structure

```
frontend/
├── public/
├── src/
│   ├── main.jsx
│   ├── App.jsx                  # Route definitions (React Router v6)
│   ├── api/                     # API layer
│   │   ├── axiosClient.js       # Axios base instance + JWT interceptors
│   │   ├── authApi.js
│   │   ├── doctorApi.js
│   │   └── appointmentApi.js
│   ├── context/
│   │   └── AuthContext.jsx      # JWT storage, current user state
│   ├── components/              # Reusable UI components
│   │   ├── Navbar.jsx
│   │   ├── DoctorCard.jsx
│   │   ├── AppointmentCard.jsx
│   │   ├── Calendar/
│   │   │   ├── WeekView.jsx
│   │   │   └── SlotPicker.jsx
│   │   ├── forms/
│   │   │   ├── LoginForm.jsx
│   │   │   ├── RegisterForm.jsx
│   │   │   └── BookingForm.jsx
│   │   └── ui/                  # Generic: Button, Badge, Modal, Toast
│   ├── pages/
│   │   ├── LandingPage.jsx
│   │   ├── auth/
│   │   │   ├── LoginPage.jsx
│   │   │   └── RegisterPage.jsx
│   │   ├── patient/
│   │   │   ├── SearchPage.jsx
│   │   │   ├── DoctorProfilePage.jsx
│   │   │   ├── BookingPage.jsx
│   │   │   └── PatientDashboard.jsx
│   │   ├── doctor/
│   │   │   ├── DoctorDashboard.jsx
│   │   │   └── AvailabilitySettings.jsx
│   │   └── admin/
│   │       └── AdminDashboard.jsx
│   ├── hooks/
│   │   ├── useAuth.js
│   │   └── useAppointments.js
│   └── utils/
│       └── dateHelpers.js
├── tailwind.config.js
├── vite.config.js               # outDir → ../backend/app/static; /api proxy → :8000
└── package.json
```

### Key Pages & Features

| Page | Key Features |
|---|---|
| Landing | Hero section, specialty highlights, CTA to register |
| Login / Register | Role selection (Patient / Doctor), form validation |
| Search Doctors | Filters (specialty, name), paginated doctor cards |
| Doctor Profile | Bio, avg rating, reviews list, interactive slot picker |
| Booking Confirmation | Summary card, visit reason input, confirm button |
| Patient Dashboard | Upcoming / past appointments, cancel / reschedule |
| Doctor Dashboard | Today's schedule list, pending confirmation queue |
| Availability Settings | Weekly hours grid + slot duration selector |
| Admin Dashboard | Stats cards, sortable user management table |

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 (Vite) |
| Styling | Tailwind CSS 3 |
| HTTP client | Axios |
| Routing | React Router v6 |
| State management | React Context + custom hooks |
| Backend framework | FastAPI |
| ORM | SQLAlchemy 2 (async) |
| Database | PostgreSQL 15 |
| Authentication | JWT (python-jose) + bcrypt |
| Migrations | Alembic |
| Containerization | Docker (multi-stage) + docker-compose (2 services: app + db) |
| Environment config | pydantic-settings (.env) |

---

## Non-Functional Requirements

- **Security:** bcrypt password hashing; JWT short-lived access token + refresh token rotation; role-based guards on every protected endpoint.
- **Data integrity:** Prevent double-booking inside `routers/appointments.py`; unique constraint on `(doctor_id, scheduled_at)`; one review per appointment.
- **Validation:** Pydantic schemas on backend; client-side form validation on frontend.
- **Responsiveness:** Tailwind responsive utilities; mobile-first layout.
- **Error Handling:** Consistent `{ "detail": "..." }` JSON error responses; toast notifications on frontend.

---

## Monorepo Layout

```
/  (project root)
├── backend/            FastAPI application (Python) — also serves compiled React SPA
├── frontend/           React + Vite application (JS/JSX)
├── Dockerfile          Multi-stage monolith image (Node build → Python runtime)
├── docker-compose.yml  2 services: app (port 8000) + postgres
├── .env.example        Shared environment variable template
└── PLAN.md             ← this file
```

---

## Verification Plan

1. **Unit tests (backend):** pytest + httpx AsyncClient — cover auth flow, booking conflict detection, role guard enforcement.
2. **Swagger UI:** Exercise all endpoints manually at `/docs` after spinning up docker-compose.
3. **End-to-end patient flow:** Register → search → book → doctor confirms → patient reschedules → patient cancels → verify status transitions in DB.
4. **End-to-end doctor flow:** Set availability → view schedule → mark appointment completed → verify review eligibility for patient.
5. **Admin flow:** Log in as admin → list users → deactivate account → view stats dashboard.
6. **Frontend:** Navigate all pages in both desktop and mobile viewports; verify protected routes redirect unauthenticated users.
