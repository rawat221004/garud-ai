"""Shared incident persistence helpers used by both the incidents router and
the simulation scenario engine (single code path = honest workflow)."""

from __future__ import annotations

import json
import secrets
from datetime import datetime, timezone

from . import db
from .models import TriageResult
from .timeutil import utc_now_iso


def new_incident_id() -> str:
    stamp = datetime.now(timezone.utc).strftime("%y%m%d-%H%M%S")
    rand = secrets.token_hex(2).upper()
    return f"INC-{stamp}-{rand}"


def build_row(
    *,
    incident_id: str,
    lat: float,
    lon: float,
    city: str,
    location_label: str,
    category: str,
    title: str,
    description: str,
    people_affected: int | None,
    assistance_needed: bool,
    source_type: str,
    triage: TriageResult,
) -> dict:
    now = utc_now_iso()
    return {
        "id": incident_id,
        "created_at": now,
        "updated_at": now,
        "lat": lat,
        "lon": lon,
        "location_label": location_label or "",
        "city": city or "",
        "category": category,
        "title": title,
        "description": description,
        "people_affected": people_affected,
        "assistance_needed": 1 if assistance_needed else 0,
        "severity": triage.urgency,
        "urgency_score": triage.urgency_score,
        "status": "reported",
        "source_type": source_type,
        "assigned_team": None,
        "triage_engine": triage.engine,
        "triage_json": triage.model_dump_json(),
    }


def insert_with_events(row: dict) -> dict:
    """Persist the incident and its initial audit events (blocking; wrap in run_db)."""
    db.insert_incident(row)
    db.insert_event(
        row["id"], row["created_at"], "Incident reported",
        f"Received via {row['source_type']} report", actor="reporter",
    )
    db.insert_event(
        row["id"], row["created_at"], "Auto-triage completed",
        f"Engine {row['triage_engine']} assessed urgency '{row['severity']}' "
        f"(score {row['urgency_score']}/100)", actor="triage",
    )
    return row


def triage_of(row: dict) -> TriageResult | None:
    if not row.get("triage_json"):
        return None
    try:
        return TriageResult.model_validate(json.loads(row["triage_json"]))
    except Exception:  # noqa: BLE001
        return None
