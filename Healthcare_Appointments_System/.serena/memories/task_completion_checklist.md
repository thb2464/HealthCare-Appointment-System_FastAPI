# Task Completion Checklist

When a coding task is completed, run the following steps:

## Backend
1. **Lint / type check** (if configured):
   ```
   # from backend/ with venv active
   flake8 app/          # or ruff check app/
   mypy app/            # if mypy is set up
   ```
2. **Run tests**:
   ```
   pytest
   pytest --cov=app --cov-report=term-missing
   ```
3. **Check migrations** — if models changed:
   ```
   alembic revision --autogenerate -m "describe change"
   alembic upgrade head
   ```
4. **Verify endpoints** in Swagger UI at http://localhost:8000/docs

## Frontend
1. **Lint**:
   ```
   npm run lint         # from frontend/
   ```
2. **Test build** (also validates SPA → backend/app/static/ output):
   ```
   npm run build        # from frontend/
   ```
3. **Manual check** — navigate affected pages in browser at http://localhost:5173 (dev) or http://localhost:8000 (after build)

## Monolith-specific
- After `npm run build`, restart FastAPI and verify the SPA is served at http://localhost:8000
- Confirm all `/api/*` routes still respond correctly alongside the static files
- Ensure `backend/app/static/` is in `.gitignore`

## General
- Ensure `.env.example` is updated if new env vars were added
- Ensure no secrets are committed (check `.env` is in `.gitignore`)
- CORS: only needed for Vite dev server (:5173). Production is same-origin — `BACKEND_CORS_ORIGINS` can be `[]`
