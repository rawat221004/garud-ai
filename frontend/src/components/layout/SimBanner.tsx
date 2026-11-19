import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FlaskConical, RotateCcw, StepForward } from "lucide-react";
import { useSimulation } from "../../hooks/useApi";
import { apiPost } from "../../lib/api";
import type { SimState } from "../../lib/types";
import { useApp } from "../../state/AppContext";
import { Button, Modal } from "../ui";

export default function SimBanner({ open, onClose }: { open: boolean; onClose: () => void }) {
  const simulation = useSimulation();
  const sim = simulation.data;
  const qc = useQueryClient();
  const { toast, setCityId } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function change(action: "start" | "advance" | "reset") {
    if (action === "reset" && !window.confirm("Reset this scenario and delete its fictional reports?")) return;
    setBusy(true);
    setError("");
    try {
      const next = await apiPost<SimState>("/api/simulation/" + action);
      await qc.cancelQueries({ queryKey: ["simulation"] });
      qc.setQueryData<SimState>(["simulation"], (previous) => ({ ...previous, ...next }));
      if (action === "start" && next.city_id) setCityId(next.city_id);
      void qc.invalidateQueries({ predicate: ({ queryKey }) =>
        ["simulation", "system", "incident", "incidents", "timeline", "weather", "risk", "overview"].includes(String(queryKey[0])),
      }, { cancelRefetch: false });
      toast("success", action === "reset" ? "Scenario reset." : action === "start" ? "Hyderabad scenario started." : "Scenario advanced.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update the scenario.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Simulation controls">
      <div className="space-y-4" aria-live="polite">
        <div>
          <p className="text-sm font-medium text-sim">{sim?.active ? "Simulation active" : "Training scenario"}</p>
          <h3 className="mt-1 text-lg font-semibold">{sim?.scenario_title ?? "Extreme Rainfall & Urban Flood Response — Hyderabad"}</h3>
          <p className="mt-2 text-sm text-mute">The scenario uses fictional rainfall, forecast risk and incident reports. Affected data carries a Simulated label.</p>
        </div>
        {sim?.active && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Phase {sim.phase} of 3 · {sim.phase_label}</p>
            <progress className="scenario-progress" max={3} value={sim.phase} aria-label="Scenario progress" />
          </div>
        )}
        {error && <p role="alert" className="text-sm text-severe">{error}</p>}
        {simulation.isError && <p role="alert" className="text-sm text-severe">Scenario status unavailable.</p>}
        <div className="flex flex-wrap gap-2">
          {sim?.active ? (
            <>
              <Button variant="primary" disabled={busy || sim.phase >= 3} onClick={() => change("advance")}><StepForward size={15} /> Advance scenario</Button>
              <Button disabled={busy} onClick={() => change("reset")}><RotateCcw size={15} /> Reset scenario</Button>
            </>
          ) : (
            <Button variant="primary" disabled={busy || !sim} onClick={() => change("start")}><FlaskConical size={15} /> Start scenario</Button>
          )}
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}
