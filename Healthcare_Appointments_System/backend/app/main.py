import asyncio
import logging
import traceback
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.openapi.docs import get_redoc_html

from app.config import settings

logger = logging.getLogger(__name__)
from app.routers import (
    auth_router,
    users_router,
    doctors_router,
    specialty_router,
    appointments_router,
    admin_router,
    reviews_router,
    payment_router,
)

# Resolved path to the compiled React SPA (populated by `npm run build`)
_STATIC_DIR = Path(__file__).parent / "static"
_INDEX_HTML  = _STATIC_DIR / "index.html"


# ── Lifespan ───────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.email_configured:
        import logging
        logging.getLogger(__name__).warning(
            "Email not configured (MAIL_FROM/MAIL_USERNAME/MAIL_PASSWORD unset). "
            "Notifications will be logged only."
        )
    from app.utils.reminders import reminder_loop
    task = asyncio.create_task(reminder_loop())
    yield
    task.cancel()


# ── App factory ────────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    description=(
        "REST API for the Healthcare Appointments System. "
        "Connects patients with doctors for streamlined appointment management."
    ),
    docs_url="/docs",
    redoc_url=None,
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
# In production the frontend is served from the same origin, so CORS is only
# needed for local development (Vite dev server on :5173).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global exception handler ───────────────────────────────────────────────────
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "Unhandled exception on %s %s\n%s",
        request.method,
        request.url,
        traceback.format_exc(),
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": str(exc)},
    )

# ── API Routers ────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(doctors_router)
app.include_router(specialty_router)
app.include_router(appointments_router)
app.include_router(reviews_router)
app.include_router(admin_router)
app.include_router(payment_router)

# ── Health check ───────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"], summary="Health check")
async def health_check() -> dict:
    return {"status": "ok", "version": settings.APP_VERSION}

# ── Custom ReDoc (Fix CDN banned) ───────────────────────────────────────
@app.get("/redoc", include_in_schema=False)
async def redoc_html():
    return get_redoc_html(
        openapi_url=app.openapi_url,
        title=app.title + " - ReDoc",
        redoc_js_url="https://unpkg.com/redoc@2.0.0-rc.77/bundles/redoc.standalone.js"
    )

# ── Static frontend (React SPA) ────────────────────────────────────────────────
if _STATIC_DIR.is_dir():
    # Serve JS/CSS/image assets under /assets (Vite default output folder)
    app.mount("/assets", StaticFiles(directory=str(_STATIC_DIR / "assets")), name="assets")

    # SPA fallback — every non-API, non-asset request gets index.html so that
    # React Router can handle client-side navigation.
    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str) -> FileResponse:
        
        if full_path.startswith(("api/", "docs", "redoc", "openapi.json")):
            raise HTTPException(status_code=404, detail="Not found")
        return FileResponse(str(_INDEX_HTML))
