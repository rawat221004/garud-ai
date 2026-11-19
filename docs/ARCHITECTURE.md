# GARUD AI — System Architecture

## 1. Overview

GARUD AI is a two-process local web application:

```
┌──────────────────────────────┐        ┌───────────────────────────────┐
│  frontend/  React + Vite     │  HTTP  │  backend/  FastAPI + SQLite   │
│  port 5173                   │──────► │  port 8000                    │
│  (dev proxy /api → :8000)    │  SSE   │                               │
└──────────────────────────────┘        └───────────────┬───────────────┘
                                                        │ httpx (bounded,
                                                        │ TTL-cached)
                                        ┌───────────────▼───────────────┐
                                        │ Open-Meteo · USGS · EONET ·    │
                                        │ GDACS · Overpass (OSM)        │
                                        └───────────────────────────────┘
```

Everything runs on a laptop with Python 3.12 + Node 22. No containers, no
brokers, no external database — one SQLite file (`backend/data/garud.db`).

## 2. Backend layout (`backend/app`)

| Module | Responsibility |
|---|---|
| `config.py` | `.env` settings + monitored-city registry (10 Indian cities) + demo response teams |
| `db.py` | SQLite (WAL) access layer; incidents, audit events, simulation state; async wrappers via `asyncio.to_thread` |
| `models.py` | Pydantic v2 schemas; incident categories; **validated status transition matrix** (Reported → Under Review → Assigned → Responding → Resolved, plus Rejected/Duplicate) |
| `risk.py` | the transparent heuristic risk engine (pure functions, fully unit-tested) |
| `services/cache.py` | TTL cache + source-status registry; stale-on-failure retention; latency/error tracking for the System panel |
| `services/weather.py` | Open-Meteo integration (unixtime → UTC ISO normalization, 48-h slice) |
| `services/earthquakes.py` | USGS all_day feed + India bbox filter |
| `services/eonet.py` | EONET v3 GeoJSON (Point/Polygon/LineString → centroid + raw geometry) |
| `services/gdacs.py` | GDACS SEARCH JSON + RSS fallback (best-effort, never blocks anything) |
| `services/overpass.py` | OSM hospitals/police/fire (UA-required; primary + mirrors; 24-h cache) |
| `services/risksvc.py` | city risk aggregation (parallel fan-out over the registry) |
| `ai/gemini.py` | server-side google-genai wrapper; JSON mode; **per-call timeout caps**; bounded retries |
| `ai/triage.py` | Gemini triage ← automatic fallback → deterministic keyword engine (both emit the same validated schema) |
| `ai/briefing.py` | bounded context collection (weather, quakes, EONET, GDACS, incidents, sim state) → Gemini brief ← fallback → deterministic brief |
| `sim/scenario.py` | the fictional Hyderabad flood scenario: 3 phases, fixed incident IDs (idempotent), deterministic synthetic weather through the SAME risk engine |
| `eventbus.py` | in-process pub/sub backing the SSE stream |
| `routers/*` | `/api/health`, `/system/status`, `/overview`, `/locations`, `/weather`, `/earthquakes`, `/disasters`, `/risk`, `/incidents` (+ `/{id}`, `/events`, `/stream` SSE), `/ai/briefing`, `/ai/triage`, `/resources`, `/simulation/*` |

## 3. Frontend layout (`frontend/src`)

- `App.tsx` and `components/layout/` provide a collapsible rail, mobile navigation, city and freshness controls, scenario controls and status feedback. FastAPI also serves the production workspaces on direct navigation.
- `index.css` defines the graphite palette, text and severity tokens, spacing, surface radius, focus indicator and reduced-motion behavior. `components/ui.tsx` composes shared page headers, panels, metrics, source labels and native modal dialogs.
- `pages/` contains Overview, Live Map, Forecast & Risk, Incident Response and System Health. Supporting routes load on demand. Weather charts display one measurement at a time alongside current conditions and hourly values.
- `components/map/` retains Esri basemap attribution and hazard polygons. Nearby incidents group by projected screen distance at the current zoom. A cluster opens a list of its reports. Selecting a hazard or marker focuses the map and opens its details.
- `components/incidents/` provides reporting with a map pin picker, triage, team assignment, valid workflow actions, draft alerts, facilities and audit history. `hooks/useApi.ts` shares query state and invalidates related data on incident and simulation SSE messages.

### OpenUI guidance

OpenUI design guidance informed the shared component composition and semantic tokens.

Operational pages use deterministic React. The briefing renders the existing validated Gemini or fallback payload through approved React components. Adopting OpenUI Lang here would add a second schema and parser for the same response. The dashboard runs without an OpenUI runtime or Thesys Gateway dependency.

## 4. Real-time updates

`POST/PATCH /api/incidents` and simulation transitions publish to an
in-process `EventBus`; `/api/incidents/stream` (SSE) fans them out with a
15-second keepalive. The frontend also polls at conservative intervals
(30 s incidents, 60 s overview, 5–15 min external feeds) as a safety net.

## 5. Failure philosophy (testable behaviours)

- External source down → serve last-good data marked **CACHED/STALE**; if no
  cache exists, an honest 503 that the UI renders as an outage notice (never a
  crash, never fake data).
- Gemini down/overloaded → **bounded** call caps (10 s triage / 20 s briefing)
  then the deterministic fallback with an explanatory note. Auto-triage never
  blocks incident submission for long.
- Overpass busy → multi-mirror attempt, graceful outage message; all other
  features unaffected.
- Zero-result states render as genuine empty states.

## 6. Security posture

- Gemini key only in `backend/.env` (git-ignored); never sent to the client.
- Incident text is length-capped, control-char-stripped, fenced inside
  `<incident_text>` with explicit ignore-instructions handling (prompt
  injection defence, covered by tests).
- No user-controlled URLs are ever fetched server-side; Overpass queries are
  built from validated floats only.
- All external calls are server-side with bounded timeouts.

## 7. Data storage

SQLite WAL, three tables: `incidents` (with triage result JSON),
`incident_events` (audit trail powering the activity timeline), and
`simulation_state` (scenario phase). Timestamps are stored as UTC ISO-8601 and
rendered in Asia/Kolkata.
