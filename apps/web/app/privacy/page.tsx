// The privacy page renders the same source as the permission screen and
// docs/privacy.md — the wireframe requires them to match word-for-word.
import Link from "next/link";
import {
  GMAIL_SCOPE, PRIVACY_ACTIONS, SCOPE_EXPLANATION, WE_NEVER_STORE, WE_STORE,
} from "@trailhead/domain";

export const metadata = { title: "Privacy · Trailhead" };

export default function Privacy() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 80px" }}>
      <div style={{ padding: "14px 0", borderBottom: "2px solid var(--color-text)" }}>
        <Link href="/" style={{ font: "800 13px/1 var(--font-heading)", color: "inherit", textDecoration: "none" }}>
          TRAILHEAD
        </Link>
      </div>

      <h1 style={{ marginTop: 34, maxWidth: "14em" }}>Trailhead reads flight emails. Nothing else.</h1>

      <section style={{ marginTop: 30 }}>
        <h6 style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>The permission we ask for</h6>
        <p style={{ marginTop: 10 }}>
          <code style={{ fontFamily: "ui-monospace, Menlo, monospace", background: "var(--color-neutral-200)", padding: "2px 6px" }}>
            {GMAIL_SCOPE}
          </code>
        </p>
        <p style={{ maxWidth: "40em" }}>{SCOPE_EXPLANATION}</p>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 24, borderTop: "2px solid var(--color-text)", paddingTop: 20 }} className="split">
        <div>
          <h6 style={{ color: "var(--color-accent)", marginBottom: 12 }}>We store</h6>
          {WE_STORE.map((t) => (
            <div key={t} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <span style={{ width: 8, height: 8, background: "var(--color-text)", flex: "none" }} />
              <span style={{ font: "500 12px/1.3 var(--font-body)" }}>{t}</span>
            </div>
          ))}
        </div>
        <div>
          <h6 style={{ color: "color-mix(in srgb, var(--color-text) 50%, transparent)", marginBottom: 12 }}>We never store</h6>
          {WE_NEVER_STORE.map((t) => (
            <div key={t} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <span style={{ width: 8, height: 8, border: "1.5px solid var(--color-neutral-500)", flex: "none" }} />
              <span style={{ font: "500 12px/1.3 var(--font-body)" }} className="text-muted">{t}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 36 }}>
        <h3>What you can delete</h3>
        <div style={{ borderTop: "2px solid var(--color-text)", marginTop: 14 }}>
          {PRIVACY_ACTIONS.map((a) => (
            <div key={a.id} style={{ padding: "16px 0", borderBottom: "1px solid var(--color-divider)" }}>
              <div style={{ font: "700 15px/1.2 var(--font-heading)" }}>{a.title}</div>
              <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 600 }}>{a.summary}</p>
              <p style={{ margin: "8px 0 0", fontSize: 13, maxWidth: "42em" }} className="text-muted">{a.consequence}</p>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 18, fontSize: 13 }} className="text-muted">
          All of these live in <Link href="/settings" style={{ color: "var(--color-accent)" }}>settings</Link>.
        </p>
      </section>
    </main>
  );
}
