"""GARUD AI configuration and monitored-city registry.

Environment variables are read from backend/.env (see .env.example).
GEMINI_API_KEY and GEMINI_MODEL are read by their own names; other settings
use DB_PATH / HTTP_TIMEOUT.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent

# Monitored Indian cities (configurable registry used by every module).
CITIES: Dict[str, dict] = {
    "hyderabad": {"id": "hyderabad", "name": "Hyderabad", "state": "Telangana", "lat": 17.3850, "lon": 78.4867},
    "mumbai":    {"id": "mumbai",    "name": "Mumbai",    "state": "Maharashtra", "lat": 19.0760, "lon": 72.8777},
    "delhi":     {"id": "delhi",     "name": "Delhi",     "state": "Delhi",       "lat": 28.6139, "lon": 77.2090},
    "chennai":   {"id": "chennai",   "name": "Chennai",   "state": "Tamil Nadu",  "lat": 13.0827, "lon": 80.2707},
    "bengaluru": {"id": "bengaluru", "name": "Bengaluru", "state": "Karnataka",  "lat": 12.9716, "lon": 77.5946},
    "kolkata":   {"id": "kolkata",   "name": "Kolkata",   "state": "West Bengal","lat": 22.5726, "lon": 88.3639},
    "pune":      {"id": "pune",      "name": "Pune",      "state": "Maharashtra", "lat": 18.5204, "lon": 73.8567},
    "guwahati":  {"id": "guwahati",  "name": "Guwahati",  "state": "Assam",       "lat": 26.1445, "lon": 91.7362},
    "ahmedabad": {"id": "ahmedabad", "name": "Ahmedabad", "state": "Gujarat",    "lat": 23.0225, "lon": 72.5714},
    "jaipur":    {"id": "jaipur",    "name": "Jaipur",    "state": "Rajasthan",  "lat": 26.9124, "lon": 75.7873},
}

# Rough bounding box used to classify events as "in or near India".
INDIA_BBOX = {"lat_min": 6.0, "lat_max": 37.5, "lon_min": 66.0, "lon_max": 98.5}

# Configurable (fictional) demo response units for the coordinator workflow.
# These are prototype configuration values only — GARUD AI never dispatches
# real emergency services and says so in the UI.
RESPONSE_TEAMS = [
    "City Disaster Response Cell (HQ)",
    "Central Zone Police Control",
    "Fire & Emergency Services Unit 4",
    "State Disaster Response Force (SDRF-style unit)",
    "Municipal Drainage & Monsoon Cell",
    "Zone-3 Mobile Ambulance Group",
    "NDRF Liaison Team (coordination only)",
]

SEVERITY_ORDER = {"low": 0, "elevated": 1, "high": 2, "severe": 3}


def get_city(city_id: str) -> Optional[dict]:
    """Return a monitored city record by id (case-insensitive), else None."""
    if not city_id:
        return None
    return CITIES.get(city_id.strip().lower())


class Settings(BaseSettings):
    app_name: str = "GARUD AI"
    app_version: str = "1.0.0"
    gemini_api_key: Optional[str] = None
    gemini_model: str = "gemini-3.6-flash"
    db_path: str = "data/garud.db"
    http_timeout: float = 15.0

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )


settings = Settings()
