"use client";

// Choosing one airport out of nine thousand. Settled in the picker ticket
// after three prototypes: a keyboard-first combobox whose dropdown opens on
// *your own* airports before you type, so the common case needs no typing and
// no network — while someone with no history just sees a list that fills in as
// they type, instead of an empty grid.
import { useEffect, useRef, useState } from "react";

export interface MyAirport {
  iata: string;
  name: string;
  municipality: string | null;
  /** How many of this person's flights touch it — the ranking signal. */
  count: number;
}

interface Hit {
  iata: string;
  name: string;
  municipality: string | null;
  iso_country: string;
  type: string | null;
}

interface Row extends Hit { count: number }

const place = (a: { municipality: string | null; name: string }) => a.municipality ?? a.name;

export function AirportPicker({
  label, value, onChange, mine, onPasteRoute, autoFocus,
}: {
  label: string;
  value: string | null;
  onChange: (iata: string | null) => void;
  mine: MyAirport[];
  /** A whole route pasted into this field ("VNO LHR") fills both ends. */
  onPasteRoute?: (origin: string, dest: string) => void;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [remote, setRemote] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const mineByCode = useRef(new Map(mine.map((m) => [m.iata, m])));

  useEffect(() => { mineByCode.current = new Map(mine.map((m) => [m.iata, m])); }, [mine]);

  const q = text.trim();

  // Your own airports, matched in the browser: no request, no waiting.
  const localMatches: Row[] = (() => {
    if (!q) return mine.map((m) => ({ ...m, iso_country: "", type: null }));
    const l = q.toLowerCase();
    return mine
      .filter((m) =>
        m.iata.toLowerCase().startsWith(l) ||
        m.municipality?.toLowerCase().startsWith(l) ||
        m.name.toLowerCase().includes(l))
      .map((m) => ({ ...m, iso_country: "", type: null }));
  })();

  // Everywhere else, from the server, only once there is something to search.
  useEffect(() => {
    if (!q) { setRemote([]); return; }
    let dead = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/airports?q=${encodeURIComponent(q)}`);
        const d = await r.json();
        if (!dead) setRemote(d.hits ?? []);
      } catch { if (!dead) setRemote([]); }
      finally { if (!dead) setLoading(false); }
    }, 140);
    return () => { dead = true; clearTimeout(t); setLoading(false); };
  }, [q]);

  // Your own always come first — an airport you have actually flown outranks a
  // same-named one on another continent, whatever the query matched on.
  const seen = new Set(localMatches.map((r) => r.iata));
  const rows: Row[] = [
    ...localMatches,
    ...remote.filter((h) => !seen.has(h.iata)).map((h) => ({ ...h, count: 0 })),
  ].slice(0, 8);

  const commit = (code: string, display?: string) => {
    onChange(code);
    setText(display ?? code);
    setOpen(false);
  };

  // Exactly one candidate is not a choice; confirming it buys nothing.
  useEffect(() => {
    if (!open || loading || !q || value) return;
    if (rows.length === 1 && q.length >= 3) {
      const only = rows[0]!;
      commit(only.iata, `${only.iata} · ${place(only)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, loading, q, open, value]);

  /** "VNO LHR", "VNO-LHR", "vno lhr" — a route pasted into one field. */
  const asRoute = (s: string): [string, string] | null => {
    const parts = s.toUpperCase().replace(/[^A-Z]+/g, " ").trim().split(" ");
    return parts.length === 2 && parts.every((p) => /^[A-Z]{3}$/.test(p))
      ? [parts[0]!, parts[1]!] : null;
  };

  return (
    <div ref={wrap} style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
      <h6 style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 6 }}>
        {label}
      </h6>
      <input
        autoFocus={autoFocus}
        value={text}
        placeholder="Code, city or airport"
        aria-label={label}
        role="combobox"
        aria-expanded={open}
        onChange={(e) => {
          const v = e.target.value;
          const route = onPasteRoute ? asRoute(v) : null;
          if (route) { onPasteRoute!(route[0], route[1]); setText(route[0]); setOpen(false); return; }
          setText(v); setOpen(true); setCursor(0); onChange(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Three letters typed blind and tabbed away is a complete answer;
          // it never needed the list.
          if (!value && /^[A-Za-z]{3}$/.test(q)) onChange(q.toUpperCase());
          setTimeout(() => setOpen(false), 140);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setOpen(false); return; }
          if (!open || !rows.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => (c + 1) % rows.length); }
          if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => (c - 1 + rows.length) % rows.length); }
          if (e.key === "Enter") {
            e.preventDefault();
            const r = rows[cursor];
            if (r) commit(r.iata, `${r.iata} · ${place(r)}`);
          }
        }}
        style={{
          width: "100%", font: "500 13px/1 var(--font-body)", padding: "9px 10px",
          border: `1.5px solid ${value ? "var(--color-accent)" : "var(--color-text)"}`,
          background: "var(--color-bg)", color: "inherit",
        }}
      />

      {open && rows.length > 0 && (
        <ul role="listbox" style={{
          position: "absolute", zIndex: 30, left: 0, right: 0, margin: 0, padding: 0,
          listStyle: "none", background: "var(--color-bg)",
          border: "1.5px solid var(--color-text)", borderTop: "none",
          maxHeight: 264, overflowY: "auto",
        }}>
          {!q && (
            <li style={{ padding: "6px 10px", borderBottom: "1px solid var(--color-divider)" }}>
              <h6 style={{ color: "color-mix(in srgb, var(--color-text) 45%, transparent)" }}>
                Airports you fly
              </h6>
            </li>
          )}
          {rows.map((r, i) => (
            <li key={r.iata}>
              <button
                type="button"
                role="option"
                aria-selected={i === cursor}
                onMouseDown={(e) => { e.preventDefault(); commit(r.iata, `${r.iata} · ${place(r)}`); }}
                onMouseEnter={() => setCursor(i)}
                style={{
                  display: "flex", width: "100%", gap: 10, alignItems: "baseline", textAlign: "left",
                  padding: "8px 10px", border: "none", cursor: "pointer",
                  borderBottom: "1px solid var(--color-divider)",
                  background: i === cursor ? "var(--color-neutral-200)" : "transparent",
                  color: "inherit",
                }}
              >
                <span style={{ font: "700 12px/1 var(--font-heading)", width: 34, flex: "none" }}>{r.iata}</span>
                <span style={{ font: "500 12px/1.25 var(--font-body)", flex: 1 }}>
                  {place(r)}
                  {r.iso_country && <span className="text-muted" style={{ fontSize: 10.5 }}> · {r.iso_country}</span>}
                </span>
                {r.count > 0 && (
                  <span style={{ font: "700 9px/1 var(--font-body)", letterSpacing: ".08em", color: "var(--color-accent)", flex: "none" }}>
                    {r.count}×
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && q !== "" && !loading && rows.length === 0 && (
        <div style={{
          position: "absolute", zIndex: 30, left: 0, right: 0, padding: "10px",
          background: "var(--color-bg)", border: "1.5px solid var(--color-text)", borderTop: "none",
          fontSize: 12,
        }} className="text-muted">
          Nothing matches “{q}”. Three-letter codes work too.
        </div>
      )}
    </div>
  );
}
