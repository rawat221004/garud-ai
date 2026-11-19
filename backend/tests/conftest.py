"""Pytest configuration: temp SQLite DB per test + deterministic AI fallback."""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest


@pytest.fixture()
def temp_db(tmp_path, monkeypatch):
    """Fresh SQLite database per test; Gemini disabled for determinism."""
    from app import db
    from app.config import settings

    monkeypatch.setattr(settings, "db_path", str(tmp_path / "garud_test.db"))
    monkeypatch.setattr(settings, "gemini_api_key", None)
    db.init_db()
    return db


@pytest.fixture()
def client(temp_db):
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c
