# Attribution & Credits

## Data providers (all attributed in the running UI)

| Provider | Use | Terms |
|---|---|---|
| **Open-Meteo** (open-meteo.com) | Weather forecasts (48 h) for monitored cities; historical archive sample | Free for non-commercial use with attribution; no API key |
| **USGS** (earthquake.usgs.gov) | Past-24 h global earthquake feed | U.S. public domain feeds |
| **NASA EONET** (eonet.gsfc.nasa.gov) | Open natural-event feed | NASA open data; attribution required |
| **GDACS** (gdacs.org) | Disaster alerts (cyclones, floods, EQ…) | Public API; credit GDACS / EC Joint Research Centre |
| **OpenStreetMap** (openstreetmap.org) | Mapped hospitals / police / fire stations via **Overpass API** | ODbL 1.0 — "© OpenStreetMap contributors" shown in UI |
| **Esri** (arcgisonline.com) | World Dark Gray Canvas basemap tiles — keyless, no registration required | Attribution shown on every map |

GARUD AI is an independent prototype and is **not** affiliated with, endorsed
by, or integrated with any of these providers, nor with IMD, NDMA, NDRF, state
police or any emergency service.

## Open-source libraries

- **Backend:** FastAPI, Uvicorn, Pydantic v2, pydantic-settings, httpx,
  google-genai (BSD/Apache-2.0 licences, per package).
- **Frontend:** React, React Router, Vite, TypeScript, Tailwind CSS v4,
  Leaflet + React-Leaflet (BSD-2), Recharts (MIT), TanStack Query (MIT),
  Lucide React (ISC), clsx + tailwind-merge (MIT).

## Reference projects inspected during research (no code copied)

We reviewed these repositories before building GARUD AI as an original,
clean-room implementation. **No source code, assets or text was copied** from
any of them; they informed our understanding of the problem space:

- [ALERTIX-AI](https://github.com/0XSreekar/ALERTIX-AI) (Apache-2.0) — Indian
  multi-hazard monitoring concepts.
- [hazard-map](https://github.com/Ayodele-Oyeyemi/hazard-map) (MIT) — realtime
  citizen hazard reporting patterns.
- [disasteralert-dashboard](https://github.com/bhumify/disasteralert-dashboard)
  — USGS + EONET dashboard layout ideas (no licence file present → nothing reused).
- [disaster-mapper](https://github.com/KhushiMahato/disaster-mapper) and
  [DisasterGuard](https://github.com/Ankita7033/Disasterguard) — reviewed for
  workflow ideas only.

Where a reusable idea clearly came from the open ecosystem (Leaflet
div-icon markers, TTL-cache-then-stale patterns, SSE streams), it was
re-implemented from scratch or via official library documentation.

## Design notes

The visual identity (GARUD branding, dark command-centre palette, marker
system) and all scenario content (Hyderabad flood simulation narrative) are
original work of Team Garud Dwaar for CipherCop 2026.

If we have missed an attribution, it is unintentional — please open an issue.
