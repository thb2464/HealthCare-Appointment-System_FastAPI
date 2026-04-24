# Codebase Structure (Monolith)

## Backend (`backend/`)
```
backend/
├── app/
│   ├── main.py              # App factory, CORS, API routers, StaticFiles + SPA fallback
│   ├── config.py            # pydantic-settings BaseSettings (.env loading)
│   ├── database.py          # Async SQLAlchemy engine & session factory
│   ├── dependencies.py      # get_db, get_current_user, role guards
│   ├── models/              # SQLAlchemy ORM models (User, Doctor, Specialty, Availability, Appointment, Review)
│   ├── schemas/             # Pydantic v2 request/response schemas
│   ├── routers/             # Route handlers + inlined business logic (NO separate services layer)
│   │   ├── auth.py          # Auth logic inline
│   │   ├── users.py
│   │   ├── doctors.py       # Availability helpers inlined (get_open_slots, is_slot_available, etc.)
│   │   ├── appointments.py  # Booking helpers inlined (_book, _reschedule, _validate_status_transition, etc.)
│   │   ├── reviews.py
│   │   └── admin.py
│   ├── services/            # REMOVED — files raise ImportError to catch stale imports
│   ├── utils/               # security.py (JWT/bcrypt), email.py (notifications)
│   └── static/              # Compiled React SPA (output of `npm run build`; git-ignored)
├── alembic/                 # DB migration scripts
├── tests/                   # pytest test suite
└── (requirements.txt at project root)
```

## Frontend (`frontend/`)
```
frontend/
├── src/
│   ├── main.jsx             # React entry point
│   ├── App.jsx              # Route definitions (React Router v6)
│   ├── api/                 # axiosClient.js + domain API modules
│   ├── context/             # AuthContext.jsx (JWT + user state)
│   ├── components/          # Reusable UI: Navbar, DoctorCard, AppointmentCard, Calendar/, forms/, ui/
│   ├── pages/               # Route pages: LandingPage, auth/, patient/, doctor/, admin/
│   ├── hooks/               # useAuth.js, useAppointments.js
│   └── utils/               # dateHelpers.js
├── index.html
├── tailwind.config.js
├── vite.config.js           # outDir → ../backend/app/static; /api proxy → :8000
└── package.json
```
(frontend/Dockerfile removed — frontend is built into backend/app/static/)

## Deployment
- **Root Dockerfile** — multi-stage: Stage 1 = Node build, Stage 2 = Python runtime
- **docker-compose.yml** — 2 services only: `app` (port 8000) + `db` (PostgreSQL 15)
- **Local dev** — Vite dev server (:5173) proxies /api to FastAPI (:8000)
- **Production** — single FastAPI process serves API + React SPA from same origin

## Key API Endpoints
| Method | Path | Access |
|---|---|---|
| POST | /api/auth/register | Public |
| POST | /api/auth/login | Public |
| GET  | /api/doctors | Public |
| GET  | /api/doctors/{id} | Public |
| PUT  | /api/doctors/me/availability | Doctor |
| POST | /api/appointments | Patient |
| PATCH| /api/appointments/{id} | Auth |
| POST | /api/reviews | Patient |
| GET  | /api/admin/users | Admin |
| GET  | /api/admin/stats | Admin |

## Appointment Status Flow
```
PENDING → CONFIRMED → COMPLETED
PENDING / CONFIRMED → CANCELLED
CONFIRMED → RESCHEDULED → CONFIRMED
```
