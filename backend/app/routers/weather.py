"""Weather forecast endpoints (Open-Meteo) with simulation overlay support."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from .. import risk
from ..config import get_city
from ..sim import scenario as sim_scenario
from ..services import weather as weather_svc
from ..services.cache import ExternalSourceError

router = APIRouter(tags=["weather"])


async def _envelope(city_id: str) -> dict:
    city = get_city(city_id)
    if city is None:
        raise HTTPException(status_code=404, detail=f"Unknown city '{city_id}'. See /api/locations.")
    try:
        return await weather_svc.get_weather_envelope(city_id, simulated_supplier=sim_scenario.simulated_weather_supplier)
    except ExternalSourceError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "message": "Weather source temporarily unavailable and no cached data exists yet.",
                "source": exc.source,
                "error": exc.detail[:300],
            },
        ) from exc


@router.get("/weather")
async def weather(city: str = Query("hyderabad"), hours: int = Query(48, ge=6, le=48)) -> dict:
    env = await _envelope(city)
    assessment = risk.assess(env["hourly"], env["city"]["name"], bool(env.get("simulated")))
    out = weather_svc.trimmed_forecast(env, hours)
    out["risk"] = assessment
    return out


@router.get("/weather/forecast")
async def weather_forecast(city: str = Query("hyderabad"), hours: int = Query(48, ge=6, le=48)) -> dict:
    """Alias of /weather kept for API discoverability."""
    return await weather(city=city, hours=hours)
