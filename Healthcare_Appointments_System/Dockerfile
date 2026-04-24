# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Build React SPA
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

# Install dependencies (cached unless package*.json changes)
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy source and build — outputs to /app/backend/app/static (per vite.config.js)
COPY frontend/ ./
RUN npm run build


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Python runtime (FastAPI monolith)
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Pull in the compiled React artefacts produced by Stage 1
COPY --from=frontend-build /app/backend/app/static ./backend/app/static

WORKDIR /app/backend

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
