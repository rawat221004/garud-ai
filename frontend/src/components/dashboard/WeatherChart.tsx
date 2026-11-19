import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CloudRain } from "lucide-react";
import type { WeatherEnvelope } from "../../lib/types";
import { Button, Card, EmptyState, SimBadge, Skeleton, SourceTag } from "../ui";
import { wmoLabel } from "../../lib/format";

const dateTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
});
const series = {
  rain: { label: "Rainfall", unit: "mm", color: "var(--color-accent)" },
  probability: { label: "Rain chance", unit: "%", color: "var(--color-low)" },
  gust: { label: "Wind gust", unit: "km/h", color: "var(--color-high)" },
  temperature: { label: "Temperature", unit: "°C", color: "var(--color-sim)" },
} as const;
type Series = keyof typeof series;
const keys = Object.keys(series) as Series[];

export default function WeatherChart({ weather, loading }: { weather?: WeatherEnvelope; loading?: boolean }) {
  const [hours, setHours] = useState<24 | 48>(24);
  const [measure, setMeasure] = useState<Series>("rain");
  const currentSeries = series[measure];

  if (!weather) {
    return (
      <Card title="Weather forecast" icon={<CloudRain size={16} />}>
        {loading ? <div aria-busy="true" aria-label="Loading weather forecast"><Skeleton className="h-56" /></div>
          : <EmptyState text="Weather forecast unavailable" hint="Check System Health for source availability." />}
      </Card>
    );
  }

  const data = weather.hourly.slice(0, hours).map((h) => ({
    time: dateTime.format(new Date(h.time)), rain: h.precipitation_mm,
    probability: h.precipitation_probability_pct, gust: h.wind_gusts_kmh, temperature: h.temperature_c,
  }));
  const c = weather.current;
  const allZero = data.length > 0 && data.every((hour) => hour[measure] === 0);

  return (
    <Card title={weather.city.name + " weather forecast"} icon={<CloudRain size={17} />} right={
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Forecast period">
        {weather.simulated && <SimBadge />}
        {([24, 48] as const).map((h) => <Button key={h} size="sm" variant={hours === h ? "outline" : "ghost"}
          aria-pressed={hours === h} onClick={() => setHours(h)}>{h}h</Button>)}
      </div>
    }>
      <p className="mb-3 text-sm text-mute">
        <span className="font-semibold text-ink">{weather.simulated ? "Simulated conditions" : "Current conditions"}</span> · {wmoLabel(c.weather_code)}
        {" · "}{c.temperature_c ?? "—"}°C · Humidity {c.humidity_pct ?? "—"}% · Rain {c.precipitation_mm ?? "—"} mm/h · Wind {c.wind_speed_kmh ?? "—"} km/h · Gust {c.wind_gusts_kmh ?? "—"} km/h
      </p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Forecast measure">
        {keys.map((key) => <Button size="sm" key={key} aria-pressed={key === measure}
          variant={key === measure ? "outline" : "ghost"} onClick={() => setMeasure(key)}>{series[key].label}</Button>)}
      </div>
      <figure className="mt-4">
        <figcaption className="mb-2 text-xs text-mute">{currentSeries.label} ({currentSeries.unit}) · Next {hours} hours · IST</figcaption>
        {allZero && <p className="text-sm text-mute">All forecast values in this window are 0 {currentSeries.unit}.</p>}
        {data.some((hour) => hour[measure] != null) ? (
          <div className="h-[215px] min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={data} margin={{ top: 4, right: 8, bottom: 2, left: 0 }} accessibilityLayer>
                <CartesianGrid stroke="var(--color-edge)" vertical={false} />
                <XAxis dataKey="time" minTickGap={32} tickFormatter={(value: string) => value.split(", ").at(-1) ?? value}
                  tick={{ fill: "var(--color-faint)", fontSize: 12 }} />
                <YAxis width={34} domain={measure === "probability" ? [0, 100] : ["auto", "auto"]}
                  tick={{ fill: "var(--color-faint)", fontSize: 12 }} />
                <Tooltip cursor={{ fill: "var(--color-panel2)" }}
                  contentStyle={{ background: "var(--color-panel)", borderColor: "var(--color-edge2)", borderRadius: 8 }}
                  formatter={(value: number) => [value + " " + currentSeries.unit, currentSeries.label]} />
                <Bar dataKey={measure} fill={currentSeries.color} maxBarSize={18} radius={[2, 2, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <EmptyState text="This measurement is unavailable for the selected window." />}
      </figure>
      <details className="mt-3 text-sm">
        <summary className="text-mute">Hourly values</summary>
        <ul className="mt-2 grid max-h-44 grid-cols-2 gap-2 overflow-auto text-xs text-mute sm:grid-cols-3">
          {data.map((hour) => <li key={hour.time}>{hour.time} · {hour[measure] == null ? "Unavailable" : hour[measure] + " " + currentSeries.unit}</li>)}
        </ul>
      </details>
      <div className="mt-3">
        <SourceTag name={weather.source} fetchedAt={weather.fetched_at} stale={weather.stale} simulated={weather.simulated} />
      </div>
    </Card>
  );
}
