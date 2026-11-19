import { SEVERITY_STYLES, URGENCY_STYLES } from "../../lib/format";

export default function MapLegend() {
  return (
    <details className="disclosure map-legend">
      <summary>Map legend</summary>
      <div className="flex flex-wrap gap-x-5 gap-y-2 px-4 pb-4 text-xs text-mute">
        <Key color="#c1acfb">Earthquake (magnitude)</Key>
        <Key color="#f43f5e">NASA EONET (E)</Key>
        <Key color="#f59e0b">GDACS (G)</Key>
        <Key color={URGENCY_STYLES.critical.hex}>Incident report (urgency)</Key>
        <Key color={SEVERITY_STYLES.low.hex} square>City forecast risk (L, E, H, S)</Key>
        <Key color="#34d399" square>Mapped facility (H hospital, P police, F fire)</Key>
        <p className="basis-full text-faint">FL flood · ST storm · WF wildfire. Purple S badge marks simulated data or a cluster containing simulated reports. Forecast markers show city-level estimates. OpenStreetMap facility listings are unverified.</p>
      </div>
    </details>
  );
}

function Key({ color, square, children }: { color: string; square?: boolean; children: string }) {
  return <span className="inline-flex items-center gap-2"><span style={{ background: color }} aria-hidden="true"
    className={"h-2.5 w-2.5 " + (square ? "rounded-xs" : "rounded-full")} />{children}</span>;
}
