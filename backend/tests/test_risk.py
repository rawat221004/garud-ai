"""Transparent risk engine tests (no network required)."""

from app.risk import DISCLAIMER, THRESHOLDS_DOC, assess, compute_windows


def hour(precip=0.0, gust=0.0, prob=0, code=0, temp=25.0):
    return {
        "time": "t",
        "temperature_c": temp,
        "humidity_pct": 50,
        "precipitation_mm": precip,
        "precipitation_probability_pct": prob,
        "weather_code": code,
        "pressure_hpa": 1005.0,
        "wind_speed_kmh": gust * 0.6,
        "wind_gusts_kmh": gust,
    }


SIM_RAIN = [8, 14, 26, 32, 35, 38, 36, 30, 18, 12, 9, 6] + [3] * 12 + [0.2] * 24
SIM_GUST = [52, 58, 65, 72, 78, 85, 82, 74, 60, 48, 40, 34] + [24] * 12 + [16] * 24
SIM_CODE = [65, 80, 95, 95, 95, 95, 95, 95, 95, 65, 65, 51] + [61] * 12 + [1] * 24


def test_low_risk_flat_forecast():
    a = assess([hour() for _ in range(24)], "TestCity")
    assert a["severity"] == "low"
    assert a["score"] < 25.0
    assert a["windows"]["h24"]["rain_mm"] == 0.0
    assert a["disclaimer"] == DISCLAIMER
    assert "score" in a["thresholds_doc"]
    assert a["model"] == "garud-heuristic-v1"


def test_severe_simulated_scenario_pattern():
    hours = [hour(precip=SIM_RAIN[i], gust=SIM_GUST[i], prob=95, code=SIM_CODE[i]) for i in range(48)]
    a = assess(hours, "Hyderabad", simulated=True)
    assert a["simulated"] is True
    assert a["severity"] == "severe"
    # all three factors in the severe band
    assert all(f["severity"] == "severe" for f in a["factors"])
    assert a["windows"]["h24"]["rain_mm"] >= 115.6
    assert "thunderstorm_forecast" in a["flags"]
    assert "intense_rain_burst" in a["flags"]
    assert "damaging_gusts" in a["flags"]
    assert "heavy_rain_day_potential" in a["flags"]


def test_boundary_values_follow_documented_bands():
    # exactly 64.5 mm/24h → IMD 'heavy' boundary → high band
    a = assess([hour(precip=64.5 / 24) for _ in range(24)], "X")
    f = {x["name"]: x for x in a["factors"]}
    assert f["rain_accumulation_24h"]["severity"] == "high"
    # 15.4 is below the 15.5 elevated edge → low; 20 mm is inside elevated
    a1 = assess([hour(precip=15.4 / 24) for _ in range(24)], "X")
    f1 = {x["name"]: x for x in a1["factors"]}
    assert f1["rain_accumulation_24h"]["severity"] == "low"
    a2 = assess([hour(precip=20.0 / 24) for _ in range(24)], "X")
    f2 = {x["name"]: x for x in a2["factors"]}
    assert f2["rain_accumulation_24h"]["severity"] == "elevated"


def test_overall_severity_is_max_of_factors():
    # gusts severe, rain low → overall severe (conservative max rule)
    a = assess([hour(gust=90.0) for _ in range(24)], "X")
    f = {x["name"]: x for x in a["factors"]}
    assert f["wind_gust_max"]["severity"] == "severe"
    assert f["rain_accumulation_24h"]["severity"] == "low"
    assert a["severity"] == "severe"


def test_windows_math():
    hours = [hour(precip=2.0, gust=10.0, prob=60) for _ in range(12)]
    w = compute_windows(hours)
    assert w["h6"]["rain_mm"] == 12.0
    assert w["h12"]["rain_mm"] == 24.0
    assert w["h24"]["rain_mm"] == 24.0  # only 12 entries available
    assert w["h6"]["gust_max"] == 10.0
    assert w["h6"]["rain_prob_max"] == 60


def test_empty_hours_is_low_not_crash():
    a = assess([], "Empty")
    assert a["severity"] == "low"
    assert a["windows"]["h24"]["rain_mm"] == 0.0
