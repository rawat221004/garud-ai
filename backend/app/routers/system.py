"""System health, data-source status and dashboard overview endpoints."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from .. import db
from ..ai.gemini import gemini_available
from ..config import CITIES, RESPONSE_TEAMS, settings
from ..services import eonet, earthquakes, gdacs
from ..services.cache import ExternalSourceError, all_source_snapshots
from ..services.risksvc import assess_all_cities, elevated_count
from ..sim import scenario as sim_scenario
from ..timeutil import utc_now_iso

router = APIRouter(tags=["system"])

OPEN_STATUSES = ("reported", "under_review", "assigned", "responding")


@router.get("/health")
async def health() -> dict:
    db_ok = True
    try:
        await db.run_db(db.incident_counts)
    except Exception:  # noqa: BLE001
        db_ok = False
    return {
        "status": "ok" if db_ok else "degraded",
        "time": utc_now_iso(),
        "version": settings.app_version,
        "app": settings.app_name,
        "db_ok": db_ok,
        "gemini_configured": gemini_available(),
    }


@router.get("/locations")
async def locations() -> dict:
    return {
        "cities": list(CITIES.values()),
        "default_city": "hyderabad",
    }


@router.get("/system/status")
async def system_status() -> dict:
    sim = sim_scenario.state()
    counts = await db.run_db(db.incident_counts)
    snapshots = all_source_snapshots()
    last_sync = max((s["last_success"] for s in snapshots if s["last_success"]), default=None)

    states = [s["state"] for s in snapshots]
    if not states or all(st == "unknown" for st in states):
        data_state = "unknown"  # freshly started server — nothing fetched yet
    elif all(st == "ok" for st in states):
        data_state = "live"
    elif any(st in ("ok", "degraded") for st in states):
        data_state = "cached"
    else:
        data_state = "offline"

    return {
        "sources": snapshots,
        "data_state": data_state,
        "last_sync": last_sync,
        "gemini": {"configured": gemini_available(), "model": settings.gemini_model if gemini_available() else None},
        "simulation": sim,
        "incident_counts": counts,
        "locations": list(CITIES.values()),
        "response_teams": RESPONSE_TEAMS,
        "timezone_note": "Timestamps stored in UTC; displayed in Asia/Kolkata.",
    }


@router.get("/overview")
async def overview() -> dict:
    """Dashboard KPIs — every number is computed from live source caches and
    the SQLite incident store. Nothing is hardcoded."""
    # --- forecast-driven risk across all monitored cities --------------------
    assessments = await assess_all_cities()
    elevated = elevated_count(assessments)

    # --- tracked hazard events -------------------------------------------------
    eq_meta = {}
    eq_count = 0
    try:
        q = await earthquakes.get_earthquakes()
        eq_count = sum(1 for e in q["data"] if (e.get("magnitude") or 0) >= 4.5)
        eq_meta = {"fetched_at": q["fetched_at"], "stale": q["stale"]}
    except ExternalSourceError as exc:
        eq_meta = {"error": str(exc)[:200]}

    eonet_meta = {}
    eonet_count = 0
    try:
        ev = await eonet.get_events()
        eonet_count = len(ev["data"])
        eonet_meta = {"fetched_at": ev["fetched_at"], "stale": ev["stale"]}
    except ExternalSourceError as exc:
        eonet_meta = {"error": str(exc)[:200]}

    gdacs_meta = {}
    gdacs_count = 0
    try:
        gd = await gdacs.get_events()
        gdacs_count = len(gd["data"])
        gdacs_meta = {"fetched_at": gd["fetched_at"], "stale": gd["stale"]}
    except ExternalSourceError as exc:
        gdacs_meta = {"error": str(exc)[:200]}

    # --- incident records --------------------------------------------------------
    rows = await db.run_db(db.list_incidents, limit=1000)
    open_rows = [r for r in rows if r["status"] in OPEN_STATUSES]
    critical = sum(1 for r in open_rows if r["severity"] in ("critical", "high"))
    awaiting = sum(1 for r in open_rows if not r["assigned_team"] and r["status"] in ("reported", "under_review"))
    sim_open = sum(1 for r in open_rows if r["source_type"] == "simulation")

    snapshots = all_source_snapshots()
    last_sync = max((s["last_success"] for s in snapshots if s["last_success"]), default=None)

    sim = sim_scenario.state()
    by_severity = {}
    for a in assessments:
        by_severity[a["severity"]] = by_severity.get(a["severity"], 0) + 1

    return {
        "generated_at": utc_now_iso(),
        "active_events": {
            "total": eonet_count + gdacs_count + eq_count,
            "usgs_significant_earthquakes_24h": eq_count,
            "eonet_open_events": eonet_count,
            "gdacs_events": gdacs_count,
            "usgs": eq_meta,
            "eonet": eonet_meta,
            "gdacs": gdacs_meta,
        },
        "elevated_risk_locations": elevated,
        "risk_by_severity": by_severity,
        "risk_summary": [
            {
                "city": a["city"],
                "city_id": a["city_id"],
                "severity": a["severity"],
                "score": a["score"],
                "simulated": a["simulated"],
                "lat": a["lat"],
                "lon": a["lon"],
                "windows": a["windows"],
            }
            for a in assessments
        ],
        "critical_open_incidents": critical,
        "incidents_awaiting_assignment": awaiting,
        "open_incidents": len(open_rows),
        "simulated_open_incidents": sim_open,
        "last_sync": last_sync,
        "simulation": sim,
    }
