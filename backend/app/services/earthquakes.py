"""USGS earthquake feed integration.

Docs: https://earthquake.usgs.gov/earthquakes/feed/v1.0/
Uses the all_day GeoJSON summary feed; normalizes to UTC ISO timestamps.
"""

from __future__ import annotations

from typing import List, Optional

import httpx

from ..config import settings
from ..timeutil import iso_from_epoch
from .cache import ExternalSourceError, cached_fetch, register_source
from .geo import is_in_india

USGS_ALL_DAY_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
SOURCE_NAME = "USGS Earthquake Feed (all_day)"
TTL_SECONDS = 300  # 5 minutes

register_source(SOURCE_NAME, USGS_ALL_DAY_URL, TTL_SECONDS)


def _normalize(raw: dict) -> List[dict]:
    events: List[dict] = []
    for feat in raw.get("features", []):
        props = feat.get("properties") or {}
        geo = feat.get("geometry") or {}
        coords = geo.get("coordinates") or [None, None, None]
        if coords[0] is None or coords[1] is None:
            continue
        time_ms = props.get("time")
        events.append(
            {
                "id": feat.get("id"),
                "magnitude": props.get("mag"),
                "place": props.get("place") or "Unknown location",
                "time": iso_from_epoch(time_ms / 1000) if time_ms else None,
                "lat": coords[1],
                "lon": coords[0],
                "depth_km": coords[2],
                "url": props.get("url"),
                "tsunami_flag": bool(props.get("tsunami")),
                "alert": props.get("alert"),
                "in_india": is_in_india(coords[1], coords[0]),
            }
        )
    events.sort(key=lambda e: e["time"] or "", reverse=True)
    return events


async def _fetch() -> List[dict]:
    async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True) as client:
        resp = await client.get(USGS_ALL_DAY_URL)
        resp.raise_for_status()
        raw = resp.json()
        if "features" not in raw:
            raise ValueError("Unexpected USGS response shape")
        return _normalize(raw)


async def get_earthquakes() -> dict:
    """{"events": [...], "fetched_at", "stale"} — raises on total failure."""
    return await cached_fetch(
        SOURCE_NAME,
        key="usgs:all_day",
        ttl=TTL_SECONDS,
        fetch=_fetch,
        items_of=lambda d: len(d),
    )


def apply_filters(events: List[dict], region: str = "world", min_magnitude: Optional[float] = None) -> List[dict]:
    if region == "india":
        events = [e for e in events if e.get("in_india")]
    if min_magnitude is not None:
        events = [e for e in events if (e.get("magnitude") or 0) >= min_magnitude]
    return events
