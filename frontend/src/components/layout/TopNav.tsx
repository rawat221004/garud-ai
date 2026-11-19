import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, FlaskConical, LayoutDashboard, Map, MapPin, Moon, PanelLeftClose, Radio, RefreshCw, Shield, Siren, Sun } from "lucide-react";
import { useApp } from "../../state/AppContext";
import { useLocations, useSimulation, useSystemStatus } from "../../hooks/useApi";
import { ago } from "../../lib/format";
import { Button, Select } from "../ui";
import SimBanner from "./SimBanner";

const links = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/map", label: "Live Map", icon: Map },
  { to: "/forecast", label: "Forecast & Risk", icon: Activity },
  { to: "/incidents", label: "Incident Response", icon: Siren },
  { to: "/system", label: "System Health", icon: Radio },
];

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside className="app-sidebar">
      <Link to="/" className="brand" aria-label="GARUD AI Overview">
        <span className="brand-mark"><Shield size={21} aria-hidden="true" /></span>
        <span className="brand-wordmark">GARUD <span>AI</span><small>Disaster intelligence</small></span>
      </Link>
      <nav aria-label="Primary navigation">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink to={to} key={to} end={to === "/"} title={label} aria-label={label}>
            <Icon size={18} aria-hidden="true" /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <button className="sidebar-toggle" onClick={onToggle} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}>
        <PanelLeftClose size={18} aria-hidden="true" /><span>Collapse navigation</span>
      </button>
    </aside>
  );
}

export default function TopNav() {
  const { cityId, setCityId, theme, setTheme, toast } = useApp();
  const { pathname } = useLocation();
  const qc = useQueryClient();
  const locations = useLocations();
  const system = useSystemStatus();
  const simulation = useSimulation();
  const [refreshing, setRefreshing] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const state = system.data?.data_state ?? (system.isError ? "offline" : "unknown");
  const statusLabels = { live: "Live", cached: "Cached", offline: "Unavailable", unknown: "Checking sources" };

  async function refresh() {
    setRefreshing(true);
    try {
      await qc.invalidateQueries({}, { throwOnError: true });
      toast("success", "Data refreshed.");
    } catch {
      toast("error", "Some data could not refresh. Check System Health for details.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <header className="command-bar">
      <span className="command-context">{links.find(({ to }) => to === pathname)?.label ?? "Operations"}</span>
      <div className="command-controls">
        <div className="city-control">
          <MapPin size={15} aria-hidden="true" />
          <Select ariaLabel="Monitored city" value={cityId} onChange={setCityId}
            options={locations.data?.cities.map((c) => ({ value: c.id, label: c.name })) ?? [{ value: cityId, label: cityId }]} />
        </div>
        <Link to="/system" className="source-status" data-state={state}
          title={system.data?.last_sync ? "Last sync " + ago(system.data.last_sync) : undefined}>
          <span className="status-dot" aria-hidden="true" />{statusLabels[state]}
          {system.data?.last_sync && <span className="sync-age">{ago(system.data.last_sync)}</span>}
        </Link>
        <Button size="sm" onClick={refresh} disabled={refreshing} title="Refresh data" aria-label="Refresh data">
          <RefreshCw size={15} className={refreshing ? "animate-spin" : undefined} aria-hidden="true" />
        </Button>
        <Button size="sm" className={simulation.data?.active ? "text-sim border-sim/35" : undefined}
          onClick={() => setScenarioOpen(true)} aria-haspopup="dialog">
          <FlaskConical size={15} aria-hidden="true" />{simulation.data?.active ? "Simulation active" : "Simulation"}
        </Button>
        <Button size="sm" className="theme-switch" role="switch" aria-label="Light mode" aria-checked={theme === "light"}
          title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
          {theme === "light" ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
        </Button>
      </div>
      <SimBanner open={scenarioOpen} onClose={() => setScenarioOpen(false)} />
    </header>
  );
}
