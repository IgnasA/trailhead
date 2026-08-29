// Frame 1e — the overview. Five KPI cells split by rules, per-year bars that
// double as the year picker, recent flights. No cards, no shadows: the grid
// does the containing.
import Link from "next/link";
import { supabaseServer } from "../../lib/supabase/server";
import { EmptyState, KpiCell, ReviewNotice, formatRoute } from "./ui";

export default async function Overview({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year } = await searchParams;
  const yearNum = year ? Number(year) : null;
  const supabase = await supabaseServer();

  const [{ data: stats }, { data: perYear }, { data: recent }] = await Promise.all([
    supabase.rpc("dashboard_stats", { p_year: yearNum }),
    supabase.rpc("flights_per_year"),
    // The year filter is global: the recent list has to honour it too, or the
    // page shows 2026 flights while claiming to be filtered to 2025.
    (year
      ? supabase
          .from("flights")
          .select("id, origin_iata, dest_iata, departure_date, airline_iata, flight_number, distance_km")
          .eq("status", "flown")
          .gte("departure_date", `${year}-01-01`)
          .lte("departure_date", `${year}-12-31`)
          .order("departure_date", { ascending: false })
          .limit(6)
      : supabase
          .from("flights")
          .select("id, origin_iata, dest_iata, departure_date, airline_iata, flight_number, distance_km")
          .eq("status", "flown")
          .order("departure_date", { ascending: false })
          .limit(6)),
  ]);

  const s = (stats ?? {}) as Record<string, number>;
  const years = (perYear ?? []) as { year: number; flights: number; km: number }[];
  const busiest = years.reduce((a, b) => (b.flights > (a?.flights ?? 0) ? b : a), years[0]);
  const maxFlights = Math.max(1, ...years.map((y) => y.flights));

  if (!s.flights) {
    return (
      <EmptyState
        title={year ? `No flights in ${year}.` : "No flights yet."}
        body={
          year
            ? "Pick another year, or clear the filter to see everything."
            : "Once an import finishes, your history appears here — flights, trips, countries and the map."
        }
        action={year ? { href: "/dashboard", label: "All years" } : { href: "/import", label: "Import my mailbox" }}
      />
    );
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", borderBottom: "2px solid var(--color-text)" }} className="kpi-row">
        <KpiCell value={s.flights ?? 0} label="Flights" />
        <KpiCell value={s.countries ?? 0} label="Countries" />
        <KpiCell value={s.airports ?? 0} label="Airports" />
        <KpiCell value={s.km ?? 0} label="Kilometres" compact />
        <KpiCell value={s.airlines ?? 0} label="Airlines" last />
      </div>

      <ReviewNotice count={s.needs_review ?? 0} />

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr" }} className="split">
        <section style={{ padding: "22px 24px", borderRight: "2px solid var(--color-text)" }}>
          <h6 style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 16 }}>
            Flights per year
          </h6>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 120, borderBottom: "2px solid var(--color-text)" }}>
            {years.map((y, i) => (
              <Link
                key={y.year}
                href={`/dashboard?year=${y.year}`}
                title={`${y.year}: ${y.flights} flights`}
                className="year-bar"
                style={{
                  flex: 1,
                  height: `${Math.max(4, (y.flights / maxFlights) * 100)}%`,
                  background: y.year === busiest?.year ? "var(--color-accent)" : "var(--color-neutral-300)",
                  display: "block",
                  animationDelay: `${i * 40}ms`,
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            {years.map((y) => (
              <span key={y.year} style={{ flex: 1, textAlign: "center", font: "500 10px/1 var(--font-body)", color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                {String(y.year).slice(2)}
              </span>
            ))}
          </div>
          {busiest && (
            <p style={{ marginTop: 14, fontSize: 12 }} className="text-muted">
              Busiest year: <strong style={{ color: "var(--color-text)" }}>{busiest.year}</strong> — {busiest.flights} flights,{" "}
              {busiest.km.toLocaleString()} km.
            </p>
          )}
        </section>

        <section style={{ padding: "22px 24px" }}>
          <h6 style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 14 }}>
            Recent flights
          </h6>
          <div style={{ borderTop: "1px solid var(--color-divider)" }}>
            {(recent ?? []).map((f) => (
              <Link
                key={f.id}
                href={`/dashboard/flights/${f.id}`}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 0", borderBottom: "1px solid var(--color-divider)",
                  color: "inherit", textDecoration: "none",
                }}
              >
                <div>
                  <div style={{ font: "700 12px/1 var(--font-heading)" }}>{formatRoute(f.origin_iata, f.dest_iata)}</div>
                  <div style={{ fontSize: 10.5, marginTop: 5 }} className="text-muted">
                    {f.departure_date}
                    {f.airline_iata ? ` · ${f.airline_iata}${f.flight_number ?? ""}` : ""}
                  </div>
                </div>
                <span style={{ fontSize: 11 }} className="text-muted">
                  {f.distance_km ? `${f.distance_km.toLocaleString()} km` : "—"}
                </span>
              </Link>
            ))}
          </div>
          <Link href="/dashboard/flights" className="btn btn-ghost" style={{ marginTop: 12, display: "inline-block" }}>
            All flights →
          </Link>
        </section>
      </div>
    </>
  );
}
