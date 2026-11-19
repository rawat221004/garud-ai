"""Fetch small, legally reusable data samples for the datasets/ folder.

Run from the repo root:
    backend\.venv\Scripts\python.exe scripts\fetch_datasets.py

Every live sample is a genuine response from its public provider, trimmed to a
reasonable size, with retrieval timestamps recorded in-file.
"""

from __future__ import annotations

import csv
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
DATASETS = ROOT / "datasets"
LIVE = DATASETS / "live_samples"
HIST = DATASETS / "historical"
SIM = DATASETS / "simulated"

UA = {"User-Agent": "GARUD-AI/1.0 (CipherCop 2026 hackathon project; dataset sampling)"}
NOW = datetime.now(timezone.utc).isoformat(timespec="seconds")


def save_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  wrote {path.relative_to(ROOT)} ({path.stat().st_size / 1024:.0f} KB)")


def save_csv(path: Path, header: list[str], rows: list[list]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    print(f"  wrote {path.relative_to(ROOT)} ({path.stat().st_size / 1024:.0f} KB, {len(rows)} rows)")


def main() -> None:
    print(f"Fetching GARUD AI dataset samples at {NOW}")
    client = httpx.Client(timeout=45, follow_redirects=True, headers=UA)

    # ---- Open-Meteo forecast (Hyderabad, next 48 h) ------------------------
    print("[1/5] Open-Meteo forecast for Hyderabad…")
    try:
        r = client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": 17.385, "longitude": 78.4867,
                "current": "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m",
                "hourly": "temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,weather_code,surface_pressure,wind_speed_10m,wind_gusts_10m",
                "timezone": "auto", "timeformat": "unixtime", "forecast_days": 3,
            },
        )
        r.raise_for_status()
        save_json(LIVE / "open_meteo_forecast_hyderabad.json", {
            "provider": "Open-Meteo (https://open-meteo.com)", "retrieved_at_utc": NOW,
            "location": "Hyderabad, Telangana, India (17.385, 78.4867)",
            "usage": "Free API for non-commercial use; attribution required.",
            "data": r.json(),
        })
    except Exception as exc:  # noqa: BLE001
        print(f"  SKIP: {exc}")

    # ---- USGS earthquakes (24 h) -------------------------------------------
    print("[2/5] USGS all_day feed…")
    try:
        r = client.get("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson")
        r.raise_for_status()
        feats = r.json().get("features", [])
        trimmed = [
            {
                "id": f.get("id"),
                "magnitude": (f.get("properties") or {}).get("mag"),
                "place": (f.get("properties") or {}).get("place"),
                "time_ms": (f.get("properties") or {}).get("time"),
                "url": (f.get("properties") or {}).get("url"),
                "lon_lat_depth": (f.get("geometry") or {}).get("coordinates"),
            }
            for f in feats[:80]
        ]
        save_json(LIVE / "usgs_earthquakes_24h.json", {
            "provider": "USGS Earthquake Hazards Program (https://earthquake.usgs.gov)",
            "retrieved_at_utc": NOW,
            "usage": "USGS public domain / public feeds; attribution appreciated.",
            "events_retained": len(trimmed),
            "events": trimmed,
        })
    except Exception as exc:  # noqa: BLE001
        print(f"  SKIP: {exc}")

    # ---- NASA EONET (open events) ------------------------------------------
    print("[3/5] NASA EONET open events…")
    try:
        r = client.get("https://eonet.gsfc.nasa.gov/api/v3/events/geojson", params={"status": "open", "limit": 60})
        r.raise_for_status()
        feats = r.json().get("features", [])[:40]
        save_json(LIVE / "eonet_open_events.json", {
            "provider": "NASA Earth Observatory Natural Event Tracker (https://eonet.gsfc.nasa.gov)",
            "retrieved_at_utc": NOW,
            "usage": "NASA open data; attribution to NASA EONET required.",
            "events_retained": len(feats),
            "features": feats,
        })
    except Exception as exc:  # noqa: BLE001
        print(f"  SKIP: {exc}")

    # ---- GDACS (recent events) ----------------------------------------------
    print("[4/5] GDACS recent events…")
    try:
        frm = (datetime.now(timezone.utc) - timedelta(days=10)).strftime("%Y-%m-%d")
        to = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        r = client.get(
            "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH",
            params={"fromdate": frm, "todate": to},
        )
        r.raise_for_status()
        feats = r.json().get("features", [])[:40]
        save_json(LIVE / "gdacs_events_recent.json", {
            "provider": "GDACS - Global Disaster Alert and Coordination System (https://www.gdacs.org)",
            "retrieved_at_utc": NOW, "query_window_days": 10,
            "usage": "GDACS public API; attribution to GDACS/JRC European Commission.",
            "events_retained": len(feats),
            "features": feats,
        })
    except Exception as exc:  # noqa: BLE001
        print(f"  SKIP: {exc}")

    # ---- Open-Meteo historical daily (Hyderabad, 365 days) ------------------
    print("[5/5] Open-Meteo historical daily weather for Hyderabad (1 year)…")
    try:
        end = datetime.now(timezone.utc).date()
        start = end - timedelta(days=365)
        r = client.get(
            "https://archive-api.open-meteo.com/v1/archive",
            params={
                "latitude": 17.385, "longitude": 78.4867,
                "start_date": start.isoformat(), "end_date": end.isoformat(),
                "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max",
                "timezone": "UTC",
            },
        )
        r.raise_for_status()
        d = r.json().get("daily", {})
        rows = []
        for i, day in enumerate(d.get("time", [])):
            rows.append([
                day,
                d.get("temperature_2m_max", [None] * len(d["time"]))[i],
                d.get("temperature_2m_min", [None] * len(d["time"]))[i],
                d.get("precipitation_sum", [None] * len(d["time"]))[i],
                d.get("wind_speed_10m_max", [None] * len(d["time"]))[i],
                d.get("wind_gusts_10m_max", [None] * len(d["time"]))[i],
            ])
        meta = json.loads(json.dumps({
            "provider": "Open-Meteo Historical Weather API (https://open-meteo.com/en/docs/historical-weather-api)",
            "retrieved_at_utc": NOW,
            "location": "Hyderabad, India (17.385, 78.4867)",
            "start_date": start.isoformat(), "end_date": end.isoformat(),
            "usage": "Free for non-commercial use with attribution; reanalysis-based archive data.",
            "columns": ["date_utc", "temp_max_c", "temp_min_c", "precipitation_sum_mm", "wind_speed_max_kmh", "wind_gust_max_kmh"],
        }))
        save_json(HIST / "open_meteo_hyderabad_daily_meta.json", meta)
        save_csv(
            HIST / "open_meteo_hyderabad_daily_1yr.csv",
            ["date_utc", "temp_max_c", "temp_min_c", "precipitation_sum_mm", "wind_speed_max_kmh", "wind_gust_max_kmh"],
            rows,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"  SKIP: {exc}")

    print("Done.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(1)
