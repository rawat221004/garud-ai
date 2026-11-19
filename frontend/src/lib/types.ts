/** Shared API types mirroring the backend responses. */

export interface City {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
}

export type Severity = "low" | "elevated" | "high" | "severe";
export type Urgency = "low" | "moderate" | "high" | "critical";

export type IncidentStatus =
  | "reported"
  | "under_review"
  | "assigned"
  | "responding"
  | "resolved"
  | "rejected"
  | "duplicate";

export type IncidentCategory =
  | "flooding"
  | "earthquake_damage"
  | "storm_damage"
  | "fire_wildfire"
  | "infrastructure_failure"
  | "medical_assistance"
  | "rescue_request"
  | "other_needs_review";

export interface RiskFactor {
  name: string;
  value: number | null;
  unit: string;
  severity: Severity;
  weight: number;
  points: number;
  threshold_note: string;
  explanation: string;
}

export interface WindowSummary {
  rain_mm: number;
  rain_prob_max: number;
  gust_max: number;
}

export interface RiskAssessment {
  city: string;
  city_id?: string;
  lat?: number;
  lon?: number;
  severity: Severity;
  score: number;
  simulated: boolean;
  model: string;
  computed_at: string;
  factors: RiskFactor[];
  windows: { h6: WindowSummary; h12: WindowSummary; h24: WindowSummary };
  flags: string[];
  disclaimer: string;
  thresholds_doc: Record<string, any>;
  weather_fetched_at?: string;
  weather_stale?: boolean;
}

export interface HourEntry {
  time: string;
  temperature_c: number;
  humidity_pct: number;
  precipitation_mm: number;
  precipitation_probability_pct: number | null;
  weather_code: number;
  pressure_hpa: number | null;
  wind_speed_kmh: number;
  wind_gusts_kmh: number;
}

export interface CurrentWeather {
  time: string;
  temperature_c: number | null;
  humidity_pct: number | null;
  precipitation_mm: number;
  weather_code: number | null;
  wind_speed_kmh: number;
  wind_gusts_kmh: number;
}

export interface WeatherEnvelope {
  city: City;
  current: CurrentWeather;
  hourly: HourEntry[];
  simulated: boolean;
  source: string;
  source_url?: string;
  fetched_at: string;
  stale: boolean;
  scenario?: string;
  scenario_title?: string;
  risk?: RiskAssessment;
}

export interface Earthquake {
  id: string;
  magnitude: number | null;
  place: string;
  time: string;
  lat: number;
  lon: number;
  depth_km: number | null;
  url: string;
  tsunami_flag: boolean;
  in_india: boolean;
  alert?: string | null;
}

export interface DisasterEvent {
  id: string;
  title: string;
  description: string;
  link?: string;
  categories: string[];
  sources: { id: string; url: string }[];
  date?: string;
  geo_type: string;
  lat: number;
  lon: number;
  geometry?: any;
  source_feed: "eonet" | "gdacs";
  alert_level?: string;
  distance_km?: number;
}

export interface SourceMetaBase {
  fetched_at?: string;
  stale?: boolean;
  count?: number;
  error?: string;
}

export interface EarthquakesResponse {
  events: Earthquake[];
  meta: SourceMetaBase & { source: string; source_url: string; region: string; min_magnitude: number | null };
}

export interface DisastersResponse {
  events: DisasterEvent[];
  meta: { eonet?: SourceMetaBase; gdacs?: SourceMetaBase };
}

export interface Triage {
  engine: string;
  category: IncidentCategory;
  urgency: Urgency;
  urgency_score: number;
  summary: string;
  details: {
    injuries_reported: boolean;
    people_trapped: boolean;
    blocked_roads: boolean;
    infrastructure_damage: boolean;
    evacuation_requested: boolean;
  };
  recommended_agencies: string[];
  next_steps: string[];
  confidence: number;
  notes: string;
}

export interface IncidentEvent {
  id: number;
  incident_id: string;
  at: string;
  event: string;
  detail: string;
  actor: string;
  incident_title?: string;
  severity?: string;
  source_type?: string;
  simulated?: boolean;
}

export interface Incident {
  id: string;
  created_at: string;
  updated_at: string;
  lat: number;
  lon: number;
  location_label: string;
  city: string;
  category: IncidentCategory;
  category_label: string;
  title: string;
  description: string;
  people_affected: number | null;
  assistance_needed: boolean;
  severity: Urgency;
  urgency_score: number;
  status: IncidentStatus;
  source_type: "citizen" | "coordinator" | "simulation";
  assigned_team: string | null;
  triage_engine: string;
  triage: Triage | null;
  simulated: boolean;
  allowed_next_statuses: string[];
  status_history?: IncidentEvent[];
}

export interface IncidentsResponse {
  incidents: Incident[];
  total: number;
}

export interface Overview {
  generated_at: string;
  active_events: {
    total: number;
    usgs_significant_earthquakes_24h: number;
    eonet_open_events: number;
    gdacs_events: number;
    usgs?: SourceMetaBase;
    eonet?: SourceMetaBase;
    gdacs?: SourceMetaBase;
  };
  elevated_risk_locations: number;
  risk_by_severity: Record<string, number>;
  risk_summary: {
    city: string;
    city_id: string;
    severity: Severity;
    score: number;
    simulated: boolean;
    lat: number;
    lon: number;
    windows: { h6: WindowSummary; h12: WindowSummary; h24: WindowSummary };
  }[];
  critical_open_incidents: number;
  incidents_awaiting_assignment: number;
  open_incidents: number;
  simulated_open_incidents: number;
  last_sync: string | null;
  simulation: SimState;
}

export interface SourceSnapshot {
  name: string;
  url: string;
  state: "ok" | "degraded" | "error" | "unknown";
  last_success: string | null;
  last_attempt: string | null;
  last_error: string | null;
  latency_ms: number | null;
  items: number | null;
  ttl_seconds: number;
}

export interface SimState {
  active: boolean;
  phase: number;
  phase_label: string;
  started_at: string | null;
  scenario_id: string | null;
  scenario_title: string | null;
  city_id: string | null;
  simulated_incident_count?: number;
  phase_definitions?: { phase: number; label: string }[];
}

export interface SystemStatus {
  sources: SourceSnapshot[];
  data_state: "live" | "cached" | "offline" | "unknown";
  last_sync: string | null;
  gemini: { configured: boolean; model: string | null };
  simulation: SimState;
  incident_counts: { total: number; by_status: Record<string, number>; simulated: number };
  locations: City[];
  response_teams: string[];
  timezone_note: string;
}

export interface BriefingSource {
  name: string;
  timestamp: string;
  description: string;
}

export interface Briefing {
  engine: string;
  headline: string;
  situation_summary: string;
  hazards_observed: string[];
  forecast_concerns: string[];
  preparedness_actions: string[];
  response_considerations: string[];
  data_gaps: string[];
  sources: BriefingSource[];
  uncertainty_note: string;
  language: string;
  generated_at: string;
}

export interface Resource {
  id: string;
  name: string;
  kind: "hospital" | "police" | "fire_station";
  kind_label: string;
  lat: number;
  lon: number;
  verified: boolean;
  source: string;
}

export interface ResourcesResponse {
  resources: Resource[];
  meta: {
    source: string;
    source_url: string;
    fetched_at: string;
    stale: boolean;
    disclaimer: string;
  };
}

export interface LocationsResponse {
  cities: City[];
  default_city: string;
}
