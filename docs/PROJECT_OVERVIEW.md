# GARUD AI — Project Overview (presentation source material)

## One-liner
**GARUD AI — Geospatial AI for Risk Understanding & Disaster Response.**
Predict Early. Prepare Smarter. Respond Faster.

## The problem (30 s)
Indian control rooms monitor hazards through scattered portals — weather in
one place, earthquakes in another, global alerts in a third — and citizen
field reports arrive by phone calls. There is no single operational picture
connecting *what is coming* (forecast), *what is happening* (live events +
field reports) and *what to do next* (triage → assignment → resolution).

## Our answer (60 s)
GARUD AI fuses five free public sources (Open-Meteo, USGS, NASA EONET, GDACS,
OpenStreetMap) over 10 monitored Indian cities into a dark, fast,
command-centre dashboard, and closes the loop with a working response
workflow:

1. **PREDICT** — 48-h forecasts + a transparent risk engine (Low/Elevated/
   High/Severe) whose every threshold is documented and testable.
2. **PREPARE** — AI situation briefs grounded ONLY in the system's live data,
   with per-source timestamps, preparedness checklists and honest data gaps;
   nearby mapped facilities (labelled unverified).
3. **RESPOND** — map-pinned incident reports → AI triage with explicit
   criteria → human confirmation → team assignment → validated status
   workflow → audit timeline → copy-after-review draft alerts. Real-time
   across browsers via SSE; persistent in SQLite.

4. **DEMONSTRATE** — a fictional, clearly-badged Hyderabad flood scenario
   with scripted phases so the full workflow is demonstrable on any judging
   day, no real disaster required.

## Why it's credible (the honesty stack)
- Live sources with per-feed freshness/latency shown (LIVE/CACHED states).
- Risk = **experimental heuristics**, never "validated predictions".
- AI outputs engine-labelled (Gemini vs rule-based fallback), source-cited,
  uncertainty-noted; prompt-injection fenced; human confirmation mandatory.
- Simulated data is separated at the source, badged everywhere, resets clean.
- Zero-result and outage states are shown honestly — no fake data anywhere.

## Tech (15 s)
React + Vite + Tailwind + Leaflet/Recharts frontend; FastAPI + SQLite +
httpx backend; Gemini via the official SDK (server-side) with a deterministic
fallback; 26 automated backend tests + a 19-step live smoke script; two
processes on a laptop — no infrastructure.

## Numbers we can defend
- 5 live public data integrations, all verified working during the build
  (105 tracked events at capture time; EONET 86, GDACS 5, USGS M4.5+ 14).
- 10 monitored cities; risk computed in parallel for all of them.
- 26/26 automated tests passing; 19/19 smoke checks passing (1 documented
  external-outage WARN).
- Full incident lifecycle latency: submission → triage → assign → respond →
  resolve is a few clicks, persisted, auditable, and visible in a second
  browser window in real time.

## Demo flow (for slides)
Dashboard KPIs & live feeds → Forecast & Risk transparency → AI brief →
Simulation phase 1 (SEVERE, badged) → scripted field report → triage →
assign → respond → resolve → activity timeline → draft alert → reset →
System Status page (source health + honesty rules).

## Team
**Team Garud Dwaar** — Shlok Rawat & Dharmik Pandya · CipherCop 2026 ·
Track 2: AI for Disaster Resilience · Hyderabad.

## Known limitations (say them before judges ask)
- Risk thresholds need local calibration (stated in-app).
- No river-gauge/reservoir data (documented as a data gap in briefs).
- GDACS is best-effort (public endpoint variability).
- Overpass availability fluctuates (mirror fallback + honest outage states).
- Single-district SQLite scale, not a national rollout (by design for a
  prototype).
- ML anomaly extension deferred: bundled 1-year historical dataset is ready
  for it, but a reliable dashboard beat an unfinished model.
