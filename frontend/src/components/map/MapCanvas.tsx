/** Leaflet map canvas with Esri Gray Canvas tiles, markers, polygons, and click-to-pick. */

import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polygon, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Crosshair, Focus, Maximize } from "lucide-react";
import { useApp } from "../../state/AppContext";
import { Button, SimBadge } from "../ui";
import { buildIcon, type MarkerSpec } from "./markers";

const TILE_ROOT = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
const ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, FAO, NOAA, USGS &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · GARUD AI';

export interface MapPolygon {
  id: string;
  positions: [number, number][];
  color: string;
  title: string;
  data: MarkerSpec;
}

function Recenter({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  const [lat, lon] = center;
  useEffect(() => {
    map.setView([lat, lon], zoom ?? map.getZoom(), { animate: false });
  }, [map, lat, lon, zoom]);
  return null;
}

function ClickPicker({ onPick, cursorRef }: { onPick: (lat: number, lon: number) => void; cursorRef: boolean }) {
  useMapEvents({
    click(e) {
      if (cursorRef) onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

const emptyPolygons: MapPolygon[] = [];

function MapViewport({ center, zoom, markers, polygons, selected, fit, controls }: {
  center: [number, number]; zoom: number; markers: MarkerSpec[]; polygons: MapPolygon[];
  selected?: MarkerSpec | null; fit: boolean; controls: boolean;
}) {
  const map = useMap();
  const bounds = useMemo(() => L.latLngBounds([
    ...markers.map((m): [number, number] => [m.lat, m.lon]),
    ...polygons.flatMap((p) => p.positions),
  ]), [markers, polygons]);
  const lat = selected?.lat;
  const lon = selected?.lon;
  const key = selected?.key;

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    if (lat !== undefined && lon !== undefined) map.setView([lat, lon], Math.max(zoom, 9), { animate: false });
  }, [map, lat, lon, key, zoom]);

  useEffect(() => {
    if (fit && bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
  }, [map, fit, bounds]);

  if (!controls) return null;
  return <div className="map-view-controls" aria-label="Map navigation" role="group">
    <Button size="sm" onClick={() => map.setView(center, zoom)} aria-label="Reset map view" title="Reset map view"><Crosshair size={16} /></Button>
    <Button size="sm" disabled={!bounds.isValid()} onClick={() => map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 })} aria-label="Fit to events" title="Fit to events"><Maximize size={16} /></Button>
    {selected && <Button size="sm" onClick={() => map.setView([selected.lat, selected.lon], Math.max(zoom, 9))} aria-label="Zoom to selection" title="Zoom to selection"><Focus size={16} /></Button>}
  </div>;
}

function IncidentMarkers({ markers, selected, onSelect }: { markers: MarkerSpec[]; selected?: MarkerSpec | null; onSelect?: (m: MarkerSpec) => void }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const groups = useMemo(() => {
    const cells = new Map<string, MarkerSpec[]>();
    for (const marker of markers) {
      if (marker.kind !== "incident" || marker.key === selected?.key) continue;
      const { x, y } = map.project([marker.lat, marker.lon], zoom);
      const key = Math.round(x / 37) + ":" + Math.round(y / 37);
      const cell = cells.get(key) ?? [];
      cell.push(marker);
      cells.set(key, cell);
    }
    return Array.from(cells.values());
  }, [map, markers, selected?.key, zoom]);
  return <>
    {groups.map((group) => {
      const first = group[0];
      if (group.length === 1) return <EventMarker key={first.key} marker={first} onSelect={onSelect} />;
      const position = L.latLngBounds(group.map((m): [number, number] => [m.lat, m.lon])).getCenter();
      const hasSimulated = group.some((item) => item.simulated);
      const title = group.length + " nearby incident reports" + (hasSimulated ? " · Includes simulated reports" : "");
      const clusterLabel = '<span class="gm-cluster">' + group.length + '</span>' + (hasSimulated ? '<span class="gm-sim" aria-hidden="true">S</span>' : "");
      const icon = L.divIcon({ className: "gm-icon", html: clusterLabel, iconSize: [32, 32], iconAnchor: [16, 16] });
      return <Marker key={first.key} position={position} icon={icon} title={title} alt={title}>
        <Popup>
          <strong>Nearby reports</strong>
          <ul className="mt-2 grid max-h-44 gap-2 overflow-auto">
            {group.map((item) => <li key={item.key}><button type="button" className="text-left text-accent hover:underline" onClick={() => { map.closePopup(); onSelect?.(item); }}>{item.title} {item.simulated && <SimBadge />}</button></li>)}
          </ul>
        </Popup>
      </Marker>;
    })}
  </>;
}

function EventMarker({ marker, selected, onSelect }: { marker: MarkerSpec; selected?: boolean; onSelect?: (m: MarkerSpec) => void }) {
  const icon = useMemo(() => buildIcon(marker, selected), [marker, selected]);
  const label = marker.title + (marker.simulated ? " · Simulated" : "");
  return <Marker position={[marker.lat, marker.lon]} icon={icon} title={label} alt={label}
    zIndexOffset={selected ? 1000 : 0} eventHandlers={{ click: () => onSelect?.(marker) }}>
    <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>{label}</Tooltip>
  </Marker>;
}

export function MapCanvas({
  center,
  zoom = 10,
  markers,
  polygons = emptyPolygons,
  onSelect,
  onPick,
  picking = false,
  heightClass = "h-[520px]",
  fit = false,
  className,
  selected,
  controls = false,
}: {
  center: [number, number];
  zoom?: number;
  markers: MarkerSpec[];
  polygons?: MapPolygon[];
  onSelect?: (m: MarkerSpec) => void;
  onPick?: (lat: number, lon: number) => void;
  picking?: boolean;
  heightClass?: string;
  fit?: boolean;
  className?: string;
  selected?: MarkerSpec | null;
  controls?: boolean;
}) {
  const { theme } = useApp();
  const basemap = theme === "light" ? "World_Light_Gray" : "World_Dark_Gray";
  const markerEls = useMemo(() => markers
    .filter((marker) => !controls || marker.kind !== "incident" || marker.key === selected?.key)
    .map((marker) => <EventMarker key={marker.key} marker={marker} selected={marker.key === selected?.key} onSelect={onSelect} />),
    [markers, controls, selected?.key, onSelect]);

  const polyEls = useMemo(
    () =>
      polygons.map((p) => (
        <Polygon
          key={p.id}
          positions={p.positions}
          pathOptions={{ color: p.color, weight: 1.5, fillOpacity: 0.15 }}
          eventHandlers={{ click: () => onSelect?.(p.data) }}
        >
          <Tooltip sticky opacity={0.95}>
            {p.title}
          </Tooltip>
        </Polygon>
      )),
    [polygons, onSelect]
  );

  return (
    <div className={className}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        worldCopyJump
        className={`${heightClass} w-full rounded-xl`}

      >
        <TileLayer url={`${TILE_ROOT}/${basemap}_Base/MapServer/tile/{z}/{y}/{x}`} attribution={ATTRIBUTION} maxNativeZoom={16} maxZoom={19} />
        <TileLayer url={`${TILE_ROOT}/${basemap}_Reference/MapServer/tile/{z}/{y}/{x}`} maxNativeZoom={16} maxZoom={19} opacity={0.95} />
        <Recenter center={center} zoom={zoom} />
        <ClickPicker onPick={(lat, lon) => onPick?.(lat, lon)} cursorRef={picking} />
        <MapViewport center={center} zoom={zoom} markers={markers} polygons={polygons} selected={selected} controls={controls} fit={fit} />
        {controls && <IncidentMarkers markers={markers} selected={selected} onSelect={onSelect} /> }
        {markerEls}
        {polyEls}
      </MapContainer>
    </div>
  );
}

/** Convert GeoJSON polygon/line coordinates ([lon,lat] rings) to Leaflet positions. */
export function geojsonToPositions(geometry: unknown): [number, number][] {
  try {
    if (!Array.isArray(geometry)) return [];
    // Polygon: array of rings
    if (Array.isArray(geometry[0]) && Array.isArray(geometry[0][0])) {
      return geometry[0].map((pt: number[]) => [pt[1], pt[0]] as [number, number]);
    }
    // LineString: array of points
    if (Array.isArray(geometry[0]) && typeof geometry[0][0] === "number") {
      return geometry.map((pt: number[]) => [pt[1], pt[0]] as [number, number]);
    }
  } catch {
    /* malformed */
  }
  return [];
}
export { type MarkerSpec };
