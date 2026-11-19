"""OpenStreetMap Overpass integration for emergency infrastructure mapping.

Finds hospitals, police stations and fire stations around a city centre.
IMPORTANT: these are facilities MAPPED in OpenStreetMap. GARUD AI never
claims they are operational, staffed or reachable — the UI labels them as
'mapped facilities (availability unverified)'.
"""

from __future__ import annotations

from typing import Callable, List

import httpx

from ..config import get_city, settings
from .cache import ExternalSourceError, cached_fetch, register_source

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_MIRRORS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
OVERPASS_HEADERS = {
    # Overpass rejects generic library User-Agents with 406.
    "User-Agent": "GARUD-AI/1.0 (disaster-response prototype; hackathon project)",
    "Accept-Encoding": "gzip",
}
SOURCE_NAME = "OpenStreetMap Overpass API"
TTL_SECONDS = 86400  # 24 h per city

register_source(SOURCE_NAME, OVERPASS_URL, TTL_SECONDS)

AMENITY_LABELS = {"hospital": "Hospital", "police": "Police station", "fire_station": "Fire station"}


def _query(lat: float, lon: float, radius_m: int = 15000) -> str:
    return (
        f"[out:json][timeout:25];"
        "("
        f"node[\"amenity\"~\"^(hospital|police|fire_station)$\"](around:{radius_m},{lat},{lon});"
        f"way[\"amenity\"~\"^(hospital|police|fire_station)$\"](around:{radius_m},{lat},{lon});"
        ");"
        "out center 120;"
    )


def _normalize(raw: dict) -> List[dict]:
    out: List[dict] = []
    for el in raw.get("elements", []):
        tags = el.get("tags") or {}
        amenity = tags.get("amenity")
        if amenity not in AMENITY_LABELS:
            continue
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lon = el.get("lon") or (el.get("center") or {}).get("lon")
        if lat is None or lon is None:
            continue
        out.append(
            {
                "id": f"osm-{el.get('type')}-{el.get('id')}",
                "name": tags.get("name") or AMENITY_LABELS[amenity],
                "kind": amenity,
                "kind_label": AMENITY_LABELS[amenity],
                "lat": lat,
                "lon": lon,
                "verified": False,  # mapped in OSM — NOT verified operational
                "source": "OpenStreetMap",
            }
        )
    out.sort(key=lambda r: r["name"].lower())
    return out


async def _fetch(lat: float, lon: float) -> List[dict]:
    query = {"data": _query(lat, lon)}
    async with httpx.AsyncClient(timeout=settings.http_timeout + 10, follow_redirects=True) as client:
        # primary endpoint, then public mirrors (Overpass is frequently busy)
        for url in [OVERPASS_URL, *OVERPASS_MIRRORS]:
            try:
                resp = await client.post(url, data=query, headers=OVERPASS_HEADERS)
                resp.raise_for_status()
                raw = resp.json()
                if "elements" not in raw:
                    raise ValueError("Unexpected Overpass response shape")
                return _normalize(raw)
            except Exception:  # noqa: BLE001 — try the next mirror
                continue
        raise RuntimeError("Overpass primary and mirrors all unavailable")


async def get_resources_for_city(city_id: str, lat: float | None = None, lon: float | None = None) -> dict:
    """Resources near a monitored city (or explicit validated coordinates)."""
    city = get_city(city_id)
    if city is None and (lat is None or lon is None):
        raise KeyError(city_id)
    if city is not None and lat is None:
        lat, lon = city["lat"], city["lon"]
    key = f"overpass:{round(float(lat), 2)},{round(float(lon), 2)}"
    fetch: Callable[[], List[dict]] = lambda: _fetch(float(lat), float(lon))  # noqa: E731
    return await cached_fetch(
        SOURCE_NAME,
        key=key,
        ttl=TTL_SECONDS,
        fetch=fetch,
        items_of=lambda d: len(d),
        on_error_keep_stale=True,
    )
