"""Pydantic models shared by API handlers and the AI engines."""

from __future__ import annotations

import re
from enum import Enum
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


def clean_text(v: str) -> str:
    """Strip whitespace and control characters from user text."""
    if v is None:
        return v
    v = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u200b-\u200f\u2028\u2029]", "", v)
    return v.strip()


class IncidentStatus(str, Enum):
    REPORTED = "reported"
    UNDER_REVIEW = "under_review"
    ASSIGNED = "assigned"
    RESPONDING = "responding"
    RESOLVED = "resolved"
    REJECTED = "rejected"
    DUPLICATE = "duplicate"


# Allowed workflow transitions (coordinator-driven, validated server-side).
STATUS_TRANSITIONS: dict[str, set[str]] = {
    "reported": {"under_review", "assigned", "rejected", "duplicate"},
    "under_review": {"assigned", "rejected", "duplicate", "reported"},
    "assigned": {"responding", "resolved", "under_review"},
    "responding": {"resolved", "assigned"},
    "resolved": set(),
    "rejected": {"under_review"},
    "duplicate": set(),
}


class IncidentCategory(str, Enum):
    FLOODING = "flooding"
    EARTHQUAKE_DAMAGE = "earthquake_damage"
    STORM_DAMAGE = "storm_damage"
    FIRE_WILDFIRE = "fire_wildfire"
    INFRASTRUCTURE = "infrastructure_failure"
    MEDICAL = "medical_assistance"
    RESCUE = "rescue_request"
    OTHER = "other_needs_review"


CATEGORY_LABELS = {
    "flooding": "Flooding / waterlogging",
    "earthquake_damage": "Earthquake damage",
    "storm_damage": "Severe storm damage",
    "fire_wildfire": "Fire / wildfire",
    "infrastructure_failure": "Infrastructure failure",
    "medical_assistance": "Medical assistance",
    "rescue_request": "Rescue request",
    "other_needs_review": "Other / needs review",
}


class IncidentCreate(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0, description="Report location latitude")
    lon: float = Field(..., ge=-180.0, le=180.0, description="Report location longitude")
    city: Optional[str] = Field(None, max_length=40)
    location_label: str = Field("", max_length=120)
    category: IncidentCategory = IncidentCategory.OTHER
    title: str = Field(..., min_length=5, max_length=140)
    description: str = Field(..., min_length=5, max_length=2000)
    people_affected: Optional[int] = Field(None, ge=0, le=1_000_000)
    assistance_needed: bool = False
    source_type: Literal["citizen", "coordinator"] = "citizen"

    @field_validator("title", "description", "location_label")
    @classmethod
    def _clean(cls, v: str) -> str:
        return clean_text(v)


class IncidentPatch(BaseModel):
    status: Optional[IncidentStatus] = None
    assigned_team: Optional[str] = Field(None, max_length=90)
    note: Optional[str] = Field(None, max_length=300)

    @field_validator("assigned_team", "note")
    @classmethod
    def _clean(cls, v: Optional[str]) -> Optional[str]:
        return clean_text(v) if v else v


class TriageDetails(BaseModel):
    injuries_reported: bool = False
    people_trapped: bool = False
    blocked_roads: bool = False
    infrastructure_damage: bool = False
    evacuation_requested: bool = False


class TriageResult(BaseModel):
    engine: str
    category: IncidentCategory
    urgency: Literal["low", "moderate", "high", "critical"]
    urgency_score: int = Field(..., ge=0, le=100)
    summary: str = Field(..., max_length=900)
    details: TriageDetails = TriageDetails()
    recommended_agencies: List[str] = Field(default_factory=list, max_length=6)
    next_steps: List[str] = Field(default_factory=list, max_length=8)
    confidence: float = Field(0.5, ge=0.0, le=1.0)
    notes: str = ""


class BriefingSource(BaseModel):
    name: str
    timestamp: str = ""
    description: str = ""


class BriefingResult(BaseModel):
    engine: str
    headline: str = Field(..., max_length=160)
    situation_summary: str = Field(..., max_length=2200)
    hazards_observed: List[str] = Field(default_factory=list, max_length=12)
    forecast_concerns: List[str] = Field(default_factory=list, max_length=12)
    preparedness_actions: List[str] = Field(default_factory=list, max_length=12)
    response_considerations: List[str] = Field(default_factory=list, max_length=12)
    data_gaps: List[str] = Field(default_factory=list, max_length=12)
    sources: List[BriefingSource] = Field(default_factory=list, max_length=16)
    uncertainty_note: str = ""
    language: str = "en"
    generated_at: str = ""


class BriefingRequest(BaseModel):
    city: str = "hyderabad"
    language: Literal["en", "hi", "te"] = "en"


class TriageRequest(BaseModel):
    incident_id: Optional[str] = None
    # Direct triage (no persistence) allowed for testing:
    title: Optional[str] = Field(None, max_length=140)
    description: Optional[str] = Field(None, max_length=2000)
    category: Optional[IncidentCategory] = None
    people_affected: Optional[int] = Field(None, ge=0, le=1_000_000)
    assistance_needed: bool = False
