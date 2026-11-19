/** Data Sources / System Status: live source health, AI engine, simulation, DB. */

import { useState } from "react";
import { Brain, Database, FlaskConical, Radio, ServerCog } from "lucide-react";
import { useSystemStatus } from "../hooks/useApi";
import SimBanner from "../components/layout/SimBanner";
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from "../components/ui";
import { ago, STATUS_LABELS } from "../lib/format";
import { cn } from "../lib/utils";

export default function SystemPage() {
  const { data: sys, isLoading, refetch, isFetching } = useSystemStatus();

  if (!sys) {
    return (
      <div className="workspace-page space-y-4">
        <PageHeader title="System Health" />
        {isLoading ? <Skeleton className="h-40" /> : <Card><EmptyState text="System health is temporarily unavailable." /><Button onClick={() => refetch()} disabled={isFetching}>Retry</Button></Card>}
      </div>
    );
  }

  return (
    <div className="workspace-page space-y-4">
      <PageHeader title="System Health" description="Check data freshness, AI availability and incident storage." />
      <dl className="incident-counts system-counts panel">
        <div><dt>Data availability</dt><dd className="capitalize">{sys.data_state === "offline" ? "Unavailable" : sys.data_state === "unknown" ? "Pending" : sys.data_state}</dd></div>
        <div><dt>Last source sync</dt><dd>{sys.last_sync ? ago(sys.last_sync) : "Pending"}</dd></div>
        <div><dt>Healthy integrations</dt><dd>{sys.sources.filter((source) => source.state === "ok").length}</dd></div>
        <div><dt>Degraded or unavailable</dt><dd>{sys.sources.filter((source) => source.state === "degraded" || source.state === "error").length}</dd></div>
      </dl>
      {/* sources */}
      <Card
        title="External data sources"
        icon={<Radio size={17} />}
        right={<Button size="sm" onClick={() => refetch()} disabled={isFetching}>{isFetching ? "Checking…" : "Check status"}</Button>}
        bodyClass="p-0"
      >
        <ul className="divide-y divide-edge">
          {sys.sources.map((source) => (
            <li key={source.name} className="source-row">
              <div>
                <a href={source.url} target="_blank" rel="noreferrer" className="font-semibold text-ink hover:underline">{source.name}</a>
                <p className="mt-0.5 text-xs text-faint">{source.last_success ? "Updated " + ago(source.last_success) : "No successful sync yet"}</p>
                {source.last_error && <p className="mt-1 text-xs text-mute">{source.state === "degraded" ? "Latest refresh failed. Cached data is available." : "The latest request to this provider failed."}</p>}
              </div>
              <span className={"text-sm " + (source.state === "ok" ? "text-low" : source.state === "unknown" ? "text-faint" : source.last_success ? "text-elevated" : "text-severe")}>
                {source.state === "ok" ? "Live" : source.state === "unknown" ? "Pending" : source.last_success && source.state === "degraded" ? "Cached" : "Unavailable"}
              </span>
              <details className="text-xs text-faint">
                <summary className="text-mute">Diagnostics</summary>
                <p className="mt-2">Latency {source.latency_ms ?? "—"} ms · {source.items ?? "—"} items · Cache {Math.round(source.ttl_seconds / 60)} min</p>
                {source.last_attempt && <p>Last attempt {ago(source.last_attempt)}</p>}
                {source.last_error && <p className="mt-1 break-all">{source.last_error}</p>}
              </details>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* AI engine */}
        <Card title="AI Incident Commander" icon={<Brain size={13} />}  bodyClass="p-4 space-y-2 text-xs text-mute">
          <div className="flex items-center gap-2">
            <span className="text-faint">Engine:</span>
            {sys.gemini.configured ? (
              <Badge className="bg-accent/15 text-accent border-accent/40">Configured · {sys.gemini.model}</Badge>
            ) : (
              <Badge className="bg-amber-500/15 text-fallback border-amber-500/40">Rule-based fallback</Badge>
            )}
          </div>
          <p>Each briefing and triage result identifies the engine that produced it. The configured model status does not track individual request outcomes.</p>
        </Card>

        {/* simulation */}
        <SimulationCard />

        {/* incident DB */}
        <Card title="Incident database (SQLite)" icon={<Database size={13} />}  bodyClass="p-4 space-y-2 text-xs text-mute">
          <p>Storage reachable</p>
          <p>
            Persisted records · <span className="tabular font-semibold text-ink">{sys.incident_counts.total}</span>
            {sys.incident_counts.simulated > 0 && (
              <span className="ml-1 rounded bg-sim/15 px-1 py-0.5 text-xs font-bold text-sim">
                {sys.incident_counts.simulated} simulated
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-1">
            {Object.entries(sys.incident_counts.by_status).map(([st, n]) => (
              <Badge key={st} className="border-edge text-mute">
                {STATUS_LABELS[st] ?? st}: {n}
              </Badge>
            ))}
          </div>
          <p className="text-faint">Reports and their audit history persist across restarts.</p>
        </Card>
      </div>

      {/* attribution & ops notes */}
      <Card title="Attribution, accuracy & operational notes" icon={<ServerCog size={13} />} bodyClass="p-4 text-xs leading-relaxed text-mute">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1 font-semibold text-ink">Data providers</p>
            <ul className="space-y-0.5 text-xs">
              <li>· Weather forecasts: <a className="text-accent hover:underline" href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a> (free, no key)</li>
              <li>· Earthquakes: <a className="text-accent hover:underline" href="https://earthquake.usgs.gov" target="_blank" rel="noreferrer">USGS</a> all_day feed</li>
              <li>· Natural events: <a className="text-accent hover:underline" href="https://eonet.gsfc.nasa.gov" target="_blank" rel="noreferrer">NASA EONET</a> + <a className="text-accent hover:underline" href="https://www.gdacs.org" target="_blank" rel="noreferrer">GDACS</a></li>
              <li>· Facilities: <a className="text-accent hover:underline" href="https://www.openstreetmap.org" target="_blank" rel="noreferrer">OpenStreetMap</a> via Overpass · basemap tiles © Esri (keyless, no registration)</li>
            </ul>
          </div>
          <div>
            <p className="mb-1 font-semibold text-ink">Data limits</p>
            <ul className="space-y-0.5 text-xs">
              <li>· Forecast risk bands are experimental heuristics, not validated flood predictions.</li>
              <li>· Mapped facilities are not verified operational.</li>
              <li>· AI outputs are labelled by engine (Gemini vs rule-based) and cite sources + timestamps.</li>
              <li>· Simulation data is separated at the source and badged everywhere.</li>
              <li>· {sys.timezone_note}</li>
            </ul>
          </div>
        </div>
        <p className="mt-3 border-t border-edge pt-2 text-xs text-faint">
          Interactive API documentation (OpenAPI/Swagger) runs with the backend at{" "}
          <a className="text-accent hover:underline" href={window.location.port === "5173" ? "http://127.0.0.1:8000/docs" : "/docs"} target="_blank" rel="noreferrer">
            Open API documentation
          </a>
          . GARUD AI is a decision-support prototype — it is not an official warning system and must not be used as
          one.
        </p>
      </Card>
    </div>
  );
}

function SimulationCard() {
  const { data: sys } = useSystemStatus();
  const [open, setOpen] = useState(false);
  const sim = sys?.simulation;
  return (
    <Card title="Simulation" icon={<FlaskConical size={17} />} bodyClass="space-y-3 p-4">
      <p className={cn("text-sm", sim?.active ? "text-sim" : "text-mute")}>
        {sim?.active ? "Active · Phase " + sim.phase + " of 3" : "Inactive"}
      </p>
      {sim?.active && <p className="text-sm text-mute">{sim.phase_label}</p>}
      <Button size="sm" onClick={() => setOpen(true)}>Scenario controls</Button>
      <SimBanner open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}
