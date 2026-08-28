// Frame 1f — the map view. Two filter axes only (year and airline), per the
// map ticket: don't overload the map. Footer counts restate what is currently
// filtered so the picture stays interrogable.
import Link from "next/link";
import { supabaseServer } from "../../../lib/supabase/server";
// A "use client" component imported directly by a server component hydrates
// normally; next/dynamic here left the browser without the module.
import { RouteMap, type Airport, type Route } from "./RouteMap";

const TOP_AIRLINES = 6;

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; airline?: string }>;
}) {
  const { year, airline } = await searchParams;
  const supabase = await supabaseServer();

  let query = supabase
    .from("flights")
    .select("origin_iata, dest_iata, airline_iata, departure_date")
    .eq("status", "flown");
  if (year) query = query.gte("departure_date", `${year}-01-01`).lte("departure_date", `${year}-12-31`);
  const { data: allFlights } = await query;

  const flights = (allFlights ?? []).filter((f) => !airline || f.airline_iata === airline);

  // Airline rail is capped so it can't grow unbounded (map ticket).
  const airlineCounts = new Map<string, number>();
  for (const f of allFlights ?? []) {
    if (f.airline_iata) airlineCounts.set(f.airline_iata, (airlineCounts.get(f.airline_iata) ?? 0) + 1);
  }
  const topAirlines = [...airlineCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_AIRLINES);

  const routeCounts = new Map<string, Route>();
  for (const f of flights) {
    const key = [f.origin_iata, f.dest_iata].sort().join("-"); // a route is undirected
    const existing = routeCounts.get(key);
    if (existing) existing.count += 1;
    else routeCounts.set(key, { origin: f.origin_iata, dest: f.dest_iata, count: 1 });
  }
  const routes = [...routeCounts.values()];

  const codes = [...new Set(flights.flatMap((f) => [f.origin_iata, f.dest_iata]))];
  const { data: airportRows } = codes.length
    ? await supabase.from("airports").select("iata, name, lat, lon, iso_country").in("iata", codes)
    : { data: [] };
  const airports = (airportRows ?? []) as (Airport & { iso_country: string })[];
  const countries = new Set(airports.map((a) => a.iso_country)).size;

  const filterHref = (code: string | null) => {
    const p = new URLSearchParams();
    if (year) p.set("year", year);
    if (code) p.set("airline", code);
    const qs = p.toString();
    return qs ? `/dashboard/map?${qs}` : "/dashboard/map";
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr" }} className="split">
      <aside style={{ padding: 20, borderRight: "2px solid var(--color-text)" }}>
        <h6 style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 12 }}>
          Airline
        </h6>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <Link href={filterHref(null)} style={{ display: "flex", gap: 8, alignItems: "center", color: "inherit", textDecoration: "none" }}>
            <span style={{ width: 11, height: 11, background: !airline ? "var(--color-accent)" : "transparent", border: !airline ? "none" : "1.5px solid var(--color-neutral-500)", flex: "none" }} />
            <span style={{ font: "500 11.5px/1 var(--font-body)" }}>All airlines</span>
          </Link>
          {topAirlines.map(([code, n]) => (
            <Link key={code} href={filterHref(code)} style={{ display: "flex", gap: 8, alignItems: "center", color: "inherit", textDecoration: "none" }}>
              <span style={{ width: 11, height: 11, background: airline === code ? "var(--color-accent)" : "transparent", border: airline === code ? "none" : "1.5px solid var(--color-neutral-500)", flex: "none" }} />
              <span style={{ font: "500 11.5px/1 var(--font-body)", flex: 1 }}>{code}</span>
              <span style={{ font: "500 10.5px/1 var(--font-body)" }} className="text-muted">{n}</span>
            </Link>
          ))}
        </div>
        <p style={{ marginTop: 20, fontSize: 11 }} className="text-muted">
          Routes are drawn as great circles — the path a plane actually flies.
        </p>
      </aside>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ height: 460, position: "relative", background: "var(--color-neutral-200)" }}>
          {routes.length > 0 ? (
            <RouteMap airports={airports} routes={routes} />
          ) : (
            <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
              <p className="text-muted">No flights match this filter.</p>
            </div>
          )}
        </div>
        <div style={{ borderTop: "2px solid var(--color-text)", padding: "14px 20px", display: "flex", gap: 34, flexWrap: "wrap" }}>
          {[
            ["Airports shown", airports.length],
            ["Unique routes", routes.length],
            ["Countries", countries],
          ].map(([label, value]) => (
            <div key={label as string}>
              <div style={{ font: "700 18px/1 var(--font-heading)" }}>{(value as number).toLocaleString()}</div>
              <h6 style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginTop: 5 }}>{label}</h6>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
