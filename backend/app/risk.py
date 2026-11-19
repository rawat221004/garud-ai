"""GARUD transparent forecast-risk engine (Feature B).

This engine computes an EXPERIMENTAL hazard-potential indicator from
Open-Meteo forecast fields only. It is deliberately transparent:

  * every threshold is documented below and returned in API responses;
  * thresholds are heuristics inspired by IMD 24-hour rainfall day
    classifications — they are NOT validated flood predictions;
  * the engine never claims observed flooding; it expresses the potential
    for heavy rain / damaging gusts over the next 24 hours.

Severity scale: low < elevated < high < severe (see SEVERITIES).
"""

from __future__ import annotations

from typing import List, Optional

from .timeutil import iso_from_epoch, utc_now_iso

MODEL_ID = "garud-heuristic-v1"
SEVERITIES = ("low", "elevated", "high", "severe")
BAND_POINTS = (12.0, 38.0, 66.0, 92.0)  # points per severity band

# Experimental thresholds (documented; require local calibration).
# Rain 24h bands roughly follow IMD day classifications:
#   <15.5 mm light/low · 15.5-64.4 moderate · 64.5-115.5 heavy · >=115.6 very heavy+
RAIN_24H_EDGES = (15.5, 64.5, 115.6)
# Peak hourly rainfall intensity bands (heuristic).
RAIN_HOURLY_EDGES = (5.0, 15.0, 35.0)
# Wind gust bands (km/h), heuristic: squall-like gusts start around 60 km/h.
GUST_EDGES = (40.0, 60.0, 80.0)

WEIGHTS = {
    "rain_accumulation_24h": 0.35,
    "rain_intensity_max": 0.35,
    "wind_gust_max": 0.30,
}

DISCLAIMER = (
    "Experimental heuristic indicator computed from Open-Meteo forecast fields. "
    "It estimates heavy-rainfall and gust potential for the next 24 hours — it is "
    "NOT a validated flood or damage prediction and must not be the sole basis for "
    "operational decisions. Thresholds are experimental and require local calibration."
)

THRESHOLDS_DOC = {
    "rain_accumulation_24h": {
        "unit": "mm",
        "bands": {"low": "<15.5", "elevated": "15.5-64.4", "high": "64.5-115.5", "severe": ">=115.6"},
        "note": "Inspired by IMD 24-h rainfall day classifications (moderate/heavy/very heavy). Experimental.",
    },
    "rain_intensity_max": {
        "unit": "mm/h",
        "bands": {"low": "<5", "elevated": "5-14.9", "high": "15-34.9", "severe": ">=35"},
        "note": "Heuristic peak-hourly intensity. Experimental.",
    },
    "wind_gust_max": {
        "unit": "km/h",
        "bands": {"low": "<40", "elevated": "40-59", "high": "60-79", "severe": ">=80"},
        "note": "Heuristic gust bands; squall-like conditions typically 60+ km/h. Experimental.",
    },
    "score": "Weighted points (rain 24h 35%, rain intensity 35%, gusts 30%), 0-100.",
    "overall_severity": "Overall severity is the highest of the three factor severities (conservative).",
}


def classify(value: float, edges: tuple) -> int:
    """Return severity band index 0..3 for a value given 3 rising edges."""
    if value is None:
        return 0
    if value < edges[0]:
        return 0
    if value < edges[1]:
        return 1
    if value < edges[2]:
        return 2
    return 3


def sev_name(idx: int) -> str:
    return SEVERITIES[max(0, min(3, idx))]


def factor_block(name: str, value: Optional[float], unit: str, idx: int, weight: float, note: str) -> dict:
    return {
        "name": name,
        "value": round(value, 1) if value is not None else None,
        "unit": unit,
        "severity": sev_name(idx),
        "weight": weight,
        "points": BAND_POINTS[idx],
        "threshold_note": note,
        "explanation": _explain(name, value, unit, idx),
    }


def _explain(name: str, value: Optional[float], unit: str, idx: int) -> str:
    if value is None:
        return "No forecast data available for this factor."
    band = sev_name(idx)
    if name == "rain_accumulation_24h":
        return (
            f"Forecast 24-hour rainfall accumulation of {value:.1f} mm falls in the "
            f"'{band}' experimental band. Accumulation drives waterlogging and urban "
            f"runoff potential; it does not confirm flooding on the ground."
        )
    if name == "rain_intensity_max":
        return (
            f"Peak forecast hourly rainfall of {value:.1f} {unit} falls in the "
            f"'{band}' experimental band. Short intense bursts overwhelm storm "
            f"drains faster than the same rain spread over many hours."
        )
    return (
        f"Peak forecast wind gust of {value:.0f} {unit} falls in the "
        f"'{band}' experimental band, indicating potential for tree fall, hoarding "
        f"and power-line damage."
    )


def compute_windows(hours: List[dict]) -> dict:
    """Rainfall / gust summaries over the next 6, 12 and 24 hours."""
    out = {}
    for label, n in (("h6", 6), ("h12", 12), ("h24", 24)):
        window = hours[:n]
        if not window:
            out[label] = {"rain_mm": 0.0, "rain_prob_max": 0, "gust_max": 0.0}
            continue
        rains = [h.get("precipitation_mm") or 0.0 for h in window]
        gusts = [h.get("wind_gusts_kmh") or 0.0 for h in window]
        probs = [h.get("precipitation_probability_pct") or 0 for h in window]
        out[label] = {
            "rain_mm": round(sum(rains), 1),
            "rain_prob_max": int(max(probs)),
            "gust_max": round(max(gusts), 1),
        }
    return out


def assess(hours: List[dict], city_name: str, simulated: bool = False) -> dict:
    """Compute a risk assessment from hourly forecast entries.

    ``hours`` must be chronological, starting at the current hour, each entry
    containing precipitation_mm / wind_gusts_kmh / precipitation_probability_pct /
    weather_code / temperature_c.
    """
    h24 = hours[:24]
    rain_24h = sum(h.get("precipitation_mm") or 0.0 for h in h24)
    rain_max = max((h.get("precipitation_mm") or 0.0 for h in h24), default=0.0)
    gust_max = max((h.get("wind_gusts_kmh") or 0.0 for h in h24), default=0.0)

    i_rain = classify(rain_24h, RAIN_24H_EDGES)
    i_int = classify(rain_max, RAIN_HOURLY_EDGES)
    i_gust = classify(gust_max, GUST_EDGES)

    factors = [
        factor_block("rain_accumulation_24h", rain_24h, "mm", i_rain, WEIGHTS["rain_accumulation_24h"],
                      "24h total: <15.5 low · 15.5-64.4 elevated · 64.5-115.5 high · >=115.6 severe"),
        factor_block("rain_intensity_max", rain_max, "mm/h", i_int, WEIGHTS["rain_intensity_max"],
                     "Peak hour: <5 low · 5-14.9 elevated · 15-34.9 high · >=35 severe"),
        factor_block("wind_gust_max", gust_max, "km/h", i_gust, WEIGHTS["wind_gust_max"],
                     "Peak gust: <40 low · 40-59 elevated · 60-79 high · >=80 severe"),
    ]

    score = sum(f["points"] * f["weight"] for f in factors)
    overall_idx = max(i_rain, i_int, i_gust)

    flags: List[str] = []
    if any((h.get("weather_code") or 0) >= 95 for h in h24):
        flags.append("thunderstorm_forecast")
    if rain_max >= 15.0:
        flags.append("intense_rain_burst")
    if gust_max >= 60.0:
        flags.append("damaging_gusts")
    if rain_24h >= 64.5:
        flags.append("heavy_rain_day_potential")

    return {
        "city": city_name,
        "severity": sev_name(overall_idx),
        "score": round(score, 1),
        "simulated": simulated,
        "model": MODEL_ID,
        "computed_at": utc_now_iso(),
        "factors": factors,
        "windows": compute_windows(hours),
        "flags": flags,
        "disclaimer": DISCLAIMER,
        "thresholds_doc": THRESHOLDS_DOC,
    }
