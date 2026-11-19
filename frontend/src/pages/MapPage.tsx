/** Live Disaster Map with layer toggles and region focus. */

import { useMemo, useState } from "react";
import { Layers, Search } from "lucide-react";
import { useApp } from "../state/AppContext";
import { useDisasters, useEarthquakes, useIncidents, useLocations, useResources, useRiskAll } from "../hooks/useApi";
import { MapCanvas, geojsonToPositions, type MapPolygon, type MarkerSpec } from "../components/map/MapCanvas";
import MapDetailPanel from "../components/map/MapDetailPanel";
import MapLegend from "../components/map/MapLegend";
import { disasterMarker, earthquakeMarker, incidentMarker, resourceMarker, weatherMarker } from "../components/map/markers";
import { Button, EmptyState, PageHeader, SimBadge } from "../components/ui";
import { withinKm } from "../lib/geo";

const OPEN = ["reported", "under_review", "assigned", "responding"];
const INDIA_CENTER: [number, number] = [22.8, 79.6];
const WORLD_CENTER: [number, number] = [18, 20];

type LayerKey = "incidents" | "weather" | "quakes" | "disasters" | "resources";

const LAYER_LABELS: Record<LayerKey, string> = {
  incidents: "Incidents",
  weather: "Forecast risk",
  quakes: "Earthquakes M4.5+",
  disasters: "Disaster events",
  resources: "Facilities (city)",
};

const defaultLayers: Record<LayerKey, boolean> = { incidents: true, weather: true, quakes: true, disasters: true, resources: false };

export default function MapPage() {
  const { cityId } = useApp();
  const { data: locs } = useLocations();
  const riskAll = useRiskAll();
  const incidents = useIncidents({});
  const quakes = useEarthquakes("world", 4.5);
  const disasters = useDisasters();

  const [layers, setLayers] = useState(defaultLayers);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [focus, setFocus] = useState<"city" | "india" | "world">("city");
  const [selected, setSelected] = useState<MarkerSpec | null>(null);

  const city = locs?.cities.find((c) => c.id === cityId);
  const resources = useResources(layers.resources && focus === "city" ? { city: cityId } : null);

  const center: [number, number] =
    focus === "city" ? [city?.lat ?? 17.385, city?.lon ?? 78.4867] : focus === "india" ? INDIA_CENTER : WORLD_CENTER;
  const zoom = focus === "city" ? 10 : focus === "india" ? 5 : 2;

  const { markers, polygons } = useMemo(() => {
    const ms: MarkerSpec[] = [];
    const ps: MapPolygon[] = [];

    if (layers.incidents) {
      for (const inc of (incidents.data?.incidents ?? []).filter((i) => OPEN.includes(i.status))) {
        ms.push(incidentMarker(inc));
      }
    }
    if (layers.weather) {
      for (const a of riskAll.data?.assessments ?? []) ms.push(weatherMarker(a));
    }
    if (layers.quakes) {
      const evs = focus === "world" ? quakes.data?.events ?? [] : withinKm(quakes.data?.events ?? [], ...center, 3500, 60);
      for (const q of evs) ms.push(earthquakeMarker(q));
    }
    if (layers.disasters) {
      const pattern = category === "storm" ? /storm|cyclone/i : new RegExp(category, "i");
      const events = (disasters.data?.events ?? []).filter((event) => category === "all" || event.categories.some((label) => pattern.test(label)));
      const visible = focus === "world" ? events : withinKm(events, ...center, 3500, 60);
      for (const ev of visible) {
        const marker = disasterMarker(ev);
        ms.push(marker);
        if (ev.geo_type === "polygon" && ev.geometry) {
          const positions = geojsonToPositions(ev.geometry);
          if (positions.length >= 3) ps.push({ id: "poly-" + marker.key, positions, color: marker.color, title: ev.title, data: marker });
        }
      }
    }
    if (layers.resources && focus === "city") {
      for (const r of resources.data?.resources ?? []) ms.push(resourceMarker(r));
    }
    return { markers: ms, polygons: ps };

  }, [layers, category, incidents.data, riskAll.data, quakes.data, disasters.data, resources.data, focus, center[0], center[1]]);

  const activeSelection = markers.find((marker) => marker.key === selected?.key);
  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (term ? markers.filter((marker) => marker.title.toLowerCase().includes(term)) : markers).slice(0, 16);
  }, [search, markers]);

  return (
    <div className="workspace-page">
      <PageHeader title="Live Disaster Map" description="Inspect hazards, forecast risk, facilities and incident reports.">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Map region">
          {(["city", "india", "world"] as const).map((region) => (
            <Button key={region} size="sm" aria-pressed={focus === region} variant={focus === region ? "outline" : "ghost"}
              onClick={() => { setFocus(region); setSelected(null); }}>
              {region === "city" ? city?.name ?? "City" : region === "india" ? "India" : "World"}
            </Button>
          ))}
        </div>
      </PageHeader>
      <div className="map-workspace">
        <div className="panel overflow-clip">
          <MapCanvas center={center} zoom={zoom} markers={markers} polygons={polygons} selected={activeSelection}
            onSelect={setSelected} controls heightClass="workspace-map rounded-none" />
          <MapLegend />
        </div>
        <div className="grid min-w-0 content-start gap-3">
          <details className="panel disclosure" open>
            <summary><Layers size={15} className="mr-2 inline" /> Layers and filters</summary>
            <div className="grid gap-2 px-4 pb-4">
              {(Object.keys(LAYER_LABELS) as LayerKey[]).map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm text-mute">
                  <input type="checkbox" checked={layers[key]} disabled={key === "resources" && focus !== "city"}
                    className="size-4 accent-accent" onChange={(e) => setLayers((previous) => ({ ...previous, [key]: e.target.checked }))} />
                  {LAYER_LABELS[key]}{key === "resources" && focus !== "city" && " (city view)"}
                </label>
              ))}
              <label className="mt-1 grid gap-1 text-sm text-mute">
                Disaster category
                <select value={category} className="workspace-input" disabled={!layers.disasters}
                  onChange={(event) => setCategory(event.target.value)}>
                  <option value="all">All disasters</option>
                  <option value="storm">Storms</option>
                  <option value="flood">Floods</option>
                  <option value="fire">Fires</option>
                  <option value="volcano">Volcanoes</option>
                </select>
              </label>
              {layers.resources && focus === "city" && (
                <p className="text-xs text-faint" role="status">
                  {resources.isLoading ? "Loading facilities…" :
                    resources.isError ? "Facility listings are currently unavailable." :
                    (resources.data?.resources.length ?? 0) + " mapped facilities" + (resources.data?.meta.stale ? " · cached" : "")}
                </p>
              )}
              <Button size="sm" onClick={() => { setLayers(defaultLayers); setCategory("all"); setSearch(""); setSelected(null); }}>Reset filters</Button>
            </div>
          </details>
          {activeSelection && <MapDetailPanel item={activeSelection} onClose={() => setSelected(null)} />}
          <section className="panel min-w-0" aria-label="Map events">
            <div className="flex items-center gap-2 p-3">
              <Search size={16} className="shrink-0 text-faint" />
              <input className="workspace-input w-full min-w-0" type="search" value={search}
                onChange={(event) => setSearch(event.target.value)} placeholder="Find a visible event" aria-label="Find a visible event" />
            </div>
            <p className="px-3 pb-2 text-xs text-faint">{markers.length} markers · {polygons.length} event areas</p>
            {results.length ? <ul className="max-h-70 divide-y divide-edge overflow-auto">
              {results.map((marker) => <li key={marker.key}>
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-panel2"
                  aria-pressed={marker.key === activeSelection?.key} aria-controls={marker.key === activeSelection?.key ? "map-event-details" : undefined} onClick={() => setSelected(marker)}>
                  <span className="hazard-dot" style={{ background: marker.color }} />
                  <span className="min-w-0 break-words">{marker.title} {marker.simulated && <SimBadge />}</span>
                </button>
              </li>)}
            </ul> : <EmptyState text={quakes.isLoading || disasters.isLoading ? "Loading map events…" : "No matching events"} />}
          </section>
        </div>
      </div>
    </div>
  );
}
