"""Shared TTL cache + external-source status registry.

Every external integration:
  * uses bounded timeouts,
  * caches results with a source-appropriate TTL,
  * keeps the last good result (marked stale) when a refresh fails,
  * records ok/error/latency for the System Status panel.
"""

from __future__ import annotations

import time
from typing import Any, Awaitable, Callable, Dict, Optional

from ..timeutil import iso_from_epoch, utc_now_iso


class ExternalSourceError(RuntimeError):
    def __init__(self, source: str, detail: str):
        self.source = source
        self.detail = detail
        super().__init__(f"External source '{source}' failed: {detail}")


class SourceStatus:
    def __init__(self, name: str, url: str, ttl: int):
        self.name = name
        self.url = url
        self.ttl = ttl
        self.state = "unknown"  # ok | degraded | error | unknown
        self.last_success: Optional[str] = None
        self.last_attempt: Optional[str] = None
        self.last_error: Optional[str] = None
        self.latency_ms: Optional[int] = None
        self.items: Optional[int] = None

    def record_ok(self, latency_ms: int, items: int) -> None:
        self.state = "ok"
        self.last_success = utc_now_iso()
        self.last_attempt = self.last_success
        self.last_error = None
        self.latency_ms = latency_ms
        self.items = items

    def record_stale(self, error: str) -> None:
        self.state = "degraded"
        self.last_attempt = utc_now_iso()
        self.last_error = error

    def record_error(self, error: str) -> None:
        self.state = "error"
        self.last_attempt = utc_now_iso()
        self.last_error = error

    def snapshot(self) -> dict:
        return {
            "name": self.name,
            "url": self.url,
            "state": self.state,
            "last_success": self.last_success,
            "last_attempt": self.last_attempt,
            "last_error": self.last_error,
            "latency_ms": self.latency_ms,
            "items": self.items,
            "ttl_seconds": self.ttl,
        }


SOURCES: Dict[str, SourceStatus] = {}


def register_source(name: str, url: str, ttl: int) -> SourceStatus:
    if name not in SOURCES:
        SOURCES[name] = SourceStatus(name, url, ttl)
    return SOURCES[name]


def all_source_snapshots() -> list[dict]:
    return [s.snapshot() for s in SOURCES.values()]


class _Entry:
    __slots__ = ("data", "fetched_at", "ttl")

    def __init__(self, data: Any, ttl: float):
        self.data = data
        self.fetched_at = time.time()
        self.ttl = ttl

    def fresh(self) -> bool:
        return (time.time() - self.fetched_at) < self.ttl


_CACHE: Dict[str, _Entry] = {}


async def cached_fetch(
    name: str,
    key: str,
    ttl: float,
    fetch: Callable[[], Awaitable[Any]],
    items_of: Optional[Callable[[Any], int]] = None,
    on_error_keep_stale: bool = True,
) -> dict:
    """Fetch with caching. Returns {"data", "fetched_at", "stale"}.

    Raises ExternalSourceError when the source fails and no cache exists.
    """
    entry = _CACHE.get(key)
    if entry is not None and entry.fresh():
        return {"data": entry.data, "fetched_at": iso_from_epoch(entry.fetched_at), "stale": False}

    status = SOURCES.get(name)
    t0 = time.monotonic()
    try:
        data = await fetch()
        latency = int((time.monotonic() - t0) * 1000)
        _CACHE[key] = _Entry(data, ttl)
        if status:
            status.record_ok(latency, items_of(data) if items_of else None)
        return {"data": data, "fetched_at": utc_now_iso(), "stale": False}
    except Exception as exc:  # noqa: BLE001 — external sources raise many shapes
        detail = f"{type(exc).__name__}: {exc}"
        if entry is not None and on_error_keep_stale:
            if status:
                status.record_stale(detail)
            return {"data": entry.data, "fetched_at": iso_from_epoch(entry.fetched_at), "stale": True}
        if status:
            status.record_error(detail)
        raise ExternalSourceError(name, detail) from exc
