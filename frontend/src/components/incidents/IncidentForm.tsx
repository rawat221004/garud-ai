/** Incident submission form with map location picker. */

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MapPin, Send } from "lucide-react";
import { apiPost } from "../../lib/api";
import { useLocations } from "../../hooks/useApi";
import { useApp } from "../../state/AppContext";
import type { Incident, Triage } from "../../lib/types";
import { Button, Modal, Select, Spinner } from "../ui";
import { MapCanvas } from "../map/MapCanvas";

const CATEGORIES = [
  { value: "flooding", label: "Flooding / waterlogging" },
  { value: "earthquake_damage", label: "Earthquake damage" },
  { value: "storm_damage", label: "Severe storm damage" },
  { value: "fire_wildfire", label: "Fire / wildfire" },
  { value: "infrastructure_failure", label: "Infrastructure failure" },
  { value: "medical_assistance", label: "Medical assistance" },
  { value: "rescue_request", label: "Rescue request" },
  { value: "other_needs_review", label: "Other / needs review" },
];

export default function IncidentForm({ open, onClose, defaultCity }: { open: boolean; onClose: () => void; defaultCity: string }) {
  const { toast } = useApp();
  const qc = useQueryClient();
  const { data: locs } = useLocations();
  const cities = locs?.cities ?? [];

  const [category, setCategory] = useState("flooding");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [peopleAffected, setPeopleAffected] = useState("");
  const [assistanceNeeded, setAssistanceNeeded] = useState(false);
  const [sourceType, setSourceType] = useState("citizen");
  const [cityId, setCityId] = useState(defaultCity);
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const city = cities.find((c) => c.id === cityId) ?? cities[0];
  const mapCenter: [number, number] = useMemo(
    () => (lat != null && lon != null ? [lat, lon] : [city?.lat ?? 17.385, city?.lon ?? 78.4867]),
    [lat, lon, city]
  );

  const reset = () => {
    setCategory("flooding");
    setTitle("");
    setDescription("");
    setPeopleAffected("");
    setAssistanceNeeded(false);
    setSourceType("citizen");
    setLat(null);
    setLon(null);
  };

  const submit = async () => {
    setError("");
    if (title.trim().length < 5) {
      setError("Title must be at least 5 characters.");
      return;
    }
    if (description.trim().length < 5) {
      setError("Description must be at least 5 characters.");
      return;
    }
    if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      setError("Pick a location on the mini-map (click the map) or type coordinates.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        lat,
        lon,
        city: cityId,
        location_label: city ? `${city.name}${lat != null ? ` (map pin ${lat.toFixed(4)}, ${lon?.toFixed(4)})` : ""}` : "",
        category,
        title: title.trim(),
        description: description.trim(),
        assistance_needed: assistanceNeeded,
        source_type: sourceType,
      };
      if (peopleAffected.trim() && !isNaN(Number(peopleAffected))) {
        payload.people_affected = Number(peopleAffected);
      }
      const inc = await apiPost<Incident>("/api/incidents", payload);
      void qc.invalidateQueries({ predicate: ({ queryKey }) =>
        ["incidents", "overview", "timeline", "system"].includes(String(queryKey[0])),
      }, { cancelRefetch: false });
      const t: Triage | null = inc.triage;
      toast(
        "success",
        `Report ${inc.id} filed · auto-triage: ${t?.urgency?.toUpperCase() ?? "?"} (${t?.urgency_score ?? "?"}/100) via ${t?.engine ?? "engine"}`
      );
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit this report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Report incident" wide>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <Field label="Incident type">
            <Select value={category} onChange={setCategory} options={CATEGORIES} className="w-full min-w-0 py-2" ariaLabel="Incident type" />
          </Field>
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              placeholder="Short operational summary, e.g. 'Waterlogging at X junction'"
              className="w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-ink outline-none placeholder:text-faint focus:border-accent/60"
            />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder="What is happening? People affected? Trapped? Roads blocked? Injuries? Be factual — AI triage reads this text."
              className="w-full resize-none rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-ink outline-none placeholder:text-faint focus:border-accent/60"
            />
            <p className="mt-1 text-right text-xs text-faint">{description.length}/2000</p>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="People affected (optional)">
              <input
                value={peopleAffected}
                onChange={(e) => setPeopleAffected(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                placeholder="e.g. 40"
                className="w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-ink outline-none placeholder:text-faint focus:border-accent/60"
              />
            </Field>
            <Field label="Reported by">
              <Select
                value={sourceType}
                onChange={setSourceType}
                options={[
                  { value: "citizen", label: "Citizen / field report" },
                  { value: "coordinator", label: "Control-room coordinator" },
                ]}
                className="w-full min-w-0 py-2"
                ariaLabel="Reported by"
              />
            </Field>
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-edge bg-panel2 px-3 py-2 text-xs text-mute">
            <input
              type="checkbox"
              checked={assistanceNeeded}
              onChange={(e) => setAssistanceNeeded(e.target.checked)}
              className="accent-sky-500"
            />
            Immediate assistance reported as needed
          </label>
          {error && <p role="alert" className="text-sm text-severe">{error}</p>}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={submit} disabled={submitting}>
              {submitting ? <Spinner className="h-3.5 w-3.5 border-on-fill/40 border-t-on-fill" /> : <Send size={13} />}
              Submit report
            </Button>
          </div>
        </div>

        <div className="min-w-0 space-y-2">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Location</legend>
            <p className="mb-2 text-xs text-mute">Drop a pin on the map or enter coordinates.</p>
            <Select
              value={cityId}
              onChange={setCityId}
              options={cities.map((c) => ({ value: c.id, label: c.name }))}
              className="mb-2 w-full min-w-0 py-2"
              ariaLabel="City for the report map"
            />
            <MapCanvas
              center={mapCenter}
              zoom={11}
              picking
              markers={
                lat != null && lon != null
                  ? [
                      {
                        key: "pin",
                        kind: "incident",
                        lat,
                        lon,
                        label: "★",
                        color: "#38bdf8",
                        pulse: true,
                        square: false,
                        title: "Report location",
                        data: null,
                      },
                    ]
                  : []
              }
              onPick={(la, lo) => {
                setLat(Number(la.toFixed(5)));
                setLon(Number(lo.toFixed(5)));
              }}
              heightClass="h-[260px]"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                value={lat ?? ""}
                onChange={(e) => setLat(e.target.value === "" ? null : Number(e.target.value))}
                type="number"
                step="0.0001"
                aria-label="Latitude"
                placeholder="Latitude"
                className="min-w-0 rounded-lg border border-edge bg-panel px-2.5 py-1.5 text-xs text-ink outline-none focus:border-accent/60"
              />
              <input
                value={lon ?? ""}
                onChange={(e) => setLon(e.target.value === "" ? null : Number(e.target.value))}
                type="number"
                step="0.0001"
                aria-label="Longitude"
                placeholder="Longitude"
                className="min-w-0 rounded-lg border border-edge bg-panel px-2.5 py-1.5 text-xs text-ink outline-none focus:border-accent/60"
              />
            </div>
            {lat != null && lon != null && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-low">
                <MapPin size={10} /> pin set at {lat.toFixed(4)}, {lon.toFixed(4)}
              </p>
            )}
          </fieldset>
          <p className="text-xs leading-relaxed text-faint">
            Stored locally in GARUD's SQLite incident database. Submitting does NOT contact any real emergency
            service. The AI triage suggestion appears immediately and a coordinator reviews it.
          </p>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-faint">{label}</span>
      {children}
    </label>
  );
}
