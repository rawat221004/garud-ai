# GARUD AI — Forecast-Risk Methodology (Feature B)

## 1. What the risk indicator is — and is not

`garud-heuristic-v1` computes an **experimental hazard-potential indicator**
for the next 24 hours from Open-Meteo forecast fields only.

It **is**: a transparent, documented, testable screening signal that tells a
coordinator which monitored cities deserve attention today.

It is **not**: a validated flood or damage prediction, a hydrological model,
or a substitute for official warnings. The UI repeats this on every risk
surface, and every API response carries the disclaimer.

Heavy-rain potential ≠ confirmed flooding. Observed flooding, damage and
casualties enter the system only through real incident reports.

## 2. Inputs (Open-Meteo hourly forecast, current hour + 24 h)

| Field | Used by factor |
|---|---|
| `precipitation` (mm/h) | 24-h accumulation + peak intensity |
| `wind_gusts_10m` (km/h) | peak gust |
| `precipitation_probability`, `weather_code` | window summaries + thunderstorm flag |

## 3. Factors, thresholds and weights

All three factors contribute points (0–100 scale) weighted into a composite
score. **Overall severity = the highest of the three factor bands**
(conservative rule — a single severe driver is enough to escalate).

### Factor 1 — 24-h rainfall accumulation (weight 35%)
Inspired by IMD 24-hour rainfall day classifications:

| Band | Range (mm/24 h) | Points |
|---|---|---|
| Low | < 15.5 | 12 |
| Elevated | 15.5 – 64.4 | 38 |
| High | 64.5 – 115.5 (IMD "heavy") | 66 |
| Severe | ≥ 115.6 (IMD "very heavy"+) | 92 |

### Factor 2 — peak hourly rainfall intensity (weight 35%)
Short bursts overwhelm storm drains faster than the same rain spread over
many hours — hence a separate intensity factor.

| Band | Range (mm/h) | Points |
|---|---|---|
| Low | < 5 | 12 |
| Elevated | 5 – 14.9 | 38 |
| High | 15 – 34.9 | 66 |
| Severe | ≥ 35 | 92 |

### Factor 3 — peak wind gust (weight 30%)
Squall-like gusts (≈60+ km/h) drive tree fall, hoarding and power-line
damage.

| Band | Range (km/h) | Points |
|---|---|---|
| Low | < 40 | 12 |
| Elevated | 40 – 59 | 38 |
| High | 60 – 79 | 66 |
| Severe | ≥ 80 | 92 |

## 4. Composite score

`score = Σ(band_points × weight)` → 0–100, shown as the gauge on the
Forecast & Risk page. Interpretation bands: < 25 low · 25–49 elevated ·
50–74 high · ≥ 75 severe (for display only — severity itself follows the
conservative max-factor rule above).

## 5. Window summaries

For the next 6 / 12 / 24 hours the response additionally reports total
rainfall, max rain probability and max gust — so a coordinator can see whether
the signal is front-loaded or persistent.

## 6. Flags

`thunderstorm_forecast` (WMO code ≥ 95), `intense_rain_burst` (≥ 15 mm/h),
`damaging_gusts` (≥ 60 km/h), `heavy_rain_day_potential` (≥ 64.5 mm/24 h).

## 7. Transparency guarantees

- Every API response includes: each factor's raw value, unit, band, weight,
  points, threshold text, and a plain-language explanation.
- `thresholds_doc` ships the complete band table + rationale to the frontend,
  which renders it (Forecast & Risk → "Severity scale").
- The engine is pure and covered by unit tests including boundary cases
  (64.5 mm exactly, 15.4 vs 15.5, gusts-only scenarios, empty input).

## 8. Calibration status & optional ML extension

The thresholds are **experimental heuristics requiring local calibration**
(stated in-app). The bundled `datasets/historical/open_meteo_hyderabad_daily_1yr.csv`
(366 days of genuine Open-Meteo reanalysis data) provides a real baseline for
the optional scikit-learn anomaly-detection extension: flag forecast days
that are unusual **relative to Hyderabad's own recent climate**. Such a model
would be reported as anomaly scores only — never disaster probabilities — and
was intentionally deferred because a reliable dashboard outranks an
unfinished model.

## 9. Incident urgency (Feature D) — separate scale

Incident triage urgency (low/moderate/high/critical) uses **explicit
operational criteria** documented in the triage output: base 20; +35 trapped/
stranded; +30 deaths/unconscious; +20 injuries; +15 immediate assistance
flag; +12/+20 for ≥25/≥100 people affected; +10 deep water entering homes;
+8 collapse/electrocution hazard; +5 blocked roads; clamped 5–100. Both the
Gemini path and the rule-based fallback apply the same criteria, and the
coordinator confirms every result before action.
