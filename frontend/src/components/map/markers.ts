/** Marker visual specs + Leaflet divIcon builders. */

import L from "leaflet";
import { hexSeverity, hexUrgency } from "../../lib/format";
import type { City, DisasterEvent, Earthquake, Incident, Resource, RiskAssessment } from "../../lib/types";

export type MarkerKind = "incident" | "earthquake" | "disaster" | "weather" | "resource";

export interface MarkerSpec {
  key: string;
  kind: MarkerKind;
  lat: number;
  lon: number;
  label: string;
  color: string;
  pulse: boolean;
  square?: boolean;
  simulated?: boolean;
  title: string;
  data: any;
}

export function incidentMarker(inc: Incident): MarkerSpec {
  return {
    key: `inc-${inc.id}`,
    kind: "incident",
    lat: inc.lat,
    lon: inc.lon,
    label: inc.severity === "critical" ? "!" : inc.severity[0].toUpperCase(),
    color: hexUrgency(inc.severity),
    pulse: inc.severity === "critical" && !["resolved", "rejected", "duplicate"].includes(inc.status),
    title: inc.title,
    simulated: inc.simulated,
    data: inc,
  };
}

export function earthquakeMarker(q: Earthquake): MarkerSpec {
  const mag = q.magnitude;
  return {
    key: `eq-${q.id}`,
    kind: "earthquake",
    lat: q.lat,
    lon: q.lon,
    label: mag ? mag.toFixed(1) : "Q",
    color: "#c1acfb",
    pulse: (mag ?? 0) >= 6,
    title: mag == null ? q.place : `M${mag.toFixed(1)} — ${q.place}`,
    data: q,
  };
}

export function disasterMarker(ev: DisasterEvent): MarkerSpec {
  const category = ev.categories.join(" ").toLowerCase();
  const label = category.includes("flood") ? "FL" : /storm|cyclone/.test(category) ? "ST" : category.includes("fire") ? "WF" : ev.source_feed === "gdacs" ? "G" : "E";
  return {
    key: `dis-${ev.source_feed}-${ev.id}-${ev.date ?? ""}-${ev.lat}-${ev.lon}-${ev.geo_type}`,
    kind: "disaster",
    lat: ev.lat,
    lon: ev.lon,
    label,
    color: ev.source_feed === "gdacs" ? "#f59e0b" : "#f43f5e",
    pulse: ev.alert_level === "severe",
    title: ev.title,
    data: ev,
  };
}

export function weatherMarker(a: RiskAssessment): MarkerSpec {
  return {
    key: `wx-${a.city_id}`,
    kind: "weather",
    lat: a.lat!,
    lon: a.lon!,
    label: a.severity[0].toUpperCase(),
    color: hexSeverity(a.severity),
    pulse: a.severity === "severe",
    square: true,
    title: `${a.city} — forecast risk: ${a.severity}`,
    simulated: a.simulated,
    data: a,
  };
}

export function resourceMarker(r: Resource): MarkerSpec {
  const colors: Record<string, string> = { hospital: "#34d399", police: "#60a5fa", fire_station: "#fb923c" };
  const labels: Record<string, string> = { hospital: "H", police: "P", fire_station: "F" };
  return {
    key: `res-${r.id}`,
    kind: "resource",
    lat: r.lat,
    lon: r.lon,
    label: labels[r.kind] ?? "R",
    color: colors[r.kind] ?? "#94a3b8",
    pulse: false,
    square: true,
    title: r.name,
    data: r,
  };
}

export function cityCenter(c: City): [number, number] {
  return [c.lat, c.lon];
}

export function buildIcon(spec: MarkerSpec, selected = false): L.DivIcon {
  const shape = spec.square ? "gm-dot gm-dot-sq" : "gm-dot";
  const disclosure = spec.simulated ? '<span class="gm-sim" aria-hidden="true">S</span>' : "";
  const html = `<div class="gm-wrap"><div class="${shape}" data-selected="${selected}" style="background:${spec.color}"><span>${spec.label}</span></div>${disclosure}</div>`;
  return L.divIcon({ html, className: "gm-icon", iconSize: [30, 30], iconAnchor: [15, 15] });
}
