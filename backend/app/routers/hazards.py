"""Hazard feed endpoints: USGS earthquakes and EONET/GDACS disaster events."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..config import get_city
from ..services import eonet, earthquakes, gdacs
from ..services.cache import ExternalSourceError
from ..services.earthquakes import apply_filters

router = APIRouter(tags=["hazards"])


@router.get("/earthquakes")
async def get_earthquakes(
    region: str = Query("world", pattern="^(world|india)$"),
    min_magnitude: float | None = Query(None, ge=0, le=10),
    limit: int = Query(100, ge=1, le=500),
) -> dict:
    try:
        result = await earthquakes.get_earthquakes()
    except ExternalSourceError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "message": "USGS feed temporarily unavailable and no cached data exists yet.",
                "source": exc.source,
                "error": exc.detail[:300],
            },
        ) from exc
    events = apply_filters(result["data"], region=region, min_magnitude=min_magnitude)[:limit]
    return {
        "events": events,
        "meta": {
            "source": earthquakes.SOURCE_NAME,
            "source_url": earthquakes.USGS_ALL_DAY_URL,
            "fetched_at": result["fetched_at"],
            "stale": result["stale"],
            "count": len(events),
            "region": region,
            "min_magnitude": min_magnitude,
        },
    }


@router.get("/disasters")
async def get_disasters(
    near_city: str | None = Query(None, description="Optional city id to compute distance_km"),
    limit: int = Query(120, ge=1, le=300),
) -> dict:
    """Merged open natural-event feeds: NASA EONET + GDACS (best-effort).

    Each event carries `source_feed` so the UI can attribute it precisely.
    Failures degrade gracefully — a failing feed never blanks the other.
    """
    city = get_city(near_city) if near_city else None
    if near_city and city is None:
        raise HTTPException(status_code=404, detail=f"Unknown city '{near_city}'.")

    events: list[dict] = []
    meta: dict = {}

    try:
        ev = await eonet.get_events()
        events.extend(ev["data"])
        meta["eonet"] = {"fetched_at": ev["fetched_at"], "stale": ev["stale"], "count": len(ev["data"])}
    except ExternalSourceError as exc:
        meta["eonet"] = {"error": exc.detail[:200]}

    try:
        gd = await gdacs.get_events()
        events.extend(gd["data"])
        meta["gdacs"] = {"fetched_at": gd["fetched_at"], "stale": gd["stale"], "count": len(gd["data"])}
    except ExternalSourceError as exc:
        meta["gdacs"] = {"error": exc.detail[:200]}

    if not events and "eonet" not in meta:
        raise HTTPException(
            status_code=503,
            detail={"message": "All disaster feeds are currently unavailable.", **meta},
        )

    if city is not None:
        from ..services import geo as geo_svc

        for e in events:
            e["distance_km"] = round(geo_svc.haversine_km(city["lat"], city["lon"], e["lat"], e["lon"]), 1)
        events.sort(key=lambda e: e.get("distance_km", 1e9))

    return {"events": events[:limit], "meta": meta}
