# Healthcare Appointment Scheduling Web Application — Implementation Plan

## 1. Business Concept

A modern healthcare scheduling platform is no longer just a booking tool — it is a core operational strategy that optimizes patient flow and integrates deeply with clinical workflows. The system shifts the paradigm from manual phone-based scheduling to an automated, self-service model, significantly reducing administrative costs and patient wait times.

### Core Value Propositions

- **Patient Empowerment:** 24/7 self-service booking, automated multi-tier reminders, and fast check-ins to minimize waiting times.
- **Provider Efficiency:** Real-time availability management and a clear daily schedule view to minimize idle time and absorb clinical variability.
- **Smart Automation:** Automated waitlist to instantly fill slots when last-minute cancellations occur, protecting clinic revenue.
- **Data Integrity:** Slot locking during booking confirmation prevents double-booking under concurrent load.

---

## 2. User Roles

| Role | Description |
| :--- | :--- |
| **Patient** | Searches for providers, books/reschedules/cancels slots, receives Email reminders, and leaves post-visit reviews. |
| **Doctor / Provider** | Manages weekly availability, accesses daily schedule, confirms/completes appointments, and adds clinical notes. |
| **Receptionist / Staff** | *(Planned)* Manages walk-ins, handles schedule overrides, and updates appointment statuses on behalf of patients. |
| **Admin** | Manages all users and providers, oversees platform-wide analytics, manages medical specialties, and deactivates accounts. |

---

## 3. User Stories

### Patient
1. As a patient, I can register and log in securely with a validated email and strong password.
2. As a patient, I can search for doctors by specialty, location, or name to find the right provider.
3. As a patient, I can view a doctor's full profile — bio, specialty, consultation fee, ratings, and available slots.
4. As a patient, I can book an available appointment slot with a reason for visit.
5. As a patient, I can view all my upcoming and past appointments in a personal dashboard.
6. As a patient, I can reschedule or cancel an upcoming appointment before it is confirmed.
7. As a patient, I can receive automated email confirmations and reminders before my visit.
8. As a patient, I can leave a rating and review after a completed appointment.

### Doctor / Provider
1. As a doctor, I can register, log in, and complete my provider profile (bio, specialty, fee, clinic address).
2. As a doctor, I can set my weekly working hours and slot duration to control my availability.
3. As a doctor, I can view my daily and weekly appointment schedule in a clear calendar view.
4. As a doctor, I can confirm, reschedule, or cancel a patient appointment.
5. As a doctor, I can mark an appointment as completed and add post-visit notes.
6. As a doctor, I can view a patient's appointment history for clinical context.

### Admin
1. As an admin, I can manage (view, activate, deactivate) all users and providers on the platform.
2. As an admin, I can manage medical specialties (create, delete) used for doctor categorization.
3. As an admin, I can view platform-wide statistics — total users, appointments by status, and trends.
4. As an admin, I can suspend any account to enforce data privacy and compliance.

---

## 4. Core Workflow

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
Select slot → [Slot Lock applied] → Confirm booking
        │
        ▼
System creates Appointment (status: PENDING)
Email confirmation dispatched automatically
        │
   ┌────┴────┐
   │         │
Doctor    Patient
confirms  can cancel / reschedule
   │
   ▼
Status → CONFIRMED
Reminder email dispatched (24h before)
   │
   ▼
Appointment date arrives
   │
   ▼
Doctor marks COMPLETED + adds notes
   │
   ▼
Patient can leave review
   │
   ▼
[If cancelled] → Slot released → Waitlist notified automatically
```

**Appointment Status Flow:**

```
PENDING → CONFIRMED → COMPLETED
PENDING / CONFIRMED → CANCELLED
CONFIRMED → RESCHEDULED → CONFIRMED
```

---

## 5. System Architecture

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
│  Middleware: CORS (dev only) · JWT auth · Role guards   │
└────────────────────┬────────────────────────────────────┘
                     │ SQLAlchemy 2 ORM (async)
┌────────────────────▼────────────────────────────────────┐
│                  PostgreSQL 15 Database                  │
│  Tables: users · doctors · specialties · availabilities │
│          appointments · reviews                         │
└─────────────────────────────────────────────────────────┘
```

**Design decisions:**
- No separate `services/` layer — booking logic lives in `routers/appointments.py`, availability logic in `routers/doctors.py`.
- React SPA is compiled (`npm run build`) into `backend/app/static/` and served by FastAPI's `StaticFiles` mount + SPA fallback route.
- Single Docker container (multi-stage build: Node → Python) + one PostgreSQL container via docker-compose.

---

## 6. Backend Architecture — FastAPI

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
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── doctors.py           # get_open_slots, is_slot_available helpers
│   │   ├── appointments.py      # _book, _reschedule, _validate_status_transition helpers
│   │   ├── reviews.py
│   │   └── admin.py
│   └── utils/
│       ├── security.py          # JWT encode/decode, bcrypt hashing
│       └── email.py             # Email notification helpers (confirmations, reminders)
├── alembic/                     # DB migrations
├── tests/
└── requirements.txt             # at project root
```

### Key API Endpoints

| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| POST | `/api/auth/register` | Public | Patient or doctor registration |
| POST | `/api/auth/login` | Public | Login → JWT access + refresh tokens |
| POST | `/api/auth/refresh` | Public | Refresh access token |
| GET | `/api/auth/me` | Auth | Get current user profile |
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

## 7. Database Schema

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

## 8. Frontend Architecture — React + Tailwind CSS

### Project Structure

```
frontend/
├── src/
│   ├── main.jsx
│   ├── App.jsx                  # Route definitions (React Router v6)
│   ├── api/
│   │   ├── axiosClient.js       # Axios base instance + JWT interceptors + auto-refresh
│   │   ├── authApi.js
│   │   ├── doctorApi.js
│   │   └── appointmentApi.js
│   ├── context/
│   │   └── AuthContext.jsx      # JWT storage, current user state
│   ├── components/
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
│   │   └── ui/                  # Button, Badge, Modal, Toast
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
| :--- | :--- |
| Landing | Hero section, specialty highlights, CTA to register |
| Login / Register | Role selection (Patient / Doctor), form validation, strong password rules |
| Search Doctors | Filters (specialty, name), paginated doctor cards |
| Doctor Profile | Bio, avg rating, reviews list, interactive slot picker |
| Booking Confirmation | Summary card, visit reason input, confirm button |
| Patient Dashboard | Upcoming / past appointments, cancel / reschedule actions |
| Doctor Dashboard | Today's schedule, pending confirmation queue, complete + notes |
| Availability Settings | Weekly hours grid + slot duration selector |
| Admin Dashboard | Stats cards, user management table, specialty management |

---

## 9. Technology Stack

| Layer | Technology |
| :--- | :--- |
| Frontend framework | React 18 (Vite) |
| Styling | Tailwind CSS 3 |
| HTTP client | Axios |
| Routing | React Router v6 |
| State management | React Context + custom hooks |
| Backend framework | FastAPI (Python) |
| ORM | SQLAlchemy 2 (async) |
| Database | PostgreSQL 15 |
| Authentication | JWT (python-jose) + bcrypt (passlib) |
| Migrations | Alembic |
| Containerization | Docker (multi-stage) + docker-compose (2 services: app + db) |
| Environment config | pydantic-settings (.env) |
| Email | fastapi-mail + aiosmtplib + Jinja2 |
| Testing (backend) | pytest + pytest-asyncio + httpx |

---

## 10. Non-Functional Requirements

- **Security:** bcrypt password hashing (min 8 chars, 1 uppercase, 1 digit); JWT short-lived access token + refresh token rotation; RBAC role guards on every protected endpoint; HTTPS in production (TLS 1.2+).
- **Data Integrity:** Slot locking during booking prevents double-booking under concurrent requests; unique constraint on `(doctor_id, scheduled_at)`; one review per completed appointment.
- **Availability:** System must remain operational 24/7 to support self-service booking outside clinic hours.
- **Performance:** API responses under 2 seconds under normal load; async SQLAlchemy + asyncpg for non-blocking DB access.
- **Validation:** Pydantic v2 schemas on backend; client-side form validation on frontend with clear error messages via Toast.
- **Responsiveness:** Tailwind responsive utilities; mobile-first layout for patients booking on phones.
- **Error Handling:** Consistent `{ "detail": "..." }` JSON error responses; HTTP status codes 400/401/403/404/409/422; toast notifications on frontend.
- **Compliance:** No plaintext passwords stored; `.env` secrets excluded from version control; CORS restricted to known origins.

---

## 11. Monorepo Layout

```
/  (project root)
├── backend/            FastAPI application (Python) — also serves compiled React SPA
├── frontend/           React + Vite application (JS/JSX)
├── Dockerfile          Multi-stage monolith image (Node build → Python runtime)
├── docker-compose.yml  2 services: app (port 8000) + postgres
├── .env                Environment variables (git-ignored)
├── .env.example        Shared environment variable template
├── requirements.txt    Python dependencies
└── PLAN.md             ← this file
```

---

## 12. Verification & Testing Plan

1. **Unit tests (backend):** pytest + httpx AsyncClient — cover auth flow, booking conflict detection, role guard enforcement, status transition validation.
2. **Swagger UI:** Exercise all endpoints manually at `/docs` after spinning up docker-compose.
3. **End-to-end patient flow:** Register → search → book → doctor confirms → patient reschedules → patient cancels → verify status transitions in DB.
4. **End-to-end doctor flow:** Set availability → view schedule → mark appointment completed → verify review eligibility for patient.
5. **Admin flow:** Log in as admin → list users → deactivate account → manage specialties → view stats dashboard.
6. **Concurrency testing:** Simulate simultaneous booking requests for the same slot — verify slot locking prevents double-booking.
7. **Email notifications:** Verify confirmation and reminder emails are dispatched at the correct appointment lifecycle events.
8. **Frontend:** Navigate all pages in both desktop and mobile viewports; verify protected routes redirect unauthenticated users to login.

# Reschedule Process:
# Appointment Re-negotiation Process (Reschedule)
**Compliance Standard:** HL7 FHIR Standards

This automated workflow is triggered upon receiving a `Reschedule` request from either a Patient or a Provider. The system strictly executes the following four-step re-negotiation protocol:

---

### 1. Receive & Update Status
* **Data Logging:** Record the `proposedNewTime` within the Appointment resource.
* **Participant State Management:**
    * Update the requesting participant’s status to `tentative`.
    * Set all other involved participants' statuses to `needs-action` to prompt for concurrence.

### 2. Resource Management (Slot Management)
* **Slot Release:** Immediately revert the original time slot to `FREE` status in the scheduling system.
* **Smart Waitlist Trigger:** Automatically dispatch notifications to patients on the **Smart Waitlist** regarding the newly available opening.
* **Concurrency Control:** Apply a **Temporary Slot Lock** to the newly selected time period to prevent race conditions or double-booking.

### 3. Business Rules Validation
* **Policy Compliance:** Evaluate the request timestamp against administrative policies (e.g., the **48-hour rule**).
* **Financial Processing:** * Automatically calculate applicable rescheduling fees if the request violates clinic policy.
    * Execute deposit deductions or generate billing invoices as dictated by the business logic.

### 4. Finalize & Notify
* **Agreement Verification:** Once all participants have updated their status to `accepted`.
* **System Finalization:**
    * Update the overall Appointment status to `booked`.
    * Transition the new time slot status to `BUSY`.
* **Automated Communication:** Dispatch final confirmation via **SMS or Email** containing the updated schedule details to all relevant parties.

---
**FHIR Mapping Note:** - **Resources:** `Appointment`, `Slot`, `Schedule`, `Communication`.
- **Status Codes:** Follows `AppointmentStatus` and `ParticipantStatus` value sets.


# 13. Comprehensive Healthcare Appointment Workflow (End-to-End)
## Modern Healthcare System (Based on HL7 FHIR Standards & Operational Governance)

This document outlines the professional workflow for medical scheduling, from initial discovery to post-visit care, utilizing international data interoperability standards.

---

### 1. Discovery & Proposed
* **Search:** Patients search for doctors, specialties, or services. The system queries available time slots (Status: `FREE`) based on the practitioner's `Schedule`.
* **Proposal & Temporary Hold:** * Once a slot is selected, an `Appointment` resource is created with a `proposed` status.
    * **Slot Locking:** The system triggers a temporary lock on the selected slot to prevent **double-booking** while the patient completes form entry or payment.

### 2. Payment & Confirmation (Booked)
* **Payment/Deposit:** * To ensure commitment, patients may be required to pay a deposit (e.g., 30% of the service fee).
    * Slots are usually held for a specific window (e.g., 2 hours) awaiting payment confirmation.
    * Integration with `Coverage` and `Claim` resources allows for real-time insurance eligibility checks.
* **Finalization:** Upon successful payment, the appointment status transitions to `booked`, and the slot status updates to `BUSY`.
* **Automated Reminders:** Multi-channel notifications (SMS/Email/In-app) are sent 24 hours and 2 hours prior to the appointment to minimize **no-show** rates.

### 3. Rescheduling Process
The rescheduling flow operates as a **Re-negotiation** mechanism with strict financial rules:
* **Negotiation Mechanism:** * The requester sends a `proposedNewTime`. 
    * Requester status becomes `tentative`; the respondent status becomes `needs-action`. 
    * The new time is only finalized as `booked` once all parties have `accepted`.
* **Financial Rules (Sample):**
    * *Over 48 hours notice:* First reschedule is free; subsequent changes may incur a processing fee.
    * *Within 48 hours notice:* A penalty (e.g., 30% of the deposit) may be automatically applied.
* **Slot Management:** The original slot is immediately released back to `FREE`. The **Smart Waitlist** feature then notifies queued patients of the new opening to optimize clinic revenue.

### 4. Cancellation & Refund
* **Cancellation:** If a request is `declined` or the patient cancels, the status moves to `cancelled`. If the patient fails to appear without notice, it is recorded as a `noshow`.
* **Refund/Penalty Policy:**
    * **Early Cancellation (>48h):** Patient incurs a small cancellation fee, and the remainder is **refunded**.
    * **Late Cancellation/No-show (<48h):** Usually results in a 100% deposit penalty to cover operational losses.
    * **Data Integrity:** The `cancellationReason` is always logged for financial auditing.

### 5. Arrival & Clinical Encounter
* **Check-in:** On the day of the visit, the patient scans a **QR code** at a Kiosk or Reception. The status immediately updates to `arrived`, bypassing traditional paperwork.
* **Clinical Encounter:** * This event triggers the creation of an `Encounter` record in the HIS/EMR system.
    * The clinician tracks vitals, orders tests, or issues prescriptions.
    * Any additional sub-services (lab tests, imaging) require payment via the app or counter before execution.

### 6. Fulfillment & Post-visit Care
* **Completion:** Once the consultation ends, the appointment status is marked as `fulfilled`.
* **Patient Engagement:**
    * **Feedback:** Automated Quality of Service surveys (Rating/Review).
    * **Patient Portal:** Patients access their **Electronic Health Records (EHR)**, including lab results, prescriptions, and vitals.
    * **Follow-up:** The system proposes or automatically schedules follow-up appointments based on the doctor's orders.

---
*Technical Note: This workflow maps directly to HL7 FHIR resources including **Appointment, Slot, Patient, Coverage, and Encounter**.*