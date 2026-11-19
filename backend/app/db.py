"""SQLite persistence layer for incidents, incident events and simulation state.

All writes go through short-lived connections (SQLite in WAL mode handles this
comfortably at hackathon scale). Async wrappers keep FastAPI handlers async.
"""

from __future__ import annotations

import asyncio
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from .config import BACKEND_DIR, settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    location_label TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    people_affected INTEGER,
    assistance_needed INTEGER NOT NULL DEFAULT 0,
    severity TEXT NOT NULL DEFAULT 'moderate',
    urgency_score INTEGER NOT NULL DEFAULT 30,
    status TEXT NOT NULL DEFAULT 'reported',
    source_type TEXT NOT NULL DEFAULT 'citizen',
    assigned_team TEXT,
    triage_engine TEXT NOT NULL DEFAULT '',
    triage_json TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_source ON incidents(source_type);

CREATE TABLE IF NOT EXISTS incident_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id TEXT NOT NULL,
    at TEXT NOT NULL,
    event TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    actor TEXT NOT NULL DEFAULT 'system'
);
CREATE INDEX IF NOT EXISTS idx_events_incident ON incident_events(incident_id);

CREATE TABLE IF NOT EXISTS simulation_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    active INTEGER NOT NULL DEFAULT 0,
    phase INTEGER NOT NULL DEFAULT 0,
    started_at TEXT,
    scenario_id TEXT
);
INSERT OR IGNORE INTO simulation_state (id, active, phase) VALUES (1, 0, 0);
"""


def db_file() -> Path:
    p = Path(settings.db_path)
    if not p.is_absolute():
        p = BACKEND_DIR / p
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(db_file(), timeout=15)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = connect()
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


async def run_db(fn: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
    """Run a blocking DB function in a worker thread (kwargs supported)."""
    return await asyncio.to_thread(fn, *args, **kwargs)


# ---------------------------------------------------------------------------
# Synchronous DB operations (call via run_db from async code, or directly
# from pytest tests).
# ---------------------------------------------------------------------------

def insert_incident(row: dict) -> None:
    conn = connect()
    try:
        conn.execute(
            """INSERT INTO incidents
               (id, created_at, updated_at, lat, lon, location_label, city, category,
                title, description, people_affected, assistance_needed, severity,
                urgency_score, status, source_type, assigned_team, triage_engine, triage_json)
               VALUES (:id, :created_at, :updated_at, :lat, :lon, :location_label, :city,
                       :category, :title, :description, :people_affected, :assistance_needed,
                       :severity, :urgency_score, :status, :source_type, :assigned_team,
                       :triage_engine, :triage_json)""",
            row,
        )
        conn.commit()
    finally:
        conn.close()


def insert_event(incident_id: str, at: str, event: str, detail: str = "", actor: str = "system") -> None:
    conn = connect()
    try:
        conn.execute(
            "INSERT INTO incident_events (incident_id, at, event, detail, actor) VALUES (?, ?, ?, ?, ?)",
            (incident_id, at, event, detail, actor),
        )
        conn.commit()
    finally:
        conn.close()


def get_incident(incident_id: str) -> dict | None:
    conn = connect()
    try:
        row = conn.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def list_incidents(
    status: str | None = None,
    category: str | None = None,
    severity: str | None = None,
    city: str | None = None,
    q: str | None = None,
    source_type: str | None = None,
    limit: int = 200,
) -> list[dict]:
    sql = "SELECT * FROM incidents WHERE 1=1"
    params: list[Any] = []
    if status:
        sql += " AND status = ?"
        params.append(status)
    if category:
        sql += " AND category = ?"
        params.append(category)
    if severity:
        sql += " AND severity = ?"
        params.append(severity)
    if city:
        sql += " AND city = ?"
        params.append(city)
    if source_type:
        sql += " AND source_type = ?"
        params.append(source_type)
    if q:
        sql += " AND (title LIKE ? OR description LIKE ? OR id LIKE ?)"
        like = f"%{q}%"
        params.extend([like, like, like])
    sql += " ORDER BY created_at DESC LIMIT ?"
    params.append(int(limit))
    conn = connect()
    try:
        return [dict(r) for r in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()


def update_incident(incident_id: str, fields: dict) -> bool:
    if not fields:
        return False
    sets = ", ".join(f"{k} = :{k}" for k in fields)
    conn = connect()
    try:
        cur = conn.execute(f"UPDATE incidents SET {sets} WHERE id = :_id", {**fields, "_id": incident_id})
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def delete_incidents_source(source_type: str) -> int:
    conn = connect()
    try:
        ids = [r["id"] for r in conn.execute("SELECT id FROM incidents WHERE source_type = ?", (source_type,)).fetchall()]
        conn.execute("DELETE FROM incidents WHERE source_type = ?", (source_type,))
        if ids:
            marks = ",".join("?" * len(ids))
            conn.execute(f"DELETE FROM incident_events WHERE incident_id IN ({marks})", ids)
        conn.commit()
        return len(ids)
    finally:
        conn.close()


def get_events_for(incident_id: str) -> list[dict]:
    conn = connect()
    try:
        rows = conn.execute(
            "SELECT * FROM incident_events WHERE incident_id = ? ORDER BY at ASC, id ASC", (incident_id,)
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def recent_events(limit: int = 50, source_type: str | None = None) -> list[dict]:
    sql = """SELECT e.*, i.title AS incident_title, i.source_type AS source_type, i.severity AS severity
             FROM incident_events e JOIN incidents i ON i.id = e.incident_id"""
    params: list[Any] = []
    if source_type:
        sql += " WHERE i.source_type = ?"
        params.append(source_type)
    sql += " ORDER BY e.at DESC, e.id DESC LIMIT ?"
    params.append(int(limit))
    conn = connect()
    try:
        return [dict(r) for r in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()


def incident_counts() -> dict:
    conn = connect()
    try:
        rows = conn.execute("SELECT status, COUNT(*) AS n FROM incidents GROUP BY status").fetchall()
        by_status = {r["status"]: r["n"] for r in rows}
        total = conn.execute("SELECT COUNT(*) AS n FROM incidents").fetchone()["n"]
        sim = conn.execute("SELECT COUNT(*) AS n FROM incidents WHERE source_type='simulation'").fetchone()["n"]
        return {"total": total, "by_status": by_status, "simulated": sim}
    finally:
        conn.close()


# --- simulation state ------------------------------------------------------

def get_sim_state() -> dict:
    conn = connect()
    try:
        row = conn.execute("SELECT * FROM simulation_state WHERE id = 1").fetchone()
        return dict(row) if row else {"active": 0, "phase": 0, "started_at": None, "scenario_id": None}
    finally:
        conn.close()


def set_sim_state(active: bool, phase: int, started_at: str | None, scenario_id: str | None) -> None:
    conn = connect()
    try:
        conn.execute(
            "UPDATE simulation_state SET active=?, phase=?, started_at=?, scenario_id=? WHERE id=1",
            (1 if active else 0, phase, started_at, scenario_id),
        )
        conn.commit()
    finally:
        conn.close()


# --- helper used by simulation to stay idempotent ---------------------------

def incident_exists(incident_id: str) -> bool:
    conn = connect()
    try:
        return conn.execute("SELECT 1 FROM incidents WHERE id = ?", (incident_id,)).fetchone() is not None
    finally:
        conn.close()
