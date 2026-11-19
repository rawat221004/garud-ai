"""Open-Meteo normalization tests (offline fixture built in-memory)."""

import time

import pytest

from app.services.weather import _normalize


def make_raw(n_hours: int = 72, start_offset: int = -2) -> dict:
    now = int(time.time())
    times = [now + (start_offset + i) * 3600 for i in range(n_hours)]
    return {
        "current": {
            "time": now,
            "temperature_2m": 27.1,
            "relative_humidity_2m": 60,
            "precipitation": 0.2,
            "weather_code": 3,
            "wind_speed_10m": 12.0,
            "wind_gusts_10m": 22.0,
        },
        "hourly": {
            "time": times,
            "temperature_2m": [25.0] * n_hours,
            "relative_humidity_2m": [60] * n_hours,
            "precipitation": [1.0] * n_hours,
            "precipitation_probability": [40] * n_hours,
            "weather_code": [61] * n_hours,
            "surface_pressure": [1000.0] * n_hours,
            "wind_speed_10m": [10.0] * n_hours,
            "wind_gusts_10m": [20.0] * n_hours,
        },
        "timezone": "Asia/Kolkata",
    }


def test_normalize_produces_48_utc_entries():
    city = {"id": "test", "name": "Test", "state": "X", "lat": 0.0, "lon": 0.0}
    env = _normalize(make_raw(), city)
    assert len(env["hourly"]) == 48
    first = env["hourly"][0]
    assert first["time"].endswith("Z")
    assert first["precipitation_mm"] == 1.0
    assert first["wind_gusts_kmh"] == 20.0
    assert first["precipitation_probability_pct"] == 40
    assert env["current"]["temperature_c"] == 27.1
    assert env["city"]["id"] == "test"


def test_normalize_pads_missing_optional_arrays():
    raw = make_raw()
    del raw["hourly"]["precipitation_probability"]
    del raw["hourly"]["surface_pressure"]
    env = _normalize(raw, {"id": "t", "name": "T", "lat": 0, "lon": 0})
    assert env["hourly"][0]["precipitation_probability_pct"] is None
    assert env["hourly"][0]["pressure_hpa"] is None


def test_normalize_rejects_bad_shape():
    with pytest.raises(ValueError):
        _normalize({"current": {}}, {"id": "t", "name": "T", "lat": 0, "lon": 0})
    with pytest.raises(ValueError):
        _normalize({"hourly": {"time": []}}, {"id": "t", "name": "T", "lat": 0, "lon": 0})
