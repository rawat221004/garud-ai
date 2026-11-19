"""Incident API workflow tests (TestClient, temp SQLite, no network)."""


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["gemini_configured"] is False  # deterministic test env


def test_locations_registry(client):
    r = client.get("/api/locations")
    assert r.status_code == 200
    ids = [c["id"] for c in r.json()["cities"]]
    assert "hyderabad" in ids and "mumbai" in ids


def test_full_incident_lifecycle(client):
    payload = {
        "lat": 17.385,
        "lon": 78.4867,
        "city": "hyderabad",
        "location_label": "Begumpet, Hyderabad",
        "category": "flooding",
        "title": "Waterlogging on main road",
        "description": "Heavy rain causing knee deep waterlogging near Begumpet; traffic stuck; two-wheelers stranded.",
        "people_affected": 12,
        "assistance_needed": True,
    }
    r = client.post("/api/incidents", json=payload)
    assert r.status_code == 201, r.text
    inc = r.json()
    assert inc["id"].startswith("INC-")
    assert inc["status"] == "reported"
    assert inc["source_type"] == "citizen"
    assert inc["simulated"] is False
    assert inc["triage"]["engine"] == "rule-based-fallback-v1"
    assert inc["severity"] in ("low", "moderate", "high", "critical")
    assert inc["category_label"] == "Flooding / waterlogging"
    iid = inc["id"]

    # persisted with audit history
    r2 = client.get(f"/api/incidents/{iid}")
    assert r2.status_code == 200
    body = r2.json()
    assert len(body["status_history"]) >= 2
    assert any(e["event"] == "Incident reported" for e in body["status_history"])
    assert any(e["event"] == "Auto-triage completed" for e in body["status_history"])

    # invalid transition rejected with allowed options
    r3 = client.patch(f"/api/incidents/{iid}", json={"status": "resolved"})
    assert r3.status_code == 422
    assert "allowed" in r3.json()["detail"]

    # assigning a team implicitly moves report → assigned
    r4 = client.patch(f"/api/incidents/{iid}", json={"assigned_team": "Fire & Emergency Services Unit 4"})
    assert r4.status_code == 200
    body = r4.json()
    assert body["status"] == "assigned"
    assert body["assigned_team"].startswith("Fire")
    assert "responding" in body["allowed_next_statuses"]

    # assigned → responding → resolved with a note
    r5 = client.patch(f"/api/incidents/{iid}", json={"status": "responding"})
    assert r5.status_code == 200
    r6 = client.patch(f"/api/incidents/{iid}", json={"status": "resolved", "note": "Drain cleared, road open"})
    assert r6.status_code == 200
    assert r6.json()["status"] == "resolved"
    history = r6.json()["status_history"]
    assert any("Drain cleared" in e["detail"] for e in history)

    # search + list reflect the record
    r7 = client.get("/api/incidents", params={"q": "Begumpet"})
    assert any(i["id"] == iid for i in r7.json()["incidents"])

    # coordinator note-only PATCH creates an event
    r8 = client.patch(f"/api/incidents/{iid}", json={"note": "Follow-up call completed"})
    assert r8.status_code == 200
    assert any(e["event"] == "Coordinator note" for e in r8.json()["status_history"])

    # activity timeline endpoint works
    r9 = client.get("/api/incidents/events")
    assert r9.status_code == 200 and r9.json()["total"] > 0


def test_validation_errors(client):
    # missing required fields
    r = client.post("/api/incidents", json={"lat": 5.0, "lon": 5.0, "title": "ab", "description": "x"})
    assert r.status_code == 422
    # impossible latitude
    r2 = client.post(
        "/api/incidents",
        json={"lat": 999.0, "lon": 0.0, "title": "A valid title", "description": "A valid description here"},
    )
    assert r2.status_code == 422
    # unknown city rejected with guidance
    r3 = client.post(
        "/api/incidents",
        json={
            "lat": 17.4, "lon": 78.5, "city": "atlantis",
            "category": "flooding", "title": "A valid title", "description": "A valid description here",
        },
    )
    assert r3.status_code == 422
    assert "hyderabad" in r3.json()["detail"]
    # missing incident
    assert client.get("/api/incidents/DOES-NOT-EXIST").status_code == 404
    # empty patch rejected
    inc = client.post(
        "/api/incidents",
        json={"lat": 17.4, "lon": 78.5, "category": "other_needs_review",
              "title": "Another valid title", "description": "Another valid description"},
    ).json()
    assert client.patch(f"/api/incidents/{inc['id']}", json={}).status_code == 400


def test_persistence_across_restart(client, temp_db):
    inc = client.post(
        "/api/incidents",
        json={
            "lat": 19.07, "lon": 72.87, "city": "mumbai", "category": "storm_damage",
            "title": "Tree fall blocking lane", "description": "Uprooted tree blocking the lane after gusts.",
        },
    ).json()

    # a brand-new ASGI client against the same database file simulates a restart
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c2:
        found = c2.get(f"/api/incidents/{inc['id']}")
        assert found.status_code == 200
        assert found.json()["title"] == "Tree fall blocking lane"


def test_direct_triage_endpoint(client):
    r = client.post(
        "/api/ai/triage",
        json={
            "title": "People stuck in lift during outage",
            "description": "Three people trapped in a lift between floors after power failure in the building.",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["engine"] == "rule-based-fallback-v1"
    triage = body["triage"]
    assert triage["urgency_score"] >= 50  # trapped → +35
    assert triage["details"]["people_trapped"] is True
    assert triage["recommended_agencies"]
