"""Nearby emergency infrastructure from OpenStreetMap (Overpass API).

Mapped facilities are clearly labelled as UNVERIFIED: GARUD AI does not
claim they are operational, staffed or reachable.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..config import get_city
from ..services import overpass
from ..services.cache import ExternalSourceError

router = APIRouter(tags=["resources"])


@router.get("/resources")
async def resources(
    city: str | None = Query(None, description="Monitored city id"),
    lat: float | None = Query(None, ge=-90.0, le=90.0),
    lon: float | None = Query(None, ge=-180.0, le=180.0),
) -> dict:
    if city is None and (lat is None or lon is None):
        raise HTTPException(status_code=422, detail="Provide a monitored 'city' or both 'lat' and 'lon'.")
    if city is not None and get_city(city) is None:
        raise HTTPException(status_code=404, detail=f"Unknown city '{city}'. See /api/locations.")
    if city is not None and lat is not None and lon is None:
        raise HTTPException(status_code=422, detail="lat and lon must be provided together.")

    try:
        result = await overpass.get_resources_for_city(city, lat, lon)
    except ExternalSourceError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "message": "Overpass (OpenStreetMap) is unavailable right now; nearby resources cannot be listed.",
                "source": exc.source,
                "error": exc.detail[:300],
            },
        ) from exc

    return {
        "resources": result["data"],
        "meta": {
            "source": "OpenStreetMap via Overpass API",
            "source_url": overpass.OVERPASS_URL,
            "fetched_at": result["fetched_at"],
            "stale": result["stale"],
            "disclaimer": (
                "Facilities as mapped in OpenStreetMap. Presence on this map does NOT verify "
                "current operation, capacity, staffing or reachability."
            ),
        },
    }
