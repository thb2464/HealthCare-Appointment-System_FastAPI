# Healthcare Appointments System — Project Overview (Monolith)

## Purpose
A full-stack web application that connects **patients** with **healthcare providers** (doctors/specialists).
It handles the full appointment lifecycle: discovery, booking, rescheduling, cancellation, reminders, and follow-up reviews.

## Architecture: Monolith
The system is a **single deployable unit**:
- FastAPI serves both the REST API and the compiled React SPA
- No separate frontend container or process in production
- `npm run build` outputs to `backend/app/static/`; FastAPI mounts it as StaticFiles + SPA fallback

## User Roles
- **Patient** — registers, searches doctors, books/reschedules/cancels appointments, leaves reviews
- **Doctor/Provider** — manages availability, views schedule, confirms/completes appointments
- **Admin** — manages all users, specialties, clinic data, views platform statistics

## Tech Stack
| Layer | Technology |
|---|---|
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
| Containerisation | Docker (multi-stage) + docker-compose (2 services) |
| Environment config | pydantic-settings (.env) |
| Email | fastapi-mail + aiosmtplib + Jinja2 |
| Testing (backend) | pytest + pytest-asyncio + httpx |

## Monorepo Layout
```
/  (project root)
├── backend/            FastAPI application (Python) — also serves compiled React SPA
├── frontend/           React + Vite application (JS/JSX)
├── Dockerfile          Multi-stage monolith image (Node build → Python runtime)
├── docker-compose.yml  2 services: app + postgres
├── .env.example        Shared environment variable template
├── README.md
└── PLAN.md
```
