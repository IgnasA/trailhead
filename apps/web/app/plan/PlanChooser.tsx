"use client";

// Step 2 of 2, straight after the Gmail grant: what we found in the mailbox,
// and which plan to go with. Premium is an expression of interest — there is
// no billing, and nothing here collects payment details. The brief (§36) says
// willingness to pay is the signal worth measuring before building any.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "../../lib/supabase/client";

const FREE = [
  "Your full flight history, however far back it goes",
  "Trips reconstructed from your flights",
  "The world map and every statistic",
  "Provenance on every flight, and the original email on demand",
  "Add flights we missed, or that predate your mailbox",
];

const PREMIUM = [
  "Automatic re-import as new bookings arrive",
  "Spending analysis across your history",
  "Your year, wrapped, every January",
  "Hotels and trains, once they exist",
];

export function PlanChooser({ mailbox }: { mailbox: string }) {
  const [candidates, setCandidates] = useState<number | null>(null);
  const [scanError, setScanError] = useState(false);
  const [busy, setBusy] = useState<"free" | "premium" | null>(null);
  const [interest, setInterest] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/scan")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { candidates: number }) => !cancelled && setCandidates(d.candidates))
      .catch(() => !cancelled && setScanError(true));
    return () => { cancelled = true; };
  }, []);

  async function choose(plan: "free" | "premium_interest") {
    setBusy(plan === "free" ? "free" : "premium");
    const supabase = supabaseBrowser();
    await supabase.rpc("choose_plan", { p_plan: plan, p_candidates: candidates });
    if (plan === "free") {
      await supabase.rpc("start_import");
      router.push("/import");
      return;
    }
    setInterest(true);
    setBusy(null);
  }

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "0 24px 80px" }}>
      <div style={{ padding: "14px 0", borderBottom: "2px solid var(--color-text)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <Link href="/" style={{ font: "800 13px/1 var(--font-heading)", color: "inherit", textDecoration: "none" }}>
          TRAILHEAD
        </Link>
        <span style={{ fontSize: 11 }} className="text-muted">Step 2 of 2</span>
      </div>

      <section style={{ padding: "34px 0 26px", borderBottom: "2px solid var(--color-text)" }}>
        <h6 style={{ color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>
          {mailbox} is connected
        </h6>
        {candidates === null && !scanError && (
          <h2 style={{ marginTop: 14, color: "color-mix(in srgb, var(--color-text) 45%, transparent)" }}>
            Looking through your mailbox…
          </h2>
        )}
        {scanError && (
          <h2 style={{ marginTop: 14, maxWidth: "16em" }}>
            We couldn&rsquo;t count your emails, but the import will still work.
          </h2>
        )}
        {candidates !== null && (
          <>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 800, fontSize: "clamp(56px,10vw,96px)", lineHeight: 0.9, letterSpacing: "-.04em" }}>
                {candidates.toLocaleString()}
              </div>
              <div style={{ font: "700 20px/1 var(--font-heading)", paddingBottom: 10 }}>
                emails look like flight mail
              </div>
            </div>
            <p style={{ maxWidth: "38em", marginTop: 14, fontSize: 14 }} className="text-muted">
              That&rsquo;s the search result, not a promise — plenty will turn out to be
              fare alerts and newsletters. Reading them takes roughly{" "}
              {Math.max(2, Math.round(candidates / 45))}&nbsp;minutes, and you can close
              the tab while it runs.
            </p>
          </>
        )}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }} className="split">
        <div style={{ padding: "26px 24px 26px 0", borderRight: "2px solid var(--color-text)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <h3 style={{ margin: 0 }}>Free</h3>
            <span style={{ font: "700 11px/1 var(--font-body)", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-accent)" }}>
              Everything built so far
            </span>
          </div>
          <p style={{ font: "800 32px/1 var(--font-heading)", margin: "14px 0 4px" }}>€0</p>
          <p style={{ fontSize: 12 }} className="text-muted">No card, no trial, no expiry.</p>
          <div style={{ borderTop: "1px solid var(--color-divider)", marginTop: 18 }}>
            {FREE.map((f) => (
              <div key={f} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--color-divider)", fontSize: 13 }}>
                <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>✓</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => choose("free")} disabled={busy !== null}>
            {busy === "free" ? "Starting…" : "Import my history"}
          </button>
        </div>

        <div style={{ padding: "26px 0 26px 24px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <h3 style={{ margin: 0 }}>Premium</h3>
            <span style={{ font: "700 11px/1 var(--font-body)", letterSpacing: ".1em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>
              Not built yet
            </span>
          </div>
          <p style={{ font: "800 32px/1 var(--font-heading)", margin: "14px 0 4px", color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
            €30<span style={{ fontSize: 16, fontWeight: 600 }}>/year</span>
          </p>
          <p style={{ fontSize: 12 }} className="text-muted">
            The price we&rsquo;re considering. Nothing to pay today.
          </p>
          <div style={{ borderTop: "1px solid var(--color-divider)", marginTop: 18 }}>
            {PREMIUM.map((f) => (
              <div key={f} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--color-divider)", fontSize: 13 }} className="text-muted">
                <span>·</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
          {interest ? (
            <p style={{ marginTop: 20, fontSize: 13, padding: "12px 14px", borderLeft: "2px solid var(--color-accent)", background: "var(--color-accent-100)" }}>
              Noted — thank you. That&rsquo;s a vote for building it, not a charge.
              Your import is still free; start it on the left.
            </p>
          ) : (
            <button className="btn btn-secondary" style={{ marginTop: 20 }} onClick={() => choose("premium_interest")} disabled={busy !== null}>
              {busy === "premium" ? "Noting…" : "I'd pay for that"}
            </button>
          )}
          <p style={{ fontSize: 11, marginTop: 14 }} className="text-muted">
            This records interest only. We never ask for payment details in the app.
          </p>
        </div>
      </section>
    </main>
  );
}
