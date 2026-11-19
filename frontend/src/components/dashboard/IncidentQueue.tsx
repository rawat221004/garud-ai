/** Compact incident response queue (open reports sorted by urgency). */

import { Link } from "react-router-dom";
import { Inbox } from "lucide-react";
import type { Incident } from "../../lib/types";
import { Card, EmptyState, Skeleton, StatusBadge, UrgencyBadge, SimBadge } from "../ui";
import { ago, hexUrgency } from "../../lib/format";

export default function IncidentQueue({ incidents, loading, limit = 5 }: { incidents?: Incident[]; loading?: boolean; limit?: number }) {
  const open = (incidents ?? [])
    .filter((i) => !["resolved", "rejected", "duplicate"].includes(i.status))
    .sort((a, b) => Number(needsAssignment(b)) - Number(needsAssignment(a)) || b.urgency_score - a.urgency_score)
    .slice(0, limit);

  return (
    <Card
      title="Action center"
      icon={<Inbox size={13} />}
      right={
        <Link to="/incidents" className="text-sm font-medium text-accent hover:underline">
          Open workspace →
        </Link>
      }
      bodyClass="p-0"
    >
      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : open.length === 0 ? (
        <EmptyState
          text={incidents ? "No open incidents." : "Incident reports unavailable."}
          hint="Submit a report from Incident Response, or start the simulation scenario to exercise the workflow."
        />
      ) : (
        <ul className="divide-y divide-edge">
          {open.map((inc) => (
            <li key={inc.id}>
              <Link
                to={`/incidents?focus=${inc.id}`}
                className="flex flex-wrap items-center gap-2.5 px-4 py-3 hover:bg-panel2/60"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: hexUrgency(inc.severity), opacity: inc.urgency_score > 60 ? 1 : 0.5 }}
                />
                <span className="min-w-0 flex-1 basis-36">
                  <span className="block text-sm font-semibold text-ink">{inc.title}</span>
                  <span className="mt-0.5 block text-xs text-faint">
                    {inc.location_label || inc.city} · {ago(inc.created_at)} · {inc.assigned_team ? inc.assigned_team : "unassigned"}
                  </span>
                </span>
                {inc.simulated && <SimBadge />}
                <UrgencyBadge urgency={inc.severity} />
                <StatusBadge status={inc.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function needsAssignment(incident: Incident) {
  return !incident.assigned_team && (incident.status === "reported" || incident.status === "under_review");
}
