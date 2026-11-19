"""Incident reporting and response workflow (Feature D).

SQLite-backed CRUD + validated status transitions + audit events + SSE push.
Everything a coordinator does here is a prototype workflow: GARUD AI never
contacts real emergency services.
"""

from __future__ import annotations

import asyncio
import json
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from .. import db, incident_service
from ..ai.triage import triage_incident
from ..config import CITIES, get_city
from ..eventbus import bus
from ..models import (
    CATEGORY_LABELS,
    IncidentCreate,
    IncidentPatch,
    STATUS_TRANSITIONS,
    STATUS_TRANSITIONS as _TRANS,
)
from ..services.geo import haversine_km
from ..timeutil import utc_now_iso

router = APIRouter(tags=["incidents"])


def _to_out(row: dict) -> dict:
    triage = None
    if row.get("triage_json"):
        try:
            triage = json.loads(row["triage_json"])
        except (ValueError, TypeError):
            triage = None
    return {
        "id": row["id"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "lat": row["lat"],
        "lon": row["lon"],
        "location_label": row["location_label"],
        "city": row["city"],
        "category": row["category"],
        "category_label": CATEGORY_LABELS.get(row["category"], row["category"]),
        "title": row["title"],
        "description": row["description"],
        "people_affected": row["people_affected"],
        "assistance_needed": bool(row["assistance_needed"]),
        "severity": row["severity"],
        "urgency_score": row["urgency_score"],
        "status": row["status"],
        "source_type": row["source_type"],
        "assigned_team": row["assigned_team"],
        "triage_engine": row["triage_engine"],
        "triage": triage,
        "simulated": row["source_type"] == "simulation",
        "allowed_next_statuses": sorted(STATUS_TRANSITIONS.get(row["status"], set())),
    }


def _nearest_city_id(lat: float, lon: float, max_km: float = 75.0) -> str:
    best: tuple[float, str] | None = None
    for c in CITIES.values():
        d = haversine_km(lat, lon, c["lat"], c["lon"])
        if best is None or d < best[0]:
            best = (d, c["id"])
    return best[1] if best and best[0] <= max_km else ""


@router.get("/incidents")
async def list_incidents(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    source_type: Optional[str] = Query(None),
    q: Optional[str] = Query(None, max_length=120),
    limit: int = Query(200, ge=1, le=1000),
) -> dict:
    rows = await db.run_db(
        db.list_incidents,
        status=status,
        category=category,
        severity=severity,
        city=city,
        source_type=source_type,
        q=q,
        limit=limit,
    )
    out = [_to_out(r) for r in rows]
    return {"incidents": out, "total": len(out)}


@router.post("/incidents", status_code=201)
async def create_incident(payload: IncidentCreate) -> dict:
    city_id = payload.city
    if city_id is not None:
        city_id = city_id.strip().lower()
        if city_id and get_city(city_id) is None:
            raise HTTPException(
                status_code=422,
                detail=f"Unknown city '{payload.city}'. Valid ids: {', '.join(CITIES.keys())}",
            )
    if not city_id:
        city_id = _nearest_city_id(payload.lat, payload.lon)

    triage = await triage_incident(
        title=payload.title,
        description=payload.description,
        category_hint=payload.category,
        people_affected=payload.people_affected,
        assistance_needed=payload.assistance_needed,
    )

    row = incident_service.build_row(
        incident_id=incident_service.new_incident_id(),
        lat=payload.lat,
        lon=payload.lon,
        city=city_id,
        location_label=payload.location_label,
        category=payload.category.value,
        title=payload.title,
        description=payload.description,
        people_affected=payload.people_affected,
        assistance_needed=payload.assistance_needed,
        source_type=payload.source_type,
        triage=triage,
    )
    await db.run_db(incident_service.insert_with_events, row)
    bus.publish(
        "incident.created",
        {"incident_id": row["id"], "severity": row["severity"], "title": row["title"]},
    )
    return _to_out(row)


@router.get("/incidents/events")
async def activity_timeline(limit: int = Query(50, ge=1, le=200), source_type: Optional[str] = Query(None)) -> dict:
    rows = await db.run_db(db.recent_events, limit, source_type)
    for r in rows:
        r["simulated"] = r.get("source_type") == "simulation"
    return {"events": rows, "total": len(rows)}


@router.get("/incidents/stream")
async def incidents_stream() -> StreamingResponse:
    """Server-Sent Events stream: incident + simulation updates, keepalive 15s."""
    q = bus.subscribe()

    async def gen():
        try:
            hello = {"type": "connected", "at": utc_now_iso(), "payload": {"note": "GARUD incident stream"}}
            yield f"data: {json.dumps(hello)}\n\n"
            while True:
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield f"data: {json.dumps(msg)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            bus.unsubscribe(q)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/incidents/{incident_id}")
async def get_incident(incident_id: str) -> dict:
    row = await db.run_db(db.get_incident, incident_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Incident '{incident_id}' not found.")
    history = await db.run_db(db.get_events_for, incident_id)
    out = _to_out(row)
    out["status_history"] = history
    return out


@router.patch("/incidents/{incident_id}")
async def patch_incident(incident_id: str, patch: IncidentPatch) -> dict:
    row = await db.run_db(db.get_incident, incident_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Incident '{incident_id}' not found.")

    now = utc_now_iso()
    fields: dict = {}
    new_events: List[tuple] = []  # (event, detail)

    if patch.status is not None:
        new_status = patch.status.value
        allowed = STATUS_TRANSITIONS.get(row["status"], set())
        if new_status not in allowed:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": f"Invalid transition {row['status']} → {new_status}.",
                    "allowed": sorted(allowed),
                },
            )
        fields["status"] = new_status
        detail = f"Status {row['status']} → {new_status}"
        if patch.note:
            detail += f" — {patch.note}"
        new_events.append(("Status updated", detail))

    if patch.assigned_team is not None:
        fields["assigned_team"] = patch.assigned_team
        new_events.append(("Team assigned", f"Assigned to {patch.assigned_team}" + (f" — {patch.note}" if patch.note else "")))
        # assigning a team implicitly advances an unassigned queue item
        if patch.status is None and row["status"] in ("reported", "under_review"):
            fields["status"] = "assigned"
            new_events.append(("Status updated", f"Status {row['status']} → assigned"))

    if not fields and not new_events:
        if patch.note:
            new_events.append(("Coordinator note", patch.note))
        else:
            raise HTTPException(status_code=400, detail="No changes requested (status, assigned_team or note required).")

    if fields:
        fields["updated_at"] = now
        await db.run_db(db.update_incident, incident_id, fields)

    for event, detail in new_events:
        await db.run_db(db.insert_event, incident_id, now, event, detail, "coordinator")

    bus.publish(
        "incident.updated",
        {"incident_id": incident_id, "status": fields.get("status", row["status"]),
         "assigned_team": fields.get("assigned_team", row["assigned_team"])},
    )

    updated = await db.run_db(db.get_incident, incident_id)
    out = _to_out(updated)
    out["status_history"] = await db.run_db(db.get_events_for, incident_id)
    return out
