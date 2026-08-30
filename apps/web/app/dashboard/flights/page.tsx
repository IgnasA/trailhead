// All flights, newest first — the table pattern from the design system, with
// the door to adding one we missed at the top of it.
import Link from "next/link";
import { supabaseServer } from "../../../lib/supabase/server";
import { AddFlight } from "./AddFlight";

export default async function Flights({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year } = await searchParams;
  const supabase = await supabaseServer();
  let query = supabase
    .from("flights")
    .select("id, origin_iata, dest_iata, departure_date, airline_iata, flight_number, distance_km, confidence, needs_review")
    .order("departure_date", { ascending: false });
  if (year) query = query.gte("departure_date", `${year}-01-01`).lte("departure_date", `${year}-12-31`);
  const { data: flights } = await query;

  // The picker opens on these before a key is pressed, so they travel with the
  // page rather than costing a request. Counted across the whole history, not
  // the filtered year — the airports you fly do not change by filter.
  const [{ data: all }, { count: manualCount }] = await Promise.all([
    supabase.from("flights").select("origin_iata, dest_iata"),
    supabase.from("manual_flights").select("id", { count: "exact", head: true }),
  ]);
  const counts = new Map<string, number>();
  for (const f of all ?? []) {
    counts.set(f.origin_iata, (counts.get(f.origin_iata) ?? 0) + 1);
    counts.set(f.dest_iata, (counts.get(f.dest_iata) ?? 0) + 1);
  }
  const { data: airportRows } = counts.size
    ? await supabase.from("airports").select("iata, name, municipality").in("iata", [...counts.keys()])
    : { data: [] };
  const mine = (airportRows ?? [])
    .map((a) => ({ ...a, count: counts.get(a.iata) ?? 0 }))
    .sort((a, b) => b.count - a.count);

  return (
    <>
    <AddFlight mine={mine} count={manualCount ?? 0} />
    <div style={{ padding: "20px 24px", overflowX: "auto" }}>
      <table className="table">
        <thead>
          <tr>
            <th>Route</th>
            <th>Date</th>
            <th>Flight</th>
            <th style={{ textAlign: "right" }}>Distance</th>
            <th style={{ textAlign: "right" }}>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {(flights ?? []).map((f) => (
            <tr key={f.id}>
              <td>
                <Link href={`/dashboard/flights/${f.id}`} style={{ color: "inherit", textDecoration: "none", fontWeight: 600 }}>
                  {f.origin_iata} → {f.dest_iata}
                </Link>
                {f.needs_review && (
                  <span style={{ marginLeft: 8, font: "700 9px/1 var(--font-body)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-accent)" }}>
                    review
                  </span>
                )}
              </td>
              <td>{f.departure_date}</td>
              <td style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}>
                {f.airline_iata ? `${f.airline_iata} ${f.flight_number ?? ""}`.trim() : "—"}
              </td>
              <td style={{ textAlign: "right" }}>{f.distance_km ? `${f.distance_km.toLocaleString()} km` : "—"}</td>
              <td style={{ textAlign: "right", color: Number(f.confidence) < 0.7 ? "var(--color-accent-700)" : "inherit" }}>
                {Number(f.confidence).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(flights ?? []).length === 0 && (
        <p className="text-muted" style={{ padding: "20px 0" }}>
          No flights in this period. If we missed one, add it above.
        </p>
      )}
    </div>
    </>
  );
}
