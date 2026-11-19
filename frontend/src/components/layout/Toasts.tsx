/** Toast notifications (bottom-right). */

import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useApp } from "../../state/AppContext";
import { cn } from "../../lib/utils";

export default function Toasts() {
  const { toasts, dismiss } = useApp();
  return (
    <div className="app-toasts" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "panel fade-up flex items-start gap-2 border-l-4 px-3 py-2.5 text-sm shadow-2xl",
            t.kind === "success" && "border-l-low",
            t.kind === "error" && "border-l-severe",
            t.kind === "info" && "border-l-accent"
          )}
        >
          <span className="mt-0.5 shrink-0">
            {t.kind === "success" && <CheckCircle2 size={15} className="text-low" />}
            {t.kind === "error" && <AlertTriangle size={15} className="text-severe" />}
            {t.kind === "info" && <Info size={15} className="text-accent" />}
          </span>
          <p className="flex-1 leading-snug">{t.text}</p>
          <button onClick={() => dismiss(t.id)} className="text-faint hover:text-ink" aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
