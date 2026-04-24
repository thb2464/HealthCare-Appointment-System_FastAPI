# Suggested Commands

## System Utilities (Windows)
- List directory: `dir` or `powershell Get-ChildItem`
- Change directory: `cd`
- Find files: `powershell Get-ChildItem -Recurse -Filter *.py`
- Search in files: `powershell Select-String -Recurse -Pattern "keyword"`
- Git: `git status`, `git add`, `git commit`, `git push`

## Backend (FastAPI / Python)

### Setup virtual environment
```
python -m venv venv
venv\Scripts\activate          # Windows
source venv/bin/activate       # macOS/Linux
```

### Install dependencies
```
pip install -r requirements.txt
```

### Run dev server (from backend/)
```
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- Swagger UI: http://localhost:8000/docs
- ReDoc:      http://localhost:8000/redoc

### Database migrations (from backend/)
```
alembic upgrade head           # apply all migrations
alembic revision --autogenerate -m "description"   # create new migration
```

### Run tests (from backend/)
```
pytest
pytest --cov=app --cov-report=term-missing
```

## Frontend (React / Vite)

### Install packages (from frontend/)
```
npm install
```

### Run dev server (from frontend/)
```
npm run dev
```
- App: http://localhost:5173
- All /api requests are proxied to localhost:8000 (vite.config.js)

### Build SPA into backend/app/static/ (from frontend/)
```
npm run build
```
After building, FastAPI at :8000 will serve the full app (API + SPA).

### Lint
```
npm run lint
```

## Docker (monolith — single container + postgres)
```
docker-compose up --build      # start app + postgres
docker-compose down            # stop
docker-compose down -v         # stop + remove DB volume
```
Only port 8000 is exposed (no separate :5173 container).
