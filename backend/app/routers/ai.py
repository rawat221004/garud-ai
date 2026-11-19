"""AI Incident Commander endpoints: situation briefing + incident triage.

Gemini is used when configured; the deterministic, clearly-labelled
rule-based fallback otherwise. All AI output is a recommendation for a human
coordinator — never an operational instruction.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from .. import db
from ..ai.briefing import generate_briefing
from ..ai.triage import triage_incident
from ..config import get_city, settings
from ..eventbus import bus
from ..models import BriefingRequest, IncidentCategory, TriageRequest
from ..timeutil import utc_now_iso

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/briefing")
async def briefing(req: BriefingRequest) -> dict:
    if get_city(req.city) is None:
        raise HTTPException(status_code=404, detail=f"Unknown city '{req.city}'. See /api/locations.")
    result = await generate_briefing(req.city, req.language)
    return result.model_dump()


@router.post("/triage")
async def triage(req: TriageRequest) -> dict:
    """Re-triage a stored incident (persisted) or triage raw text (not persisted)."""
    if req.incident_id:
        row = await db.run_db(db.get_incident, req.incident_id)
        if row is None:
            raise HTTPException(status_code=404, detail=f"Incident '{req.incident_id}' not found.")
        try:
            hint = IncidentCategory(row["category"])
        except ValueError:
            hint = None
        result = await triage_incident(
            title=row["title"],
            description=row["description"],
            category_hint=hint,
            people_affected=row["people_affected"],
            assistance_needed=bool(row["assistance_needed"]),
        )
        now = utc_now_iso()
        await db.run_db(
            db.update_incident,
            req.incident_id,
            {
                "severity": result.urgency,
                "urgency_score": result.urgency_score,
                "triage_engine": result.engine,
                "triage_json": result.model_dump_json(),
                "updated_at": now,
            },
        )
        await db.run_db(
            db.insert_event,
            req.incident_id,
            now,
            "Re-triage completed",
            f"Engine {result.engine} assessed urgency '{result.urgency}' (score {result.urgency_score}/100)",
            "coordinator",
        )
        bus.publish("incident.updated", {"incident_id": req.incident_id, "severity": result.urgency})
        return {"engine": result.engine, "triage": result.model_dump()}

    if not req.title or not req.description:
        raise HTTPException(status_code=422, detail="title and description are required when incident_id is omitted.")

    result = await triage_incident(
        title=req.title,
        description=req.description,
        category_hint=req.category,
        people_affected=req.people_affected,
        assistance_needed=req.assistance_needed,
    )
    return {"engine": result.engine, "triage": result.model_dump()}
