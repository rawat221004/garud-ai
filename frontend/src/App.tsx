/** GARUD AI application shell. */

import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppProvider } from "./state/AppContext";
import { useIncidentStream } from "./hooks/useApi";
import TopNav, { Sidebar } from "./components/layout/TopNav";

import Toasts from "./components/layout/Toasts";
import DashboardPage from "./pages/DashboardPage";





const MapPage = lazy(() => import("./pages/MapPage"));
const ForecastPage = lazy(() => import("./pages/ForecastPage"));
const IncidentsPage = lazy(() => import("./pages/IncidentsPage"));
const SystemPage = lazy(() => import("./pages/SystemPage"));

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  useIncidentStream();
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="app-shell flex flex-col" data-collapsed={collapsed}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <TopNav />
      <main id="main-content" className="min-w-0 flex-1" tabIndex={-1}>
        <Suspense fallback={<p className="workspace-page text-mute" role="status">Loading workspace…</p>}>
          <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/forecast" element={<ForecastPage />} />
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/system" element={<SystemPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="app-footer">
        <p>
          GARUD AI · Geospatial AI for Risk Understanding & Disaster Response · Team Garud Dwaar — CipherCop 2026 ·
          Data: Open-Meteo, USGS, NASA EONET, GDACS, OpenStreetMap/Overpass · basemap tiles © Esri · Prototype for situational awareness —
          not an official warning system; AI outputs are coordinator decision support only.
        </p>
      </footer>
      <Toasts />
    </div>
  );
}
