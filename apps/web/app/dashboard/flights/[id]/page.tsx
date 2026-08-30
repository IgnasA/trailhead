// Frame 1h — flight detail. Provenance ships here, not later: which emails
// this flight was merged from, which extraction version, what confidence.
// Absent fields say "not found in source" rather than showing an empty row.
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "../../../../lib/supabase/server";
import { ManualFlightActions, type ManualRow } from "./ManualFlightActions";
import { formatLocal } from "../../ui";
import { SourceEmail } from "./SourceEmail";
import { Corrections } from "./Corrections";

interface SourceRow {
  id: string;
  subject: string | null;
  email_type: string;
  received_at: string | null;
}
interface ExtractionRow {
  id: string;
  tier: string;
  extraction_version: number;
  source_emails: SourceRow | SourceRow[] | null;
}
/** PostgREST returns embedded rows as an object or an array depending on the
 *  relationship it infers — normalize both shapes. */
const many = <T,>(v: T | T[] | null | undefined): T[] =>
  v == null ? [] : Array.isArray(v) ? v : [v];

function Row({ label, value, missing = "not found in source" }: {
  label: string; value: React.ReactNode;
  /** Why the value is absent. "Not found in source" is a claim about an email;
   *  on a flight someone typed there was never a source to search. */
  missing?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 0", borderBottom: "1px solid var(--color-divider)", font: "500 12px/1.4 var(--font-body)" }}>
      <span className="text-muted">{label}</span>
      <span style={{ fontWeight: 600, textAlign: "right" }}>
        {value ?? <span style={{ color: "color-mix(in srgb, var(--color-text) 45%, transparent)", fontWeight: 500 }}>{missing}</span>}
      </span>
    </div>
  );
}

export default async function FlightDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data: flight } = await supabase
    .from("flights")
    .select("*, trips(id, title)")
    .eq("id", id)
    .maybeSingle();
  if (!flight) notFound();

  // On a typed flight there was no source to search, so saying a field was
  // "not found in source" would be describing an email that never existed.
  const absent = flight.source === "manual" ? "you didn't say" : "not found in source";

  // A derived flight carries no pointer to the manual_flights row behind it —
  // the merge folds them — so the row is found by the same identity the merge
  // used: where you said you flew, and when. Also the picker's own-airports
  // list, for the edit form.
  let manualRow: ManualRow | null = null;
  let mineAirports: { iata: string; name: string; municipality: string | null; count: number }[] = [];
  if (flight.source === "manual") {
    const [{ data: mr }, { data: all }] = await Promise.all([
      supabase
        .from("manual_flights")
        .select("id, origin_iata, dest_iata, departure_date, airline_iata, flight_number, dep_local_time, arr_local_time, booking_ref")
        .eq("origin_iata", flight.origin_iata)
        .eq("dest_iata", flight.dest_iata)
        .eq("departure_date", flight.departure_date)
        .limit(1)
        .maybeSingle(),
      supabase.from("flights").select("origin_iata, dest_iata"),
    ]);
    manualRow = (mr as ManualRow | null) ?? null;
    if (manualRow) {
      manualRow.dep_local_time = manualRow.dep_local_time?.slice(0, 5) ?? null;
      manualRow.arr_local_time = manualRow.arr_local_time?.slice(0, 5) ?? null;
      const counts = new Map<string, number>();
      for (const f of all ?? []) {
        counts.set(f.origin_iata, (counts.get(f.origin_iata) ?? 0) + 1);
        counts.set(f.dest_iata, (counts.get(f.dest_iata) ?? 0) + 1);
      }
      const { data: airportRows } = await supabase
        .from("airports").select("iata, name, municipality").in("iata", [...counts.keys()]);
      mineAirports = (airportRows ?? [])
        .map((a) => ({ ...a, count: counts.get(a.iata) ?? 0 }))
        .sort((a, b) => b.count - a.count);
    }
  }

  const { data: links } = await supabase
    .from("flight_sources")
    .select("email_extractions(id, tier, extraction_version, payload, source_emails(id, subject, email_type, received_at))")
    .eq("flight_id", id);

  const extractions = (links ?? []).flatMap((l) =>
    many((l as unknown as { email_extractions: ExtractionRow | ExtractionRow[] | null }).email_extractions),
  );
  const uniqueSources = [
    ...new Map(extractions.flatMap((e) => many(e.source_emails)).map((s) => [s.id, s])).values(),
  ];
  const bestTier = extractions.some((e) => e.tier === "schema_org")
    ? "schema_org"
    : extractions.some((e) => e.tier === "kitinerary") ? "kitinerary" : "llm";

  const highlights = [
    flight.flight_number, flight.origin_iata, flight.dest_iata, flight.booking_ref,
    flight.airline_iata && flight.flight_number ? `${flight.airline_iata}${flight.flight_number}` : null,
    flight.airline_iata && flight.flight_number ? `${flight.airline_iata} ${flight.flight_number}` : null,
    flight.price_amount ? String(flight.price_amount) : null,
  ].filter((x): x is string => Boolean(x));

  return (
    <div>
      <div style={{ padding: "14px 24px", borderBottom: "2px solid var(--color-text)" }}>
        <Link href="/dashboard/flights" className="btn btn-ghost" style={{ padding: 0 }}>← Back to flights</Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }} className="split">
        <section style={{ padding: "26px 24px", borderRight: "2px solid var(--color-text)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>{flight.origin_iata} → {flight.dest_iata}</h2>
            {flight.airline_iata && (
              <span style={{ padding: "4px 8px", background: "var(--color-text)", color: "var(--color-bg)", font: "700 9.5px/1 var(--font-body)", letterSpacing: ".08em" }}>
                {flight.airline_iata} {flight.flight_number ?? ""}
              </span>
            )}
            {flight.needs_review && (
              <span style={{ padding: "4px 8px", border: "1px solid var(--color-accent)", color: "var(--color-accent)", font: "700 9.5px/1 var(--font-body)", letterSpacing: ".08em", textTransform: "uppercase" }}>
                Needs review
              </span>
            )}
          </div>
          <p style={{ font: "500 13px/1 var(--font-body)", marginTop: 10 }} className="text-muted">
            {flight.departure_date}
            {flight.distance_km ? ` · ${flight.distance_km.toLocaleString()} km` : ""}
            {flight.trips ? " · " : ""}
            {flight.trips && (
              <Link href="/dashboard/trips" style={{ color: "var(--color-accent)" }}>
                {(flight.trips as { title: string }).title}
              </Link>
            )}
          </p>
          {flight.needs_review && flight.review_reason && (
            <p style={{ marginTop: 12, padding: "10px 12px", borderLeft: "2px solid var(--color-accent)", background: "var(--color-accent-100)", fontSize: 12.5 }}>
              {flight.review_reason}
            </p>
          )}

          <div style={{ marginTop: 22, borderTop: "2px solid var(--color-text)" }}>
            <Row label="Departs" value={formatLocal(flight.dep_local, flight.dep_tz)} missing={absent} />
            <Row label="Arrives" value={formatLocal(flight.arr_local, flight.arr_tz)} missing={absent} />
            <Row label="Booking ref" value={flight.booking_ref ? <code style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{flight.booking_ref}</code> : null} missing={absent} />
            <Row label="Price" value={flight.price_amount ? `${flight.price_currency ?? ""} ${flight.price_amount}`.trim() : null} missing={absent} />
            <Row label="Seat" value={null} missing={absent} />
          </div>

          {/* A flight someone typed has no tier, no version worth showing and
              no confidence to report: we did not assess them, they were there.
              Saying "1.00 confidence, llm tier" would be a small lie told in
              precise-looking type. */}
          {flight.source === "manual" ? (
            <div style={{ marginTop: 22, background: "var(--color-neutral-200)", borderLeft: "2px solid var(--color-accent)", padding: "14px 16px" }}>
              <h6 style={{ color: "var(--color-accent)", marginBottom: 9 }}>Provenance</h6>
              <p style={{ fontSize: 12.5, margin: 0 }}>
                You added this flight yourself.
                {uniqueSources.length > 0 && (
                  <> A later import found {uniqueSources.length} email{uniqueSources.length === 1 ? "" : "s"} that
                  match it; where they disagreed with you, we kept your version.</>
                )}
              </p>
              {manualRow && (
                <ManualFlightActions
                  manual={manualRow}
                  mine={mineAirports}
                  corroborated={uniqueSources.length > 0}
                />
              )}
            </div>
          ) : (
          <div style={{ marginTop: 22, background: "var(--color-neutral-200)", borderLeft: "2px solid var(--color-accent)", padding: "14px 16px" }}>
            <h6 style={{ color: "var(--color-accent)", marginBottom: 11 }}>Provenance</h6>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, font: "500 11px/1.3 ui-monospace, Menlo, monospace" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span className="text-muted">extraction_tier</span><span>{bestTier}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span className="text-muted">extraction_version</span><span>{flight.extraction_version}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span className="text-muted">confidence</span>
                <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>{Number(flight.confidence).toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span className="text-muted">merged_from</span>
                <span>{uniqueSources.length} email{uniqueSources.length === 1 ? "" : "s"}</span>
              </div>
            </div>
          </div>
          )}

          {/* Corrections are labelled examples of the extractor being wrong.
              A typed flight has no extraction to label — its edits are direct
              (above), and putting them in the eval dataset would poison it. */}
          {flight.source !== "manual" && (
          <Corrections flightId={flight.id} origin={flight.origin_iata} dest={flight.dest_iata} />
          )}
        </section>

        <section style={{ padding: "26px 24px", background: "var(--color-surface)" }}>
          <h6 style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 14 }}>
            Source {uniqueSources.length === 1 ? "email" : `emails · ${uniqueSources.length}`}
          </h6>
          {uniqueSources.length === 0 ? (
            <p style={{ fontSize: 13 }} className="text-muted">
              {flight.source === "manual"
                ? "There is no source email — you told us about this flight yourself."
                : "The source email metadata for this flight has been deleted. The flight itself survives — that is by design."}
            </p>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                {uniqueSources.map((s, i) => (
                  <span
                    key={s.id}
                    style={{
                      padding: "8px 11px", font: "600 11px/1 var(--font-body)",
                      background: i === 0 ? "var(--color-text)" : "transparent",
                      color: i === 0 ? "var(--color-bg)" : "color-mix(in srgb, var(--color-text) 60%, transparent)",
                      border: i === 0 ? "none" : "1px solid var(--color-divider)",
                      textTransform: "capitalize",
                    }}
                  >
                    {s.email_type.replace("_", "-")}
                  </span>
                ))}
              </div>
              <SourceEmail sourceId={uniqueSources[0]!.id} highlights={highlights} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
