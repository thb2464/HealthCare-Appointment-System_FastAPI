# Healthcare Appointments System

A full-stack web application connecting patients with healthcare providers.  
Built as a **monolith**: the FastAPI backend serves both the REST API and the compiled React SPA from a single process and a single container.

---

## Architecture Overview

```
Browser
  │  HTTP (same origin in production)
  ▼
FastAPI  (port 8000)
  ├── /api/*          → REST endpoints
  ├── /docs           → Swagger UI
  ├── /assets/*       → Compiled React JS/CSS (StaticFiles)
  └── /*              → index.html  (React Router SPA fallback)
  │
  ▼
PostgreSQL 15
```

During **local development** the Vite dev server (`localhost:5173`) proxies `/api` requests to FastAPI (`localhost:8000`), so no CORS changes are needed.

In **production** (Docker) a single container at port `8000` serves everything.

---

## Project Structure

```
/  (project root)
├── backend/
│   ├── app/
│   │   ├── main.py             # App factory + SPA static file serving
│   │   ├── config.py           # pydantic-settings (.env loading)
│   │   ├── database.py         # Async SQLAlchemy engine & session
│   │   ├── dependencies.py     # get_db, JWT auth guards
│   │   ├── models/             # SQLAlchemy ORM models
│   │   │   ├── user.py
│   │   │   ├── doctor.py
│   │   │   ├── appointment.py
│   │   │   ├── availability.py
│   │   │   ├── review.py
│   │   │   ├── specialty.py
│   │   │   └── waitlist.py
│   │   ├── schemas/            # Pydantic v2 schemas
│   │   │   ├── user.py
│   │   │   ├── doctor.py
│   │   │   ├── appointment.py
│   │   │   └── review.py
│   │   ├── routers/            # Route handlers
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── doctors.py
│   │   │   ├── appointments.py
│   │   │   ├── reviews.py
│   │   │   └── admin.py
│   │   ├── utils/
│   │   │   ├── security.py     # JWT / bcrypt
│   │   │   ├── email.py        # Email notifications
│   │   │   └── reminders.py    # Appointment reminder logic
│   │   └── static/             # ← compiled React SPA (git-ignored)
│   ├── alembic/                # DB migration scripts
│   │   └── versions/
│   ├── scripts/
│   │   └── seed_db.py          # Database seeding script
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   ├── test_appointments.py
│   │   ├── test_doctors.py
│   │   ├── test_reviews.py
│   │   └── test_admin.py
│   └── seed.py
├── frontend/
│   └── src/
│       ├── api/                # Axios API clients
│       │   ├── axiosClient.js
│       │   ├── authApi.js
│       │   ├── appointmentApi.js
│       │   ├── doctorApi.js
│       │   ├── adminApi.js
│       │   └── reviewApi.js
│       ├── components/
│       │   ├── AppointmentCard/
│       │   ├── DoctorCard/
│       │   ├── Navbar/
│       │   ├── Calendar/
│       │   │   ├── SlotPicker/
│       │   │   └── WeekView/
│       │   ├── forms/
│       │   │   ├── BookingForm/
│       │   │   ├── LoginForm/
│       │   │   └── RegisterForm/
│       │   └── ui/             # Reusable UI primitives
│       │       ├── Badge/
│       │       ├── Button/
│       │       ├── Modal/
│       │       └── Toast/
│       ├── context/
│       │   └── AuthContext.jsx
│       ├── hooks/
│       │   ├── useAuth.js
│       │   └── useAppointments.js
│       ├── pages/
│       │   ├── LandingPage/
│       │   ├── ProfilePage/
│       │   ├── auth/
│       │   │   ├── LoginPage/
│       │   │   └── RegisterPage/
│       │   ├── patient/
│       │   │   ├── PatientDashboard/
│       │   │   ├── SearchPage/
│       │   │   ├── DoctorProfilePage/
│       │   │   ├── BookingPage/
│       │   │   └── CheckoutPage/
│       │   ├── doctor/
│       │   │   ├── DoctorDashboard/
│       │   │   └── AvailabilitySettings/
│       │   └── admin/
│       │       └── AdminDashboard/
│       └── utils/
│           └── dateHelpers.js
├── Dockerfile              # Multi-stage: Node build → Python runtime
├── docker-compose.yml      # app + postgres (2 services)
├── requirements.txt        # Python dependencies
└── .env.example            # Environment variable template
```

---

## Prerequisites

| Tool | Minimum Version |
|---|---|
| Python | 3.11+ |
| Node.js | 18+ |
| npm | 9+ |
| PostgreSQL | 15 |
| Docker Desktop *(optional)* | any |

---

## Local Development (without Docker)

### 1 — Clone & configure

```bash
git clone <repo-url>
cd Healthcare_Appointments_System
cp .env.example .env   # Windows: copy .env.example .env
# Edit .env — set DATABASE_URL, SECRET_KEY, etc.
```

### 2 — Backend

```bash
# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
source venv/bin/activate       # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Apply database migrations
cd backend
python -m alembic upgrade head

# Start FastAPI dev server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API: **http://localhost:8000**
- Swagger UI: **http://localhost:8000/docs**

### 3 — Frontend

Open a **new terminal**:

```bash
cd frontend
npm install
npm run dev
```

- Vite dev server: **http://localhost:5173**  
  All `/api` requests are proxied to `localhost:8000` (configured in `vite.config.js`).

### 4 — Tests

```bash
cd backend
pytest
pytest --cov=app --cov-report=term-missing
```

---

## Production Build (single-origin)

Build the React SPA so it is served directly by FastAPI:

```bash
cd frontend
npm install
npm run build   # outputs to backend/app/static/
```

Then start FastAPI — it automatically detects and serves the static files:

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open **http://localhost:8000** — the React app is served from the same origin as the API.

---

## Docker (recommended for production)

```bash
# Build image and start containers (app + postgres)
docker-compose up --build

# Stop
docker-compose down

# Stop and remove database volume
docker-compose down -v
```

The Docker build is a **two-stage Dockerfile**:
1. **Stage 1** — Node 20 builds the React SPA (`npm run build`)
2. **Stage 2** — Python 3.11 copies the artefacts into `backend/app/static/` and starts Uvicorn

All traffic goes through **port 8000** — no separate frontend container.

---

## Quick Reference

| Command | Description |
|---|---|
| `pip install -r requirements.txt` | Install Python packages |
| `cd backend && alembic upgrade head` | Apply DB migrations |
| `uvicorn app.main:app --reload` | Start backend dev server |
| `cd frontend && npm run dev` | Start frontend dev server (Vite) |
| `cd frontend && npm run build` | Build SPA into `backend/app/static/` |
| `pytest` *(from backend/)* | Run backend tests |
| `docker-compose up --build` | Start full stack via Docker |

---

## Troubleshooting

**`asyncpg` fails to install on Windows:**  
Install [Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/).

**PostgreSQL connection refused:**  
Ensure the PostgreSQL service is running and credentials in `.env` match.

**Port 8000 already in use:**  
Change with `--port 8001` in the Uvicorn command and update `BACKEND_CORS_ORIGINS` in `.env`.

**React app shows 404 on page refresh:**  
This should not happen with the monolith setup — FastAPI's SPA fallback route catches all non-API paths and returns `index.html`.
