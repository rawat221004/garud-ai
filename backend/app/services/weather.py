"""Open-Meteo weather forecast integration.

Docs: https://open-meteo.com/en/docs
Uses timeformat=unixtime so timestamps normalize to UTC ISO strings; the
frontend renders them in Asia/Kolkata.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional

import httpx

from ..config import get_city, settings
from ..timeutil import iso_from_epoch, utc_now_iso
from .cache import ExternalSourceError, cached_fetch, register_source

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
SOURCE_NAME = "Open-Meteo Forecast API"
TTL_SECONDS = 600  # 10 minutes

HOURLY_VARS = [
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation",
    "precipitation_probability",
    "weather_code",
    "surface_pressure",
    "wind_speed_10m",
    "wind_gusts_10m",
]
CURRENT_VARS = [
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation",
    "weather_code",
    "wind_speed_10m",
    "wind_gusts_10m",
]

register_source(SOURCE_NAME, OPEN_METEO_URL, TTL_SECONDS)


def _hour_entry(h: dict, i: int, time_epoch: int) -> dict:
    return {
        "time": iso_from_epoch(time_epoch),
        "temperature_c": h["temperature_2m"][i],
        "humidity_pct": h["relative_humidity_2m"][i],
        "precipitation_mm": h["precipitation"][i] or 0.0,
        "precipitation_probability_pct": h["precipitation_probability"][i],
        "weather_code": h["weather_code"][i],
        "pressure_hpa": h["surface_pressure"][i],
        "wind_speed_kmh": h["wind_speed_10m"][i] or 0.0,
        "wind_gusts_kmh": h["wind_gusts_10m"][i] or 0.0,
    }


def _normalize(raw: dict, city: dict) -> dict:
    """Normalize an Open-Meteo response into current + 48 hourly entries."""
    now_epoch = datetime.now(timezone.utc).timestamp()
    h = raw.get("hourly") or {}
    times: List[int] = h.get("time") or []
    if not times:
        raise ValueError("Open-Meteo response missing hourly.time")

    # Optional variables: pad to the full length so indexing is always safe.
    for var in ("precipitation_probability", "surface_pressure"):
        if not isinstance(h.get(var), list) or len(h.get(var) or []) < len(times):
            h[var] = [None] * len(times)

    start = 0
    for i, t in enumerate(times):
        if t >= now_epoch - 3600:
            start = i
            break

    hourly = [
        _hour_entry(h, i, times[i])
        for i in range(start, min(start + 48, len(times)))
    ]

    cur = raw.get("current") or {}
    current = {
        "time": iso_from_epoch(cur["time"]) if cur.get("time") else utc_now_iso(),
        "temperature_c": cur.get("temperature_2m"),
        "humidity_pct": cur.get("relative_humidity_2m"),
        "precipitation_mm": cur.get("precipitation") or 0.0,
        "weather_code": cur.get("weather_code"),
        "wind_speed_kmh": cur.get("wind_speed_10m") or 0.0,
        "wind_gusts_kmh": cur.get("wind_gusts_10m") or 0.0,
    }
    return {"city": city, "current": current, "hourly": hourly}


async def _fetch(city: dict) -> dict:
    params = {
        "latitude": city["lat"],
        "longitude": city["lon"],
        "current": ",".join(CURRENT_VARS),
        "hourly": ",".join(HOURLY_VARS),
        "timezone": "auto",
        "timeformat": "unixtime",
        "forecast_days": 3,
    }
    async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True) as client:
        resp = await client.get(OPEN_METEO_URL, params=params)
        resp.raise_for_status()
        raw = resp.json()
        if "hourly" not in raw or not (raw.get("hourly") or {}).get("time"):
            raise ValueError("Unexpected Open-Meteo response shape")
        return _normalize(raw, city)


async def get_city_forecast(city: dict) -> dict:
    """Return {"data": envelope, "fetched_at", "stale"}; envelope carries
    city/current/hourly. Raises ExternalSourceError on total failure."""
    return await cached_fetch(
        SOURCE_NAME,
        key=f"weather:{city['id']}",
        ttl=TTL_SECONDS,
        fetch=lambda: _fetch(city),
        items_of=lambda d: len(d.get("hourly", [])),
    )


async def get_weather_envelope(city_id: str, simulated_supplier=None) -> dict:
    """Public helper used by routers: normalizes source metadata.

    ``simulated_supplier`` (from sim.scenario) may return a simulated envelope
    when the demo scenario is active for this city.
    """
    city = get_city(city_id)
    if city is None:
        raise KeyError(city_id)

    if simulated_supplier is not None:
        sim_env = await simulated_supplier(city)
        if sim_env is not None:
            return {
                "city": sim_env["city"],
                "current": sim_env["current"],
                "hourly": sim_env["hourly"],
                "simulated": True,
                "source": sim_env.get("source", "SIMULATION"),
                "scenario": sim_env.get("scenario"),
                "scenario_title": sim_env.get("scenario_title"),
                "fetched_at": utc_now_iso(),
                "stale": False,
            }

    result = await get_city_forecast(city)
    return {
        "city": result["data"]["city"],
        "current": result["data"]["current"],
        "hourly": result["data"]["hourly"],
        "simulated": False,
        "source": SOURCE_NAME,
        "source_url": OPEN_METEO_URL,
        "fetched_at": result["fetched_at"],
        "stale": result["stale"],
    }


def trimmed_forecast(envelope: dict, hours: int = 48) -> dict:
    out = dict(envelope)
    out["hourly"] = envelope.get("hourly", [])[: max(0, min(hours, 48))]
    return out
