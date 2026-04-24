# Code Style & Conventions

## Backend (Python / FastAPI)

### General
- Python 3.11+
- Type hints on all function signatures (arguments + return types)
- Pydantic v2 schemas for all request/response models
- Async-first: use `async def` for all route handlers and service methods
- SQLAlchemy 2 async ORM (`AsyncSession`, `select()`, `await session.execute()`)

### Naming
- Files & modules: `snake_case`
- Classes: `PascalCase`
- Functions / variables: `snake_case`
- Constants: `UPPER_SNAKE_CASE`
- Pydantic schemas: suffix with `Create`, `Update`, `Response` (e.g. `UserCreate`, `UserResponse`)
- SQLAlchemy models: singular noun (e.g. `User`, `Doctor`, `Appointment`)

### Structure (Monolith)
- Routers contain HTTP logic **AND** the business logic for their domain (no services layer)
- `routers/appointments.py` — booking helpers (`_book`, `_reschedule`, `_validate_status_transition`, etc.)
- `routers/doctors.py` — availability helpers (`get_open_slots`, `is_slot_available`, etc.)
- `routers/auth.py` — authentication logic
- DB session injected via `Depends(get_db)` from `dependencies.py`
- JWT + role guards also in `dependencies.py`
- Settings loaded via `pydantic-settings` `BaseSettings` class in `config.py`
- `services/` directory exists but all files raise `ImportError` (dead stubs)

### Error handling
- Raise `HTTPException` with `{"detail": "..."}` body
- Use specific HTTP status codes (400, 401, 403, 404, 409, 422)

### Testing
- Use `pytest` with `pytest-asyncio`
- Use `httpx.AsyncClient` for endpoint tests
- Tests in `backend/tests/`

## Frontend (React / JSX)

### General
- React 18 functional components only (no class components)
- JSX files use `.jsx` extension; plain JS utilities use `.js`
- React Router v6 for routing
- React Context (`AuthContext`) for global auth state
- Custom hooks in `src/hooks/` (prefix: `use`)

### Naming
- Components: `PascalCase` filenames and function names (e.g. `DoctorCard.jsx`)
- Hooks: `camelCase` with `use` prefix (e.g. `useAuth.js`)
- API modules: `camelCase` + `Api` suffix (e.g. `doctorApi.js`)
- CSS: Tailwind utility classes only (no custom CSS files unless necessary)

### API layer
- All HTTP calls go through `axiosClient.js` (base URL + JWT interceptor)
- Each domain has its own API module (`authApi.js`, `doctorApi.js`, etc.)
- In dev: Vite proxies `/api` to `localhost:8000` (no CORS issues)
- In prod: same origin, no proxy needed

### Error handling
- Display errors via `Toast` component
- Axios interceptors handle 401 (token refresh / redirect to login)
