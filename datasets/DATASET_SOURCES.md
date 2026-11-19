# GARUD AI — Dataset Sources & Provenance

All datasets used by GARUD AI are documented here. The rule of the project:
**real data is labelled real, forecasts are labelled forecasts, synthetic
demo data is labelled synthetic — always.**

Retrieval date for the bundled samples: **2026-11-19 (UTC)**. The live
application re-fetches all feeds continuously with bounded caching; the
bundled files are immutable samples captured on that date for offline
inspection by judges.

---

## Live / forecast datasets (bundled samples + live feeds)

### 1. Open-Meteo Weather Forecast API
- **Provider:** Open-Meteo (open-meteo.com)
- **Source URL:** `https://api.open-meteo.com/v1/forecast`
- **Sample:** `live_samples/open_meteo_forecast_hyderabad.json` (48 h forecast for Hyderabad, captured 2026-11-19)
- **Coverage:** 10 monitored Indian cities (city list in `backend/app/config.py`)
- **Time coverage:** current conditions + next 48 hours (rolling)
- **License/usage:** free for non-commercial use with attribution; no API key required; fair-use rate limits respected via 10-minute caching
- **Classification:** FORECAST data (not observations)
- **Transformations:** timestamps normalized from unix epoch to UTC ISO-8601; optional arrays padded; sliced to 48 entries starting at the current hour. No values altered.

### 2. USGS Earthquake Feed
- **Provider:** U.S. Geological Survey (earthquake.usgs.gov)
- **Source URL:** `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson`
- **Sample:** `live_samples/usgs_earthquakes_24h.json` (top 80 events of the past 24 h, captured 2026-11-19)
- **Coverage:** global; an India bounding-box filter is applied in-app for regional views
- **Time coverage:** rolling past 24 hours
- **License/usage:** USGS public-domain feeds; attribution appreciated
- **Classification:** REAL observations (automated seismic detections)
- **Transformations:** trimmed to essential fields (id, magnitude, place, time, url, [lon, lat, depth]); no values altered.

### 3. NASA EONET
- **Provider:** NASA Earth Observatory Natural Event Tracker (eonet.gsfc.nasa.gov)
- **Source URL:** `https://eonet.gsfc.nasa.gov/api/v3/events/geojson?status=open&limit=60`
- **Sample:** `live_samples/eonet_open_events.json` (top 40 open events, captured 2026-11-19)
- **Coverage:** global natural events (wildfires, severe storms, volcanoes, floods…)
- **Time coverage:** open events only (rolling)
- **License/usage:** NASA open data; attribution to NASA EONET required
- **Classification:** REAL curated event records (Point / LineString / Polygon geometries)
- **Transformations:** polygons/lines reduced to a centroid for map markers (raw geometry retained for overlays); closed events filtered.

### 4. GDACS
- **Provider:** Global Disaster Alert and Coordination System — EC Joint Research Centre (gdacs.org)
- **Source URL:** `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?fromdate=…&todate=…` (RSS fallback documented in code)
- **Sample:** `live_samples/gdacs_events_recent.json` (recent 10-day window, captured 2026-11-19)
- **Coverage:** global (earthquakes, tropical cyclones, floods, volcanoes, droughts…)
- **Time coverage:** rolling 10-day query window, cached 1 hour
- **License/usage:** GDACS public API; attribution to GDACS / JRC European Commission
- **Classification:** REAL alert-level event records
- **Transformations:** geometry coordinates extracted; alert level mapped (Green/Orange/Red → low/elevated/severe); naive datetimes assumed UTC.
- **Reliability note:** GDACS public endpoints occasionally change or are slow; the integration is best-effort and failing gracefully never blocks other features.

### 5. OpenStreetMap / Overpass (in-app only, no bundled sample)
- **Provider:** OpenStreetMap contributors via Overpass API (overpass-api.de, mirrors)
- **Source URL:** `https://overpass-api.de/api/interpreter` (+ mirrors)
- **Coverage:** hospitals / police stations / fire stations within 15 km of each monitored city centre
- **Time coverage:** cached 24 h per city
- **License/usage:** ODbL 1.0; attribution © OpenStreetMap contributors (shown in the UI)
- **Classification:** MAPPED facilities — presence on the map does NOT verify that a facility is operational, staffed or reachable (stated in the UI)
- **Transformations:** nodes + way centres normalized to points; unnamed POIs labelled by amenity type.

### 6. Open-Meteo Historical Weather API
- **Provider:** Open-Meteo archive (reanalysis data)
- **Source URL:** `https://archive-api.open-meteo.com/v1/archive`
- **Sample:** `historical/open_meteo_hyderabad_daily_1yr.csv` (+ `_meta.json`) — 366 daily rows for Hyderabad (2025-11 → 2026-11), captured 2026-11-19
- **Coverage:** Hyderabad, India
- **Time coverage:** 1 year of daily records
- **License/usage:** free for non-commercial use with attribution; reanalysis-based archive
- **Classification:** HISTORICAL (reanalysis, not station observations)
- **Purpose:** baseline for the optional anomaly-detection extension; also serves as honest evidence of data provenance practices. The shipped risk engine does not claim to be trained on it.

---

## Simulated dataset (fictional — for the demonstration workflow)

### 7. Hyderabad Extreme-Rainfall Flood Scenario
- **File:** `simulated/hyderabad_flood_scenario.json`
- **Origin:** authored by Team Garud Dwaar; deterministic; exported verbatim from `backend/app/sim/scenario.py`
- **Classification:** 100% SYNTHETIC. This is demo fiction for exercising the workflow when no real hazard is available near the venue.
- **Contents:** 3 scripted phases, 3 scripted incident reports (fixed IDs → idempotent), and a 48-hour synthetic weather series (~300 mm/24 h, gusts to 85 km/h) that flows through the **same** risk engine as live data, producing a clearly-badged SEVERE assessment.
- **In-app handling:** stored with `source_type='simulation'`; every screen shows a magenta SIMULATED badge and banner; `Reset scenario` deletes all simulated records; repeat runs cannot create duplicates.
- **Never mixed with real feeds:** simulated weather overlays only for Hyderabad while the scenario is active; all other cities stay live.

---

## Dataset usage honesty rules enforced by the build

1. No synthetic record is ever presented as a real observation.
2. Forecast-derived risk is explicitly labelled an experimental heuristic, not a validated flood prediction.
3. Zero-result states are shown genuinely (e.g., "no hazard events in current feeds").
4. When a source fails, the last good data is shown marked CACHED/STALE, or an honest outage notice.
5. All external calls run server-side with bounded timeouts, TTL caching and attribution surfaced in the UI.
