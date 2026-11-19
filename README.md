# GARUD AI
### Geospatial AI for Risk Understanding & Disaster Response

> **Predict Early. Prepare Smarter. Respond Faster.**
> Unified disaster intelligence for Indian control rooms — live hazard feeds,
> transparent forecast-risk analysis, AI-assisted incident triage and a
> coordinator-reviewed response workflow, on one map.

**CipherCop 2026 · Track 2 — AI for Disaster Resilience · Team Garud Dwaar**
(Shlok Rawat & Dharmik Pandya)

---

## Problem statement

AI-powered solutions for **prediction, preparedness and response** to natural
disasters. Authorities monitoring hazards today face scattered portals
(weather here, earthquakes there, alerts elsewhere) and no unified picture of
*what is coming, what is happening, and what to do next*. GARUD AI connects
those three stages into one operational console.

## What GARUD AI does

| Stage | Capability |
|---|---|
| **PREDICT** | Live weather forecasts (Open-Meteo) for 10 Indian cities + a transparent, documented risk engine (Low / Elevated / High / Severe) computed from rainfall accumulation, peak intensity and gusts |
| **PREPARE** | 24/48-h forecast charts, 6/12/24-h window summaries, severity scale with full threshold documentation, AI situation briefs with preparedness checklists, nearby mapped facilities |
| **RESPOND** | Citizen/coordinator incident reporting with map pin-picker, SQLite-backed incident records, AI triage with human confirmation, validated status workflow (Reported → Under Review → Assigned → Responding → Resolved), audit timeline, draft public alerts, real-time SSE updates |
| **DEMONSTRATE** | An explicitly labelled SIMULATION scenario (fictional Hyderabad extreme-rainfall flood) with 3 scripted phases, idempotent repeats and clean reset |

Live sources, all free and key-less: **Open-Meteo** (weather), **USGS**
(earthquakes), **NASA EONET** + **GDACS** (global events), **OpenStreetMap/
Overpass** (mapped emergency facilities). Every feed shows its source,
timestamp and freshness; failures degrade gracefully and honestly.

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 6 + TypeScript, Tailwind CSS v4, React-Leaflet (keyless Esri World Dark Gray basemap), Recharts, Lucide, TanStack Query |
| Backend | Python 3.12, FastAPI, Pydantic v2, httpx, SQLite (WAL), SSE push |
| AI | Google `google-genai` SDK (server-side only, JSON-mode outputs) with a deterministic rule-based fallback engine |
| Tests | pytest (26 automated backend tests) + `scripts/smoke_test.ps1` (19 end-to-end checks) |

No Docker, no Redis, no PostGIS, no message brokers — two processes and one
SQLite file. It runs on a laptop.

## Architecture

```
frontend (React/Vite, port 5173)
    │  fetch /api/*  (Vite dev proxy)          EventSource /api/incidents/stream
    ▼
backend (FastAPI, port 8000)  ── httpx (bounded timeouts + TTL cache) ──►  Open-Meteo / USGS / EONET / GDACS / Overpass
    │
    ├── app/risk.py            transparent heuristic risk engine (tested)
    ├── app/ai/triage.py       Gemini triage  ←fallback→  keyword-rule triage (tested)
    ├── app/ai/briefing.py     Gemini brief   ←fallback→  deterministic brief (tested)
    ├── app/sim/scenario.py    fictional scenario engine (idempotent, tested)
    └── SQLite (WAL)           incidents + audit events + simulation state
```

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
Risk methodology: [docs/RISK_METHODOLOGY.md](docs/RISK_METHODOLOGY.md)

## Installation (Windows PowerShell)

Prerequisites: Python 3.12 and Node.js 22.

```powershell
git clone https://github.com/rawat221004/garud-ai.git
cd garud-ai

# 1) backend
python -m venv backend\.venv
backend\.venv\Scripts\pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env      # optional: add GEMINI_API_KEY here

# 2) frontend
cd frontend
npm ci
cd ..
```

## Startup (two terminals — or one script)

```powershell
# Terminal 1 — API on http://127.0.0.1:8000 (docs at /docs)
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Terminal 2 — dashboard on http://localhost:5173
cd frontend
npm run dev
```

Or use the helper: `powershell -File scripts\dev.ps1` (starts both).

Open **http://localhost:5173** for the dashboard and
**http://127.0.0.1:8000/docs** for the interactive API documentation.

A production frontend build (`npm run build`) is auto-served by the backend on
port 8000 when `frontend/dist` exists.

### macOS and Linux

From the cloned repository, start the API in one terminal:

```sh
cd backend
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

From the repository root in a second terminal:

```sh
cd frontend
npm ci
npm run dev
```

## Environment variables

Configured in `backend/.env` (see `backend/.env.example`):

| Variable | Default | Meaning |
|---|---|---|
| `GEMINI_API_KEY` | *(empty)* | Enables live Gemini situation briefs + incident triage. **Without it, everything still works via the deterministic, clearly-labelled rule-based fallback.** |
| `GEMINI_MODEL` | `gemini-3.6-flash` | Set this to a model available to your account. |
| `DB_PATH` | `data/garud.db` | SQLite location (relative to `backend/`). |
| `HTTP_TIMEOUT` | `15` | Bounded timeout (seconds) for external APIs. |

The Gemini key is only ever read server-side; the frontend never sees it.

## Using Simulation Mode (demo day insurance)

1. Open **Simulation** in the command bar and select **Start scenario**. The console selects Hyderabad and shows **Simulation active**. Phase 1 supplies fictional rainfall to the existing forecast and risk calculations.
2. Open **Simulation active** and select **Advance scenario**. Phase 2 adds a critical scripted field report in LB Nagar. Phase 3 adds two more reports.
3. Work the reports in **Incident Response**. Select **Reset scenario** from the same controls to remove fictional reports and return to live monitoring.

Simulated weather, risk and reports carry visible provenance labels. Source-backed hazards continue to appear in the hazard feed.

## Walk through the operations console

1. **Overview** — inspect the four operational metrics and the map. Select a hazard in the feed to center the map and inspect its source. Use the **Action center** for reports awaiting assignment.
2. **Live Map** — switch between city, India and world views. Search the visible events, toggle layers and fit or reset the view. Nearby facilities are available in city view when OpenStreetMap can be reached.
3. **Forecast & Risk** — choose a city, inspect the 6/12/24-hour outlook and switch the chart between 24 and 48 hours and individual weather measurements. Expand **Risk methodology** to inspect the thresholds.
4. **Prepare** — generate the **AI situation brief** in English, Hindi or Telugu with Gemini, or English with the built-in fallback. Review its engine, sources, preparedness actions and uncertainties.
5. **Incident Response** — select **Report incident**, drop a pin or enter coordinates, and submit. Review the triage result, assign a team and progress through valid statuses. The audit log records each update. A second browser receives updates over SSE. **Draft alert** prepares editable text for review.
6. **System Health** — check provider freshness, open refresh diagnostics, and inspect AI configuration and incident storage.

See the [judge walkthrough](docs/DEMO_SCRIPT.md) and [frontend design notes](docs/ARCHITECTURE.md#3-frontend-layout-frontendsrc).

## Data & AI honesty

- Risk bands are **experimental heuristics** (IMD-inspired rainfall day
  classifications) — labelled as such in the UI, never presented as validated
  flood predictions.
- AI outputs are labelled by engine (**Gemini · model** vs **Rule-based
  fallback**) and always include sources, timestamps and uncertainty notes.
- Incident text is treated as untrusted input; prompt-injection attempts are
  mitigated through input handling, delimiting report text, and structured output. A coordinator reviews the result.
- Mapped OSM facilities are never claimed to be operational.
- **GARUD AI is a decision-support prototype.** It does not integrate with
  police, IMD, NDMA or any emergency service, and says so in the UI.

## Testing

```powershell
# 26 automated backend tests (risk engine, triage, workflow, simulation, normalization)
Push-Location backend
.venv\Scripts\python.exe -m pytest tests -q
Pop-Location

Push-Location frontend
npm run build
Pop-Location

# 19-step smoke test against a local app using a disposable SQLite database
powershell -ExecutionPolicy Bypass -File scripts\smoke_test.ps1
```

For the smoke test, start the API with `DB_PATH` set to a new absolute path in a temporary directory. The smoke script creates and updates test incidents.

## Repository layout

```
frontend/            React dashboard (src/pages: Dashboard, Map, Forecast, Incidents, System)
backend/             FastAPI app (app/routers, app/services, app/ai, app/sim, tests/)
datasets/            provider provenance + fictional scenario (DATASET_SOURCES.md)
docs/                architecture, risk methodology, demo script, project overview
scripts/             dev.ps1, smoke_test.ps1, fetch_datasets.py
```

## Team & acknowledgements

**Team Garud Dwaar** — Shlok Rawat, Dharmik Pandya (CipherCop 2026, IIT Hyderabad).

Data: Open-Meteo · USGS · NASA EONET · GDACS (JRC/EC) · OpenStreetMap
contributors (ODbL) · basemap tiles © Esri (World Dark Gray Canvas — keyless). Libraries: FastAPI, React, Leaflet,
Recharts, TanStack Query, google-genai. Full credits: [ATTRIBUTION.md](ATTRIBUTION.md).

Built as a working prototype for CipherCop 2026 — not an official warning system.

## License and contributing

The original project code and documentation are available under the [MIT License](LICENSE). External API services, map tiles, and provider data have separate terms. Gemini is optional and account quotas or charges depend on the provider plan. See [Attribution](ATTRIBUTION.md) and [dataset provenance](datasets/DATASET_SOURCES.md).

See the [contribution guide](CONTRIBUTING.md) and [security reporting instructions](SECURITY.md).
