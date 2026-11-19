/** Shared UI primitives (shadcn-style, hand-rolled for zero extra deps). */

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "../lib/utils";
import { SEVERITY_STYLES, STATUS_STYLES, STATUS_LABELS, URGENCY_STYLES } from "../lib/format";
import type { Severity, Urgency } from "../lib/types";

export function Card({
  title,
  icon,
  right,
  children,
  className,
  bodyClass,
}: {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={cn("panel min-w-0", className)}>
      {(title || right) && (
        <header className="section-header">
          <h2 className="section-title">
            {icon}
            {title}
          </h2>
          {right}
        </header>
      )}
      <div className={cn("p-4", bodyClass)}>{children}</div>
    </section>
  );
}

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium capitalize",
        className
      )}
    >
      {children}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const s = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.low;
  return <Badge className={s.chip}>{s.label}</Badge>;
}

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const s = URGENCY_STYLES[urgency] ?? URGENCY_STYLES.low;
  return <Badge className={s.chip}>{urgency}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge className={STATUS_STYLES[status] ?? STATUS_STYLES.reported}>{STATUS_LABELS[status] ?? status}</Badge>;
}

export function SimBadge() {
  return (
    <Badge className="bg-sim/20 text-sim border-sim/50">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-sim" />
      Simulated
    </Badge>
  );
}

export function EngineBadge({ engine }: { engine: string }) {
  const gemini = engine.startsWith("gemini");
  return (
    <Badge className={gemini ? "bg-accent/15 text-accent border-accent/40" : "bg-amber-500/15 text-fallback border-amber-500/40"}>
      {gemini ? `Gemini · ${engine.split(":")[1]}` : "Rule-based fallback"}
    </Badge>
  );
}

export function SourceTag({
  name,
  fetchedAt,
  stale,
  simulated,
}: {
  name: string;
  fetchedAt?: string | null;
  stale?: boolean;
  simulated?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-faint">
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", simulated ? "bg-sim" : stale ? "bg-elevated" : "bg-low")} />
      <span>{simulated ? "SIMULATION source" : name}</span>
      {fetchedAt && <span>· synced {new Date(fetchedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })} IST</span>}
      {stale && <Badge className="bg-elevated/15 text-elevated border-elevated/40">cached</Badge>}
    </div>
  );
}

type ButtonVariant = "primary" | "ghost" | "danger" | "success" | "sim" | "outline";

const BTN: Record<ButtonVariant, string> = {
  primary: "bg-accent/90 hover:bg-accent text-on-fill font-semibold",
  ghost: "bg-transparent hover:bg-panel2 text-ink border border-edge",
  danger: "bg-severe/90 hover:bg-severe text-on-fill font-semibold",
  success: "bg-low/90 hover:bg-low text-on-fill font-semibold",
  sim: "bg-sim/90 hover:bg-sim text-on-fill font-semibold",
  outline: "bg-transparent hover:bg-panel2 text-accent border border-accent/40",
};

export function Button({
  variant = "ghost",
  size = "md",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none",
        size === "sm" ? "min-h-8 px-2.5 py-1 text-sm" : "min-h-10 px-3.5 py-2 text-sm",
        BTN[variant],
        className
      )}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-edge2 border-t-accent", className)}
      role="status"
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-panel2", className)} />;
}

export function EmptyState({
  icon,
  text,
  hint,
  className,
}: {
  icon?: React.ReactNode;
  text: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-10 text-center", className)}>
      <div className="text-faint">{icon}</div>
      <p className="text-sm text-mute">{text}</p>
      {hint && <p className="max-w-sm text-xs text-faint">{hint}</p>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog ref={dialog} aria-labelledby={headingId} className={cn("app-dialog panel", wide ? "max-w-3xl" : "max-w-xl")}
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      {open && <>
        <header className="section-header">
          <h2 id={headingId} className="section-title">{title}</h2>
          <Button size="sm" onClick={onClose} aria-label="Close"><X size={17} /></Button>
        </header>
        <div className="p-4 sm:p-5">{children}</div>
      </>}
    </dialog>
  );
}

export function Select({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "min-h-9 rounded-md border border-edge bg-panel px-2.5 py-1.5 text-sm text-ink",
        className
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "warn" | "danger" | "good" | "sim";
}) {
  const tones: Record<string, string> = {
    default: "text-ink",
    warn: "text-elevated",
    danger: "text-severe",
    good: "text-low",
    sim: "text-sim",
  };
  return (
    <article className="panel metric">
      <p className="metric-label">{label}</p>
      <span className={cn("metric-value tabular", tones[tone])}>{value}</span>
      {icon && <span className="metric-icon" aria-hidden="true">{icon}</span>}
      {sub && <p className="metric-note">{sub}</p>}
    </article>
  );
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </header>
  );
}
