/** Feature B: Forecast & Risk workspace for the selected city. */

import { Activity, Gauge } from "lucide-react";
import { useApp } from "../state/AppContext";
import { useRiskAll, useLocations, useWeather } from "../hooks/useApi";
import WeatherChart from "../components/dashboard/WeatherChart";
import AiBriefingPanel from "../components/dashboard/AiBriefingPanel";
import { Badge, Card, EmptyState, PageHeader, SeverityBadge, SimBadge, Skeleton, SourceTag } from "../components/ui";
import { FLAG_LABELS, hexSeverity, num } from "../lib/format";
import type { RiskAssessment } from "../lib/types";

const factorLabels: Record<string, string> = {
  rain_accumulation_24h: "24-hour rainfall", rain_intensity_max: "Peak hourly rainfall", wind_gust_max: "Peak wind gust",
};

export default function ForecastPage() {
  const { cityId, setCityId } = useApp();
  const locations = useLocations();
  const { data: allRisks } = useRiskAll();
  const weather = useWeather(cityId);
  const risk: RiskAssessment | null | undefined = weather.data?.risk;

  if (weather.isLoading) {
    return (
      <div className="workspace-page space-y-4">
        <PageHeader title="Forecast & Risk" />
        <Skeleton className="h-28" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const cityName = weather.data?.city.name ?? locations.data?.cities.find((city) => city.id === cityId)?.name ?? cityId;

  return (
    <div className="workspace-page space-y-4">
      <PageHeader title="Forecast & Risk" description={cityName + " · Weather outlook and experimental risk assessment"} />
      <div className="forecast-layout">
        {risk ? (
          <div>
            <Card
              title="24-hour risk outlook"
              icon={<Gauge size={13} />}
              right={
                <div className="flex items-center gap-1.5">
                  {risk.simulated && <SimBadge />}

                </div>
              }
              bodyClass="p-4 pt-3"
            >
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <SeverityBadge severity={risk.severity} />
                  <p className="tabular mt-1.5 text-3xl font-extrabold text-ink">
                    {risk.score}
                    <span className="text-sm font-normal text-faint">/100 experimental score</span>
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-mute">
                    The highest forecast factor sets the risk band.
                    {risk.simulated && " Input is SIMULATED scenario data."}
                  </p>
                  {risk.flags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {risk.flags.map((f) => (
                        <Badge key={f} className="bg-accent/10 text-accent border-accent/30">
                          {FLAG_LABELS[f] ?? f}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {weather.data && <div className="mt-3"><SourceTag name={weather.data.source} fetchedAt={weather.data.fetched_at} stale={weather.data.stale} simulated={weather.data.simulated} /></div>}
              {/* windows */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                {(["h6", "h12", "h24"] as const).map((w) => {
                  const label = w === "h6" ? "Next 6 h" : w === "h12" ? "Next 12 h" : "Next 24 h";
                  return (
                    <div key={w} className="rounded-lg border border-edge bg-panel2 p-2.5 text-center">
                      <p className="text-xs font-semibold text-faint">{label}</p>
                      <p className="tabular mt-1 text-lg font-bold text-ink">
                        {risk.windows[w].rain_mm}
                        <span className="text-xs font-normal text-faint"> mm rain</span>
                      </p>
                      <p className="tabular text-xs text-mute">
                        prob ≤ {risk.windows[w].rain_prob_max}% · gust ≤ {risk.windows[w].gust_max} km/h
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-faint">Experimental estimate of rainfall and gust potential. Use alongside local observations and official advisories.</p>
            </Card>
          </div>
        ) : <Card title="Risk assessment"><EmptyState text="Risk assessment is unavailable." /></Card>}
        <WeatherChart weather={weather.data} loading={weather.isLoading} />
      </div>

      {risk && <div className="forecast-details">
          <div>
            <Card
              title="Risk drivers"
              icon={<Activity size={13} />}
              bodyClass="p-4 pt-3 space-y-4"
            >
              {risk.factors.map((f) => (
                <div key={f.name} className="border-b border-edge pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-ink">
                      {factorLabels[f.name] ?? f.name} <span className="font-normal text-faint">· weight {Math.round(f.weight * 100)}%</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="tabular text-xs text-mute">
                        {f.value ?? "—"} {f.unit}
                      </span>
                      <SeverityBadge severity={f.severity} />
                    </div>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-edge">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${f.points * f.weight}%`, background: hexSeverity(f.severity) }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-mute">{f.explanation}</p>

                </div>
              ))}
              <details className="disclosure rounded-md bg-panel2">
                <summary>Risk methodology</summary>
                <div className="space-y-2 px-4 pb-4">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-faint">
                  Severity scale (experimental heuristics, require local calibration)
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-faint">
                        <th className="py-1 pr-2 font-semibold">Factor</th>
                        <th className="py-1 pr-2 font-semibold">Low</th>
                        <th className="py-1 pr-2 font-semibold">Elevated</th>
                        <th className="py-1 pr-2 font-semibold">High</th>
                        <th className="py-1 font-semibold">Severe</th>
                      </tr>
                    </thead>
                    <tbody className="text-mute">
                      {(["rain_accumulation_24h", "rain_intensity_max", "wind_gust_max"] as const).map((k) => {
                        const doc = risk.thresholds_doc?.[k];
                        if (!doc) return null;
                        return (
                          <tr key={k} className="border-t border-edge/60">
                            <td className="py-1 pr-2">{factorLabels[k]}</td>
                            <td className="py-1 pr-2">{doc.bands?.low}</td>
                            <td className="py-1 pr-2">{doc.bands?.elevated}</td>
                            <td className="py-1 pr-2">{doc.bands?.high}</td>
                            <td className="py-1">{doc.bands?.severe}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1.5 text-xs text-faint">{risk.thresholds_doc?.score}</p>
                <p className="text-xs text-faint">{risk.thresholds_doc?.overall_severity}</p>
                <p className="text-xs text-faint">Model · {risk.model}</p>
                <p className="text-xs text-faint">{risk.disclaimer}</p>
                <ul className="text-xs text-faint">{risk.factors.map((factor) => <li key={factor.name}>{factorLabels[factor.name] ?? factor.name} · {factor.threshold_note}</li>)}</ul>
                </div>
              </details>
              <p className="text-xs leading-relaxed text-faint">
                Heavy-rain potential ≠ confirmed flooding. This indicator estimates meteorological hazard potential
                from forecast fields; observed flooding, damage and casualties only enter the system through real
                incident reports.
              </p>
            </Card>
          </div>
        <Card title="Preparedness">
        <p className="text-sm text-mute">{risk.severity === "high" || risk.severity === "severe"
          ? "Review local weather advisories, confirm team availability and check access routes in forecast-affected areas."
          : "Continue monitoring weather advisories and review readiness as the forecast changes."} Forecast risk estimates potential conditions.</p>
        </Card>
      </div>}

      {/* all-city comparison strip */}
      {allRisks && allRisks.assessments.length > 0 && (
        <Card title="Monitored cities — 24-h outlook" icon={<Activity size={13} />} bodyClass="p-3">
          <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3 lg:grid-cols-5">
            {allRisks.assessments.map((a) => (
              <div key={a.city_id ?? a.city} className="border-b border-edge px-1 py-2">
                <div className="flex items-center justify-between">
                  <button disabled={!a.city_id} onClick={() => { if (a.city_id) setCityId(a.city_id); }} className="text-left text-sm font-semibold text-accent hover:underline" aria-pressed={a.city_id === cityId}>{a.city}</button>
                  {a.simulated && <span className="text-xs text-sim">Simulated</span>}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <SeverityBadge severity={a.severity} />
                  <span className="tabular text-xs text-faint">{num(a.score, 0)}</span>
                </div>
                <p className="tabular mt-1 text-xs text-faint">
                  24h: {a.windows.h24.rain_mm} mm · gust {a.windows.h24.gust_max} km/h
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <AiBriefingPanel key={cityId} cityId={cityId} cityName={cityName} />
    </div>
  );
}
