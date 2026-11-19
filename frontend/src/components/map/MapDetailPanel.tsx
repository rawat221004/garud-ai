/** Side panel with details + actions for the selected map marker. */

import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Building2, ExternalLink, Flame, MapPin, Stethoscope, Waves, Wind, X } from "lucide-react";
import { Badge, EngineBadge, SeverityBadge, SimBadge, StatusBadge, UrgencyBadge } from "../ui";
import { ago, fmtIST, hexUrgency, num, wmoLabel } from "../../lib/format";
import type { MarkerSpec } from "./markers";

export default function MapDetailPanel({ item, onClose }: { item: MarkerSpec | null; onClose: () => void }) {
  const panel = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const itemKey = item?.key;

  useEffect(() => {
    const target = panel.current;
    if (!target || !itemKey) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && !target.contains(active)) trigger.current = active;
    target.focus({ preventScroll: true });
    if (window.matchMedia("(max-width: 960px)").matches) target.scrollIntoView({ block: "nearest" });
  }, [itemKey]);

  function close() {
    onClose();
    requestAnimationFrame(() => {
      if (trigger.current?.isConnected) trigger.current.focus();
    });
  }

  if (!item) return null;
  const d = item.data;

  return (
    <aside id="map-event-details" ref={panel} tabIndex={-1} className="map-detail panel flex max-h-[460px] min-h-0 flex-col overflow-y-auto" aria-label="Selected map event">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-edge bg-panel/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: item.color }} />
            <span className="text-xs font-semibold capitalize text-faint">{item.kind}</span>
          </div>
          <h3 className="break-words text-base font-semibold text-ink">{item.title}</h3>
        </div>
        <button onClick={close} className="grid size-8 shrink-0 place-items-center rounded text-mute hover:bg-panel2" aria-label="Close details">
          <X size={16} />
        </button>
      </header>

      <div className="flex-1 space-y-3 px-4 py-3 text-[13px] text-mute">
        {item.kind === "incident" && <IncidentBody d={d} />}
        {item.kind === "weather" && <WeatherBody d={d} />}
        {item.kind === "earthquake" && <QuakeBody d={d} />}
        {item.kind === "disaster" && <DisasterBody d={d} />}
        {item.kind === "resource" && <ResourceBody d={d} />}
      </div>
    </aside>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-faint">{label}</span>
      <span className="text-right text-ink">{children}</span>
    </div>
  );
}

function IncidentBody({ d }: { d: any }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <UrgencyBadge urgency={d.severity} />
        <StatusBadge status={d.status} />
        {d.simulated && <SimBadge />}
      </div>
      <Row label="Category">{d.category_label}</Row>
      <Row label="Reported">{fmtIST(d.created_at)} ({ago(d.created_at)})</Row>
      <Row label="Location">
        <span className="inline-flex items-center gap-1">
          <MapPin size={11} className="text-faint" />
          {d.location_label || `${d.lat.toFixed(3)}, ${d.lon.toFixed(3)}`}
        </span>
      </Row>
      {d.people_affected != null && <Row label="People affected">{num(d.people_affected, 0)}</Row>}
      <Row label="Immediate help">{d.assistance_needed ? "Reported needed" : "Not indicated"}</Row>
      <Row label="Team">{d.assigned_team ?? "— unassigned —"}</Row>
      <p className="mt-2 rounded-lg border border-edge bg-panel2 p-2.5 text-xs leading-relaxed text-mute">
        {d.description}
      </p>
      {d.triage && (
        <div className="mt-2 rounded-lg border border-edge bg-panel2 p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-faint">AI triage</span>
            <EngineBadge engine={d.triage.engine} />
          </div>
          <div className="mb-2 flex items-center gap-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-edge">
              <div
                className="h-full rounded-full"
                style={{ width: `${d.urgency_score}%`, background: hexUrgency(d.severity) }}
              />
            </div>
            <span className="tabular text-[11px] text-mute">{d.urgency_score}/100</span>
          </div>
          <p className="text-xs leading-relaxed">{d.triage.summary}</p>
        </div>
      )}
      <Link
        to={`/incidents?focus=${d.id}`}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20"
      >
        Open in Incident Response <ExternalLink size={12} />
      </Link>
    </>
  );
}

function WeatherBody({ d }: { d: any }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <SeverityBadge severity={d.severity} />
        {d.simulated && <SimBadge />}
        <Badge className="border-edge text-faint">score {d.score}/100</Badge>
      </div>
      <div className="rounded-lg border border-edge bg-panel2 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
          Experimental risk factors (next 24 h)
        </p>
        {d.factors?.map((f: any) => (
          <div key={f.name} className="mb-1.5 flex items-center justify-between gap-2 text-xs">
            <span className="text-mute">{f.name}</span>
            <span className="tabular text-ink">
              {f.value ?? "—"} {f.unit} · {f.severity}
            </span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(["h6", "h12", "h24"] as const).map((w) => (
          <div key={w} className="rounded-lg border border-edge bg-panel2 p-2 text-center">
            <p className="text-xs uppercase tracking-wider text-faint">{w.toUpperCase()}</p>
            <p className="tabular text-sm font-semibold text-ink">{d.windows?.[w]?.rain_mm ?? 0} mm</p>
            <p className="text-xs text-faint">gust {d.windows?.[w]?.gust_max ?? 0} km/h</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-faint">{d.disclaimer}</p>
      <Link
        to="/forecast"
        className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20"
      >
        View Forecast & Risk <ExternalLink size={12} />
      </Link>
    </>
  );
}

function QuakeBody({ d }: { d: any }) {
  return (
    <>
      <Row label="Magnitude">
        <span className="text-lg font-bold text-ink">M{d.magnitude?.toFixed(1) ?? "?"}</span>
      </Row>
      <Row label="Place">{d.place}</Row>
      <Row label="Time">{fmtIST(d.time)}</Row>
      <Row label="Depth">{d.depth_km != null ? `${d.depth_km.toFixed(1)} km` : "—"}</Row>
      <Row label="Region">{d.in_india ? "In / near India" : "Global"}</Row>
      {d.tsunami_flag && (
        <Badge className="bg-severe/15 text-severe border-severe/40">
          <Waves size={10} /> tsunami flag
        </Badge>
      )}
      <a
        href={d.url}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-edge bg-panel2 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-panel2/80"
      >
        USGS event page <ExternalLink size={12} />
      </a>
    </>
  );
}

function DisasterBody({ d }: { d: any }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className={d.source_feed === "gdacs" ? "bg-amber-500/15 text-amber-400 border-amber-500/40" : "bg-rose-500/15 text-rose-300 border-rose-500/40"}>
          {d.source_feed === "gdacs" ? "GDACS" : "NASA EONET"}
        </Badge>
        {d.alert_level && (
          <Badge className="border-edge text-mute">alert: {d.alert_level}</Badge>
        )}
        {d.distance_km != null && <Badge className="border-edge text-faint">{d.distance_km} km away</Badge>}
      </div>
      <Row label="Categories">{(d.categories || []).join(", ") || "Natural event"}</Row>
      {d.date && <Row label="Event date">{fmtIST(d.date)}</Row>}
      {d.description && (
        <p className="rounded-lg border border-edge bg-panel2 p-2.5 text-xs leading-relaxed text-mute">{d.description}</p>
      )}
      {d.link && (
        <a
          href={d.link}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-edge bg-panel2 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-panel2/80"
        >
          Source event link <ExternalLink size={12} />
        </a>
      )}
    </>
  );
}

function ResourceBody({ d }: { d: any }) {
  const icons: Record<string, React.ReactNode> = {
    hospital: <Stethoscope size={14} className="text-low" />,
    police: <Building2 size={14} className="text-accent" />,
    fire_station: <Flame size={14} className="text-high" />,
  };
  return (
    <>
      <div className="flex items-center gap-2">
        {icons[d.kind]}
        <span className="font-semibold text-ink">{d.name}</span>
      </div>
      <Row label="Type">{d.kind_label}</Row>
      <Row label="Source">OpenStreetMap (Overpass)</Row>
      <p className="flex items-start gap-1.5 rounded-lg border border-elevated/30 bg-elevated/5 p-2 text-[11px] leading-relaxed text-elevated">
        <Wind size={12} className="mt-0.5 shrink-0" />
        Mapped facility — presence on this map does NOT verify it is operational, staffed or reachable.
      </p>
    </>
  );
}
