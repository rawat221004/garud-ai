"""Forecast-driven risk endpoints (transparent heuristic engine)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from .. import risk
from ..config import get_city
from ..services.risksvc import assess_all_cities, assess_city, elevated_count

router = APIRouter(tags=["risk"])


@router.get("/risk")
async def risk_assessment(city: str | None = Query(None)) -> dict:
    """All monitored cities, or a single city when ?city= is given."""
    if city:
        city_d = get_city(city)
        if city_d is None:
            raise HTTPException(status_code=404, detail=f"Unknown city '{city}'. See /api/locations.")
        assessment = await assess_city(city_d)
        if assessment is None:
            raise HTTPException(
                status_code=503,
                detail={
                    "message": "Weather source unavailable; risk assessment for this city is not possible right now.",
                    "city": city,
                },
            )
        return assessment

    assessments = await assess_all_cities()
    return {
        "assessments": assessments,
        "elevated_count": elevated_count(assessments),
        "model": risk.MODEL_ID,
        "disclaimer": risk.DISCLAIMER,
        "thresholds_doc": risk.THRESHOLDS_DOC,
    }
