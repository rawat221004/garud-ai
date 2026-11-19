import { Link } from "react-router-dom";
import { ArrowUpRight, ShieldAlert } from "lucide-react";
import type { Overview, RiskAssessment } from "../../lib/types";
import { Card, EmptyState, SeverityBadge, SimBadge } from "../ui";
import { SEVERITY_STYLES } from "../../lib/format";

export default function RiskBreakdown({ overview, assessment }: { overview?: Overview; assessment?: RiskAssessment | null }) {
  const assessed = overview?.risk_summary.length ?? 0;
  return (
    <Card title="Forecast risk" icon={<ShieldAlert size={17} />}
      right={<Link to="/forecast" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">Full outlook <ArrowUpRight size={14} /></Link>}
      bodyClass="space-y-4 p-4">
      {assessment ? (
        <div className="rounded-md bg-panel2 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="mr-auto font-semibold">{assessment.city}</h3>
            <SeverityBadge severity={assessment.severity} />
            {assessment.simulated && <SimBadge />}
          </div>
          <p className="mt-2 text-sm text-mute">{assessment.score}/100 experimental risk · Next 24 hours</p>
          <p className="mt-1 text-xs text-faint">{assessment.windows.h24.rain_mm} mm forecast rain · Gusts up to {assessment.windows.h24.gust_max} km/h</p>
        </div>
      ) : <EmptyState text="Selected city risk is unavailable." className="py-6" />}
      {assessed > 0 && overview && <div>
        <h3 className="mb-2 text-sm font-medium">Forecast bands across {assessed} assessed cities</h3>
        <dl className="space-y-2">
          {(["severe", "high", "elevated", "low"] as const).map((severity) => {
            const count = overview.risk_by_severity[severity] ?? 0;
            return <div className="grid grid-cols-[60px_1fr_20px] items-center gap-2 text-xs" key={severity}>
              <dt className="text-mute">{SEVERITY_STYLES[severity].label}</dt>
              <dd aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-edge">
                <span className="block h-full rounded-full" style={{ width: (count / assessed) * 100 + "%", background: SEVERITY_STYLES[severity].hex }} />
              </dd>
              <dd className="text-right tabular">{count}</dd>
            </div>;
          })}
        </dl>
      </div>}
    </Card>
  );
}
