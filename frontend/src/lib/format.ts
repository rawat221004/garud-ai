/** Formatting helpers: Asia/Kolkata display, severity/urgency visuals, WMO codes. */

import type { Severity, Urgency } from "./types";

const istFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const istFmtLong = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function fmtIST(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return istFmt.format(d) + " IST";
}

export function fmtISTLong(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return istFmtLong.format(d) + " IST";
}

export function fmtClock(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return (
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d) + " IST"
  );
}

export function ago(iso?: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "?";
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 90) return "1 min ago";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export function num(n?: number | null, digits = 1): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(n);
}

export const SEVERITY_STYLES: Record<Severity, { chip: string; dot: string; hex: string; label: string }> = {
  low: { chip: "bg-low/15 text-low border-low/40", dot: "bg-low", hex: "#22c55e", label: "Low" },
  elevated: { chip: "bg-elevated/15 text-elevated border-elevated/40", dot: "bg-elevated", hex: "#eab308", label: "Elevated" },
  high: { chip: "bg-high/15 text-high border-high/40", dot: "bg-high", hex: "#f97316", label: "High" },
  severe: { chip: "bg-severe/15 text-severe border-severe/40", dot: "bg-severe", hex: "#ef4444", label: "Severe" },
};

export const URGENCY_STYLES: Record<Urgency, { chip: string; dot: string; hex: string }> = {
  low: { chip: "bg-low/15 text-low border-low/40", dot: "bg-low", hex: "#22c55e" },
  moderate: { chip: "bg-elevated/15 text-elevated border-elevated/40", dot: "bg-elevated", hex: "#eab308" },
  high: { chip: "bg-high/15 text-high border-high/40", dot: "bg-high", hex: "#f97316" },
  critical: { chip: "bg-severe/15 text-severe border-severe/40", dot: "bg-severe", hex: "#ef4444" },
};

export const STATUS_STYLES: Record<string, string> = {
  reported: "bg-sky-500/15 text-status-reported border-sky-500/40",
  under_review: "bg-indigo-500/15 text-status-review border-indigo-500/40",
  assigned: "bg-violet-500/15 text-status-assigned border-violet-500/40",
  responding: "bg-amber-500/15 text-status-responding border-amber-500/40",
  resolved: "bg-low/15 text-low border-low/40",
  rejected: "bg-zinc-500/15 text-status-closed border-zinc-500/40",
  duplicate: "bg-zinc-500/15 text-status-closed border-zinc-500/40",
};

export const STATUS_LABELS: Record<string, string> = {
  reported: "Reported",
  under_review: "Under Review",
  assigned: "Assigned",
  responding: "Responding",
  resolved: "Resolved",
  rejected: "Rejected",
  duplicate: "Duplicate",
};

export const FLAG_LABELS: Record<string, string> = {
  thunderstorm_forecast: "Thunderstorm cells forecast",
  intense_rain_burst: "Intense rain burst",
  damaging_gusts: "Damaging gusts",
  heavy_rain_day_potential: "Heavy-rain-day potential (IMD-inspired band)",
};

const WMO: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  61: "Light rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Severe thunderstorm with hail",
};

export function wmoLabel(code?: number | null): string {
  if (code === null || code === undefined) return "—";
  return WMO[code] ?? `WMO ${code}`;
}

export function hexUrgency(u: string): string {
  return (URGENCY_STYLES as any)[u]?.hex ?? "#64748b";
}

export function hexSeverity(s: string): string {
  return (SEVERITY_STYLES as any)[s]?.hex ?? "#64748b";
}
