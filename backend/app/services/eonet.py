"""NASA EONET natural-event integration (docs: https://eonet.gsfc.nasa.gov/docs/v3).

The v3 /events/geojson endpoint returns a GeoJSON FeatureCollection:
features[].properties (id/title/link/categories/sources/date/closed) with
features[].geometry as Point / LineString / Polygon. Polygons and lines are
reduced to a representative centroid for map markers while the raw geometry
is kept for overlay rendering.
"""

from __future__ import annotations

from typing import List, Optional

import httpx

from ..config import settings
from .cache import ExternalSourceError, cached_fetch, register_source

EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/events/geojson"
SOURCE_NAME = "NASA EONET (open events)"
TTL_SECONDS = 1800  # 30 minutes

register_source(SOURCE_NAME, EONET_URL, TTL_SECONDS)


def _centroid_from_ring(ring: List) -> Optional[tuple]:
    lons = [pt[0] for pt in ring if isinstance(pt, (list, tuple)) and len(pt) >= 2]
    lats = [pt[1] for pt in ring if isinstance(pt, (list, tuple)) and len(pt) >= 2]
    if not lons or not lats:
        return None
    return (sum(lats) / len(lats), sum(lons) / len(lons))


def _representative_point(geo: dict) -> tuple[Optional[float], Optional[float], str]:
    gtype = (geo.get("type") or "").lower()
    coords = geo.get("coordinates")
    if gtype == "point" and isinstance(coords, list) and len(coords) >= 2:
        return coords[1], coords[0], "point"
    if gtype == "linestring" and isinstance(coords, list) and coords:
        pt = _centroid_from_ring(coords)
        if pt:
            return pt[0], pt[1], "line"
    if gtype == "polygon" and isinstance(coords, list) and coords and isinstance(coords[0], list) and coords[0]:
        pt = _centroid_from_ring(coords[0])
        if pt:
            return pt[0], pt[1], "polygon"
    return None, None, gtype


def _normalize(raw: dict) -> List[dict]:
    events: List[dict] = []
    for feat in raw.get("features", []):
        if not isinstance(feat, dict):
            continue
        props = feat.get("properties") or {}
        geo = feat.get("geometry") or {}
        lat, lon, geo_type = _representative_point(geo)
        if lat is None:
            continue
        if props.get("closed"):
            continue  # only open events
        events.append(
            {
                "id": props.get("id"),
                "title": props.get("title") or "Unnamed event",
                "description": (props.get("description") or "").strip()[:600],
                "link": props.get("link"),
                "categories": [
                    c.get("title")
                    for c in props.get("categories", [])
                    if isinstance(c, dict) and c.get("title")
                ],
                "sources": [
                    {"id": s.get("id"), "url": s.get("url")}
                    for s in props.get("sources", [])
                    if isinstance(s, dict)
                ],
                "date": props.get("date"),
                "geo_type": geo_type,
                "lat": lat,
                "lon": lon,
                "geometry": geo.get("coordinates") if geo_type != "point" else None,
                "source_feed": "eonet",
            }
        )
    events.sort(key=lambda e: e.get("date") or "", reverse=True)
    return events


async def _fetch() -> List[dict]:
    async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True) as client:
        resp = await client.get(EONET_URL, params={"status": "open", "limit": 60})
        resp.raise_for_status()
        raw = resp.json()
        if not isinstance(raw, dict) or "features" not in raw:
            raise ValueError("Unexpected EONET response shape")
        return _normalize(raw)


async def get_events() -> dict:
    return await cached_fetch(
        SOURCE_NAME,
        key="eonet:open",
        ttl=TTL_SECONDS,
        fetch=_fetch,
        items_of=lambda d: len(d),
    )
