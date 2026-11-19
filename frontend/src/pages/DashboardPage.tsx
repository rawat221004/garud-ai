/** Feature A: the Disaster Intelligence Dashboard. */

import { useMemo, useState } from "react";
import { ArrowUpRight, Globe2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "../state/AppContext";
import { useDisasters, useEarthquakes, useIncidents, useLocations, useOverview, useRiskAll, useWeather } from "../hooks/useApi";
import KpiCards from "../components/dashboard/KpiCards";
import HazardFeed from "../components/dashboard/HazardFeed";
import WeatherChart from "../components/dashboard/WeatherChart";
import RiskBreakdown from "../components/dashboard/RiskBreakdown";
import IncidentQueue from "../components/dashboard/IncidentQueue";
import ActivityTimeline from "../components/dashboard/ActivityTimeline";
import AiBriefingPanel from "../components/dashboard/AiBriefingPanel";
import { MapCanvas, geojsonToPositions, type MapPolygon, type MarkerSpec } from "../components/map/MapCanvas";
import MapDetailPanel from "../components/map/MapDetailPanel";
import MapLegend from "../components/map/MapLegend";
import { disasterMarker, earthquakeMarker, incidentMarker, weatherMarker } from "../components/map/markers";
import { withinKm } from "../lib/geo";
import { Card, PageHeader } from "../components/ui";

const OPEN = ["reported", "under_review", "assigned", "responding"];

export default function DashboardPage() {
  const { cityId } = useApp();
  const { data: locs } = useLocations();
  const overview = useOverview();
  const weather = useWeather(cityId);
  const riskAll = useRiskAll();
  const incidents = useIncidents({});
  const quakes = useEarthquakes("world", 4.5);
  const disasters = useDisasters();
  const [selected, setSelected] = useState<MarkerSpec | null>(null);

  const city = locs?.cities.find((c) => c.id === cityId);
  const center: [number, number] = [city?.lat ?? 17.385, city?.lon ?? 78.4867];

  const { markers, polygons } = useMemo(() => {
    const ms: MarkerSpec[] = [];
    const ps: MapPolygon[] = [];
    const clat = center[0];
    const clon = center[1];

    for (const a of riskAll.data?.assessments ?? []) ms.push(weatherMarker(a));

    for (const inc of (incidents.data?.incidents ?? []).filter((i) => OPEN.includes(i.status))) {
      ms.push(incidentMarker(inc));
    }

    const nearDis = withinKm(disasters.data?.events ?? [], clat, clon, 3500, 30);
    for (const ev of nearDis) {
      const marker = disasterMarker(ev);
      ms.push(marker);
      if (ev.geo_type === "polygon" && ev.geometry) {
        const positions = geojsonToPositions(ev.geometry);
        if (positions.length >= 3) {
          ps.push({ id: "poly-" + marker.key, positions, color: marker.color, title: ev.title, data: marker });
        }
      }
    }

    const nearQ = withinKm(quakes.data?.events ?? [], clat, clon, 3500, 20);
    const qs = nearQ.length ? nearQ : (quakes.data?.events ?? []).slice(0, 6);
    for (const q of qs) ms.push(earthquakeMarker(q));

    return { markers: ms, polygons: ps };
  }, [riskAll.data, incidents.data, disasters.data, quakes.data, center[0], center[1]]);

  const activeSelection = markers.find((marker) => marker.key === selected?.key) ??
    (selected?.kind === "disaster" || selected?.kind === "earthquake" ? selected : undefined);
  const visibleMarkers = useMemo(() =>
    activeSelection && !markers.includes(activeSelection) ? [...markers, activeSelection] : markers,
    [markers, activeSelection]);

  return (
    <div className="workspace-page">
      <PageHeader title="Disaster Operations Overview"
        description={city ? city.name + ", " + city.state + " · Global hazard monitoring and local response" : "Global hazard monitoring and local response"}>
        <Link className="workspace-link" to="/incidents?report=1">Report incident <ArrowUpRight size={15} /></Link>
      </PageHeader>
      <KpiCards />

      <div className="overview-situation">
        <Card title="Geographic situation" icon={<Globe2 size={17} />}
          right={<Link className="text-sm text-accent hover:underline" to="/map">Open live map ↗</Link>} bodyClass="p-0">
          <MapCanvas center={center} zoom={7} markers={visibleMarkers} polygons={polygons}
            onSelect={setSelected} selected={activeSelection} controls heightClass="overview-map rounded-none" />
          {activeSelection && <MapDetailPanel item={activeSelection} onClose={() => setSelected(null)} />}
          <MapLegend />
        </Card>
        <HazardFeed onSelect={setSelected} selectedKey={activeSelection?.key} />
      </div>

      <div className="overview-support">
        <IncidentQueue incidents={incidents.data?.incidents} loading={incidents.isLoading} />
        <ActivityTimeline />
        <WeatherChart weather={weather.data} loading={weather.isLoading} />
        <RiskBreakdown overview={overview.data} assessment={weather.data?.risk ?? null} />
      </div>
      <AiBriefingPanel key={cityId} cityId={cityId} cityName={city?.name ?? cityId} />
    </div>
  );
}
