"use client";

// The form for a flight we missed. Three fields are required — where from,
// where to, and when — because there is no flight *schedule* data anywhere in
// this system, so "LH710 on the 3rd" genuinely cannot be turned into a route.
// Everything else stays optional and stays empty: absence is information here
// exactly as it is for an extraction.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../../lib/supabase/client";
import { AirportPicker, type MyAirport } from "./AirportPicker";

export function AddFlight({ mine, count, showPrompt }: {
  mine: MyAirport[];
  count: number;
  /** Past ten typed flights and never asked before — see InterestPrompt. */
  showPrompt: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [origin, setOrigin] = useState<string | null>(null);
  const [dest, setDest] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [extra, setExtra] = useState({
    airline: "", flightNumber: "", depTime: "", arrTime: "", bookingRef: "",
  });
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const router = useRouter();

  // Reset the airports but keep the date: adding a return leg or a second
  // flight from the same trip is the common next action.
  const reset = () => {
    setOrigin(null); setDest(null);
    // Remount the pickers: nulling the value they report would leave the
    // airport still written in the box, which reads as filled but won't submit.
    setRound((r) => r + 1);
    setExtra({ airline: "", flightNumber: "", depTime: "", arrTime: "", bookingRef: "" });
  };

  async function submit() {
    setBusy(true); setError(null);
    const res = await fetch("/api/manual-flights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ origin, dest, date, ...extra }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(body.error ?? "Couldn't save that flight."); return; }
    setAdded(`${origin} → ${dest}`);
    reset();
    router.refresh();
  }

  if (!open) {
    return (
      <>
      <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--color-divider)", display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>Add a flight</button>
        <span style={{ fontSize: 12 }} className="text-muted">
          {count > 0
            ? `You've added ${count} flight${count === 1 ? "" : "s"} yourself.`
            : "Flights we missed, or that predate your mailbox."}
        </span>
      </div>
      {showPrompt && <InterestPrompt />}
      </>
    );
  }

  const ready = Boolean(origin && dest && date && origin !== dest);

  return (
    <div style={{ padding: "18px 24px 22px", borderBottom: "2px solid var(--color-text)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h6 style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Add a flight</h6>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setOpen(false); setAdded(null); }}>
          Close
        </button>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end", marginTop: 12 }}>
        <AirportPicker
          key={`from-${round}`}
          label="From" value={origin} onChange={setOrigin} mine={mine} autoFocus
          onPasteRoute={(a, b) => { setOrigin(a); setDest(b); }}
        />
        <AirportPicker key={`to-${round}`} label="To" value={dest} onChange={setDest} mine={mine} />
        <div>
          <h6 style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 6 }}>Date</h6>
          {/* The browser renders this in the reader's own locale, which is the
              whole reason it is a date input and not three text boxes. */}
          <input
            type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Departure date"
            style={{ font: "500 13px/1 var(--font-body)", padding: "8px 10px", border: "1.5px solid var(--color-text)", background: "var(--color-bg)", color: "inherit" }}
          />
        </div>
      </div>

      <button
        className="btn btn-ghost"
        style={{ fontSize: 12, marginTop: 14 }}
        onClick={() => setMore((m) => !m)}
      >
        {more ? "Fewer details" : "Add the airline, times or a booking reference"}
      </button>

      {more && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
          {([
            ["Airline", "airline", "LH", 60],
            ["Flight no.", "flightNumber", "710", 80],
            ["Departs", "depTime", "10:15", 90],
            ["Arrives", "arrTime", "12:40", 90],
            ["Booking ref", "bookingRef", "ABC123", 120],
          ] as const).map(([label, key, placeholder, width]) => (
            <div key={key}>
              <h6 style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 6 }}>{label}</h6>
              <input
                value={extra[key]} placeholder={placeholder} aria-label={label}
                onChange={(e) => setExtra((x) => ({ ...x, [key]: e.target.value }))}
                style={{ width, font: "500 13px/1 var(--font-body)", padding: "8px 10px", border: "1.5px solid var(--color-neutral-500)", background: "var(--color-bg)", color: "inherit" }}
              />
            </div>
          ))}
          <p style={{ flexBasis: "100%", fontSize: 11, margin: 0 }} className="text-muted">
            All optional. Left empty, they stay empty — we never guess a value you didn&rsquo;t give.
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 18, flexWrap: "wrap" }}>
        <button className="btn btn-primary" disabled={!ready || busy} onClick={submit}>
          {busy ? "Adding…" : "Add flight"}
        </button>
        {added && !error && (
          <span style={{ fontSize: 12.5 }} className="text-muted">
            Added <strong style={{ color: "var(--color-text)" }}>{added}</strong>. Your history and
            trips have been rebuilt around it.
          </span>
        )}
        {error && <span style={{ fontSize: 12.5, color: "var(--color-accent)" }}>{error}</span>}
      </div>
      {showPrompt && <InterestPrompt />}
    </div>
  );
}

/** Asked once, past ten typed flights — never a wall, never repeated. The
 *  answer is recorded server-side either way, so no device sees this twice.
 *  This is the counting-not-capping ticket's whole point: someone who typed
 *  eleven flights by hand is the most qualified paying signal the product
 *  can collect, and a cap would have truncated exactly this measurement. */
function InterestPrompt() {
  const [answered, setAnswered] = useState(false);
  const [busy, setBusy] = useState(false);

  async function answer(plan: "premium_interest" | "premium_not_now") {
    setBusy(true);
    await supabaseBrowser().rpc("choose_plan", {
      p_plan: plan, p_candidates: null, p_context: "manual_flights",
    });
    setAnswered(true);
  }

  if (answered) return null;
  return (
    <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--color-divider)", background: "var(--color-neutral-200)", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
      <p style={{ fontSize: 12.5, margin: 0, maxWidth: "40em" }}>
        You&rsquo;ve added more than ten flights by hand. Automatic re-import — new
        bookings appearing on their own — is something we&rsquo;re considering
        charging for. Nothing exists to buy yet.
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={busy} onClick={() => answer("premium_interest")}>
          Tell me when it exists
        </button>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={busy} onClick={() => answer("premium_not_now")}>
          Not for me
        </button>
      </div>
    </div>
  );
}
