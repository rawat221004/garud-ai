import { AlertTriangle, ClipboardList, Globe2, Radar } from "lucide-react";
import { useOverview } from "../../hooks/useApi";
import { KpiCard, Skeleton } from "../ui";

export default function KpiCards() {
  const { data, isLoading } = useOverview();

  if (isLoading) {
    return <div className="metric-grid" aria-label="Loading operational metrics" aria-busy="true">
      {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)}
    </div>;
  }

  return (
    <div className="metric-grid">
      <KpiCard label="Monitored hazards" value={data?.active_events.total ?? "—"} icon={<Radar size={18} />}
        sub={data ? "USGS · NASA EONET · GDACS" : "Metrics unavailable"} />
      <KpiCard label="Elevated-risk locations" value={data?.elevated_risk_locations ?? "—"} icon={<Globe2 size={18} />}
        sub="Based on forecast risk" />
      <KpiCard label="Critical open incidents" value={data?.critical_open_incidents ?? "—"} icon={<AlertTriangle size={18} />}
        tone={data?.critical_open_incidents ? "danger" : "default"}
        sub={data?.simulated_open_incidents ? data.simulated_open_incidents + " simulated open reports" : data ? data.open_incidents + " open reports total" : undefined} />
      <KpiCard label="Awaiting assignment" value={data?.incidents_awaiting_assignment ?? "—"} icon={<ClipboardList size={18} />}
        tone={data?.incidents_awaiting_assignment ? "warn" : "default"} sub="Reported or under review" />
    </div>
  );
}
