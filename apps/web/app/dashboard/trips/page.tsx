// Frame 1g — trips are derived, so each row shows its derivation: the
// airport chain with the destination in red. Flights the clustering declined
// to place appear as reviewable rows with the reason, never forced into a trip.
import Link from "next/link";
import { haversineKm } from "@trailhead/domain";
import { supabaseServer } from "../../../lib/supabase/server";
import { EmptyState } from "../ui";

interface Flight {
  id: string;
  origin_iata: string;
  dest_iata: string;
  departure_date: string;
  distance_km: number | null;
  trip_id: string | null;
  needs_review: boolean;
  review_reason: string | null;
}

/** Legs flown on the same day sort arbitrarily by date alone, which breaks
 *  the chain (VNO→STN→ACE reads as STN→ACE→STN). Walk the connections
 *  instead: start where nothing arrives, then follow each arrival onward. */
function orderLegs(legs: Flight[], startCode?: string): Flight[] {
  const remaining = [...legs].sort((a, b) => a.departure_date.localeCompare(b.departure_date));
  const arrivals = new Set(legs.map((f) => f.dest_iata));
  // A round trip is a closed loop, so no origin is missing from arrivals —
  // anchor on the trip's own start airport in that case.
  const headIndex = startCode
    ? remaining.findIndex((f) => f.origin_iata === startCode)
    : remaining.findIndex((f) => !arrivals.has(f.origin_iata));
  const ordered: Flight[] = [];
  let current = remaining.splice(headIndex === -1 ? 0 : headIndex, 1)[0];
  while (current) {
    ordered.push(current);
    const next = remaining.findIndex((f) => f.origin_iata === current!.dest_iata);
    current = remaining.splice(next === -1 ? 0 : next, 1)[0];
  }
  return ordered;
}

type Coords = Record<string, { lat: number; lon: number }>;

function Chain({
  flights: unordered, startCode, coords,
}: {
  flights: Flight[]; startCode?: string; coords: Coords;
}) {
  const flights = orderLegs(unordered, startCode);
  const stops = [flights[0]!.origin_iata, ...flights.map((f) => f.dest_iata)];
  // The destination is the stop farthest from home — the reason you went —
  // not the end of the longest single leg (which is usually the flight back).
  const home = coords[stops[0]!];
  let destination = stops[1] ?? stops[0]!;
  let best = -1;
  for (const code of stops.slice(1)) {
    const c = coords[code];
    const d = home && c ? haversineKm(home.lat, home.lon, c.lat, c.lon) : 0;
    if (d > best) { best = d; destination = code; }
  }
  return (
    <div style={{ display: "flex", alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
      {stops.map((code, i) => (
        <span key={`${code}-${i}`} style={{ display: "contents" }}>
          <span
            style={{
              font: "600 11px/1 ui-monospace, Menlo, monospace",
              color: code === destination ? "var(--color-accent)" : "inherit",
            }}
          >
            {code}
          </span>
          {i < stops.length - 1 && (
            <span style={{ flex: 1, minWidth: 16, height: 2, background: "var(--color-text)", margin: "0 7px" }} />
          )}
        </span>
      ))}
    </div>
  );
}

export default async function Trips({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year } = await searchParams;
  const supabase = await supabaseServer();

  const [{ data: trips }, { data: flights }] = await Promise.all([
    supabase.from("trips").select("id, title, start_date, end_date").order("start_date", { ascending: false }),
    supabase
      .from("flights")
      .select("id, origin_iata, dest_iata, departure_date, distance_km, trip_id, needs_review, review_reason")
      .order("departure_date", { ascending: true }),
  ]);

  // Fetch only the airports these flights touch: an unfiltered select is
  // capped at 1000 rows, which silently left most stops without coordinates.
  const codes = [...new Set((flights ?? []).flatMap((f) => [f.origin_iata, f.dest_iata]))];
  const { data: airports } = codes.length
    ? await supabase.from("airports").select("iata, lat, lon").in("iata", codes)
    : { data: [] };
  const coords: Coords = Object.fromEntries(
    (airports ?? []).map((a) => [a.iata as string, { lat: a.lat as number, lon: a.lon as number }]),
  );

  const all = (flights ?? []) as Flight[];
  const inYear = (d: string) => !year || d.startsWith(year);
  const byTrip = new Map<string, Flight[]>();
  for (const f of all) if (f.trip_id) byTrip.set(f.trip_id, [...(byTrip.get(f.trip_id) ?? []), f]);
  const unassigned = all.filter((f) => !f.trip_id && inYear(f.departure_date)).reverse();
  const shownTrips = (trips ?? []).filter((t) => inYear(t.start_date));

  // Group by year like the wireframe's "2025 — 29 flights · 11 trips · 74,821 km"
  const years = [...new Set(shownTrips.map((t) => t.start_date.slice(0, 4)))];

  if (shownTrips.length === 0 && unassigned.length === 0) {
    return (
      <EmptyState
        title={year ? `No trips in ${year}.` : "No trips yet."}
        body="Trips are reconstructed from your flights — once there are flights that chain together, they appear here."
        action={year ? { href: "/dashboard/trips", label: "All years" } : { href: "/import", label: "Import my mailbox" }}
      />
    );
  }

  return (
    <div style={{ padding: "20px 24px", maxWidth: 860 }}>
      {years.map((y) => {
        const yearTrips = shownTrips.filter((t) => t.start_date.startsWith(y));
        const yearFlights = all.filter((f) => f.departure_date.startsWith(y));
        const km = yearFlights.reduce((n, f) => n + (f.distance_km ?? 0), 0);
        return (
          <section key={y} style={{ marginBottom: 34 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ margin: 0 }}>{y}</h2>
              <span style={{ font: "600 11px/1 var(--font-body)" }} className="text-muted">
                {yearFlights.length} flights · {yearTrips.length} trip{yearTrips.length === 1 ? "" : "s"} · {km.toLocaleString()} km
              </span>
            </div>
            <div style={{ borderTop: "2px solid var(--color-text)" }}>
              {yearTrips.map((t) => {
                const legs = (byTrip.get(t.id) ?? []).sort((a, b) => a.departure_date.localeCompare(b.departure_date));
                if (legs.length === 0) return null;
                return (
                  <div key={t.id} style={{ padding: "16px 0", borderBottom: "1px solid var(--color-divider)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ font: "700 15px/1.2 var(--font-heading)" }}>{t.title}</div>
                      <div style={{ font: "600 11px/1 var(--font-body)" }} className="text-muted">
                        {t.start_date} – {t.end_date} · {legs.length} flight{legs.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    <Chain flights={legs} startCode={t.title.split(" → ")[0]} coords={coords} />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {unassigned.length > 0 && (
        <section>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
            <h2 style={{ margin: 0 }}>Needs review</h2>
            <span style={{ font: "600 11px/1 var(--font-body)" }} className="text-muted">
              {unassigned.length} flight{unassigned.length === 1 ? "" : "s"}
            </span>
          </div>
          <p style={{ maxWidth: "44em", fontSize: 13, marginBottom: 14 }} className="text-muted">
            These are real flights we couldn&rsquo;t confidently place in a trip — usually
            a leg whose partner never appeared in your mailbox. Rather than invent a trip
            around them, we left them here.
          </p>
          <div style={{ borderTop: "2px solid var(--color-text)" }}>
            {unassigned.map((f) => (
              <Link
                key={f.id}
                href={`/dashboard/flights/${f.id}`}
                style={{
                  display: "block", padding: "14px 12px", borderBottom: "1px solid var(--color-divider)",
                  background: "var(--color-neutral-200)", color: "inherit", textDecoration: "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ font: "700 15px/1.2 var(--font-heading)", color: "color-mix(in srgb, var(--color-text) 75%, transparent)" }}>
                    {f.origin_iata} → {f.dest_iata}
                  </div>
                  <span style={{ padding: "4px 8px", border: "1px solid var(--color-accent)", color: "var(--color-accent)", font: "700 9.5px/1 var(--font-body)", letterSpacing: ".08em", textTransform: "uppercase" }}>
                    Needs review
                  </span>
                </div>
                <div style={{ font: "400 11.5px/1.5 var(--font-body)", marginTop: 8 }} className="text-muted">
                  {f.departure_date} — {f.review_reason ?? "No trip could be reconstructed."}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
