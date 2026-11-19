/** TanStack Query data hooks + SSE live-update stream. */

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "../lib/api";
import type {
  Briefing,
  DisastersResponse,
  EarthquakesResponse,
  Incident,
  IncidentsResponse,
  IncidentEvent,
  LocationsResponse,
  Overview,
  ResourcesResponse,
  RiskAssessment,
  SimState,
  SystemStatus,
  WeatherEnvelope,
} from "../lib/types";

export function useOverview() {
  const { data: simulation } = useSimulation();
  const scenario = simulation?.active ? [simulation.started_at, simulation.phase] : null;
  return useQuery({
    queryKey: ["overview", scenario],
    queryFn: () => apiGet<Overview>("/api/overview"),
    refetchInterval: 60_000,
  });
}

export function useWeather(cityId: string, hours = 48) {
  const { data: simulation } = useSimulation();
  const scenario = simulation?.active && simulation.city_id === cityId ? simulation.started_at ?? simulation.scenario_id ?? "active" : null;
  return useQuery({
    queryKey: ["weather", cityId, hours, scenario],
    queryFn: () => apiGet<WeatherEnvelope>("/api/weather", { city: cityId, hours }),
    refetchInterval: 600_000,
  });
}

export interface RiskAllResponse {
  assessments: RiskAssessment[];
  elevated_count: number;
  model: string;
  disclaimer: string;
  thresholds_doc: Record<string, any>;
}

export function useRiskAll() {
  const { data: simulation } = useSimulation();
  const scenario = simulation?.active ? simulation.scenario_id : null;
  return useQuery({
    queryKey: ["risk", scenario],
    queryFn: () => apiGet<RiskAllResponse>("/api/risk"),
    refetchInterval: 600_000,
  });
}

export function useEarthquakes(region: "world" | "india" = "world", minMagnitude = 4.5) {
  return useQuery({
    queryKey: ["earthquakes", region, minMagnitude],
    queryFn: () => apiGet<EarthquakesResponse>("/api/earthquakes", { region, min_magnitude: minMagnitude }),
    refetchInterval: 300_000,
  });
}

export function useDisasters() {
  return useQuery({
    queryKey: ["disasters"],
    queryFn: () => apiGet<DisastersResponse>("/api/disasters"),
    refetchInterval: 900_000,
  });
}

export function useIncidents(filters: Record<string, string | number | undefined> = {}) {
  const active = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ""));
  return useQuery({
    queryKey: ["incidents", active],
    queryFn: () => apiGet<IncidentsResponse>("/api/incidents", active),
    refetchInterval: 30_000,
  });
}

export function useIncident(id: string | null | undefined) {
  return useQuery({
    queryKey: ["incident", id],
    queryFn: () => apiGet<Incident>(`/api/incidents/${id}`),
    enabled: !!id,
    refetchInterval: 30_000,
  });
}

export function useTimeline() {
  return useQuery({
    queryKey: ["timeline"],
    queryFn: () => apiGet<{ events: IncidentEvent[]; total: number }>("/api/incidents/events", { limit: 60 }),
    refetchInterval: 30_000,
  });
}

export function useSystemStatus() {
  return useQuery({
    queryKey: ["system"],
    queryFn: () => apiGet<SystemStatus>("/api/system/status"),
    refetchInterval: 30_000,
  });
}

export function useSimulation() {
  return useQuery({
    queryKey: ["simulation"],
    queryFn: () => apiGet<SimState>("/api/simulation/status"),
    refetchInterval: 30_000,
  });
}

export function useLocations() {
  return useQuery({
    queryKey: ["locations"],
    queryFn: () => apiGet<LocationsResponse>("/api/locations"),
    staleTime: Infinity,
  });
}

export function useResources(params: { city?: string; lat?: number; lon?: number } | null) {
  return useQuery({
    queryKey: ["resources", params?.city, params?.lat, params?.lon],
    queryFn: () => apiGet<ResourcesResponse>("/api/resources", params ?? undefined),
    enabled: !!params,
    staleTime: 3600_000,
    retry: 0,
  });
}

export function useRefreshAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

/** SSE: incidents + simulation updates push-validated into the cache. */
export function useIncidentStream() {
  const qc = useQueryClient();
  useEffect(() => {
    const es = new EventSource("/api/incidents/stream");
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg?.type === "connected") return;
        if (msg?.type?.startsWith("incident")) {
          qc.invalidateQueries({ queryKey: ["incident"] });
          qc.invalidateQueries({ queryKey: ["incidents"] });
          qc.invalidateQueries({ queryKey: ["system"] });
        }
        if (msg?.type?.startsWith("simulation")) {
          qc.invalidateQueries({ queryKey: ["simulation"] });
          qc.invalidateQueries({ queryKey: ["incidents"] });
          qc.invalidateQueries({ queryKey: ["weather"] });
          qc.invalidateQueries({ queryKey: ["risk"] });
          qc.invalidateQueries({ queryKey: ["incident"] });
          qc.invalidateQueries({ queryKey: ["system"] });
        }
        qc.invalidateQueries({ queryKey: ["timeline"] });
        qc.invalidateQueries({ queryKey: ["overview"] });
      } catch {
        /* ignore malformed frames */
      }
    };
    es.onerror = () => {
      /* EventSource auto-reconnects; polling keeps data fresh meanwhile */
    };
    return () => es.close();
  }, [qc]);
}

/** On-demand AI situation briefing (POST; components drive loading state). */
export async function fetchBriefing(cityId: string, language: "en" | "hi" | "te" = "en"): Promise<Briefing> {
  return apiPost<Briefing>("/api/ai/briefing", { city: cityId, language });
}
