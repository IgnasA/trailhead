"use client";

// The source email is fetched on demand and held only in this component's
// state — never stored, never cached. Extracted values are highlighted in
// place, which is the "why did you think this" answer without reading.
import { useState } from "react";

interface Loaded {
  subject: string;
  from: string;
  receivedAt: string | null;
  body: string;
}

export function SourceEmail({ sourceId, highlights }: { sourceId: string; highlights: string[] }) {
  const [state, setState] = useState<"idle" | "loading" | "error" | "loaded">("idle");
  const [email, setEmail] = useState<Loaded | null>(null);
  const [detail, setDetail] = useState<string>("");

  async function load() {
    setState("loading");
    const res = await fetch(`/api/source-email/${sourceId}`);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
      setDetail(
        body.error === "not_configured"
          ? "Live source fetch isn't configured on this server yet."
          : body.error === "no_token"
            ? "Gmail isn't connected any more, so the original can't be fetched."
            : "Gmail wouldn't return this message.",
      );
      setState("error");
      return;
    }
    setEmail((await res.json()) as Loaded);
    setState("loaded");
  }

  if (state === "idle" || state === "loading") {
    return (
      <div>
        <button className="btn btn-secondary" onClick={load} disabled={state === "loading"}>
          {state === "loading" ? "Fetching from Gmail…" : "View source email"}
        </button>
        <p style={{ fontSize: 11.5, marginTop: 12 }} className="text-muted">
          Fetched live from Gmail when you ask. We don&rsquo;t keep the body — close this and it&rsquo;s gone.
        </p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div>
        <p style={{ fontSize: 13 }} className="text-muted">{detail}</p>
        <button className="btn btn-secondary" onClick={load} style={{ marginTop: 10 }}>Try again</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: "var(--color-bg)", border: "1px solid var(--color-divider)", padding: 16 }}>
        <div style={{ font: "700 12px/1.3 var(--font-heading)" }}>{email!.subject}</div>
        <div style={{ font: "500 10.5px/1 var(--font-body)", marginTop: 6 }} className="text-muted">
          {email!.from}
          {email!.receivedAt ? ` · ${email!.receivedAt.slice(0, 10)}` : ""}
        </div>
        <div style={{ borderTop: "1px solid var(--color-divider)", marginTop: 12, paddingTop: 12, maxHeight: 320, overflowY: "auto", font: "400 11.5px/1.6 var(--font-body)", whiteSpace: "pre-wrap" }}>
          <Highlighted text={email!.body} terms={highlights} />
        </div>
      </div>
      <button
        className="btn btn-ghost"
        onClick={() => { setEmail(null); setState("idle"); }}
        style={{ marginTop: 10 }}
      >
        Close and discard
      </button>
    </div>
  );
}

/** Highlight the values we extracted, re-matched on fetch (extraction ticket:
 *  cheaper than storing character offsets, and good enough). */
function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  const clean = terms.filter((t) => t && t.length > 1).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (clean.length === 0) return <>{text}</>;
  const parts = text.split(new RegExp(`(${clean.join("|")})`, "gi"));
  const hit = new Set(terms.map((t) => t.toLowerCase()));
  return (
    <>
      {parts.map((part, i) =>
        hit.has(part.toLowerCase()) ? (
          <mark key={i} style={{ background: "var(--color-accent-200)", border: "1px solid var(--color-accent)", padding: "1px 4px", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5 }}>
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
