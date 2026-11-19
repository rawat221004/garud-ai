"""City risk aggregation shared by /api/risk, /api/overview and the AI briefing."""

from __future__ import annotations

import asyncio
from typing import List, Optional

from .. import risk
from ..config import CITIES, get_city
from ..sim import scenario as sim_scenario
from ..services import weather as weather_svc
from ..services.cache import ExternalSourceError


async def assess_city(city: dict) -> Optional[dict]:
    """Weather + transparent risk assessment for one city (None on source failure)."""
    try:
        weather = await weather_svc.get_weather_envelope(
            city["id"], simulated_supplier=sim_scenario.simulated_weather_supplier
        )
    except ExternalSourceError:
        return None
    assessment = risk.assess(weather["hourly"], city["name"], bool(weather.get("simulated")))
    assessment["city_id"] = city["id"]
    assessment["lat"] = city["lat"]
    assessment["lon"] = city["lon"]
    assessment["weather_fetched_at"] = weather.get("fetched_at")
    assessment["weather_stale"] = weather.get("stale", False)
    return assessment


async def assess_all_cities() -> List[dict]:
    """Assess every monitored city; failed sources simply drop out of the map."""
    tasks = [assess_city(c) for c in CITIES.values()]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    out: List[dict] = []
    for r in results:
        if isinstance(r, dict):
            out.append(r)
    order = {"severe": 0, "high": 1, "elevated": 2, "low": 3}
    out.sort(key=lambda a: order.get(a["severity"], 4))
    return out


def elevated_count(assessments: List[dict]) -> int:
    return sum(1 for a in assessments if a["severity"] in ("elevated", "high", "severe"))


def get_assessment_for(city_id: str) -> Optional[dict]:
    city = get_city(city_id)
    return city
