/** Feature D: Incident Response workspace (report → triage → assign → resolve). */

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useApp } from "../state/AppContext";
import { useIncidents, useOverview, useSystemStatus } from "../hooks/useApi";
import type { Incident } from "../lib/types";
import IncidentDetail from "../components/incidents/IncidentDetail";
import IncidentForm from "../components/incidents/IncidentForm";
import IncidentTable from "../components/incidents/IncidentTable";
import { Button, PageHeader, Select, Skeleton } from "../components/ui";
import { STATUS_LABELS } from "../lib/format";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  ...Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

const SEVERITY_OPTIONS = [
  { value: "", label: "All urgency" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "moderate", label: "Moderate" },
  { value: "low", label: "Low" },
];

const SOURCE_OPTIONS = [
  { value: "", label: "All sources" },
  { value: "citizen", label: "Citizen reports" },
  { value: "coordinator", label: "Coordinator reports" },
  { value: "simulation", label: "Simulation only" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "All types" },
  { value: "flooding", label: "Flooding / waterlogging" },
  { value: "earthquake_damage", label: "Earthquake damage" },
  { value: "storm_damage", label: "Severe storm damage" },
  { value: "fire_wildfire", label: "Fire / wildfire" },
  { value: "infrastructure_failure", label: "Infrastructure failure" },
  { value: "medical_assistance", label: "Medical assistance" },
  { value: "rescue_request", label: "Rescue request" },
  { value: "other_needs_review", label: "Other / needs review" },
];

export default function IncidentsPage() {
  const { cityId } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get("focus");

  const [selectedId, setSelectedId] = useState<string | null>(focusId);
  useEffect(() => {
    if (focusId) setSelectedId(focusId);
  }, [focusId]);

  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [category, setCategory] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [q, setQ] = useState("");
  const [formOpen, setFormOpen] = useState(searchParams.has("report"));
  const [sort, setSort] = useState("newest");
  const detail = useRef<HTMLDivElement>(null);
  const deferredQuery = useDeferredValue(q);

  const filters = useMemo(
    () => ({ status, severity, category, source_type: sourceType, q: deferredQuery }),
    [status, severity, category, sourceType, deferredQuery]
  );
  const { data, isLoading, isError, refetch, isFetching } = useIncidents(filters);
  const { data: overview } = useOverview();
  const { data: system } = useSystemStatus();
  const incidents = useMemo(() => [...(data?.incidents ?? [])].sort((a, b) =>
    (sort === "urgency" ? b.urgency_score - a.urgency_score : 0) || Date.parse(b.created_at) - Date.parse(a.created_at)), [data, sort]);

  function selectIncident(incident: Incident) {
    setSelectedId(incident.id);
    if (window.matchMedia("(max-width: 950px)").matches) detail.current?.scrollIntoView({ block: "start" });
    detail.current?.focus({ preventScroll: true });
  }

  return (
    <div className="workspace-page">
      <PageHeader title="Incident Management" description="Review reports, coordinate response teams and trace status changes.">
        <Button variant="primary" onClick={() => setFormOpen(true)}><Plus size={16} /> Report incident</Button>
      </PageHeader>
      <dl className="incident-counts panel">
        <div><dt>Open</dt><dd>{overview?.open_incidents ?? "—"}</dd></div>
        <div><dt>Critical</dt><dd>{overview?.critical_open_incidents ?? "—"}</dd></div>
        <div><dt>Awaiting assignment</dt><dd>{overview?.incidents_awaiting_assignment ?? "—"}</dd></div>
        <div><dt>Responding</dt><dd>{(system ? system.incident_counts.by_status.responding ?? 0 : undefined) ?? "—"}</dd></div>
      </dl>
      {/* filters */}
      <div className="panel incident-filters mb-4 flex flex-wrap items-center gap-2 p-3" role="group" aria-label="Incident filters">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search id, title, description…"
          aria-label="Search incidents"
          type="search"
          className="workspace-input min-w-0 grow basis-44"
        />
        <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} ariaLabel="Status filter" />
        <Select value={severity} onChange={setSeverity} options={SEVERITY_OPTIONS} ariaLabel="Urgency filter" />
        <Select value={category} onChange={setCategory} options={CATEGORY_OPTIONS} ariaLabel="Type filter" />
        <Select value={sourceType} onChange={setSourceType} options={SOURCE_OPTIONS} ariaLabel="Source filter" />
        <Select value={sort} onChange={setSort} ariaLabel="Sort incidents" options={[
          { value: "newest", label: "Newest first" }, { value: "urgency", label: "Highest urgency" },
        ]} />
        {(status || severity || category || sourceType || q) && (
          <button
            onClick={() => {
              setStatus("");
              setSeverity("");
              setCategory("");
              setSourceType("");
              setQ("");
            }}
            className="px-2 py-2 text-sm text-accent hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* table + detail */}
      <div className="incident-workspace">
        <div className="incident-list-target min-w-0">
          {isLoading ? (
            <div className="panel space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : (
            <>
              {isError && <div className="panel mb-3 flex flex-wrap items-center justify-between gap-2 p-3">
                <p role="status">{data ? "Showing previously loaded reports. The latest refresh failed." : "Incident reports are unavailable."}</p>
                <Button size="sm" onClick={() => refetch()} disabled={isFetching}>Retry</Button>
              </div>}
              {data && <IncidentTable incidents={incidents} selectedId={selectedId} onSelect={selectIncident} />}
            </>
          )}
        </div>
        <div className="incident-detail-target min-w-0" ref={detail} tabIndex={-1}>
          <IncidentDetail incidentId={selectedId} />
        </div>
      </div>

      <IncidentForm open={formOpen} onClose={() => {
        setFormOpen(false);
        if (searchParams.has("report")) {
          const params = new URLSearchParams(searchParams);
          params.delete("report");
          setSearchParams(params, { replace: true });
        }
      }} defaultCity={cityId} />
    </div>
  );
}
