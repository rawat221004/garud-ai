"""Geospatial helpers shared by hazard services."""

from __future__ import annotations

import math
from typing import Iterable, List

from ..config import INDIA_BBOX

EARTH_RADIUS_KM = 6371.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    rlat1, rlat2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def is_in_india(lat: float, lon: float) -> bool:
    return (
        INDIA_BBOX["lat_min"] <= lat <= INDIA_BBOX["lat_max"]
        and INDIA_BBOX["lon_min"] <= lon <= INDIA_BBOX["lon_max"]
    )


def nearest(events: Iterable[dict], lat: float, lon: float, n: int, max_km: float) -> List[dict]:
    """Sort events by distance to (lat, lon), keep those within max_km, top n."""
    scored = []
    for ev in events:
        d = haversine_km(lat, lon, ev["lat"], ev["lon"])
        if d <= max_km:
            item = dict(ev)
            item["distance_km"] = round(d, 1)
            scored.append(item)
    scored.sort(key=lambda x: x["distance_km"])
    return scored[:n]
