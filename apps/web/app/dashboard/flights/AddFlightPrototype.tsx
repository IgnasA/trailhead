"use client";

/* PROTOTYPE — throwaway. Ticket: "Choosing an airport from nine thousand".
 *
 * Three structurally different answers to "how do you pick an airport", each
 * mounted inside the real Flights page so it is judged at real density.
 * Nothing here writes: choosing shows the payload the form would submit.
 *
 *   A — Type-ahead     one field per airport, dropdown, keyboard-first
 *   B — Yours first    your own airports as a grid; search only if you need it
 *   C — Route in one   type "VNO LHR" or "Vilnius to London", both at once
 */
import { useEffect, useMemo, useRef, useState } from "react";

interface Hit {
  iata: string;
  name: string;
  municipality: string | null;
  iso_country: string;
  mine: number;
}
export interface MyAirport { iata: string; name: string; municipality: string | null; count: number }

const useSearch = (q: string) => {
  const [hits, setHits] = useState<Hit[]>([]);
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    if (!q.trim()) { setHits([]); setMs(null); return; }
    let dead = false;
    const t = setTimeout(async () => {
      const started = performance.now();
      const r = await fetch(`/api/airports?q=${encodeURIComponent(q)}`);
      const d = await r.json();
      if (dead) return;
      setHits(d.hits ?? []);
      setMs(Math.round(performance.now() - started));
    }, 120);
    return () => { dead = true; clearTimeout(t); };
  }, [q]);
  return { hits, ms };
};

const label = (a: { iata: string; municipality: string | null; name: string }) =>
  `${a.iata} · ${a.municipality ?? a.name}`;

/* ── Shared chrome: the rest of the form, so the picker is judged in context ─ */
function FormShell({
  title, hint, children, origin, dest,
}: {
  title: string; hint: string; children: React.ReactNode;
  origin: string | null; dest: string | null;
}) {
  const [date, setDate] = useState("");
  return (
    <div style={{ borderBottom: "2px solid var(--color-text)", padding: "18px 24px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <h6 style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Add a flight</h6>
        <span style={{ font: "700 10px/1 var(--font-body)", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-accent)" }}>
          {title}
        </span>
      </div>
      <p style={{ fontSize: 12, margin: "6px 0 16px", maxWidth: "44em" }} className="text-muted">{hint}</p>

      {children}

      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", marginTop: 16, flexWrap: "wrap" }}>
        <div>
          <h6 style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 6 }}>Date</h6>
          {/* Browser renders this in the viewer's own locale — i18n for free. */}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            style={{ font: "500 13px/1 var(--font-body)", padding: "9px 10px", border: "1.5px solid var(--color-text)", background: "var(--color-bg)" }} />
        </div>
        <button className="btn btn-primary" disabled={!origin || !dest || !date}>Add flight</button>
        <code style={{ fontSize: 11, opacity: 0.65, fontFamily: "ui-monospace, Menlo, monospace" }}>
          {origin ?? "—"} → {dest ?? "—"} {date || "—"}
        </code>
      </div>
    </div>
  );
}

/* ── A. Type-ahead ─────────────────────────────────────────────────────────
   The conventional answer: one combobox per airport. Keyboard-first, and a
   bare code typed blind (VNO, Tab) never opens the list at all.            */
function Field({ what, value, onPick }: { what: string; value: string | null; onPick: (c: string | null) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const { hits, ms } = useSearch(q);
  const box = useRef<HTMLDivElement>(null);

  const choose = (h: Hit) => { onPick(h.iata); setQ(label(h)); setOpen(false); };

  return (
    <div ref={box} style={{ position: "relative", flex: "1 1 220px", minWidth: 200 }}>
      <h6 style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 6 }}>{what}</h6>
      <input
        value={q}
        placeholder="Code, city or airport"
        onChange={(e) => { setQ(e.target.value); setOpen(true); setCursor(0); onPick(null); }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // A bare code typed blind is a complete answer on its own.
          if (/^[A-Za-z]{3}$/.test(q.trim())) onPick(q.trim().toUpperCase());
          setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (!open || !hits.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => (c + 1) % hits.length); }
          if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => (c - 1 + hits.length) % hits.length); }
          if (e.key === "Enter") { e.preventDefault(); choose(hits[cursor]!); }
          if (e.key === "Escape") setOpen(false);
        }}
        style={{
          width: "100%", font: "500 13px/1 var(--font-body)", padding: "9px 10px",
          border: `1.5px solid ${value ? "var(--color-accent)" : "var(--color-text)"}`,
          background: "var(--color-bg)",
        }}
      />
      {open && q.trim() !== "" && (
        <div style={{ position: "absolute", zIndex: 20, left: 0, right: 0, background: "var(--color-bg)", border: "1.5px solid var(--color-text)", borderTop: "none" }}>
          {hits.map((h, i) => (
            <button
              key={h.iata}
              onMouseDown={(e) => { e.preventDefault(); choose(h); }}
              onMouseEnter={() => setCursor(i)}
              style={{
                display: "flex", width: "100%", gap: 10, alignItems: "baseline", textAlign: "left",
                padding: "8px 10px", border: "none", cursor: "pointer",
                borderBottom: "1px solid var(--color-divider)",
                background: i === cursor ? "var(--color-neutral-200)" : "transparent",
              }}
            >
              <span style={{ font: "700 12px/1 var(--font-heading)", width: 34 }}>{h.iata}</span>
              <span style={{ font: "500 12px/1.2 var(--font-body)", flex: 1 }}>
                {h.municipality ?? h.name}
                <span className="text-muted" style={{ fontSize: 10.5 }}> · {h.iso_country}</span>
              </span>
              {h.mine > 0 && (
                <span style={{ font: "700 9px/1 var(--font-body)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-accent)" }}>
                  {h.mine}×
                </span>
              )}
            </button>
          ))}
          {!hits.length && (
            <div style={{ padding: "10px", fontSize: 12 }} className="text-muted">
              Nothing matches “{q}”. Codes work too — try VNO.
            </div>
          )}
          {ms !== null && (
            <div style={{ padding: "4px 10px", fontSize: 9.5, textAlign: "right" }} className="text-muted">{ms}ms</div>
          )}
        </div>
      )}
    </div>
  );
}

export function VariantA() {
  const [origin, setOrigin] = useState<string | null>(null);
  const [dest, setDest] = useState<string | null>(null);
  return (
    <FormShell title="A · Type-ahead" origin={origin} dest={dest}
      hint="One field per airport. Search by code, city or airport name; your own airports are marked. Typing three letters and tabbing away works without ever opening the list.">
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Field what="From" value={origin} onPick={setOrigin} />
        <Field what="To" value={dest} onPick={setDest} />
      </div>
    </FormShell>
  );
}

/* ── B. Yours first ────────────────────────────────────────────────────────
   Bets that a flight you are adding almost always touches an airport you
   already use. No typing at all in the common case; search is the escape
   hatch, not the entrance.                                                 */
export function VariantB({ mine }: { mine: MyAirport[] }) {
  const [origin, setOrigin] = useState<string | null>(null);
  const [dest, setDest] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const { hits } = useSearch(q);

  const target: "origin" | "dest" = origin && !dest ? "dest" : "origin";
  const set = (code: string) => {
    if (target === "origin") { setOrigin(code); setDest(null); } else setDest(code);
    setSearching(false); setQ("");
  };
  const max = Math.max(1, ...mine.map((m) => m.count));

  return (
    <FormShell title="B · Yours first" origin={origin} dest={dest}
      hint={`The ${mine.length} airports you already fly, biggest first. Tap one for departure, then one for arrival. Anywhere else is behind “Search everywhere”.`}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {mine.map((a) => {
          const picked = a.iata === origin || a.iata === dest;
          return (
            <button key={a.iata} onClick={() => set(a.iata)} title={`${a.name} — ${a.count} flights`}
              style={{
                font: `700 ${11 + Math.round((a.count / max) * 5)}px/1 var(--font-heading)`,
                padding: "8px 10px", cursor: "pointer",
                border: "1.5px solid var(--color-text)",
                background: picked ? "var(--color-accent)" : "var(--color-bg)",
                color: picked ? "#fff" : "inherit",
              }}>
              {a.iata}
              {a.iata === origin && <span style={{ fontSize: 9, marginLeft: 4 }}>FROM</span>}
              {a.iata === dest && <span style={{ fontSize: 9, marginLeft: 4 }}>TO</span>}
            </button>
          );
        })}
        <button onClick={() => setSearching((s) => !s)}
          style={{ font: "500 11.5px/1 var(--font-body)", padding: "8px 10px", cursor: "pointer", border: "1.5px dashed var(--color-neutral-500)", background: "transparent" }}>
          Search everywhere →
        </button>
      </div>
      {searching && (
        <div style={{ marginTop: 12 }}>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={`Find an airport for ${target === "origin" ? "departure" : "arrival"}`}
            style={{ width: "100%", maxWidth: 380, font: "500 13px/1 var(--font-body)", padding: "9px 10px", border: "1.5px solid var(--color-text)", background: "var(--color-bg)" }} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {hits.map((h) => (
              <button key={h.iata} onClick={() => set(h.iata)}
                style={{ font: "500 11.5px/1 var(--font-body)", padding: "7px 9px", cursor: "pointer", border: "1px solid var(--color-neutral-500)", background: "var(--color-bg)" }}>
                <strong>{h.iata}</strong> {h.municipality ?? h.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <p style={{ fontSize: 11, marginTop: 12 }} className="text-muted">
        Next tap sets <strong>{target === "origin" ? "departure" : "arrival"}</strong>.
      </p>
    </FormShell>
  );
}

/* ── C. The whole route in one field ───────────────────────────────────────
   Removes the picker entirely for anyone who knows codes. "VNO LHR" is two
   airports and one keystroke of punctuation. Ambiguity is resolved by
   offering the candidates, never by guessing.                              */
export function VariantC() {
  const [raw, setRaw] = useState("");
  const [pick, setPick] = useState<{ origin: string | null; dest: string | null }>({ origin: null, dest: null });

  const parts = useMemo(() => {
    const cleaned = raw.replace(/\s+to\s+/i, " ").replace(/[–—>-]+/g, " ");
    return cleaned.split(/\s+/).filter(Boolean);
  }, [raw]);

  const codes = parts.every((p) => /^[A-Za-z]{3}$/.test(p)) && parts.length === 2
    ? parts.map((p) => p.toUpperCase()) : null;

  const { hits: aHits } = useSearch(!codes && parts[0] ? parts[0] : "");
  const { hits: bHits } = useSearch(!codes && parts[1] ? parts[1] : "");

  const origin = codes ? codes[0]! : pick.origin;
  const dest = codes ? codes[1]! : pick.dest;

  return (
    <FormShell title="C · Route in one field" origin={origin} dest={dest}
      hint="Type the whole route at once — “VNO LHR”, “VNO-LHR”, or “Vilnius to London”. Two codes are taken as given; anything ambiguous offers the candidates rather than choosing for you.">
      <input autoFocus value={raw} onChange={(e) => { setRaw(e.target.value); setPick({ origin: null, dest: null }); }}
        placeholder="VNO LHR"
        style={{ width: "100%", maxWidth: 520, font: "700 22px/1.1 var(--font-heading)", letterSpacing: ".02em", padding: "12px 12px", border: "1.5px solid var(--color-text)", background: "var(--color-bg)" }} />
      {codes && (
        <p style={{ fontSize: 12, marginTop: 10 }} className="text-muted">
          Read as <strong>{codes[0]}</strong> → <strong>{codes[1]}</strong>. Nothing to disambiguate.
        </p>
      )}
      {!codes && parts.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 14 }} className="split">
          {([["From", parts[0], aHits, pick.origin, (c: string) => setPick((p) => ({ ...p, origin: c }))],
             ["To", parts[1], bHits, pick.dest, (c: string) => setPick((p) => ({ ...p, dest: c }))]] as const).map(
            ([what, term, list, chosen, choose]) => (
              <div key={what}>
                <h6 style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 8 }}>
                  {what}{term ? ` — “${term}”` : ""}
                </h6>
                {!term && <p style={{ fontSize: 12 }} className="text-muted">Waiting for the second half.</p>}
                {list.slice(0, 5).map((h) => (
                  <button key={h.iata} onClick={() => choose(h.iata)}
                    style={{
                      display: "flex", width: "100%", gap: 10, textAlign: "left", padding: "7px 8px", cursor: "pointer",
                      border: "none", borderBottom: "1px solid var(--color-divider)",
                      background: chosen === h.iata ? "var(--color-accent)" : "transparent",
                      color: chosen === h.iata ? "#fff" : "inherit",
                    }}>
                    <span style={{ font: "700 12px/1 var(--font-heading)", width: 34 }}>{h.iata}</span>
                    <span style={{ font: "500 12px/1.2 var(--font-body)" }}>{h.municipality ?? h.name}</span>
                  </button>
                ))}
              </div>
            ))}
        </div>
      )}
    </FormShell>
  );
}
