"""GARUD AI backend application entrypoint.

Run from the backend/ directory:
    .venv\\Scripts\\uvicorn app.main:app --port 8000
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import BACKEND_DIR, settings
from .db import init_db
from .routers import ai, hazards, incidents, resources, risk, simulation, system, weather
from .services.cache import ExternalSourceError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("garud")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("GARUD AI backend ready (v%s)", settings.app_version)
    yield


app = FastAPI(
    title="GARUD AI API",
    version=settings.app_version,
    lifespan=lifespan,
    description=(
        "Geospatial AI for Risk Understanding & Disaster Response — CipherCop 2026, "
        "Team Garud Dwaar. Live sources: Open-Meteo, USGS, NASA EONET, GDACS, OSM. "
        "All AI outputs are decision-support recommendations for human coordinators."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ExternalSourceError)
async def external_source_handler(request: Request, exc: ExternalSourceError):
    return JSONResponse(
        status_code=503,
        content={"detail": {"message": f"External source '{exc.source}' unavailable.", "error": exc.detail[:300]}},
    )


app.include_router(system.router, prefix="/api")
app.include_router(weather.router, prefix="/api")
app.include_router(hazards.router, prefix="/api")
app.include_router(risk.router, prefix="/api")
app.include_router(incidents.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(resources.router, prefix="/api")
app.include_router(simulation.router, prefix="/api")


# Optionally serve a production frontend build (frontend/dist) if present.
_FRONTEND_DIST = BACKEND_DIR.parent / "frontend" / "dist"


@app.get("/health", include_in_schema=False)
async def health_alias() -> dict:
    return {"status": "ok", "note": "canonical health endpoint: /api/health"}


if _FRONTEND_DIST.is_dir():
    async def frontend_route() -> FileResponse:
        return FileResponse(_FRONTEND_DIST / "index.html")

    for path in ("/map", "/forecast", "/incidents", "/system"):
        app.add_api_route(path, frontend_route, methods=["GET"], include_in_schema=False)

    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIST), html=True), name="frontend")
else:

    @app.get("/")
    async def root() -> dict:
        return {
            "app": settings.app_name,
            "version": settings.app_version,
            "docs": "/docs",
            "api_base": "/api",
            "note": "Run the Vite dev server for the dashboard (frontend/), or build it into frontend/dist to serve it here.",
        }
