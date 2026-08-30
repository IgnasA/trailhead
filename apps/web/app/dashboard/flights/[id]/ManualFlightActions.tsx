"use client";

// Changing or removing a flight you typed in. Your input, your buttons — no
// Correction event is recorded, because there is no extraction to label as
// wrong, and typed edits in the eval dataset would poison it.
//
// Both actions finish on the flights list, not here: a rebuild regenerates
// every derived flight's id, so after either one this page's address no longer
// names anything.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AirportPicker, type MyAirport } from "../AirportPicker";

export interface ManualRow {
  id: string;
  origin_iata: string;
  dest_iata: string;
  departure_date: string;
  airline_iata: string | null;
  flight_number: string | null;
  dep_local_time: string | null;
  arr_local_time: string | null;
  booking_ref: string | null;
}

export function ManualFlightActions({
  manual, mine, corroborated,
}: {
  manual: ManualRow;
  mine: MyAirport[];
  /** Emails also evidence this flight, so removing your entry won't remove it. */
  corroborated: boolean;
}) {
  const [mode, setMode] = useState<"idle" | "edit" | "confirm-delete">("idle");
  const [origin, setOrigin] = useState<string | null>(manual.origin_iata);
  const [dest, setDest] = useState<string | null>(manual.dest_iata);
  const [date, setDate] = useState(manual.departure_date);
  const [extra, setExtra] = useState({
    airline: manual.airline_iata ?? "",
    flightNumber: manual.flight_number ?? "",
    depTime: manual.dep_local_time ?? "",
    arrTime: manual.arr_local_time ?? "",
    bookingRef: manual.booking_ref ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function call(method: "PATCH" | "DELETE", body: object) {
    setBusy(true); setError(null);
    const res = await fetch("/api/manual-flights", {
      method, headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "That didn't work."); return; }
    router.push("/dashboard/flights");
    router.refresh();
  }

  if (mode === "idle") {
    return (
      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setMode("edit")}>
          Edit this flight
        </button>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setMode("confirm-delete")}>
          Remove it
        </button>
      </div>
    );
  }

  if (mode === "confirm-delete") {
    return (
      <div style={{ marginTop: 14, borderLeft: "2px solid var(--color-accent)", padding: "12px 14px", background: "var(--color-neutral-200)" }}>
        <p style={{ fontSize: 12.5, margin: 0, maxWidth: "40em" }}>
          {corroborated
            ? "Your entry goes, but the flight stays — your emails also record it, and the rebuild will keep what they say."
            : "This flight exists only because you typed it. Removing it cannot be undone, and your trips are rebuilt without it."}
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button className="btn btn-primary" disabled={busy} onClick={() => call("DELETE", { id: manual.id })}>
            {busy ? "Removing…" : "Remove this flight"}
          </button>
          <button className="btn btn-ghost" onClick={() => setMode("idle")} disabled={busy}>Keep it</button>
          {error && <span style={{ fontSize: 12.5, color: "var(--color-accent)" }}>{error}</span>}
        </div>
      </div>
    );
  }

  const ready = Boolean(origin && dest && date && origin !== dest);
  return (
    <div style={{ marginTop: 14, borderTop: "1px solid var(--color-divider)", paddingTop: 14 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        <AirportPicker label="From" value={origin} onChange={setOrigin} mine={mine}
          onPasteRoute={(a, b) => { setOrigin(a); setDest(b); }} />
        <AirportPicker label="To" value={dest} onChange={setDest} mine={mine} />
        <div>
          <h6 style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 6 }}>Date</h6>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Departure date"
            style={{ font: "500 13px/1 var(--font-body)", padding: "8px 10px", border: "1.5px solid var(--color-text)", background: "var(--color-bg)", color: "inherit" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        {([
          ["Airline", "airline", 60], ["Flight no.", "flightNumber", 80],
          ["Departs", "depTime", 90], ["Arrives", "arrTime", 90], ["Booking ref", "bookingRef", 120],
        ] as const).map(([label, key, width]) => (
          <div key={key}>
            <h6 style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 6 }}>{label}</h6>
            <input value={extra[key]} aria-label={label}
              onChange={(e) => setExtra((x) => ({ ...x, [key]: e.target.value }))}
              style={{ width, font: "500 13px/1 var(--font-body)", padding: "8px 10px", border: "1.5px solid var(--color-neutral-500)", background: "var(--color-bg)", color: "inherit" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
        <button className="btn btn-primary" disabled={!ready || busy}
          onClick={() => call("PATCH", { id: manual.id, origin, dest, date, ...extra })}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button className="btn btn-ghost" onClick={() => setMode("idle")} disabled={busy}>Cancel</button>
        {error && <span style={{ fontSize: 12.5, color: "var(--color-accent)" }}>{error}</span>}
      </div>
    </div>
  );
}
