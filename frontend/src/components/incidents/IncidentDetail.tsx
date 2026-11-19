/** Full incident workspace: triage card, coordinator status/assignment controls,
 *  draft alert (review + copy), nearby mapped facilities and audit history. */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Ambulance,
  BellRing,
  ClipboardCheck,
  MapPin,
  RotateCw,
  ShieldCheck,
  Stethoscope,
  UserCheck,
} from "lucide-react";
import { apiPatch, apiPost } from "../../lib/api";
import { useIncident, useResources, useSystemStatus } from "../../hooks/useApi";
import { useApp } from "../../state/AppContext";
import type { Incident, IncidentEvent } from "../../lib/types";
import { Badge, Button, EmptyState, EngineBadge, Modal, Select, SimBadge, Skeleton, Spinner, StatusBadge, UrgencyBadge } from "../ui";
import { ago, fmtIST, hexUrgency, STATUS_LABELS } from "../../lib/format";
import { cn } from "../../lib/utils";

export default function IncidentDetail({ incidentId, onSelectMap }: { incidentId: string | null; onSelectMap?: (i: Incident) => void }) {
  const { data: incident, isLoading, refetch } = useIncident(incidentId);

  if (!incidentId) {
    return (
      <div className="panel p-5">
        <EmptyState
          icon={<ShieldCheck size={24} />}
          text="Select an incident to open its workspace."
          hint="Every report is triaged on arrival. Coordinators confirm urgency, assign a team and track the response workflow here."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="panel space-y-3 p-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-5" />
        ))}
      </div>
    );
  }

  if (!incident) return <div className="panel p-5"><EmptyState text="This report is unavailable." hint="It may have been removed when the simulation was reset." /><Button size="sm" onClick={() => refetch()}>Retry</Button></div>;

  return <Loaded key={incident.id} incident={incident} onSelectMap={onSelectMap} />;
}

function Loaded({
  incident,
  onSelectMap,
}: {
  incident: Incident;
  onSelectMap?: (i: Incident) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useApp();
  const { data: sys } = useSystemStatus();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [team, setTeam] = useState(incident.assigned_team ?? "");
  const [draftOpen, setDraftOpen] = useState(false);

  const invalidate = () => {
    void qc.invalidateQueries({ predicate: ({ queryKey }) =>
      ["incident", "incidents", "overview", "timeline", "system"].includes(String(queryKey[0])),
    }, { cancelRefetch: false });
  };

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const updated = await apiPatch<Incident>(`/api/incidents/${incident.id}`, body);
      await qc.cancelQueries({ queryKey: ["incident", incident.id] });
      qc.setQueryData(["incident", incident.id], updated);
      invalidate();
      setNote("");
      toast("success", `${incident.id} updated · ${STATUS_LABELS[updated.status] ?? updated.status}`);
    } catch (e: any) {
      toast("error", e.message);
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = (status: string) => patch({ status, ...(note.trim() ? { note: note.trim() } : {}) });
  const confirmUrgency = () => patch({ note: ["Urgency confirmed: " + incident.severity, note.trim()].filter(Boolean).join(" · ").slice(0, 300) });

  const assignTeam = async () => {
    if (!team) {
      toast("error", "Choose a response team first.");
      return;
    }
    await patch({ assigned_team: team, ...(note.trim() ? { note: note.trim() } : {}) });
  };

  const rerunTriage = async () => {
    setBusy(true);
    try {
      const res = await apiPost<{ engine: string }>(`/api/ai/triage`, { incident_id: incident.id });
      invalidate();
      toast("success", `Re-triage complete via ${res.engine}. Human confirmation still required.`);
    } catch (e: any) {
      toast("error", e.message);
    } finally {
      setBusy(false);
    }
  };

  const t = incident.triage;
  const open = !["resolved", "rejected", "duplicate"].includes(incident.status);

  return (
    <div className="panel flex min-w-0 flex-col">
      {/* header */}
      <div className="border-b border-edge px-4 py-3">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <UrgencyBadge urgency={incident.severity} />
          <StatusBadge status={incident.status} />
          {incident.simulated && <SimBadge />}
          <span className="tabular ml-auto text-xs text-faint">{incident.id}</span>
        </div>
        <h2 className="break-words text-xl font-semibold leading-snug text-ink">{incident.title}</h2>
        <p className="mt-1 flex items-center gap-1 text-xs text-faint">
          <MapPin size={10} />
          {incident.location_label || `${incident.lat.toFixed(4)}, ${incident.lon.toFixed(4)}`} ·{" "}
          {fmtIST(incident.created_at)} ({ago(incident.created_at)})
        </p>
      </div>

      <div className="space-y-4 px-4 py-4 text-[13px]">
        {/* facts */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Fact label="Type" value={incident.category_label} />
          <Fact label="Source" value={incident.source_type === "simulation" ? "simulation scenario" : incident.source_type} />
          <Fact label="People affected" value={incident.people_affected != null ? String(incident.people_affected) : "unknown"} />
          <Fact label="Immediate help" value={incident.assistance_needed ? "reported needed" : "not indicated"} />
          <Fact label="Urgency score" value={`${incident.urgency_score}/100`} />
          <Fact label="Team" value={incident.assigned_team ?? "— unassigned —"} />
        </div>

        <p className="rounded-lg border border-edge bg-panel2 p-3 text-xs leading-relaxed text-mute">
          {incident.description}
        </p>

        {/* triage card */}
        <div className="rounded-xl border border-edge bg-panel2 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-faint">
              <ClipboardCheck size={12} /> AI incident triage
            </p>
            <div className="flex items-center gap-2">
              {t && <EngineBadge engine={t.engine} />}
              <Button size="sm" onClick={rerunTriage} disabled={busy} title="Re-run triage on this report">
                <RotateCw size={11} /> re-run
              </Button>
            </div>
          </div>
          {t ? (
            <>
              <div className="mb-2 flex items-center gap-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-edge">
                  <div className="h-full rounded-full" style={{ width: `${t.urgency_score}%`, background: hexUrgency(t.urgency) }} />
                </div>
                <span className="tabular text-xs text-mute">{t.urgency_score}/100</span>
              </div>
              <p className="text-xs leading-relaxed text-mute">{t.summary}</p>

              <div className="mt-2 flex flex-wrap gap-1">
                <DetailChip on={t.details.people_trapped} label="people trapped" />
                <DetailChip on={t.details.injuries_reported} label="injuries reported" />
                <DetailChip on={t.details.blocked_roads} label="blocked roads" />
                <DetailChip on={t.details.infrastructure_damage} label="infrastructure damage" />
                <DetailChip on={t.details.evacuation_requested} label="evacuation requested" />
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold text-faint">Suggested agencies</p>
                  <ul className="space-y-0.5">
                    {t.recommended_agencies.map((a) => (
                      <li key={a} className="flex items-start gap-1 text-xs text-mute">
                        <UserCheck size={10} className="mt-0.5 shrink-0 text-low" /> {a}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-faint">Recommended next steps</p>
                  <ul className="space-y-0.5">
                    {t.next_steps.map((s) => (
                      <li key={s} className="flex items-start gap-1 text-xs text-mute">
                        <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-accent" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-faint">
                confidence {(t.confidence * 100).toFixed(0)}% · {t.notes}
              </p>
              <p className="mt-1.5 rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-xs leading-relaxed text-fallback">
                AI output is a recommendation. A coordinator must confirm before any operational assignment or
                public notification.
              </p>
            </>
          ) : (
            <p className="text-xs text-faint">No triage result stored — run triage.</p>
          )}
        </div>

        {/* coordinator actions */}
        <div className="rounded-xl border border-edge bg-panel p-3">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-faint">
            <ShieldCheck size={12} /> Coordinator actions
          </p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {open && <Button size="sm" onClick={confirmUrgency} disabled={busy}>Confirm urgency</Button>}
            {incident.allowed_next_statuses.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={s === "rejected" || s === "duplicate" ? "danger" : s === "resolved" ? "success" : "primary"}
                onClick={() => changeStatus(s)}
                disabled={busy}
              >
                {STATUS_LABELS[s] ?? s}
              </Button>
            ))}
            {incident.allowed_next_statuses.length === 0 && (
              <span className="text-xs text-faint">
                {incident.status === "resolved" ? "Incident closed." : "No further transitions from this state."}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={team}
              onChange={setTeam}
              options={[
                { value: "", label: "— assign team —" },
                ...(sys?.response_teams ?? []).map((tt) => ({ value: tt, label: tt })),
              ]}
              className="max-w-full py-1.5"
              ariaLabel="Response team"
            />
            <Button size="sm" variant="outline" onClick={assignTeam} disabled={busy || !open || !team}>
              <UserCheck size={11} /> Assign
            </Button>
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            aria-label="Response note"
            placeholder="Optional response note…"
            className="mt-2 w-full rounded-lg border border-edge bg-panel2 px-2.5 py-1.5 text-xs text-ink outline-none placeholder:text-faint focus:border-accent/60"
          />
          <p className="mt-1.5 text-xs text-faint">
            Prototype workflow — no real dispatch occurs. Assigning from Reported/Under Review auto-advances to
            Assigned.
          </p>
        </div>

        {/* draft alert */}
        <div className="rounded-xl border border-edge bg-panel p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-faint">
              <BellRing size={12} /> Public communication
            </p>
            <Button size="sm" onClick={() => setDraftOpen(true)} disabled={!open}>
              <BellRing size={11} /> Draft alert (review)
            </Button>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-faint">
            Generates an editable DRAFT alert for coordinator review. GARUD AI never sends messages to the public
            or to emergency services — copy it after review and publish through your official channels.
          </p>
        </div>

        {/* nearby resources */}
        <NearbyResources lat={incident.lat} lon={incident.lon} />

        {/* history */}
        <div>
          <p className="mb-2 text-sm font-semibold text-faint">Status history</p>
          <ol className="space-y-2 border-l border-edge pl-3">
            {(incident.status_history ?? []).map((e: IncidentEvent) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[17px] top-1.5 inline-block h-2 w-2 rounded-full bg-edge2" />
                <p className="text-xs text-ink">
                  <span className="font-semibold">{e.event}</span>
                  {e.detail && <span className="text-mute"> — {e.detail}</span>}
                </p>
                <p className="text-xs text-faint">
                  {fmtIST(e.at)} · {e.actor}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <DraftAlertModal open={draftOpen} onClose={() => setDraftOpen(false)} incident={incident} />
    </div>
  );
}

function DraftAlertModal({ open, onClose, incident }: { open: boolean; onClose: () => void; incident: Incident }) {
  const { toast } = useApp();
  const now = fmtIST(new Date().toISOString());

  const initial = [
    `DRAFT PUBLIC ALERT — for coordinator review (NOT SENT)`,
    ``,
    `Incident: ${incident.title}`,
    `ID: ${incident.id} · Status: ${STATUS_LABELS[incident.status] ?? incident.status}${incident.simulated ? " · [SIMULATED SCENARIO DATA]" : ""}`,
    `Location: ${incident.location_label || "map pin"} (approx. ${incident.lat.toFixed(4)}, ${incident.lon.toFixed(4)})`,
    `Reported: ${fmtIST(incident.created_at)} IST`,
    ``,
    `Situation: ${incident.triage?.summary ?? incident.description.slice(0, 220)}`,
    ``,
    `Recommended actions:`,
    ...(incident.triage?.next_steps ?? []).slice(0, 4).map((s, i) => `${i + 1}. ${s}`),
    ``,
    `Responding team: ${incident.assigned_team ?? "to be assigned"}`,
    `Prepared by GARUD AI (prototype) at ${now}`,
    ``,
    `NOTE: This is a DRAFT generated for review. It has NOT been published to the public or sent to any service. Official approval and channels are required before use.`,
  ].join("\n");

  const [text, setText] = useState(initial);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast("success", "Draft alert copied to clipboard — review and publish via official channels.");
    } catch {
      toast("error", "Clipboard unavailable — select the text and copy manually.");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Draft alert — coordinator review" wide>
      <p className="mb-2 rounded-lg border border-elevated/30 bg-elevated/5 p-2 text-xs leading-relaxed text-elevated">
        DRAFT ONLY — GARUD AI never sends messages to the public or to emergency services. Review, edit, then copy
        for release through your official channels.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={16}
        className="w-full rounded-lg border border-edge bg-panel p-3 font-mono text-xs leading-relaxed text-ink outline-none focus:border-accent/60"
      />
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button onClick={onClose}>Close</Button>
        <Button variant="primary" onClick={copy}>
          Copy reviewed draft
        </Button>
      </div>
    </Modal>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-edge bg-panel2 px-2.5 py-1.5">
      <p className="text-xs font-semibold text-faint">{label}</p>
      <p className="mt-0.5 truncate text-xs text-ink">{value}</p>
    </div>
  );
}

function DetailChip({ on, label }: { on: boolean; label: string }) {
  return (
    <Badge className={cn(on ? "bg-severe/15 text-severe border-severe/40" : "border-edge text-faint")}>
      {on ? "●" : "○"} {label}
    </Badge>
  );
}

function NearbyResources({ lat, lon }: { lat: number; lon: number }) {
  const { data, isLoading, error } = useResources({ lat, lon });
  return (
    <div className="rounded-xl border border-edge bg-panel p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-faint">
        <Ambulance size={12} /> Nearby mapped facilities (OpenStreetMap)
      </p>
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-faint">
          <Spinner /> querying Overpass…
        </div>
      )}
      {error && <p className="text-xs text-elevated">Overpass unavailable right now — facilities can't be listed.</p>}
      {data && (
        <>
          <ul className="grid gap-1 sm:grid-cols-2">
            {data.resources.slice(0, 6).map((r) => (
              <li key={r.id} className="flex items-center gap-1.5 rounded-lg border border-edge bg-panel2 px-2 py-1 text-xs text-mute">
                {r.kind === "hospital" && <Stethoscope size={10} className="shrink-0 text-low" />}
                {r.kind === "police" && <ShieldCheck size={10} className="shrink-0 text-accent" />}
                {r.kind === "fire_station" && <Ambulance size={10} className="shrink-0 text-high" />}
                <span className="truncate">{r.name}</span>
              </li>
            ))}
            {data.resources.length === 0 && <li className="text-xs text-faint">No mapped facilities within 15 km.</li>}
          </ul>
          <p className="mt-1.5 text-xs leading-relaxed text-faint">
            {data.meta.disclaimer} synced {ago(data.meta.fetched_at)}
          </p>
        </>
      )}
    </div>
  );
}
