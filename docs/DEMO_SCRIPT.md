# GARUD AI judge walkthrough

Start the API and frontend using `scripts\dev.ps1`. Open [the dashboard](http://localhost:5173) and confirm the simulation is inactive. A second browser window can show live incident updates.

## 0:00 · Detect a hazard

- Open **Overview**. Review monitored hazards, elevated-risk cities, critical open reports and the assignment queue. Source freshness is in the command bar.
- Select an event in the **Live hazard feed** to focus the map and open its details. Use **Map legend** to explain forecast markers and incident reports.
- Open **Live Map** to show the city, India and world views. Toggle a layer and search for a city or event.

## 0:40 · Analyze the risk

- Open **Forecast & Risk** and choose a monitored city. Show the 6/12/24-hour outlook, the chart measure and time-window controls, and the three risk drivers.
- Open **Risk methodology** for thresholds, weights and limitations. The heuristic estimates rainfall and wind potential. Confirmed impacts require observations or field reports.

## 1:20 · Prepare a response

- Generate an **AI situation brief** and review preparedness actions, known data gaps, and **Sources and timestamps**. Point out the engine label for Gemini or the rule-based fallback.
- Switch the requested briefing language if useful. **Copy brief** includes the engine, source citations and uncertainty.

## 2:00 · Work a fictional incident

1. Open **Simulation** and select **Start scenario**. The command bar selects Hyderabad and shows **Simulation active**. Point out the **Simulated** label on the weather and risk data.
2. Open **Simulation active** and **Advance scenario**. Phase 2 files the LB Nagar report. Select it from the **Action center** or use **Incident Response** with the Simulation source filter.
3. Review triage, select **Confirm urgency** to record an audit note, choose a response team, select **Assign**, and move the report to **Responding**. Show the status history and the live update in a second window. The workflow records actions inside the prototype.
4. Show **Draft alert**. Review or copy the editable draft. The prototype does not send alerts or dispatch real services.
5. Advance to phase 3 to show the additional reports, then resolve a report with a note.

## 3:20 · Restore the live view

- Open **Simulation active** and select **Reset scenario**. The scenario removes its fictional reports.
- Open **System Health** and expand **Diagnostics** for a provider. Explain cached or unavailable data if shown. OpenStreetMap facility records may be temporarily unavailable and never confirm operational readiness.
