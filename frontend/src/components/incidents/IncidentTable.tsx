import { ArrowRight, ClipboardList, MapPin } from "lucide-react";
import type { Incident } from "../../lib/types";
import { Card, EmptyState, SimBadge, StatusBadge, UrgencyBadge } from "../ui";
import { ago, fmtIST } from "../../lib/format";

export default function IncidentTable({ incidents, selectedId, onSelect }: {
  incidents: Incident[]; selectedId?: string | null; onSelect: (incident: Incident) => void;
}) {
  return (
    <Card title="Incident reports" icon={<ClipboardList size={17} />}
      right={<span className="text-xs text-faint">{incidents.length} results</span>} bodyClass="p-0">
      {incidents.length ? (
        <ul className="incident-rows">
          {incidents.map((incident) => (
            <li key={incident.id}>
              <button type="button" aria-pressed={incident.id === selectedId} onClick={() => onSelect(incident)}>
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <strong className="min-w-0 break-words text-sm">{incident.title}</strong>
                  {incident.simulated && <SimBadge />}
                  <ArrowRight className="ml-auto shrink-0 text-faint" size={16} aria-hidden="true" />
                </span>
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-mute">
                  <MapPin size={13} className="shrink-0" aria-hidden="true" />
                  {incident.location_label || incident.city || (incident.lat.toFixed(3) + ", " + incident.lon.toFixed(3))}
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <UrgencyBadge urgency={incident.severity} /><StatusBadge status={incident.status} />
                  <span className="text-xs text-faint">{incident.assigned_team || "Unassigned"}</span>
                  <time className="ml-auto text-xs text-faint" title={fmtIST(incident.created_at)} dateTime={incident.created_at}>{ago(incident.created_at)}</time>
                </span>
                <span className="text-xs text-faint">{incident.category_label} · {incident.id}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : <EmptyState icon={<ClipboardList size={23} />} text="No matching incident reports" hint="Adjust the filters or report a new incident." />}
    </Card>
  );
}
