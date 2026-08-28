// Frame 1a's map panel: a canned demo dataset, deliberately NOT a live
// MapLibre instance on the marketing page (map ticket: cost and LCP). It is
// inline SVG computed at render — no tiles, no JS, no image to ship.
import greatCircle from "@turf/great-circle";
import type { LineString, MultiLineString } from "geojson";

const W = 760;
const H = 420;

// Equirectangular, cropped to the inhabited band so the world isn't mostly
// empty ocean and ice.
const LON_MIN = -130, LON_MAX = 150, LAT_MIN = -40, LAT_MAX = 70;
const project = ([lon, lat]: number[]): [number, number] => [
  ((lon! - LON_MIN) / (LON_MAX - LON_MIN)) * W,
  H - ((lat! - LAT_MIN) / (LAT_MAX - LAT_MIN)) * H,
];

// The canonical fictional traveller from the wireframes — sample data, never
// anyone's real history.
const AIRPORTS: Record<string, [number, number]> = {
  VNO: [25.28, 54.63], FRA: [8.57, 50.03], LHR: [-0.45, 51.47], BCN: [2.08, 41.3],
  LIS: [-9.14, 38.77], KEF: [-22.6, 63.98], ATH: [23.94, 37.94], DXB: [55.36, 25.25],
  NRT: [140.39, 35.76], SIN: [103.99, 1.36], JFK: [-73.78, 40.64], BKK: [100.75, 13.69],
  MXP: [8.71, 45.63], TLV: [34.89, 32.01], CDG: [2.55, 49.01], AGP: [-4.5, 36.68],
};
const ROUTES: [string, string][] = [
  ["VNO", "FRA"], ["FRA", "NRT"], ["VNO", "BCN"], ["VNO", "LHR"], ["FRA", "JFK"],
  ["VNO", "MXP"], ["VNO", "ATH"], ["FRA", "DXB"], ["DXB", "SIN"], ["VNO", "KEF"],
  ["BCN", "LIS"], ["FRA", "BKK"], ["VNO", "TLV"], ["CDG", "AGP"], ["VNO", "CDG"],
];

function arcPath(a: [number, number], b: [number, number]): string[] {
  const arc = greatCircle(a, b, { npoints: 48 });
  const g = arc.geometry as LineString | MultiLineString;
  const parts = g.type === "LineString" ? [g.coordinates] : g.coordinates;
  return parts.map(
    (coords) => "M" + coords.map((c) => project(c).map((n) => n.toFixed(1)).join(",")).join("L"),
  );
}

export function LandingTeaser() {
  const paths = ROUTES.flatMap(([from, to]) => arcPath(AIRPORTS[from]!, AIRPORTS[to]!));
  const dots = Object.entries(AIRPORTS).map(([code, coords]) => ({ code, p: project(coords) }));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      role="img"
      aria-label="Sample route map showing flights between airports across Europe, Asia and the Americas"
      style={{ display: "block", width: "100%", height: "100%", background: "var(--color-neutral-200)" }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Graticule — enough structure to read as a map without a basemap. */}
      {[-120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((lon) => (
        <line key={`m${lon}`} x1={project([lon, LAT_MIN])[0]} y1={0} x2={project([lon, LAT_MIN])[0]} y2={H}
          stroke="var(--color-neutral-300)" strokeWidth={0.5} />
      ))}
      {[-30, 0, 30, 60].map((lat) => (
        <line key={`p${lat}`} x1={0} y1={project([LON_MIN, lat])[1]} x2={W} y2={project([LON_MIN, lat])[1]}
          stroke="var(--color-neutral-300)" strokeWidth={0.5} />
      ))}
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--color-accent)" strokeWidth={1.1} opacity={0.65} />
      ))}
      {dots.map(({ code, p }) => (
        <circle key={code} cx={p[0]} cy={p[1]} r={2.6} fill="var(--color-text)" />
      ))}
    </svg>
  );
}
