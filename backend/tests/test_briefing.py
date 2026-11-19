"""Rule-based briefing fallback tests (offline context, no network)."""

from app.ai.briefing import FALLBACK_ENGINE, fallback_briefing
from app.risk import assess


def _hours():
    rain = [30.0] * 8 + [2.0] * 16
    gust = [70.0] * 8 + [20.0] * 16
    return [
        {
            "time": "t", "temperature_c": 25.0, "humidity_pct": 90,
            "precipitation_mm": rain[i], "precipitation_probability_pct": 95,
            "weather_code": 95, "pressure_hpa": 990.0,
            "wind_speed_kmh": 40.0, "wind_gusts_kmh": gust[i],
        }
        for i in range(24)
    ]


def test_fallback_briefing_simulated_context():
    ctx = {
        "city": {"id": "hyderabad", "name": "Hyderabad", "state": "Telangana", "lat": 17.38, "lon": 78.48},
        "language": "en",
        "generated_at": "2026-11-19T06:00:00Z",
        "errors": ["GDACS feed unavailable (non-blocking)."],
        "weather": {"simulated": True, "fetched_at": "2026-11-19T05:55:00Z", "current": {"temperature_c": 24}},
        "risk": assess(_hours(), "Hyderabad", simulated=True),
        "earthquakes": [
            {"magnitude": 4.8, "place": "123 km E of example", "time": "2026-11-19T03:00:00Z",
             "distance_km": 210.0, "url": "https://example.org/eq"}
        ],
        "earthquakes_meta": {"fetched_at": "2026-11-19T05:50:00Z", "stale": False},
        "eonet_events": [],
        "eonet_meta": {"fetched_at": "2026-11-19T05:40:00Z", "stale": False},
        "gdacs_events": [],
        "incidents": {
            "open_count": 1,
            "by_urgency": {"low": 0, "moderate": 0, "high": 1, "critical": 0},
            "awaiting_assignment": 1,
            "top": [
                {"id": "SIM-HYD-FLOOD-01", "title": "Stranded residents", "category": "flooding",
                 "urgency": "high", "status": "reported", "simulated": True, "created_at": "x"}
            ],
        },
        "sim": {"active": True, "phase": 2},
    }

    b = fallback_briefing(ctx)
    assert b.engine == FALLBACK_ENGINE
    assert "SIMULATED SCENARIO" in b.headline or "SIMULATION" in b.headline
    assert "SIMULATION MODE ACTIVE" in b.situation_summary
    assert any("synthetic" in h for h in b.hazards_observed)
    assert b.hazards_observed  # quake + incident + sim notice
    assert b.forecast_concerns  # risk factors in elevated+ bands
    assert b.preparedness_actions
    assert b.response_considerations
    assert any("GDACS" in g for g in b.data_gaps)
    assert len(b.sources) >= 4  # weather, risk engine, USGS, EONET, incident DB
    assert b.language == "en"
    assert b.uncertainty_note


def test_fallback_briefing_missing_weather_degrades_gracefully():
    ctx = {
        "city": {"id": "pune", "name": "Pune", "state": "MH", "lat": 18.52, "lon": 73.85},
        "language": "hi",
        "generated_at": "2026-11-19T06:00:00Z",
        "errors": ["Weather source unavailable: simulated failure"],
        "weather": None,
        "risk": None,
        "earthquakes": [],
        "earthquakes_meta": None,
        "eonet_events": [],
        "eonet_meta": None,
        "gdacs_events": [],
        "incidents": {"open_count": 0, "by_urgency": {"low": 0, "moderate": 0, "high": 0, "critical": 0},
                     "awaiting_assignment": 0, "top": []},
        "sim": {"active": False, "phase": 0},
    }
    b = fallback_briefing(ctx)
    assert "unavailable" in b.headline
    assert any("Weather source unavailable" in g for g in b.data_gaps)
    assert any("Hindi" in g for g in b.data_gaps)  # honest limitation of the fallback
