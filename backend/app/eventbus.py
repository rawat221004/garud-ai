"""Tiny in-process pub/sub used by the SSE stream (/api/incidents/stream)."""

from __future__ import annotations

import asyncio
from typing import Any, Optional, Set

from .timeutil import utc_now_iso


class EventBus:
    def __init__(self) -> None:
        self._subs: Set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=64)
        self._subs.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subs.discard(q)

    def publish(self, type_: str, payload: Optional[dict] = None) -> None:
        msg = {"type": type_, "at": utc_now_iso(), "payload": payload or {}}
        for q in list(self._subs):
            try:
                q.put_nowait(msg)
            except asyncio.QueueFull:
                pass


bus = EventBus()
