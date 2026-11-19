/** Incident activity timeline (audit events from SQLite). */

import { ClipboardCheck, FileWarning, History, MessageSquarePlus, UserCheck } from "lucide-react";
import { useTimeline } from "../../hooks/useApi";
import { Card, EmptyState, Skeleton } from "../ui";
import { ago, fmtIST } from "../../lib/format";
import type { IncidentEvent } from "../../lib/types";

const EVENT_ICONS: Record<string, React.ReactNode> = {
  "Incident reported": <FileWarning size={12} className="text-sky-400" />,
  "Auto-triage completed": <ClipboardCheck size={12} className="text-accent" />,
  "Re-triage completed": <ClipboardCheck size={12} className="text-accent" />,
  "Status updated": <History size={12} className="text-violet-400" />,
  "Team assigned": <UserCheck size={12} className="text-low" />,
  "Coordinator note": <MessageSquarePlus size={12} className="text-amber-400" />,
};

export default function ActivityTimeline({ limit = 12 }: { limit?: number }) {
  const { data, isLoading } = useTimeline();

  if (isLoading) {
    return (
      <Card title="Activity timeline" icon={<History size={13} />}>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      </Card>
    );
  }

  const events: IncidentEvent[] = data?.events.slice(0, limit) ?? [];

  return (
    <Card title="Activity timeline" icon={<History size={13} />} bodyClass="p-0">
      {events.length === 0 ? (
        <EmptyState text={data ? "No coordinator activity yet." : "Activity history is unavailable."} hint="Incident reports, triage, assignments and status changes appear here as they happen." />
      ) : (
        <ul className="max-h-[420px] divide-y divide-edge overflow-y-auto">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-2.5 px-4 py-2.5">
              <span className="mt-0.5 shrink-0">{EVENT_ICONS[e.event] ?? <History size={12} className="text-faint" />}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink">
                  <span className="font-semibold">{e.event}</span>
                  {e.incident_title && <span className="text-mute"> · {e.incident_title.slice(0, 60)}</span>}
                </p>
                {e.detail && <details className="mt-1 text-xs text-mute"><summary>Details</summary><p className="mt-1 break-words">{e.detail}</p></details>}
                <p className="mt-0.5 text-xs text-faint">
                  {fmtIST(e.at)} · {e.actor}
                  {e.simulated && <span className="ml-1 font-medium text-sim">Simulated</span>}
                </p>
              </div>
              <span className="shrink-0 text-xs text-faint">{ago(e.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
