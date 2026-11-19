"""Simulation mode tests: scripted phases, idempotent advances, clean resets."""


def test_simulation_full_cycle(client):
    # baseline: inactive, no simulated incidents
    st = client.get("/api/simulation/status").json()
    assert st["active"] is False
    assert st["simulated_incident_count"] == 0

    # start → phase 1: synthetic weather flows through the SAME risk engine
    st = client.post("/api/simulation/start").json()
    assert st["active"] is True and st["phase"] == 1

    w = client.get("/api/weather", params={"city": "hyderabad"}).json()
    assert w["simulated"] is True
    assert "SIMULATION" in w["source"]
    assert w["risk"]["severity"] == "severe"
    assert w["risk"]["simulated"] is True
    assert w["risk"]["factors"] and w["risk"]["thresholds_doc"]

    r = client.get("/api/incidents", params={"source_type": "simulation"}).json()
    assert r["total"] == 0

    # advance → phase 2: main scripted incident appears
    st = client.post("/api/simulation/advance").json()
    assert st["phase"] == 2
    r = client.get("/api/incidents", params={"source_type": "simulation"}).json()
    assert r["total"] == 1
    inc = r["incidents"][0]
    assert inc["id"] == "SIM-HYD-FLOOD-01"
    assert inc["simulated"] is True
    assert inc["severity"] in ("high", "critical")
    assert inc["triage"]["category"] == "flooding"
    assert inc["allowed_next_statuses"]  # workflow continues on simulated incidents too

    # the simulated incident can be worked like any other
    p = client.patch(f"/api/incidents/{inc['id']}", json={"assigned_team": "City Disaster Response Cell (HQ)"})
    assert p.status_code == 200 and p.json()["status"] == "assigned"

    # advance → phase 3: two more scripted incidents
    st = client.post("/api/simulation/advance").json()
    assert st["phase"] == 3
    r = client.get("/api/incidents", params={"source_type": "simulation"}).json()
    assert r["total"] == 3

    # advancing past the final phase is idempotent — no duplicate records
    st = client.post("/api/simulation/advance").json()
    assert st["phase"] == 3
    r = client.get("/api/incidents", params={"source_type": "simulation"}).json()
    assert r["total"] == 3

    # reset → clean, repeatable initial state
    st = client.post("/api/simulation/reset").json()
    assert st["active"] is False
    r = client.get("/api/incidents", params={"source_type": "simulation"}).json()
    assert r["total"] == 0

    # a second run starts clean (no uncontrolled duplicates from repeat runs)
    st = client.post("/api/simulation/start").json()
    assert st["phase"] == 1
    r = client.get("/api/incidents", params={"source_type": "simulation"}).json()
    assert r["total"] == 0


def test_advance_requires_active_scenario(client):
    r = client.post("/api/simulation/advance")
    assert r.status_code == 409
