"""GDACS (Global Disaster Alert and Coordination System) integration.

Docs: https://www.gdacs.org/gdacsapi/swagger/index.html

The public JSON event list (geteventlist/SEARCH) returns a GeoJSON
FeatureCollection whose features carry properties (eventtype, eventid,
eventname, alertlevel, country, fromdate, severitydata...). This is a
best-effort integration: if both the JSON feed and the RSS fallback fail,
the source is marked unavailable and the rest of the application continues.
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from typing import List

import httpx

from ..config import settings
from .cache import ExternalSourceError, cached_fetch, register_source

GDACS_SEARCH_URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH"
GDACS_RSS_URL = "https://www.gdacs.org/xml/rss.xml"
SOURCE_NAME = "GDACS event feed"
TTL_SECONDS = 3600  # 1 hour

register_source(SOURCE_NAME, GDACS_SEARCH_URL, TTL_SECONDS)

_ALERT_MAP = {"green": "low", "orange": "elevated", "red": "severe"}
_EVENT_TYPES = {
    "EQ": "Earthquake", "TC": "Tropical Cyclone", "FL": "Flood", "VO": "Volcano",
    "WF": "Wildfire", "DR": "Drought", "TS": "Tsunami",
}


def _norm_alert(level: str) -> str:
    if not level:
        return "unknown"
    return _ALERT_MAP.get(str(level).strip().lower(), "unknown")


def _iso_gdacs(d) -> str | None:
    if not d:
        return None
    s = str(d)
    if "T" in s and "Z" not in s and "+" not in s:
        return s + "Z"  # GDACS naive datetimes are UTC
    return s


def _parse_json_feed(raw) -> List[dict]:
    features = raw
    if isinstance(raw, dict):
        features = raw.get("features") or []
    if not isinstance(features, list):
        raise ValueError("GDACS JSON feed has unexpected shape")

    events: List[dict] = []
    for f in features:
        if not isinstance(f, dict):
            continue
        geo = f.get("geometry") or {}
        coords = geo.get("coordinates") or []
        if not isinstance(coords, list) or len(coords) < 2:
            continue
        lon, lat = coords[0], coords[1]
        try:
            lat_f, lon_f = float(lat), float(lon)
        except (TypeError, ValueError):
            continue

        p = f.get("properties") or {}
        etype = str(p.get("eventtype") or "").upper()
        name = p.get("name") or p.get("eventname") or f"GDACS {etype or 'event'}"
        desc = str(p.get("htmldescription") or p.get("description") or "")
        sev = p.get("severitydata") or {}
        if sev.get("severitytext"):
            desc = f"{desc} — {sev['severitytext']}".strip(" —")

        link = ""
        url = p.get("url")
        if isinstance(url, dict):
            link = url.get("report") or ""

        events.append(
            {
                "id": f"gdacs-{(etype or 'ev').lower()}-{p.get('eventid') or abs(hash(str(name))) % 10**8}",
                "title": str(name)[:200],
                "description": desc[:600],
                "link": link or "https://www.gdacs.org",
                "categories": [_EVENT_TYPES.get(etype, "Natural hazard")],
                "alert_level": _norm_alert(p.get("alertlevel") or p.get("episodealertlevel")),
                "date": _iso_gdacs(p.get("fromdate")),
                "lat": lat_f,
                "lon": lon_f,
                "country": p.get("country") or "",
                "source_feed": "gdacs",
            }
        )

    if isinstance(raw, dict) and raw.get("type") == "FeatureCollection" and features and not events:
        raise ValueError("GDACS features present but none parsed (schema may have changed)")
    if not events:
        raise ValueError("GDACS feed parsed to zero events")
    return events


def _parse_rss(text: str) -> List[dict]:
    root = ET.fromstring(text.lstrip("\ufeff﻿"))
    events: List[dict] = []
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub = (item.findtext("pubDate") or "").strip()
        lat_s = lon_s = None
        for child in item:
            tag = (child.tag or "").lower()
            if tag.endswith("lat"):
                lat_s = (child.text or "").strip()
            elif tag.endswith("long") or tag.endswith("lon"):
                lon_s = (child.text or "").strip()
        if not title or not lat_s or not lon_s:
            continue
        alert = "unknown"
        m = re.search(r"(green|orange|red)\s*alert", title, re.IGNORECASE)
        if m:
            alert = _norm_alert(m.group(1))
        cats = []
        for kw, label in (("cyclone", "Tropical Cyclone"), ("earthquake", "Earthquake"), ("flood", "Flood"),
                          ("volcan", "Volcano"), ("wildfire", "Wildfire"), ("drought", "Drought")):
            if kw in title.lower():
                cats.append(label)
        if not cats:
            cats = ["Natural hazard"]
        date_iso = None
        if pub:
            try:
                date_iso = datetime.strptime(pub, "%a, %d %b %Y %H:%M:%S %z").astimezone(timezone.utc).isoformat()
            except ValueError:
                date_iso = None
        try:
            lat, lon = float(lat_s), float(lon_s)
        except ValueError:
            continue
        events.append(
            {
                "id": f"gdacs-rss-{abs(hash(title)) % 10**8}",
                "title": title[:200],
                "description": "",
                "link": link or "https://www.gdacs.org",
                "categories": cats,
                "alert_level": alert,
                "date": date_iso,
                "lat": lat,
                "lon": lon,
                "country": "",
                "source_feed": "gdacs",
            }
        )
    if not events:
        raise ValueError("GDACS RSS feed parsed to zero events")
    return events


async def _fetch() -> List[dict]:
    frm = (datetime.now(timezone.utc) - timedelta(days=10)).strftime("%Y-%m-%d")
    to = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True) as client:
        # 1) documented JSON event list (GeoJSON FeatureCollection)
        try:
            resp = await client.get(GDACS_SEARCH_URL, params={"fromdate": frm, "todate": to})
            resp.raise_for_status()
            return _parse_json_feed(resp.json())
        except Exception:  # noqa: BLE001 — fall through to RSS
            pass
        # 2) RSS fallback
        resp = await client.get(GDACS_RSS_URL)
        resp.raise_for_status()
        return _parse_rss(resp.text)


async def get_events() -> dict:
    return await cached_fetch(
        SOURCE_NAME,
        key="gdacs:recent",
        ttl=TTL_SECONDS,
        fetch=_fetch,
        items_of=lambda d: len(d),
        on_error_keep_stale=True,
    )
