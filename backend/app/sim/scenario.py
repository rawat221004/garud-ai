"""Simulation scenario engine: state, scripted phases, synthetic weather."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from .. import db, incident_service
from ..ai.triage import triage_incident
from ..eventbus import bus
from ..models import IncidentCategory
from ..timeutil import utc_now_iso

SCENARIO_ID = "hyd-extreme-rainfall"
SCENARIO_TITLE = "Extreme Rainfall & Urban Flood Response — Hyderabad (SIMULATION)"
SCENARIO_CITY_ID = "hyderabad"

PHASE_LABELS = {
    1: "Simulated extreme rainfall forecast active for Hyderabad (synthetic data).",
    2: "Simulated field report: stranded residents near LB Nagar.",
    3: "Additional simulated reports: Musi-bank colony flooding and Begumpet underpass stranding.",
}

# Deterministic synthetic weather (fictional, for demonstration only).
_RAIN = [8, 14, 26, 32, 35, 38, 36, 30, 18, 12, 9, 6] + [3] * 12 + [0.2] * 24
_GUST = [52, 58, 65, 72, 78, 85, 82, 74, 60, 48, 40, 34] + [24] * 12 + [16] * 24
_WIND = [32, 35, 40, 45, 48, 52, 50, 46, 38, 30, 25, 21] + [14] * 12 + [9] * 24
_TEMP = [27, 27, 26, 26, 25, 25, 24, 24, 23, 23, 22, 22] + [22] * 12 + [23] * 24
_HUM = [85, 88, 90, 93, 95, 97, 98, 97, 96, 95, 93, 92] + [90] * 12 + [75] * 24
_PRESSURE = [round(1004 - i * 1.25, 1) for i in range(12)] + [round(990 + i * 0.5, 1) for i in range(12)] + [round(998 + i * 0.5, 1) for i in range(24)]
_CODE = [65, 80, 95, 95, 95, 95, 95, 95, 95, 65, 65, 51] + [61] * 12 + [1] * 24
_PROB = [88, 92, 95, 97, 98, 98, 97, 96, 90, 80, 70, 60] + [55] * 12 + [10] * 24


def state() -> dict:
    raw = db.get_sim_state()
    phase = int(raw.get("phase") or 0)
    return {
        "active": bool(raw.get("active")),
        "phase": phase,
        "phase_label": PHASE_LABELS.get(phase, "Scenario inactive.") if raw.get("active") else "—",
        "started_at": raw.get("started_at"),
        "scenario_id": raw.get("scenario_id"),
        "scenario_title": SCENARIO_TITLE if raw.get("active") else None,
        "city_id": SCENARIO_CITY_ID if raw.get("active") else None,
    }


def build_simulated_hourly() -> List[dict]:
    base = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    hours: List[dict] = []
    for i in range(48):
        t = base + timedelta(hours=i)
        hours.append(
            {
                "time": t.isoformat(timespec="seconds").replace("+00:00", "Z"),
                "temperature_c": _TEMP[i],
                "humidity_pct": _HUM[i],
                "precipitation_mm": float(_RAIN[i]),
                "precipitation_probability_pct": _PROB[i],
                "weather_code": _CODE[i],
                "pressure_hpa": _PRESSURE[i],
                "wind_speed_kmh": float(_WIND[i]),
                "wind_gusts_kmh": float(_GUST[i]),
            }
        )
    return hours


def simulated_envelope(city: dict) -> dict:
    return {
        "city": city,
        "current": {
            "time": utc_now_iso(),
            "temperature_c": 24,
            "humidity_pct": 97,
            "precipitation_mm": 32.0,
            "weather_code": 95,
            "wind_speed_kmh": 45.0,
            "wind_gusts_kmh": 78.0,
        },
        "hourly": build_simulated_hourly(),
        "simulated": True,
        "source": "SIMULATION — synthetic scenario data (not real observations)",
        "scenario": SCENARIO_ID,
        "scenario_title": SCENARIO_TITLE,
    }


async def simulated_weather_supplier(city: dict) -> Optional[dict]:
    """Return the synthetic envelope when the scenario is active for this city."""
    st = state()
    if st["active"] and city["id"] == SCENARIO_CITY_ID:
        return simulated_envelope(city)
    return None


# --- scripted incidents (fixed IDs → idempotent, repeatable runs) -----------

SCENARIO_INCIDENTS: dict[int, list[dict]] = {
    2: [
        {
            "id": "SIM-HYD-FLOOD-01",
            "lat": 17.3490,
            "lon": 78.5540,
            "city": "hyderabad",
            "location_label": "Kothapet / LB Nagar, Hyderabad",
            "category": "flooding",
            "title": "Stranded residents in flooded colonies near LB Nagar",
            "description": (
                "SIMULATED FIELD REPORT. Continuous extreme rainfall since early morning; "
                "colony streets under 3-4 feet of water and water entering ground-floor homes. "
                "Around 40 residents including children and elderly are stranded on upper floors "
                "near Kothapet. Main road and nearby underpass closed. Immediate assistance needed."
            ),
            "people_affected": 40,
            "assistance_needed": True,
        }
    ],
    3: [
        {
            "id": "SIM-HYD-FLOOD-02",
            "lat": 17.3616,
            "lon": 78.4747,
            "city": "hyderabad",
            "location_label": "Chaderghat, Musi river bank, Hyderabad",
            "category": "flooding",
            "title": "Musi overflow flooding low-lying colonies at Chaderghat",
            "description": (
                "SIMULATED FIELD REPORT. Drain channel overflowing into low-lying lanes near the "
                "Musi bank; water waist-deep in several streets. Around 120 residents affected; "
                "two lanes cut off and families requesting relocation support. No injuries reported so far."
            ),
            "people_affected": 120,
            "assistance_needed": True,
        },
        {
            "id": "SIM-HYD-FLOOD-03",
            "lat": 17.4435,
            "lon": 78.4668,
            "city": "hyderabad",
            "location_label": "Begumpet railway underpass, Hyderabad",
            "category": "infrastructure_failure",
            "title": "Vehicles stranded in flooded Begumpet underpass",
            "description": (
                "SIMULATED FIELD REPORT. Railway underpass flooded axle-deep; four vehicles "
                "stranded, occupants moved out with bystander help. Traffic diverted; road closed. "
                "No injuries reported."
            ),
            "people_affected": 8,
            "assistance_needed": False,
        },
    ],
}


def _category_of(key: str) -> IncidentCategory:
    return IncidentCategory(key)


async def _create_incident(inc: dict) -> dict:
    triage = await triage_incident(
        title=inc["title"],
        description=inc["description"],
        category_hint=_category_of(inc["category"]),
        people_affected=inc["people_affected"],
        assistance_needed=inc["assistance_needed"],
    )
    row = incident_service.build_row(
        incident_id=inc["id"],
        lat=inc["lat"],
        lon=inc["lon"],
        city=inc["city"],
        location_label=inc["location_label"],
        category=inc["category"],
        title=inc["title"],
        description=inc["description"],
        people_affected=inc["people_affected"],
        assistance_needed=inc["assistance_needed"],
        source_type="simulation",
        triage=triage,
    )
    await db.run_db(incident_service.insert_with_events, row)
    return row


async def start() -> dict:
    """Activate phase 1 (synthetic weather). Repeatable: resets first."""
    await reset(publish=False)
    started = utc_now_iso()
    await db.run_db(db.set_sim_state, True, 1, started, SCENARIO_ID)
    bus.publish("simulation.changed", {"action": "start", "phase": 1})
    return state()


async def advance() -> dict:
    st = state()
    if not st["active"]:
        raise ValueError("Simulation is not active")
    phase = st["phase"]
    if phase >= 3:
        return state()  # idempotent: already at final scripted phase
    new_phase = phase + 1
    await db.run_db(db.set_sim_state, True, new_phase, st["started_at"], SCENARIO_ID)
    created: list[str] = []
    for inc in SCENARIO_INCIDENTS.get(new_phase, []):
        exists = await db.run_db(db.incident_exists, inc["id"])
        if not exists:  # fixed IDs keep repeat runs duplicate-free
            await _create_incident(inc)
            created.append(inc["id"])
    bus.publish("simulation.changed", {"action": "advance", "phase": new_phase, "created": created})
    return state()


async def reset(publish: bool = True) -> dict:
    """Delete all simulated incidents and deactivate the scenario."""
    removed = await db.run_db(db.delete_incidents_source, "simulation")
    await db.run_db(db.set_sim_state, False, 0, None, None)
    if publish:
        bus.publish("simulation.changed", {"action": "reset", "removed": removed})
    return state()
