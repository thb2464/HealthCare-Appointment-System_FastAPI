# Healthcare Appointment Scheduling Web Application — Implementation Plan

## 1. Business Concept

A modern healthcare scheduling platform that connects patients with healthcare providers through an automated, self-service model. The system handles the full appointment lifecycle: discovery, booking with online payment, multi-party rescheduling negotiation, cancellation with financial penalties, QR check-in, clinical encounter management (EHR), insurance claims, and post-visit follow-up care.

### Core Value Propositions

- **Patient Empowerment:** 24/7 self-service booking, automated multi-tier reminders (24h & 2h), QR check-in, EHR access for prescriptions and lab results, and insurance claim submission.
- **Provider Efficiency:** Real-time availability management, clear daily/weekly schedule views, clinical encounter recording (diagnosis, vitals, prescriptions, lab orders), and follow-up scheduling.
- **Smart Financial Management:** VNPay payment integration with server-side slot reservation, automated penalty/refund calculation per cancellation/reschedule policies, and insurance copay calculation.
- **Multi-party Negotiation:** Rescheduling requires both parties to agree — requests are proposed, then accepted or declined by the other party.
- **Smart Waitlist:** When a confirmed slot is freed (cancellation, no-show, reschedule), the oldest waitlist patient is automatically notified.
- **Data Integrity:** PostgreSQL advisory locks + unique constraints + application-level checks prevent double-booking under concurrent load.

---

## 2. User Roles

| Role | Description |
| :--- | :--- |
| **Patient** | Searches providers, books/reschedules/cancels appointments, pays via VNPay, receives email reminders, checks in via QR, accesses EHR (prescriptions, lab results), submits insurance claims, and leaves post-visit reviews. |
| **Doctor / Provider** | Manages weekly availability, accesses daily schedule, confirms/completes appointments, records clinical encounters (diagnosis, vitals, prescriptions, lab orders), recommends follow-ups, accepts/declines reschedule requests. |
| **Receptionist / Staff** | Manages walk-ins, marks patient arrivals, handles schedule overrides, generates QR check-in tokens, immediate rescheduling without negotiation. |
| **Admin** | Manages all users and providers, oversees platform analytics, manages medical specialties, processes refunds, approves/denies insurance claims, enforces state machine transitions. |

---

## 3. User Stories

### Patient
1. Register and log in securely with validated email and strong password.
2. Search doctors by specialty, location, or name.
3. View doctor profile — bio, specialty, consultation fee, ratings, and available slots.
4. Book an available appointment slot with VNPay payment (15-minute server-side slot reservation).
5. View all upcoming and past appointments in a personal dashboard with status filters.
6. Reschedule a PENDING appointment directly; request reschedule for CONFIRMED appointments (requires doctor approval).
7. Accept or decline reschedule requests initiated by the doctor.
8. Cancel appointments with automated penalty/refund calculation based on timing.
9. Receive automated email confirmations and reminders (24h, 2h before visit).
10. Check in via QR code scan on appointment day.
11. Access Electronic Health Records — encounter notes, prescriptions, lab results.
12. Submit insurance claims for completed appointments.
13. Book follow-up appointments linked to a completed visit.
14. Leave a rating and review after a completed appointment.
15. Join/leave a doctor waitlist for cancellation notifications.

### Doctor / Provider
1. Register, log in, and complete provider profile (bio, specialty, fee, clinic address).
2. Set weekly working hours and slot duration to control availability.
3. View daily and weekly appointment schedule in list or calendar view.
4. Confirm, reschedule, or cancel patient appointments.
5. Initiate reschedule requests for CONFIRMED appointments (patient must accept/decline).
6. Accept/decline patient-initiated reschedule requests.
7. Mark appointments as completed with clinical notes and follow-up recommendations.
8. Record clinical encounters — diagnosis, vitals (JSON), treatment notes.
9. Add prescriptions and order lab tests within an encounter.
10. Mark patients as no-show with automatic deposit forfeiture.
11. Generate QR check-in tokens for upcoming appointments.

### Admin
1. Manage (view, activate, deactivate) all users and providers.
2. Manage medical specialties (create, update, delete).
3. View platform-wide statistics — users, appointments by status, revenue, waitlist, daily trends.
4. Update appointment status with state machine enforcement.
5. Process pending refunds for cancelled appointments.
6. Approve or deny insurance claims.

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
Select slot → [Advisory Lock + Slot Reservation] → Proceed to VNPay payment
        │
        ▼
System creates Appointment (status: PENDING, payment_expires_at = now + 15min)
Email "Booking Received" dispatched (pending confirmation)
        │
   ┌────┴────────────┐
   │                  │
VNPay payment       Payment timeout (15 min)
succeeds             │
   │                  ▼
   │            Auto-cancel (slot freed)
   ▼
Status → CONFIRMED (deposit_paid=true, deposit_amount recorded)
Email "Confirmed by Doctor" dispatched
   │
   ├── Reminders: 24h before + 2h before (with deduplication)
   │
   ▼
Appointment day → Patient scans QR check-in
   │
   ▼
Status → ARRIVED → Encounter auto-created
Doctor records diagnosis, vitals, prescriptions, lab orders
   │
   ▼
Doctor marks COMPLETED + optional follow-up recommendation
   │
   ▼
Patient can: leave review, submit insurance claim, book follow-up
   │
   ▼
[If cancelled] → Penalty/refund calculated → Slot released → Waitlist notified
[If no-show]   → 100% deposit forfeited → Slot released → Waitlist notified
```

**Appointment Status Flow:**

```
PENDING → CONFIRMED → ARRIVED → COMPLETED
PENDING / CONFIRMED → CANCELLED
CONFIRMED → RESCHEDULE_REQUESTED → CONFIRMED (accepted) or revert (declined)
CONFIRMED → RESCHEDULED → CONFIRMED
CONFIRMED / ARRIVED → NOSHOW
RESCHEDULED → CONFIRMED / CANCELLED
RESCHEDULE_REQUESTED → CONFIRMED / CANCELLED / RESCHEDULED
```

**Financial & Penalty Regulations:**

| Scenario | Timeframe | Fees & Penalties |
| :--- | :--- | :--- |
| Reschedule (1st time) | > 48 hours | Free |
| Reschedule (subsequent) | > 48 hours | 30% of deposit surcharge |
| Late Reschedule | < 48 hours | 30% of deposit penalty |
| Early Cancellation | > 48 hours | 30% fee, 70% refund (refund_status=PENDING) |
| Late Cancel / No-Show | < 48 hours / Missed | 100% deposit forfeited, no refund |

---

## 5. System Architecture

### High-Level Overview (Monolith)

```
┌──────────────────────────────────────────────────────────────┐
│                      Client (Browser)                         │
│             React 18 + Tailwind CSS (SPA)                     │
│  White & Green theme · CSS custom properties                  │
│  Pages: Auth · Search · Doctor Profile · Dashboards           │
│    Booking (2-col layout) · Checkout · Availability Settings  │
│    Admin Panel · Profile                                      │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTP (same origin in production)
                       │ JWT in Authorization header
┌──────────────────────▼───────────────────────────────────────┐
│             FastAPI Monolith  (single process)                │
│  /api/*  → Routers: auth · users · doctors · appointments ·  │
│             reviews · admin · payment · waitlist ·            │
│             encounters · insurance                            │
│  /assets → StaticFiles  (compiled React JS/CSS)               │
│  /*      → SPA fallback  (index.html)                         │
│  Middleware: CORS (dev only) · JWT auth · Role guards         │
│  Background: reminder_loop (24h/2h reminders + payment expiry)│
└──────────────────────┬───────────────────────────────────────┘
                       │ SQLAlchemy 2 ORM (async)
┌──────────────────────▼───────────────────────────────────────┐
│                  PostgreSQL 15 Database                        │
│  Tables: users · doctors · specialties · availabilities       │
│    appointments · reviews · waitlist · encounters ·           │
│    prescriptions · lab_results · insurance_coverages ·        │
│    insurance_claims                                           │
│  Enums: appointmentstatus · refundstatus · claimstatus ·      │
│    labresultstatus · userrole                                 │
└──────────────────────────────────────────────────────────────┘
```

**Design decisions:**
- No separate `services/` layer — business logic lives in router files.
- React SPA compiled (`npm run build`) into `backend/app/static/` and served by FastAPI.
- Single Docker container (multi-stage: Node → Python) + one PostgreSQL container.
- Background asyncio task for reminder deduplication and payment hold expiry.
- CSS custom properties for theming; white & emerald-green light theme.

---

## 6. Backend Architecture — FastAPI

### Project Structure

```
backend/
├── app/
│   ├── main.py                  # App factory, CORS, router registration, lifespan (reminders)
│   ├── config.py                # Settings (env vars via pydantic-settings, VNPay config)
│   ├── database.py              # Async SQLAlchemy engine & session factory
│   ├── dependencies.py          # get_db, get_current_user, role guards (CurrentPatient, etc.)
│   ├── models/
│   │   ├── user.py              # User, UserRole enum
│   │   ├── doctor.py            # Doctor (1:1 with User)
│   │   ├── specialty.py         # Medical specialties
│   │   ├── availability.py      # Weekly availability windows, DayOfWeek enum
│   │   ├── appointment.py       # Appointment, AppointmentStatus, RefundStatus enums
│   │   ├── review.py            # Patient reviews (1 per completed appointment)
│   │   ├── waitlist.py          # WaitlistEntry (patient × doctor, unique)
│   │   ├── encounter.py         # Encounter, Prescription, LabResult, LabResultStatus
│   │   └── insurance.py         # InsuranceCoverage, InsuranceClaim, ClaimStatus
│   ├── schemas/
│   │   ├── user.py
│   │   ├── doctor.py            # Doctor, Specialty, Availability schemas
│   │   ├── appointment.py       # Create, StatusUpdate, Reschedule, FollowUp, Response schemas
│   │   ├── review.py
│   │   ├── waitlist.py          # WaitlistCreate, WaitlistResponse
│   │   ├── encounter.py         # Encounter, Prescription, LabResult schemas
│   │   └── insurance.py         # Coverage, Claim schemas
│   ├── routers/
│   │   ├── auth.py              # Register, login, refresh, me
│   │   ├── users.py             # User profile management
│   │   ├── doctors.py           # Doctor search, profile, availability, open slots
│   │   ├── appointments.py      # Booking, status updates, reschedule negotiation, follow-up, check-in
│   │   ├── reviews.py           # Create/list reviews
│   │   ├── admin.py             # User/doctor/appointment management, stats (with state machine)
│   │   ├── payment.py           # VNPay create/retry/return, refund processing
│   │   ├── waitlist.py          # Join/list/leave waitlist
│   │   ├── encounters.py        # Encounter CRUD, prescriptions, lab results
│   │   └── insurance.py         # Coverage CRUD, claim submission/processing
│   └── utils/
│       ├── security.py          # JWT encode/decode, bcrypt hashing
│       ├── email.py             # 8 email notification functions (booking, confirmed, reminder, etc.)
│       └── reminders.py         # Background loop: 24h/2h reminders (deduplicated) + payment expiry
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
| GET | `/api/auth/me` | Auth | Current user profile |
| GET | `/api/doctors` | Public | Search/list doctors |
| GET | `/api/doctors/{id}` | Public | Doctor profile |
| GET | `/api/doctors/{id}/slots?date=` | Public | Available slots for a date |
| GET | `/api/doctors/{id}/availability` | Public | Weekly availability windows |
| PUT | `/api/doctors/me/availability` | Doctor | Replace weekly availability |
| PATCH | `/api/doctors/me` | Doctor | Update profile |
| POST | `/api/appointments` | Patient | Book appointment (direct, no payment) |
| GET | `/api/appointments` | Auth | List appointments (filtered by role) |
| GET | `/api/appointments/{id}` | Auth | Appointment detail |
| PATCH | `/api/appointments/{id}` | Auth | Update status/notes (with penalty on cancel/noshow) |
| DELETE | `/api/appointments/{id}` | Auth | Cancel appointment (with penalty/refund) |
| PATCH | `/api/appointments/{id}/reschedule` | Auth | Request or perform reschedule |
| PATCH | `/api/appointments/{id}/reschedule/accept` | Auth | Accept reschedule request |
| PATCH | `/api/appointments/{id}/reschedule/decline` | Auth | Decline reschedule request |
| PATCH | `/api/appointments/{id}/arrive` | Staff | Mark patient as arrived |
| PATCH | `/api/appointments/{id}/noshow` | Staff | Mark no-show (forfeit deposit) |
| GET | `/api/appointments/{id}/checkin-token` | Staff | Generate QR check-in token |
| POST | `/api/appointments/{id}/checkin` | Public | QR check-in (signed token auth) |
| POST | `/api/appointments/{id}/follow-up` | Patient | Book a linked follow-up |
| POST | `/api/payment/vnpay/create` | Patient | Book + get VNPay URL (15-min slot hold) |
| POST | `/api/payment/vnpay/retry/{id}` | Patient | Retry payment for existing PENDING |
| GET | `/api/payment/vnpay/return` | Internal | VNPay callback → confirm + redirect |
| POST | `/api/payment/vnpay/refund/{id}` | Admin | Mark refund as completed |
| POST | `/api/waitlist` | Patient | Join waitlist for a doctor |
| GET | `/api/waitlist` | Patient | List own waitlist entries |
| DELETE | `/api/waitlist/{doctor_id}` | Patient | Leave waitlist |
| GET | `/api/encounters/{appt_id}` | Auth | View encounter record (EHR) |
| PATCH | `/api/encounters/{appt_id}` | Doctor | Update encounter (diagnosis, vitals) |
| POST | `/api/encounters/{appt_id}/prescriptions` | Doctor | Add prescription |
| GET | `/api/encounters/{appt_id}/prescriptions` | Auth | List prescriptions |
| POST | `/api/encounters/{appt_id}/lab-results` | Doctor | Order lab test |
| PATCH | `/api/encounters/{appt_id}/lab-results/{id}` | Doctor | Update lab result |
| GET | `/api/encounters/{appt_id}/lab-results` | Auth | List lab results |
| POST | `/api/insurance/coverage` | Patient | Add insurance coverage |
| GET | `/api/insurance/coverage` | Patient | List own coverages |
| DELETE | `/api/insurance/coverage/{id}` | Patient | Remove coverage |
| POST | `/api/insurance/claims/{appt_id}` | Patient/Admin | Submit insurance claim |
| GET | `/api/insurance/claims` | Auth | List claims (role-filtered) |
| PATCH | `/api/insurance/claims/{id}` | Admin | Approve/deny claim |
| POST | `/api/reviews` | Patient | Submit review |
| GET | `/api/reviews/doctor/{id}` | Public | List doctor reviews |
| GET | `/api/admin/users` | Admin | List all users |
| POST | `/api/admin/users` | Admin | Create doctor/receptionist |
| PATCH | `/api/admin/users/{id}` | Admin | Toggle active status |
| GET | `/api/admin/appointments` | Admin | List all appointments |
| PATCH | `/api/admin/appointments/{id}` | Admin | Update status (state machine enforced) |
| GET | `/api/admin/doctors` | Admin | List all doctors |
| PATCH | `/api/admin/doctors/{id}` | Admin | Update doctor profile |
| GET | `/api/admin/stats` | Admin | Platform statistics |
| GET/POST | `/api/specialties` | Public/Admin | List/create specialties |

---

## 7. Database Schema

```
users
  id, email, hashed_password, full_name, role (PATIENT/DOCTOR/RECEPTIONIST/ADMIN),
  phone, avatar_url, is_active, created_at, updated_at

doctors  (one-to-one with users)
  id, user_id (FK→users), specialty_id (FK→specialties), bio,
  license_number, years_experience, clinic_address,
  consultation_fee, avg_rating

specialties
  id, name, description, icon

availabilities
  id, doctor_id (FK→doctors), day_of_week (0=Mon…6=Sun),
  start_time, end_time, slot_duration_minutes, is_active

appointments
  id, patient_id (FK→users), doctor_id (FK→doctors),
  scheduled_at (timestamptz), end_at (timestamptz),
  status (PENDING/CONFIRMED/ARRIVED/COMPLETED/CANCELLED/RESCHEDULED/NOSHOW/RESCHEDULE_REQUESTED),
  reason, notes, cancellation_reason,
  -- Payment / financial
  deposit_paid, vnpay_txn_ref, deposit_amount, refund_amount, penalty_amount,
  refund_status (NONE/PENDING/COMPLETED), payment_expires_at,
  -- Reschedule negotiation
  reschedule_count, reschedule_fee_applied,
  proposed_new_time, reschedule_requested_by ('patient'/'doctor'),
  status_before_reschedule_request,
  -- Reminder deduplication
  reminder_24h_sent, reminder_2h_sent,
  -- Follow-up
  follow_up_of (FK→appointments, self-ref), follow_up_recommended, follow_up_date,
  -- Timestamps
  created_at, updated_at
  UNIQUE(doctor_id, scheduled_at)

reviews
  id, appointment_id (FK→appointments, UNIQUE),
  patient_id (FK→users), doctor_id (FK→doctors),
  rating (1–5), comment, created_at

waitlist
  id, patient_id (FK→users), doctor_id (FK→doctors), created_at
  UNIQUE(patient_id, doctor_id)

encounters
  id, appointment_id (FK→appointments, UNIQUE),
  doctor_id (FK→doctors), patient_id (FK→users),
  chief_complaint, diagnosis, treatment_notes,
  vitals_json (JSON: blood_pressure, heart_rate, temperature, weight, height),
  created_at, updated_at

prescriptions
  id, encounter_id (FK→encounters),
  medication_name, dosage, frequency, duration, instructions,
  created_at

lab_results
  id, encounter_id (FK→encounters),
  test_name, result_value, unit, reference_range,
  status (ORDERED/COMPLETED), ordered_at, completed_at

insurance_coverages
  id, patient_id (FK→users), provider_name, policy_number, group_number,
  coverage_start, coverage_end, is_active,
  copay_percentage (% patient pays), created_at, updated_at

insurance_claims
  id, appointment_id (FK→appointments, UNIQUE), coverage_id (FK→insurance_coverages),
  total_amount, covered_amount, patient_responsibility,
  status (PENDING/SUBMITTED/APPROVED/DENIED), denial_reason,
  submitted_at, processed_at
```

---

## 8. Frontend Architecture — React + Tailwind CSS

### Project Structure

```
frontend/
├── src/
│   ├── main.jsx
│   ├── index.css                # White & emerald-green theme (CSS custom properties)
│   ├── App.jsx                  # Route definitions (React Router v6)
│   ├── api/
│   │   ├── axiosClient.js       # Axios base instance + JWT interceptors + auto-refresh
│   │   ├── authApi.js
│   │   ├── doctorApi.js
│   │   ├── appointmentApi.js    # Includes acceptReschedule, declineReschedule, follow-up
│   │   └── reviewApi.js
│   ├── context/
│   │   └── AuthContext.jsx      # JWT storage, current user state
│   ├── components/
│   │   ├── Navbar/              # Sticky navbar with role-based links
│   │   ├── DoctorCard/          # Doctor search result card
│   │   ├── AppointmentCard/     # Shows proposed_new_time for RESCHEDULE_REQUESTED
│   │   ├── Calendar/
│   │   │   ├── WeekView/        # Doctor weekly schedule view
│   │   │   └── SlotPicker/      # Calendar + time slot grid (compact mode for modals)
│   │   ├── forms/
│   │   │   ├── LoginForm/
│   │   │   ├── RegisterForm/
│   │   │   └── BookingForm/     # Legacy wrapper (unused — BookingPage is self-contained)
│   │   └── ui/
│   │       ├── Button/
│   │       ├── Badge/           # Supports RESCHEDULE_REQUESTED status
│   │       ├── Modal/
│   │       └── Toast/
│   ├── pages/
│   │   ├── LandingPage/         # Hero, features, specialties, CTA
│   │   ├── ProfilePage/         # User profile edit
│   │   ├── auth/
│   │   │   ├── LoginPage/
│   │   │   └── RegisterPage/
│   │   ├── patient/
│   │   │   ├── SearchPage/      # Doctor search with filters
│   │   │   ├── DoctorProfilePage/ # Doctor detail + reviews
│   │   │   ├── BookingPage/     # Redesigned 2-column layout (calendar left, sidebar right)
│   │   │   ├── CheckoutPage/    # VNPay payment confirmation
│   │   │   └── PatientDashboard/ # Appointments, reschedule accept/decline, waitlist status
│   │   ├── doctor/
│   │   │   ├── DoctorDashboard/ # Schedule, confirm/complete/reschedule, accept/decline requests
│   │   │   └── AvailabilitySettings/ # Weekly hours grid (Mon=0 convention)
│   │   └── admin/
│   │       └── AdminDashboard/  # Stats, user/doctor management
│   ├── hooks/
│   │   ├── useAuth.js
│   │   └── useAppointments.js
│   └── utils/
│       └── dateHelpers.js       # Timezone-safe toDateParam, formatDateTime, getWeekDays
├── tailwind.config.js           # Emerald accent, light shadows, no dark mode
├── vite.config.js               # outDir → ../backend/app/static; /api proxy → :8000
└── package.json
```

### Key Pages & Features

| Page | Key Features |
| :--- | :--- |
| Landing | Hero section, feature cards, specialty grid, CTA, trust badges |
| Login / Register | Role selection (Patient / Doctor), form validation, strong password rules |
| Search Doctors | Name search + specialty filter + pagination (search input properly sized) |
| Doctor Profile | Bio, avg rating, reviews list, booking CTA |
| Booking (redesigned) | 2-column layout: calendar + slots on left, doctor info + reason + summary on right |
| Checkout | VNPay payment flow, summary card |
| Patient Dashboard | Status filter tabs (incl. RESCHEDULE_REQUESTED), reschedule negotiation (accept/decline/waiting), cancel with reason, VNPay retry, review submission |
| Doctor Dashboard | Status filter tabs (incl. RESCHEDULE_REQUESTED), confirm/complete/reschedule/noshow actions, accept/decline reschedule requests, clinical notes modal, profile edit, list & calendar views |
| Availability Settings | Weekly day cards (Mon–Sun), time range inputs, slot duration selector |
| Admin Dashboard | Stats cards, user management, appointment management, specialty management |

### Theme

- **White & Emerald-Green** light theme via CSS custom properties
- Backgrounds: `#ffffff` (primary), `#f8fafb` (secondary)
- Accent: `#059669` (emerald-600), `#10b981` (emerald-500)
- Text: `#0f172a` (headings), `#1e293b` (body), `#64748b` (muted)
- Cards: white with `#e2e8f0` border and subtle `rgba(0,0,0,0.06)` shadow
- No glow effects — clean, professional medical aesthetic

---

## 9. Technology Stack

| Layer | Technology |
| :--- | :--- |
| Frontend framework | React 18 (Vite) |
| Styling | Tailwind CSS 3 + CSS custom properties |
| HTTP client | Axios |
| Routing | React Router v6 |
| State management | React Context + custom hooks |
| Backend framework | FastAPI (Python) |
| ORM | SQLAlchemy 2 (async) |
| Database | PostgreSQL 15 |
| Authentication | JWT (python-jose) + bcrypt (passlib) |
| Migrations | Alembic |
| Payment | VNPay sandbox (HMAC-SHA512 signed URLs) |
| Containerization | Docker (multi-stage) + docker-compose (2 services: app + db) |
| Environment config | pydantic-settings (.env) |
| Email | fastapi-mail + aiosmtplib |
| Background tasks | asyncio (reminder loop + payment expiry) |
| Testing (backend) | pytest + pytest-asyncio + httpx |

---

## 10. Non-Functional Requirements

- **Security:** bcrypt password hashing; JWT short-lived access + refresh token rotation; RBAC role guards on every endpoint; HMAC-SHA256 signed check-in tokens; HMAC-SHA512 VNPay signature verification; HTTPS in production.
- **Data Integrity:** PostgreSQL advisory locks prevent concurrent double-booking; unique constraint on `(doctor_id, scheduled_at)`; one review per completed appointment; one claim per appointment; server-side slot reservation during payment.
- **Financial Compliance:** Automated penalty/refund calculation per TASK.md rules; `refund_status` tracking; `cancellationReason` always logged for auditing.
- **Availability:** 24/7 operation; background task loop for reminders and payment expiry.
- **Performance:** Async SQLAlchemy + asyncpg; API responses under 2 seconds; efficient slot computation (no Slot table — computed dynamically).
- **Deduplication:** Reminder flags (`reminder_24h_sent`, `reminder_2h_sent`) prevent duplicate emails.
- **Validation:** Pydantic v2 schemas on backend; client-side form validation with Toast notifications.
- **Responsiveness:** Mobile-first layout; 2-column booking page on desktop; sticky sidebar.
- **Theming:** CSS custom properties enable easy theme switching; current theme: white & emerald-green.

---

## 11. Monorepo Layout

```
/  (project root)
├── backend/            FastAPI application — serves API + compiled React SPA
├── frontend/           React + Vite application (JS/JSX)
├── Dockerfile          Multi-stage monolith image (Node build → Python runtime)
├── docker-compose.yml  2 services: app (port 8000) + postgres
├── .env                Environment variables (git-ignored)
├── .env.example        Shared environment variable template
├── requirements.txt    Python dependencies
├── TASK.md             HL7 FHIR standard workflow reference
└── PLAN.md             ← this file
```

---

## 12. HL7 FHIR Workflow Compliance

The system implements the full HL7 FHIR-inspired appointment lifecycle defined in TASK.md:

### 1. Discovery & Proposed
- Patient searches doctors/specialties, system computes available slots dynamically from `availabilities` table.
- Appointment created as PENDING with advisory lock slot protection.
- **Slot Locking:** PostgreSQL `pg_try_advisory_xact_lock` + unique constraint + application check (3 layers).

### 2. Payment & Booked
- VNPay integration with 15-minute server-side slot reservation (`payment_expires_at`).
- On payment success: status → CONFIRMED, `deposit_paid=true`, `deposit_amount` recorded.
- Background task auto-cancels expired PENDING appointments.
- Insurance copay calculation available via `InsuranceCoverage.copay_percentage`.
- Multi-tier reminders: 24h and 2h before, with deduplication flags.

### 3. Reschedule (Multi-party Negotiation)
- Patient/doctor submits `proposed_new_time` → status becomes `RESCHEDULE_REQUESTED`.
- Other party can `accept` (executes reschedule) or `decline` (reverts to previous status).
- Admin/receptionist bypass negotiation (immediate reschedule).
- Financial penalties: 1st free if >48h; subsequent or <48h = 30% of deposit.
- Original slot freed → waitlist notified automatically.

### 4. Cancellation & Refund
- Early cancel (>48h): 30% penalty, 70% refund (`refund_status=PENDING`).
- Late cancel (<48h): 100% deposit forfeited.
- No-show: 100% deposit forfeited.
- `cancellation_reason` always logged.
- Admin can process pending refunds via `/api/payment/vnpay/refund/{id}`.
- Freed slots trigger waitlist notification.

### 5. Arrived & Clinical Encounter
- QR check-in via HMAC-SHA256 signed tokens (1-hour validity).
- Manual arrival marking by receptionist/doctor/admin.
- `Encounter` record auto-created on ARRIVED status.
- Doctor records: chief complaint, diagnosis, treatment notes, vitals (JSON).
- Prescriptions and lab results tracked per encounter.
- Lab results have ORDERED → COMPLETED lifecycle.

### 6. Fulfilled & Post-visit Care
- Doctor marks COMPLETED with optional clinical notes and follow-up recommendation.
- Automated emails: visit complete + review request + follow-up suggestion.
- Patient EHR access: encounters, prescriptions, lab results via `/api/encounters/{id}`.
- Follow-up booking linked to parent appointment via `follow_up_of` field.
- Insurance claims submitted post-visit, processed by admin (PENDING → SUBMITTED → APPROVED/DENIED).
- Review system: 1-5 rating + comment, auto-recalculates doctor `avg_rating`.

---

## 13. Verification & Testing Plan

1. **Unit tests (backend):** pytest + httpx AsyncClient — auth flow, booking conflicts, role guards, status transitions, penalty calculation.
2. **Swagger UI:** Exercise all 50+ endpoints at `/docs`.
3. **Patient flow:** Register → search → book with VNPay → slot held → payment → confirmed → receive reminders → QR check-in → view encounter → submit claim → book follow-up → leave review.
4. **Reschedule negotiation:** Patient requests reschedule for CONFIRMED appointment → doctor sees RESCHEDULE_REQUESTED → accepts/declines → verify status transitions and penalty calculation.
5. **Cancellation flow:** Cancel >48h → verify 30% penalty + 70% refund. Cancel <48h → verify 100% forfeit. No-show → verify forfeit.
6. **Waitlist flow:** Patient joins waitlist → appointment cancelled → verify email notification → entry removed.
7. **Encounter/EHR flow:** Appointment arrives → encounter created → doctor adds diagnosis, prescription, lab order → patient reads EHR.
8. **Insurance flow:** Patient adds coverage → books → completes → submits claim with copay calculation → admin approves/denies.
9. **Payment expiry:** Book via VNPay → wait >15 min → verify auto-cancel by background task.
10. **Reminder dedup:** Confirm flags prevent duplicate 24h/2h emails across multiple poll cycles.
11. **Concurrency:** Simultaneous booking requests for same slot → verify advisory lock prevents double-booking.
12. **Admin state machine:** Verify admin status updates go through `_validate_status_transition()`.
13. **Frontend:** Navigate all pages in desktop and mobile; verify white & green theme renders correctly; verify reschedule accept/decline UI in both dashboards.
