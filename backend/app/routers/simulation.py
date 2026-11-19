"""SIMULATION MODE endpoints (Feature F).

The scenario is entirely fictional; every response is labelled and the UI
shows a persistent SIMULATED banner while active. `start` resets first, so
repeat runs stay clean and duplicate-free.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from .. import db
from ..sim import scenario
from ..sim.scenario import PHASE_LABELS

router = APIRouter(prefix="/simulation", tags=["simulation"])


def _state_with_docs() -> dict:
    st = scenario.state()
    sim_incidents = db.list_incidents(source_type="simulation", limit=100)
    st["simulated_incident_count"] = len(sim_incidents)
    st["phase_definitions"] = [
        {"phase": p, "label": PHASE_LABELS[p]} for p in sorted(PHASE_LABELS)
    ]
    return st


@router.get("/status")
async def status() -> dict:
    return _state_with_docs()


@router.post("/start")
async def start() -> dict:
    """Activate phase 1: simulated extreme-rainfall forecast for Hyderabad."""
    return await scenario.start()


@router.post("/advance")
async def advance() -> dict:
    """Advance to the next scripted phase; idempotent at the final phase."""
    try:
        return await scenario.advance()
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/reset")
async def reset() -> dict:
    """Delete all simulated incidents and deactivate the scenario."""
    return await scenario.reset()
