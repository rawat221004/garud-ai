/** AI Situation Briefing panel (Gemini or rule-based fallback, honestly labelled). */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Brain, Copy, Sparkles } from "lucide-react";
import { fetchBriefing, useSimulation } from "../../hooks/useApi";
import { useApp } from "../../state/AppContext";
import { Button, Card, EngineBadge, Select, Spinner } from "../ui";
import { fmtISTLong } from "../../lib/format";
import type { Briefing } from "../../lib/types";

type Lang = "en" | "hi" | "te";

export default function AiBriefingPanel({ cityId, cityName }: { cityId: string; cityName: string }) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [language, setLanguage] = useState<Lang>("en");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useApp();
  const { data: simulation } = useSimulation();
  const context = JSON.stringify([cityId, language, simulation?.active, simulation?.phase, simulation?.started_at]);
  const [briefingContext, setBriefingContext] = useState("");
  const currentBriefing = briefingContext === context ? briefing : null;
  const qc = useQueryClient();

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const b = await fetchBriefing(cityId, language);
      setBriefing(b);
      setBriefingContext(context);
      const engine = b.engine.startsWith("gemini") ? `Gemini (${b.engine.split(":")[1]})` : "rule-based fallback";
      toast("success", `Situation brief generated — ${engine}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Briefing generation failed.");
    } finally {
      setLoading(false);
      qc.invalidateQueries({ queryKey: ["system"] });
    }
  };

  async function copyBrief(value: Briefing) {
    const sections: [string, string[]][] = [
      ["Hazards observed", value.hazards_observed], ["Forecast concerns", value.forecast_concerns],
      ["Preparedness actions", value.preparedness_actions], ["Response considerations", value.response_considerations],
      ["Known data gaps", value.data_gaps], ["Sources", value.sources.map((source) => [source.name, source.timestamp, source.description].filter(Boolean).join(" · "))],
    ];
    const provenance = simulation?.active && simulation.city_id === cityId ? "Includes simulated context" : "";
    const text = [value.headline, value.situation_summary, [value.engine, value.generated_at, provenance].filter(Boolean).join(" · "),
      ...sections.filter(([, items]) => items.length).map(([label, items]) => [label, ...items].join("\n")),
      value.uncertainty_note, "For coordinator review."].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      toast("success", "Situation brief copied.");
    } catch {
      toast("error", "Clipboard unavailable. Select and copy the briefing text.");
    }
  }

  return (
    <Card
      title="AI situation brief"
      icon={<Brain size={13} />}
      right={
        <div className="flex items-center gap-2">
          <Select
            ariaLabel="Briefing language"
            value={language}
            onChange={(v) => setLanguage(v as Lang)}
            options={[
              { value: "en", label: "English" },
              { value: "hi", label: "हिन्दी" },
              { value: "te", label: "తెలుగు" },
            ]}
          />
          <Button variant="primary" size="sm" onClick={generate} disabled={loading}>
            {loading ? <Spinner className="h-3 w-3 border-on-fill/40 border-t-on-fill" /> : <Sparkles size={13} />}
            {currentBriefing ? "Regenerate brief" : "Generate brief"}
          </Button>
        </div>
      }
      bodyClass="p-4 pt-3"
    >
      {!currentBriefing && !loading && (
        <p className="text-sm text-mute">Generate a source-cited briefing for {cityName} with forecast concerns, preparedness actions and known data gaps. For coordinator review.</p>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-6 text-sm text-mute" role="status">
          <Spinner /> Collecting context and drafting the brief…
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-severe/40 bg-severe/10 p-2.5 text-xs text-severe">{error}</p>
      )}

      {currentBriefing && !loading && (
        <div className="space-y-4" lang={currentBriefing.language}>
          <div className="flex flex-wrap items-center gap-2">
            <EngineBadge engine={currentBriefing.engine} />
            {simulation?.active && simulation.city_id === cityId && <span className="font-medium text-sim">Includes simulated context</span>}
            <Button className="ml-auto" size="sm" onClick={() => copyBrief(currentBriefing)}><Copy size={14} /> Copy brief</Button>
            {currentBriefing.generated_at && <span className="text-xs text-faint">{fmtISTLong(currentBriefing.generated_at)}</span>}
          </div>
          <h3 className="text-lg font-semibold leading-snug text-ink">{currentBriefing.headline}</h3>
          <p className="text-sm leading-relaxed text-mute">{currentBriefing.situation_summary}</p>

          <Section title="Hazards observed" items={currentBriefing.hazards_observed} />
          <Section title="Forecast concerns" items={currentBriefing.forecast_concerns} />
          <Section title="Preparedness actions" items={currentBriefing.preparedness_actions} />
          <Section title="Response considerations" items={currentBriefing.response_considerations} />
          <Section title="Known data gaps" items={currentBriefing.data_gaps} tone="elevated" />

          {currentBriefing.sources?.length > 0 && (
            <details className="disclosure rounded-md bg-panel2">
              <summary>Sources and timestamps</summary>
              <ul className="space-y-1 px-4 pb-4">
                {currentBriefing.sources.map((s, i) => (
                  <li key={i} className="text-sm text-mute">
                    <span className="font-semibold text-ink">{s.name}</span>
                    {s.timestamp && <span className="text-faint">· {s.timestamp.slice(0, 16).replace("T", " ")} UTC</span>}
                    {s.description && <span className="text-faint">· {s.description}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {currentBriefing.uncertainty_note && (
            <p className="rounded-lg border border-elevated/30 bg-elevated/5 p-2 text-xs leading-relaxed text-elevated">
              ⚠︎ {currentBriefing.uncertainty_note}
            </p>
          )}

          {currentBriefing.engine.startsWith("gemini") && language !== "en" && (
            <SimBadgeExtra note={`Requested language: ${language.toUpperCase()} — Gemini output shown as delivered by the model.`} />
          )}
        </div>
      )}
    </Card>
  );
}

function Section({ title, items, tone }: { title: string; items: string[]; tone?: string }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-ink">{title}</p>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs leading-relaxed text-mute">
            <span className={`mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full ${tone === "elevated" ? "bg-elevated" : "bg-accent"}`} />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SimBadgeExtra({ note }: { note: string }) {
  return <p className="text-xs text-faint">{note}</p>;
}
