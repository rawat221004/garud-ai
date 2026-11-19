"""Small time helpers. All timestamps are stored as UTC ISO-8601 strings;
the frontend renders them in Asia/Kolkata."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    return utc_now().isoformat(timespec="seconds").replace("+00:00", "Z")


def iso_from_epoch(epoch: float) -> str:
    return datetime.fromtimestamp(epoch, tz=timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_iso(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def age_seconds(iso: str | None) -> float | None:
    if not iso:
        return None
    try:
        return max(0.0, (utc_now() - parse_iso(iso)).total_seconds())
    except ValueError:
        return None


def hours_from_now(hours: float) -> str:
    return (utc_now() + timedelta(hours=hours)).isoformat(timespec="seconds").replace("+00:00", "Z")
