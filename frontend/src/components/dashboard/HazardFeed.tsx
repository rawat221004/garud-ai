import { useMemo, useState } from "react";
import { ArrowRight, Radio, Waves } from "lucide-react";
import { Link } from "react-router-dom";
import { useDisasters, useEarthquakes } from "../../hooks/useApi";
import { Button, Card, EmptyState, Skeleton } from "../ui";
import { disasterMarker, earthquakeMarker, type MarkerSpec } from "../map/markers";
import { ago, fmtIST } from "../../lib/format";

type Filter = "All" | "Earthquakes" | "Storms" | "Floods";
const filters: Filter[] = ["All", "Earthquakes", "Storms", "Floods"];

export default function HazardFeed({ onSelect, selectedKey }: { onSelect: (item: MarkerSpec) => void; selectedKey?: string }) {
  const disasters = useDisasters();
  const quakes = useEarthquakes("world", 4.5);
  const [filter, setFilter] = useState<Filter>("All");
  const items = useMemo(() => [
    ...(disasters.data?.events ?? []).map((event) => ({
      marker: disasterMarker(event), category: event.categories.join(", ") || "Disaster event",
      source: event.source_feed === "gdacs" ? "GDACS" : "NASA EONET", time: event.date,
      detail: event.alert_level,
      location: event.lat.toFixed(2) + "°, " + event.lon.toFixed(2) + "°",
    })),
    ...(quakes.data?.events ?? []).map((event) => ({
      marker: earthquakeMarker(event), category: "Earthquake", source: "USGS", time: event.time,
      detail: event.tsunami_flag ? "Tsunami flag" : undefined,
      location: undefined,
    })),
  ].sort((a, b) => new Date(b.time ?? 0).getTime() - new Date(a.time ?? 0).getTime()), [disasters.data, quakes.data]);

  const filterPattern = { All: /./, Earthquakes: /earthquake/i, Storms: /storm|cyclone/i, Floods: /flood/i };
  const visible = items.filter((item) => filterPattern[filter].test(item.category)).slice(0, 24);
  const metadata = [disasters.data?.meta?.eonet, disasters.data?.meta?.gdacs, quakes.data?.meta];
  const unavailable = disasters.isError || quakes.isError || metadata.some((meta) => meta?.error && !meta.fetched_at);
  const cached = metadata.some((meta) => meta?.stale);
  const loading = disasters.isLoading || quakes.isLoading;

  return (
    <Card className="hazard-feed" title="Live hazard feed" icon={<Radio size={17} />} bodyClass="p-0">
      <div className="filter-tabs" role="group" aria-label="Hazard type">
        {filters.map((f) => <Button size="sm" key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</Button>)}
      </div>
      {(unavailable || cached) && <p className="px-4 pt-3 text-xs text-elevated" role="status">
        {unavailable ? "Some feeds are unavailable." : "Some feeds are showing cached events."} <Link className="underline" to="/system">Source health</Link>
      </p>}
      {visible.length ? (
        <ul className="hazard-rows" aria-label="Recent hazards">
          {visible.map(({ marker, category, source, time, detail, location }) => (
            <li key={marker.key}>
              <button type="button" aria-pressed={marker.key === selectedKey} aria-controls={marker.key === selectedKey ? "map-event-details" : undefined} onClick={() => onSelect(marker)}>
                <span className="hazard-dot" style={{ background: marker.color }} />
                <span className="min-w-0">
                  <span className="block text-xs text-faint">{category} · {source}</span>
                  <strong className="line-clamp-2 font-semibold">{marker.title}</strong>
                  <span className="block text-xs text-faint">
                    {time && <time dateTime={time} title={fmtIST(time)}>{ago(time)}</time>}
                    {detail && <span> · {detail}</span>}
                    {location && <span> · {location}</span>}
                  </span>
                </span>
                <ArrowRight size={15} className="ml-auto shrink-0 text-faint" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : loading ? (
        <div className="grid gap-2 p-4" aria-busy="true" aria-label="Loading hazard feeds">
          {[1, 2, 3, 4].map((i) => <Skeleton className="h-13" key={i} />)}
        </div>
      ) : (
        <EmptyState icon={<Waves size={24} />} text={unavailable ? "No events from available feeds" : "No matching hazards"} />
      )}
      <p className="feed-footer">Observed events · <Link className="text-accent hover:underline" to="/system">Source health</Link></p>
    </Card>
  );
}
